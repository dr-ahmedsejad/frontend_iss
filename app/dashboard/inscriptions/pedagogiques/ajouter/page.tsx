'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Search, Save } from 'lucide-react';
import { inscriptionsAdminApi, inscriptionsPedaApi } from '@/lib/api/inscriptions';
import { semestresApi } from '@/lib/api/scolarite';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { canAccess } from '@/lib/auth';
import type { InscriptionAdministrative } from '@/types/inscriptions';
import type { Semestre } from '@/types/scolarite';

// ── Contenu principal (lit les searchParams) ────────────────────────────────────
function AjouterInscriptionPedaContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const toast        = useToast();

  const prefilledAdminId = searchParams.get('inscription_admin');

  // Sélection de l'inscription administrative
  const [adminQuery, setAdminQuery]     = useState('');
  const [adminResults, setAdminResults] = useState<InscriptionAdministrative[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<InscriptionAdministrative | null>(null);
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  // Semestres
  const [semestres, setSemestres] = useState<Semestre[]>([]);
  const [selectedSemestre, setSelectedSemestre] = useState('');

  // Flags
  const [estRedoublant, setEstRedoublant] = useState(false);
  const [estDette, setEstDette]           = useState(false);

  // Soumission
  const [saving, setSaving] = useState(false);

  const canEdit = canAccess('inscriptions', 'modifier');

  // Charger l'inscription pré-remplie si ?inscription_admin= fourni
  useEffect(() => {
    if (!prefilledAdminId || isNaN(Number(prefilledAdminId))) return;
    inscriptionsAdminApi.get(Number(prefilledAdminId))
      .then(setSelectedAdmin)
      .catch(() => {});
  }, [prefilledAdminId]);

  // Charger les semestres quand on a une inscription sélectionnée
  useEffect(() => {
    if (!selectedAdmin) { setSemestres([]); setSelectedSemestre(''); return; }
    semestresApi.byFiliere(selectedAdmin.filiere)
      .then(setSemestres)
      .catch(() => semestresApi.all().then(setSemestres).catch(() => {}));
  }, [selectedAdmin]);

  // Recherche d'inscriptions administratives
  const searchAdmin = useCallback(async (q: string) => {
    if (!q.trim()) { setAdminResults([]); return; }
    setLoadingAdmin(true);
    try {
      const r = await inscriptionsAdminApi.list({ search: q, page_size: 10 });
      setAdminResults(r.results);
    } catch { setAdminResults([]); }
    finally { setLoadingAdmin(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchAdmin(adminQuery), 300);
    return () => clearTimeout(t);
  }, [adminQuery, searchAdmin]);

  function selectAdmin(a: InscriptionAdministrative) {
    setSelectedAdmin(a);
    setAdminResults([]);
    setAdminQuery('');
    setSelectedSemestre('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAdmin || !selectedSemestre) return;
    setSaving(true);
    try {
      const created = await inscriptionsPedaApi.create({
        inscription_admin: selectedAdmin.id,
        semestre:          Number(selectedSemestre),
        est_redoublant:    estRedoublant,
        est_dette:         estDette,
      });
      toast.success('Inscription pédagogique créée');
      router.push(`/dashboard/inscriptions/pedagogiques/${created.id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  }

  if (!canEdit) {
    return (
      <div className="p-6 text-iss-gray text-sm">
        Vous n'avez pas les droits pour créer une inscription pédagogique.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/inscriptions/pedagogiques"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
          <BookOpen size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Nouvelle inscription pédagogique</h1>
          <p className="text-sm text-iss-gray">Inscrire un étudiant à un semestre</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Recherche inscription administrative */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-iss-dark">1. Étudiant (inscription administrative)</h2>

          {selectedAdmin ? (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div>
                <p className="font-semibold text-iss-dark text-sm">{selectedAdmin.etudiant_nom}</p>
                <p className="text-xs text-iss-gray font-mono">
                  {selectedAdmin.etudiant_matricule} — {selectedAdmin.filiere_nom} — N{selectedAdmin.niveau}
                </p>
              </div>
              {!prefilledAdminId && (
                <button type="button"
                  onClick={() => { setSelectedAdmin(null); setSemestres([]); }}
                  className="text-xs text-red-500 hover:underline ml-4">
                  Changer
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray" />
              <input
                type="text"
                placeholder="Rechercher par nom ou matricule…"
                value={adminQuery}
                onChange={e => setAdminQuery(e.target.value)}
                className="w-full border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40"
              />
              {(adminResults.length > 0 || loadingAdmin) && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                  {loadingAdmin && (
                    <div className="px-4 py-2 text-xs text-iss-gray">Recherche…</div>
                  )}
                  {adminResults.map(a => (
                    <button key={a.id} type="button"
                      onClick={() => selectAdmin(a)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                      <p className="text-sm font-semibold text-iss-dark">{a.etudiant_nom}</p>
                      <p className="text-xs text-iss-gray">{a.etudiant_matricule} — {a.filiere_nom}</p>
                    </button>
                  ))}
                  {!loadingAdmin && adminResults.length === 0 && adminQuery && (
                    <div className="px-4 py-2 text-xs text-iss-gray">Aucun résultat</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sélection semestre */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-iss-dark">2. Semestre</h2>
          <select
            value={selectedSemestre}
            onChange={e => setSelectedSemestre(e.target.value)}
            disabled={!selectedAdmin}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#006633]/40 disabled:opacity-50"
          >
            <option value="">
              {selectedAdmin ? 'Sélectionner un semestre…' : 'Sélectionnez d\'abord un étudiant'}
            </option>
            {semestres.map(s => (
              <option key={s.id} value={String(s.id)}>
                {s.code_semestre}{s.semestre ? ` — ${s.semestre}` : ''}
              </option>
            ))}
          </select>
          {selectedAdmin && semestres.length === 0 && (
            <p className="text-xs text-amber-600">Aucun semestre disponible pour cette filière.</p>
          )}
        </div>

        {/* Options */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-iss-dark">3. Options</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={estRedoublant} onChange={e => setEstRedoublant(e.target.checked)}
              className="w-4 h-4 rounded accent-[#006633]" />
            <span className="text-sm text-slate-700">Étudiant redoublant</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={estDette} onChange={e => setEstDette(e.target.checked)}
              className="w-4 h-4 rounded accent-[#006633]" />
            <span className="text-sm text-slate-700">Inscription en dette</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link href="/dashboard/inscriptions/pedagogiques"
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50 text-center transition-colors">
            Annuler
          </Link>
          <button
            type="submit"
            disabled={saving || !selectedAdmin || !selectedSemestre}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
          >
            <Save size={15} />
            {saving ? 'Enregistrement…' : 'Créer l\'inscription'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Export avec Suspense pour useSearchParams ────────────────────────────────────
export default function AjouterInscriptionPedaPage() {
  return (
    <Suspense fallback={<div className="p-6 text-iss-gray text-sm">Chargement…</div>}>
      <AjouterInscriptionPedaContent />
    </Suspense>
  );
}
