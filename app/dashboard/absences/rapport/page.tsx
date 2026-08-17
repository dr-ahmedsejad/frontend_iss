'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, FileText, Filter, Loader2,
  AlertCircle, CheckCircle, Users, Download,
} from 'lucide-react';
import { apiFetch, API_BASE_URL } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { useTimeout } from '@/hooks/useTimeout';
import { rapport as fetchRapport } from '@/lib/api/absences';
import type { RapportRow } from '@/types/absences';

interface Filiere    { id: number; code: string; intitule_fr: string; }
interface Departement {
  id: number; nom: string;
  niveau?: number | null; niveau_nom?: string | null;
  filiere?: number | null; filiere_code?: string | null;
  is_container?: boolean;
}

/* Libellé groupe « FILIERE - NIVEAU - GROUPE » (ex. LPSTAT - L1 - G1),
   identique aux selects de emplois/gerer et absences/saisir. */
function deptLabel(d: Departement): string {
  return [d.filiere_code, d.niveau_nom, d.nom].filter(Boolean).join(' - ');
}

const MOIS_NOMS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function moisToRange(moisStr: string): { debut: string; fin: string } {
  const [y, m] = moisStr.split('-').map(Number);
  const debut = `${y}-${String(m).padStart(2, '0')}-01`;
  const last  = new Date(y, m, 0).getDate();
  const fin   = `${y}-${String(m).padStart(2, '0')}-${last}`;
  return { debut, fin };
}

async function exportExcel(data: RapportRow[], title: string) {
  const xlsx = await import('@e965/xlsx');
  const rows = data.map((r, i) => ({
    '#': i + 1,
    'Matricule':    r.etudiant__matricule,
    'Nom':          r.etudiant__nom,
    'Département':  r.etudiant__departement__nom,
    'Total ABS':    r.total_absences,
    'Non just.':    r.absences_injustifiees,
    'Justifiées':   r.absences_justifiees,
    'Taux just. (%)': r.total_absences > 0
      ? Math.round(r.absences_justifiees / r.total_absences * 100)
      : 0,
  }));
  const ws = xlsx.utils.json_to_sheet(rows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Rapport');
  xlsx.writeFile(wb, `${title}.xlsx`);
}

export default function RapportAbsencesPage() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';

  /* ─── Filtres ── */
  const [filiereId, setFiliereId] = useState('');
  const [niveauId,  setNiveauId]  = useState('');
  const [depId,     setDepId]     = useState('');
  const [mode,      setMode]      = useState<'mois' | 'periode'>('mois');
  const [mois,      setMois]      = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin,   setDateFin]   = useState('');
  const [error,     setError]     = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const pdfLoadingTimer = useTimeout();

  /* ─── Charger les filières ── */
  const filieresQuery = useQuery({
    queryKey: ['scolarite', 'filieres', 'list', { page_size: 200 }] as const,
    queryFn:  async () => {
      const res = await apiFetch<{ results: Filiere[] } | Filiere[]>(
        `/api/v1/scolarite/filieres/?page_size=200`,
      );
      const list = Array.isArray(res) ? res : res.results;
      return list.sort((a, b) => a.code.localeCompare(b.code));
    },
    enabled: !!annee,
  });
  const filieres = filieresQuery.data ?? [];

  /* ─── Charger TOUS les départements de l'année (1 seule query, pas de filtre
     côté backend). Filière, niveau et groupe sont dérivés/filtrés localement
     pour garantir une cascade cohérente : on n'affiche dans chaque dropdown que
     ce qui a effectivement des dépendants. */
  const departementsQuery = useQuery({
    queryKey: ['departements', 'list-all', { annee_universitaire: annee, page_size: 500 }] as const,
    queryFn:  async () => {
      const res = await apiFetch<{ results: Departement[] } | Departement[]>(
        `/api/v1/departements/?annee_universitaire=${annee}&page_size=500`,
      );
      const list = Array.isArray(res) ? res : res.results;
      return list.filter(d => !['HE', 'ST'].includes(d.nom)
                            && !d.is_container
                            && !(d.nom || '').toLowerCase().includes('stage'))
                 .sort((a, b) => a.nom.localeCompare(b.nom));
    },
    enabled: !!annee,
  });
  const allDepartements = departementsQuery.data ?? [];
  const loadingDeps     = departementsQuery.isLoading || departementsQuery.isFetching;

  // Filières effectivement présentes dans les départements chargés.
  const filieresDispo = useMemo(() => {
    const ids = new Set<number>();
    for (const d of allDepartements) {
      if (d.filiere != null) ids.add(d.filiere);
    }
    return filieres.filter(f => ids.has(f.id));
  }, [allDepartements, filieres]);

  // Niveaux uniques pour la filière sélectionnée.
  const niveauxDispo = useMemo(() => {
    const seen = new Map<number, string>();
    for (const d of allDepartements) {
      if (filiereId && String(d.filiere) !== filiereId) continue;
      if (d.niveau != null) seen.set(d.niveau, d.niveau_nom ?? `Niveau ${d.niveau}`);
    }
    return Array.from(seen.entries())
      .map(([id, nom]) => ({ id, nom }))
      .sort((a, b) => a.nom.localeCompare(b.nom));
  }, [allDepartements, filiereId]);

  // Groupes filtrés par filière + niveau.
  const departements = useMemo(() => {
    return allDepartements.filter(d => {
      if (filiereId && String(d.filiere) !== filiereId) return false;
      if (niveauId  && String(d.niveau)  !== niveauId)  return false;
      return true;
    });
  }, [allDepartements, filiereId, niveauId]);

  // Reset filiereId si la filière sélectionnée n'a plus de dept (ex: changement d'année).
  useEffect(() => {
    if (filiereId && filieresDispo.length > 0 && !filieresDispo.some(f => String(f.id) === filiereId)) {
      setFiliereId('');
    }
  }, [filieresDispo, filiereId]);

  // Reset niveauId si plus dans la liste après changement de filière.
  useEffect(() => {
    if (niveauId && niveauxDispo.length > 0 && !niveauxDispo.some(n => String(n.id) === niveauId)) {
      setNiveauId('');
    }
  }, [filiereId, niveauxDispo, niveauId]);

  // Reset depId si plus dans la liste après changement de filière/niveau.
  useEffect(() => {
    if (depId && departements.length > 0 && !departements.some(d => String(d.id) === depId)) {
      setDepId('');
    }
  }, [filiereId, niveauId, departements, depId]);


  /* ─── Générer le rapport ── */
  const loadMut = useMutation({
    mutationFn: () => {
      let debut = dateDebut;
      let fin   = dateFin;
      if (mode === 'mois' && mois) {
        const r = moisToRange(mois);
        debut = r.debut; fin = r.fin;
      }
      return fetchRapport(annee, depId, debut || undefined, fin || undefined);
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Erreur de chargement.'),
  });
  const rapport = loadMut.data ?? null;
  const loading = loadMut.isPending;

  function loadRapport() {
    if (!annee)    { setError('Année universitaire manquante.');           return; }
    if (!filiereId){ setError('Sélectionnez une filière.');                return; }
    if (!niveauId) { setError('Sélectionnez un niveau.');                  return; }
    if (!depId)    { setError('Sélectionnez un groupe.');                  return; }
    if (mode === 'mois'    && !mois)                       { setError('Sélectionnez un mois.');    return; }
    if (mode === 'periode' && (!dateDebut || !dateFin))    { setError('Sélectionnez une période.'); return; }
    setError(null);
    loadMut.mutate();
  }
  /* ─── Helpers ── */
  const depNom      = departements.find(d => String(d.id) === depId)?.nom ?? '';
  const filiereName = filieres.find(f => String(f.id) === filiereId)?.intitule_fr ?? '';

  function periodeLabel(): string {
    if (mode === 'mois' && mois) {
      const [y, m] = mois.split('-');
      return `${MOIS_NOMS[Number(m)]} ${y}`;
    }
    if (mode === 'periode' && dateDebut && dateFin) {
      return `Du ${new Date(dateDebut).toLocaleDateString('fr-FR')} au ${new Date(dateFin).toLocaleDateString('fr-FR')}`;
    }
    return annee;
  }

  const totaux = rapport ? {
    total:   rapport.reduce((s, r) => s + r.total_absences,       0),
    nonJust: rapport.reduce((s, r) => s + r.absences_injustifiees, 0),
    just:    rapport.reduce((s, r) => s + r.absences_justifiees,   0),
  } : null;

  const sorted  = rapport ? [...rapport].sort((a, b) => b.total_absences - a.total_absences) : [];
  const withAbs = sorted.filter(r => r.total_absences > 0);

  async function handleExport() {
    if (!rapport?.length) return;
    setExporting(true);
    try {
      await exportExcel(rapport, `rapport-absences-${depNom}-${annee}`);
    } finally {
      setExporting(false);
    }
  }

  function handlePdf() {
    if (!depId) return;
    setPdfLoading(true);
    const params = new URLSearchParams({ departement: depId, annee_universitaire: annee });
    if (mode === 'mois' && mois) {
      const r = moisToRange(mois);
      params.set('date_debut', r.debut); params.set('date_fin', r.fin);
    } else if (mode === 'periode') {
      if (dateDebut) params.set('date_debut', dateDebut);
      if (dateFin)   params.set('date_fin',   dateFin);
    }
    const a = document.createElement('a');
    a.href = `${API_BASE_URL}/api/v1/absences/presences/rapport-departement-pdf/?${params}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Reset loading après un court délai (le navigateur gère le téléchargement)
    pdfLoadingTimer.set(() => setPdfLoading(false), 1500);
  }

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/absences"
            className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <FileText size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Rapport absences</h1>
            <p className="text-xs text-iss-gray">Par filière, groupe et période — {annee}</p>
          </div>
        </div>

        {rapport && rapport.length > 0 && (
          <div className="sm:ml-auto flex gap-2">
            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-iss-gray hover:bg-gray-50 transition-colors disabled:opacity-50">
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Export Excel
            </button>
            <button onClick={handlePdf} disabled={pdfLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-60 transition-all"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              {pdfLoading
                ? <><Loader2 size={14} className="animate-spin" /> Génération…</>
                : <><Download size={14} /> Télécharger PDF</>
              }
            </button>
          </div>
        )}
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100 space-y-5">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-iss-primary" />
          <span className="text-sm font-semibold text-iss-dark">Paramètres du rapport</span>
        </div>

        {/* Ligne 1 : Filière → Niveau → Groupe (cascade obligatoire) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">
              Filière <span className="text-[#C82020]">*</span>
              {filieresDispo.length > 0 && filieresDispo.length < filieres.length && (
                <span className="ml-1 text-[10px] text-iss-gray font-normal">
                  ({filieresDispo.length}/{filieres.length} avec groupes pour {annee})
                </span>
              )}
            </label>
            <select value={filiereId} onChange={e => setFiliereId(e.target.value)}
              disabled={loadingDeps || filieresDispo.length === 0}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#006633] disabled:opacity-60 disabled:cursor-not-allowed">
              <option value="">
                {filieresDispo.length === 0
                  ? '— Aucune filière avec groupes pour cette année —'
                  : '— Choisir une filière —'}
              </option>
              {filieresDispo.map(f => (
                <option key={f.id} value={f.id}>{f.code} — {f.intitule_fr}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">
              Niveau <span className="text-[#C82020]">*</span>
            </label>
            <select value={niveauId} onChange={e => setNiveauId(e.target.value)}
              disabled={!filiereId || loadingDeps || niveauxDispo.length === 0}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#006633] disabled:opacity-60 disabled:cursor-not-allowed">
              <option value="">
                {!filiereId ? '— Choisir d\'abord une filière —' : '— Choisir un niveau —'}
              </option>
              {niveauxDispo.map(n => (
                <option key={n.id} value={n.id}>{n.nom}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">
              Groupe <span className="text-[#C82020]">*</span>
            </label>
            {loadingDeps ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50">
                <Loader2 size={12} className="animate-spin text-iss-gray" />
                <span className="text-sm text-iss-gray">Chargement…</span>
              </div>
            ) : (
              <select value={depId} onChange={e => setDepId(e.target.value)}
                disabled={!niveauId || departements.length === 0}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#006633] disabled:opacity-60 disabled:cursor-not-allowed">
                <option value="">
                  {!niveauId ? '— Choisir d\'abord un niveau —' : '— Choisir un groupe —'}
                </option>
                {departements.map(d => (
                  <option key={d.id} value={d.id}>{deptLabel(d)}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Ligne 2 : Mode période */}
        <div>
          <label className="block text-xs font-semibold text-iss-dark mb-2">Période</label>
          <div className="flex items-center gap-1 bg-gray-50 rounded-xl border border-gray-200 p-1 w-fit mb-3">
            {(['mois', 'periode'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  mode === m ? 'text-white shadow-sm' : 'text-iss-gray hover:text-iss-dark'
                }`}
                style={mode === m ? { background: 'linear-gradient(135deg, #006633, #008844)' } : {}}>
                {m === 'mois' ? 'Par mois' : 'Par période'}
              </button>
            ))}
          </div>

          {mode === 'mois' ? (
            <div className="max-w-xs">
              <input type="month" value={mois} onChange={e => setMois(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#006633]" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 max-w-sm">
              <div>
                <label className="block text-xs text-iss-gray mb-1">Du</label>
                <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#006633]" />
              </div>
              <div>
                <label className="block text-xs text-iss-gray mb-1">Au</label>
                <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#006633]" />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <button onClick={loadRapport} disabled={loading || !depId}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 transition-all"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
          {loading ? 'Génération…' : 'Générer le rapport'}
        </button>
      </div>

      {/* KPI */}
      {rapport && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Étudiants total', value: sorted.length,      color: '#64748b' },
            { label: 'Avec absences',   value: withAbs.length,     color: '#C82020' },
            { label: 'Total absences',  value: totaux?.total ?? 0,  color: '#C82020' },
            { label: 'Non justifiées',  value: totaux?.nonJust ?? 0, color: '#B8960C' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl p-4 shadow-card border border-gray-100 text-center">
              <p className="text-xs text-iss-gray mb-1">{label}</p>
              <p className="text-2xl font-extrabold" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tableau */}
      {rapport !== null && (
        sorted.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-card border border-gray-100 text-center">
            <CheckCircle size={40} className="mx-auto mb-3" style={{ color: '#006633' }} />
            <p className="text-sm font-semibold text-iss-dark">Aucune absence enregistrée</p>
            <p className="text-xs text-iss-gray mt-1">pour ce groupe sur cette période.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100"
              style={{ background: 'linear-gradient(135deg, #00663308, #00884408)' }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-iss-dark">
                    {filiereName && <span className="text-iss-gray font-normal">{filiereName} · </span>}
                    {depNom}
                  </h3>
                  <p className="text-xs text-iss-gray mt-0.5">{periodeLabel()}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-iss-gray">
                  <Users size={12} /> {sorted.length} étudiant(s)
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Matricule</th>
                    <th>Nom</th>
                    <th>Groupe</th>
                    <th className="text-center">Total ABS</th>
                    <th className="text-center">Non just.</th>
                    <th className="text-center">Justifiées</th>
                    <th className="text-center">Taux just.</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r, i) => {
                    const taux = r.total_absences > 0
                      ? Math.round(r.absences_justifiees / r.total_absences * 100)
                      : 0;
                    return (
                      <tr key={i}>
                        <td className="text-iss-gray text-xs">{i + 1}</td>
                        <td><code className="text-xs">{r.etudiant__matricule}</code></td>
                        <td className="font-medium text-iss-dark">{r.etudiant__nom}</td>
                        <td className="text-xs text-iss-gray">{r.etudiant__departement__nom}</td>
                        <td className="text-center">
                          <span className="text-sm font-bold"
                            style={{ color: r.total_absences > 3 ? '#C82020' : '#0a0f1a' }}>
                            {r.total_absences}
                          </span>
                        </td>
                        <td className="text-center font-semibold text-sm" style={{ color: '#B8960C' }}>
                          {r.absences_injustifiees}
                        </td>
                        <td className="text-center font-semibold text-sm" style={{ color: '#1a5c8f' }}>
                          {r.absences_justifiees}
                        </td>
                        <td className="text-center">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                              <div className="h-1.5 rounded-full transition-all"
                                style={{ width: `${taux}%`, background: '#006633' }} />
                            </div>
                            <span className="text-xs text-iss-gray w-8">{taux}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs font-semibold text-iss-dark">
              <span>Totaux</span>
              <div className="flex gap-6">
                <span>Total : <strong className="text-iss-secondary">{totaux?.total}</strong></span>
                <span>Non just. : <strong style={{ color: '#B8960C' }}>{totaux?.nonJust}</strong></span>
                <span>Just. : <strong style={{ color: '#1a5c8f' }}>{totaux?.just}</strong></span>
              </div>
            </div>
          </div>
        )
      )}

      {rapport === null && !loading && (
        <div className="bg-white rounded-2xl p-12 shadow-card border border-gray-100 text-center">
          <FileText size={40} className="mx-auto mb-3 text-iss-gray/30" />
          <p className="text-sm text-iss-gray">
            Sélectionnez un groupe et une période puis cliquez sur <strong>Générer le rapport</strong>.
            La filière est facultative — elle sert uniquement à filtrer la liste des groupes.
          </p>
        </div>
      )}

      {/* En-tête visible uniquement à l'impression */}
      <div className="hidden print:block mb-6">
        <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '8px' }}>
          <tbody>
            <tr>
              <td style={{ textAlign: 'left', border: 'none', width: '45%', fontSize: '13px', fontWeight: 'bold' }}>
                Groupe Polytechnique<br />Institut Supérieur de la Statistique
              </td>
              <td style={{ textAlign: 'center', border: 'none', width: '10%' }} />
              <td style={{ textAlign: 'right', border: 'none', width: '45%', fontSize: '15px', fontWeight: 'bold' }}>
                مجمع بوليتكنيك<br />المعهد العالي للإحصاء
              </td>
            </tr>
          </tbody>
        </table>
        <hr style={{ borderTop: '2px solid black', margin: '6px 0' }} />
        <p style={{ textAlign: 'right', fontSize: '12px', marginBottom: '12px' }}>
          Année universitaire : {annee}
        </p>
        <h2 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px', margin: '12px 0' }}>
          Rapport des absences — {filiereName && `${filiereName} · `}{depNom}
        </h2>
        <p style={{ textAlign: 'center', fontSize: '13px' }}>{periodeLabel()}</p>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .space-y-6 { visibility: visible; }
          .print\\:hidden { display: none !important; }
          .print\\:block  { display: block  !important; visibility: visible; }
          @page { size: A4 portrait; margin: 1.5cm; }
        }
      `}</style>
    </div>
  );
}
