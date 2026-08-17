'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Loader2, AlertCircle, Check, CheckCircle,
  Users, Search,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { bulkPresences } from '@/lib/api/absences';
import { StatutPresence } from '@/types/absences';
import type { Etudiant } from '@/types/absences';

interface SuivieDetail {
  id: number;
  jour_label: string | null;
  creneau_label: string | null;
  type_seance_label: string | null;
  prof_nom: string | null;
  em_intitule: string | null;
  salle_nom: string | null;
  dept_nom?: string | null;
  departement: number | null;
  numero_semaine: number;
}

function PointageSalleContent() {
  const { suiviId }  = useParams<{ suiviId: string }>();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const depIdParam   = searchParams.get('depId'); // passé depuis salle/page.tsx
  const user = getStoredUser();
  const annee = user?.annee_universitaire ?? '';

  const [statuts, setStatuts] = useState<Map<number, StatutPresence>>(new Map());
  const [query,   setQuery]   = useState('');
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  /* ─── Détail séance ── */
  const suiviQuery = useQuery({
    queryKey: ['suivi', 'suivies', 'detail', suiviId] as const,
    queryFn:  () => apiFetch<SuivieDetail>(`/api/v1/suivi/suivies/${suiviId}/`),
    enabled:  !!suiviId && !!annee,
  });
  const suivi = suiviQuery.data ?? null;

  /* ─── Résolution département ── */
  const depId = useMemo(() => {
    if (depIdParam) return depIdParam;
    if (suivi?.departement != null) return String(suivi.departement);
    return null;
  }, [depIdParam, suivi]);

  /* ─── Étudiants du département ── */
  const etudiantsQuery = useQuery({
    queryKey: ['absences', 'etudiants', { departement: depId }] as const,
    queryFn:  async () => {
      const res = await apiFetch<{ results: Etudiant[] } | Etudiant[]>(
        `/api/v1/absences/etudiants/?departement=${depId}&page_size=500`,
      );
      return Array.isArray(res) ? res : res.results;
    },
    enabled: !!depId,
  });
  const etudiants = useMemo(() => etudiantsQuery.data ?? [], [etudiantsQuery.data]);

  // Initialise statuts à "Présent" quand la liste arrive
  useEffect(() => {
    if (etudiants.length === 0) return;
    const map = new Map<number, StatutPresence>();
    etudiants.forEach(e => map.set(e.id, StatutPresence.Present));
    setStatuts(map);
  }, [etudiants]);

  const loading = suiviQuery.isLoading || etudiantsQuery.isLoading;
  const queryError = suiviQuery.error || etudiantsQuery.error;
  useEffect(() => {
    if (queryError) setError(queryError instanceof Error ? queryError.message : 'Erreur de chargement.');
  }, [queryError]);

  /* ─── Toggle étudiant ── */
  function toggle(etuId: number) {
    setStatuts(prev => {
      const cur = prev.get(etuId) ?? StatutPresence.Present;
      const next = cur === StatutPresence.Present ? StatutPresence.Absent : StatutPresence.Present;
      return new Map(prev).set(etuId, next);
    });
  }

  /* ─── Statistiques ── */
  const nbPresents = [...statuts.values()].filter(s => s === StatutPresence.Present).length;
  const nbAbsents  = [...statuts.values()].filter(s => s === StatutPresence.Absent).length;

  /* ─── Filtrage par recherche ── */
  const filtered = query.trim().length > 0
    ? etudiants.filter(e =>
        e.nom.toLowerCase().includes(query.toLowerCase()) ||
        e.matricule.toLowerCase().includes(query.toLowerCase()),
      )
    : etudiants;

  /* ─── Validation ── */
  const qc = useQueryClient();
  const validateMut = useMutation({
    mutationFn: () => bulkPresences({
      suivi_id: Number(suiviId),
      presences: etudiants.map(etu => ({
        etudiant_id: etu.id,
        statut: statuts.get(etu.id) ?? StatutPresence.Present,
        commentaire: '',
      })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['absences'] });
      setSaved(true);
      setTimeout(() => router.push('/dashboard/absences/saisir/salle'), 2000);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Erreur lors de la validation.');
    },
  });
  const saving = validateMut.isPending;

  function handleValidate() {
    if (!suiviId) return;
    setError(null);
    validateMut.mutate();
  }

  /* ─── Écran succès ── */
  if (saved) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(0,102,51,0.12)' }}>
            <CheckCircle size={40} className="text-[#006633]" />
          </div>
          <p className="text-xl font-bold text-gray-900">Séance validée !</p>
          <p className="text-sm text-gray-500 mt-2">{nbPresents} présent(s) · {nbAbsents} absent(s)</p>
          <p className="text-xs text-gray-400 mt-1">Redirection en cours…</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header sticky */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()}
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">
              {suivi?.em_intitule || 'Séance'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {suivi?.type_seance_label || ''} · {suivi?.creneau_label || ''} · {suivi?.prof_nom || ''}
            </p>
          </div>
        </div>

        {/* Compteur */}
        <div className="flex border-t border-gray-50">
          <div className="flex-1 py-2.5 text-center border-r border-gray-50">
            <p className="text-lg font-extrabold text-[#006633]">{nbPresents}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Présents</p>
          </div>
          <div className="flex-1 py-2.5 text-center">
            <p className="text-lg font-extrabold text-[#C82020]">{nbAbsents}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Absents</p>
          </div>
        </div>

        {/* Recherche */}
        <div className="px-4 pb-3">
          <div className="relative flex items-center">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher par matricule ou nom…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none"
            />
            <Search size={14} className="absolute left-3 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="mx-4 mt-3 flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Liste étudiants */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-28">
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Users size={32} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400">Aucun étudiant trouvé</p>
          </div>
        )}
        {filtered.map(etu => {
          const statut   = statuts.get(etu.id) ?? StatutPresence.Present;
          const isAbsent = statut === StatutPresence.Absent;

          return (
            <div key={etu.id}
              className="rounded-2xl border transition-all"
              style={{
                background: isAbsent ? 'rgba(200,32,32,0.04)' : 'rgba(0,102,51,0.03)',
                borderColor: isAbsent ? '#C82020' : '#e2e8f0',
              }}>
              <button
                onClick={() => toggle(etu.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                style={{ minHeight: '64px' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{etu.nom}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{etu.matricule}</p>
                </div>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: isAbsent ? '#C82020' : '#006633' }}
                >
                  {isAbsent
                    ? <span className="text-white text-xs font-bold">A</span>
                    : <Check size={16} className="text-white" />
                  }
                </div>
              </button>

              {/* Pas d'upload de justificatif en mode salle — réservé au DA */}
            </div>
          );
        })}
      </div>

      {/* Bouton Valider — fixed en bas */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 p-4 shadow-xl">
        <button
          onClick={handleValidate}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold text-white transition-all disabled:opacity-60 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
        >
          {saving
            ? <><Loader2 size={20} className="animate-spin" /> Validation en cours…</>
            : <><CheckCircle size={20} /> Valider la séance ({nbPresents}P / {nbAbsents}A)</>
          }
        </button>
      </div>
    </div>
  );
}

export default function PointageSallePage() {
  return (
    <Suspense fallback={
      <div className="p-6 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-iss-primary" />
      </div>
    }>
      <PointageSalleContent />
    </Suspense>
  );
}
