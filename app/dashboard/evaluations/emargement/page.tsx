'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Loader2, Users } from 'lucide-react';
import { emargementApi } from '@/lib/api/evaluations';
import { downloadBlob } from '@/lib/downloadBlob';
import { apiFetch } from '@/lib/api';
import { filieresApi } from '@/lib/api/scolarite';
import { formatNiveau } from '@/lib/niveaux';
import FiliereSelect from '@/components/scolarite/FiliereSelect';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import type { Filiere } from '@/types/scolarite';

interface Year { id: number; annee: string; }

/** Pour un niveau N (>=1), retourne les codes de semestres correspondants : 1 -> S1,S2 ; 2 -> S3,S4 ; ... */
function semestresPourNiveau(niveauNum: number): string[] {
  if (!niveauNum || niveauNum < 1) return [];
  return [`S${niveauNum * 2 - 1}`, `S${niveauNum * 2}`];
}

export default function EmargementPage() {
  const toast = useToast();

  const [filiere,   setFiliere]   = useState<number | null>(null);
  const [niveau,    setNiveau]    = useState('1');
  const [semestre,  setSemestre]  = useState('S1');
  const [anneeUniv, setAnneeUniv] = useState('');
  const [format,    setFormat]    = useState<'pdf' | 'excel'>('pdf');

  // Liste des filieres pour deduire le type_diplome de la filiere choisie.
  const filieresQuery = useQuery({
    queryKey: ['scolarite', 'filieres', 'all'] as const,
    queryFn:  () => filieresApi.all() as Promise<Filiere[]>,
    staleTime: 5 * 60_000,
  });
  const filieres = filieresQuery.data ?? [];
  const filiereObj = useMemo(
    () => filieres.find(f => f.id === filiere) ?? null,
    [filieres, filiere],
  );

  // Niveaux dynamiques selon la filiere : LP/LF -> L1/L2/L3, M -> M1/M2, ING -> E1/E2/E3, ...
  // Source : Filiere.niveau_debut / niveau_fin (renseignes en BD selon le type_diplome).
  const niveauxDispo = useMemo(() => {
    if (!filiereObj) return [{ num: '1', label: 'L1' }];  // fallback avant choix filiere
    const debut = filiereObj.niveau_debut || 1;
    const fin   = filiereObj.niveau_fin   || debut;
    const out: { num: string; label: string }[] = [];
    for (let n = debut; n <= fin; n++) {
      out.push({ num: String(n), label: formatNiveau(n, filiereObj.type_diplome) });
    }
    return out;
  }, [filiereObj]);

  // Si le niveau actuel n'est plus dans la liste apres changement de filiere, repositionner.
  useEffect(() => {
    if (niveauxDispo.length > 0 && !niveauxDispo.some(n => n.num === niveau)) {
      setNiveau(niveauxDispo[0].num);
    }
  }, [niveauxDispo, niveau]);

  // Semestres dynamiques selon le niveau choisi : 1 -> S1/S2, 2 -> S3/S4, ...
  const semestresDispo = useMemo(() => semestresPourNiveau(Number(niveau)), [niveau]);

  // Quand le niveau change, force le 1er semestre dispo si l'actuel n'est plus valide.
  useEffect(() => {
    if (semestresDispo.length > 0 && !semestresDispo.includes(semestre)) {
      setSemestre(semestresDispo[0]);
    }
  }, [niveau, semestresDispo, semestre]);

  const yearsQuery = useQuery({
    queryKey: ['parametres', 'annees', 'list'] as const,
    queryFn:  async () => {
      const raw = await apiFetch<Year[] | { results: Year[] }>('/api/v1/parametres/annees/');
      return Array.isArray(raw) ? raw : (raw as { results: Year[] }).results ?? [];
    },
  });
  const years = yearsQuery.data ?? [];

  useEffect(() => {
    if (years.length && !anneeUniv) setAnneeUniv(String(years[0].id));
  }, [years, anneeUniv]);

  const downloadMut = useMutation({
    mutationFn: () => {
      const p = { filiere: filiere!, niveau: Number(niveau), semestre, annee_univ: Number(anneeUniv) };
      return format === 'excel' ? emargementApi.excel(p) : emargementApi.pdf(p);
    },
    onSuccess: (blob) =>
      downloadBlob(blob, `emargement_N${niveau}_${semestre}.${format === 'excel' ? 'xlsx' : 'pdf'}`),
    onError:   (e) => toast.error((e as Error).message),
  });
  const loading = downloadMut.isPending;

  const download = () => {
    if (!filiere || !anneeUniv) {
      toast.error('Filière et année universitaire sont requis.');
      return;
    }
    downloadMut.mutate();
  };

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
          <Users size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Fiche d'émargement</h1>
          <p className="text-sm text-iss-gray">Générer la liste de présence par filière</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 max-w-lg space-y-4">
        <div className="w-full">
          <label className="block text-sm font-medium text-slate-700 mb-1">Filière *</label>
          <FiliereSelect value={filiere} onChange={setFiliere} label="" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Niveau *</label>
            <select
              value={niveau}
              onChange={e => setNiveau(e.target.value)}
              disabled={!filiere}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {!filiere ? (
                <option value="">Choisir d&apos;abord une filière…</option>
              ) : (
                niveauxDispo.map(n => (
                  <option key={n.num} value={n.num}>{n.label}</option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Semestre *</label>
            <select
              value={semestre}
              onChange={e => setSemestre(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40"
            >
              {semestresDispo.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Année universitaire *</label>
          <select
            value={anneeUniv}
            onChange={e => setAnneeUniv(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40"
          >
            <option value="">— Sélectionner —</option>
            {years.map(y => (
              <option key={y.id} value={y.id}>{y.annee}</option>
            ))}
          </select>
        </div>

        {/* Format de sortie */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Format *</label>
          <div className="flex gap-4">
            {(['pdf', 'excel'] as const).map(f => (
              <label key={f} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value={f}
                  checked={format === f}
                  onChange={() => setFormat(f)}
                  className="accent-[#006633]"
                />
                <span className="text-sm">{f === 'pdf' ? 'PDF' : 'Excel'}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={download}
          disabled={loading || !filiere || !anneeUniv}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {loading ? 'Génération…' : `Télécharger ${format === 'excel' ? 'Excel' : 'PDF'}`}
        </button>
      </div>
    </div>
  );
}
