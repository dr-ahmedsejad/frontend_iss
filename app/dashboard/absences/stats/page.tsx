'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, BarChart2, Filter, Loader2,
  AlertTriangle, CheckCircle, AlertCircle,
  Settings, TrendingUp, Users, Save, Download,
} from 'lucide-react';
import type { ChartData, ChartOptions } from 'chart.js';
import { Bar } from '@/components/charts';
import { apiFetch } from '@/lib/api';
import { getStoredUser, AuthUser } from '@/lib/auth';
import { rapport as fetchRapport, getSeuil, updateSeuil } from '@/lib/api/absences';
import { joursApi } from '@/lib/api/jours';
import type { RapportRow, SeuilAbsence } from '@/types/absences';
// F-6 : chart.js + plugins enregistres dans @/components/charts

interface RapportJourRow {
  jour_id:      number;
  jour:         string;
  total:        number;
  injustifiees: number;
  sanctions:    number;
  justifiees:   number;
}

interface RapportCreneauRow {
  creneau_id:   number;
  creneau:      string;
  type_creneau: 'matin' | 'apres-midi' | 'soir';
  total:        number;
  injustifiees: number;
  sanctions:    number;
  justifiees:   number;
}

interface RapportCreneauGenreRow {
  creneau_id: number;
  creneau:    string;
  ordre:      number;
  filles:     number;
  garcons:    number;
}

interface Departement { id: number; nom: string; niveau_nom?: string | null; filiere_code?: string | null; is_container?: boolean; }

/* Libellé groupe « FILIERE - NIVEAU - GROUPE » (ex. LPSTAT - L1 - G1),
   identique aux selects de emplois/gerer et absences/saisir. */
function deptLabel(d: Departement): string {
  return [d.filiere_code, d.niveau_nom, d.nom].filter(Boolean).join(' - ');
}

/* Jours de la semaine en français */

function byDept(data: RapportRow[]) {
  const map = new Map<string, { nonJust: number; just: number; sanc: number }>();
  data.forEach(r => {
    const d = r.etudiant__departement__nom || 'Inconnu';
    const cur = map.get(d) ?? { nonJust: 0, just: 0, sanc: 0 };
    cur.nonJust += r.absences_injustifiees;
    cur.just    += r.absences_justifiees;
    cur.sanc    += Math.max(0, r.total_absences - r.absences_injustifiees - r.absences_justifiees);
    map.set(d, cur);
  });
  return [...map.entries()].sort((a, b) => (b[1].nonJust + b[1].just) - (a[1].nonJust + a[1].just));
}

export default function StatsAbsencesPage() {
  const user: AuthUser | null = getStoredUser();
  const annee  = user?.annee_universitaire ?? '';
  const isDA   = ['admin', 'DA'].includes(user?.role ?? '');

  const qc = useQueryClient();
  const [selDepId,     setSelDepId]     = useState('');
  const [newSeuil,     setNewSeuil]     = useState('3');
  const [seuilMsg,     setSeuilMsg]     = useState('');
  const [confirmSeuil, setConfirmSeuil] = useState(false);

  // Refs sur les conteneurs des charts. On telecharge en cherchant le <canvas>
  // a l'interieur (next/dynamic ne propage pas le ref vers chart.js).
  const deptChartRef          = useRef<HTMLDivElement | null>(null);
  const joursChartRef         = useRef<HTMLDivElement | null>(null);
  const creneauxChartRef      = useRef<HTMLDivElement | null>(null);
  const creneauxGenreChartRef = useRef<HTMLDivElement | null>(null);

  function downloadChart(ref: React.RefObject<HTMLDivElement | null>, filename: string) {
    const canvas = ref.current?.querySelector('canvas');
    if (!canvas) return;
    // Re-dessine sur un canvas a fond blanc (chart.js par defaut transparent)
    const w = canvas.width, h = canvas.height;
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const ctx = tmp.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(canvas, 0, 0);
    const url = tmp.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /* ─── Charger les départements ── */
  const departementsQuery = useQuery({
    queryKey: ['departements', 'list', { annee_universitaire: annee, page_size: 200, exclude: ['HE','ST'] }] as const,
    queryFn:  async () => {
      const res = await apiFetch<{ results: Departement[] } | Departement[]>(
        `/api/v1/departements/?annee_universitaire=${annee}&page_size=200`,
      );
      const list = Array.isArray(res) ? res : res.results;
      return list.filter(d => !['HE', 'ST'].includes(d.nom)
                            && !d.is_container
                            && !(d.nom || '').toLowerCase().includes('stage'))
                 .sort((a, b) => deptLabel(a).localeCompare(deptLabel(b)));
    },
    enabled: !!annee,
  });
  const departements = departementsQuery.data ?? [];

  const rapportQuery = useQuery({
    queryKey: ['absences', 'rapport', annee, selDepId] as const,
    queryFn:  () => fetchRapport(annee, selDepId || undefined),
    enabled:  !!annee,
  });
  const rapport = rapportQuery.data ?? null;

  const seuilQuery = useQuery({
    queryKey: ['absences', 'seuil'] as const,
    queryFn:  () => getSeuil(),
    enabled:  !!annee,
  });
  const seuilData = seuilQuery.data ?? null;

  // Distribution par jour (jours via parametres.Jour + agregation backend)
  const joursQuery = useQuery({
    queryKey: ['parametres', 'jours', 'all'] as const,
    queryFn:  () => joursApi.all(),
    staleTime: 5 * 60_000,
  });
  const joursList = joursQuery.data ?? [];

  const rapportJourQuery = useQuery({
    queryKey: ['absences', 'rapport-par-jour', annee, selDepId] as const,
    queryFn:  () => apiFetch<RapportJourRow[]>(
      `/api/v1/absences/presences/rapport-par-jour/?annee_universitaire=${encodeURIComponent(annee)}${selDepId ? `&departement=${selDepId}` : ''}`,
    ),
    enabled:  !!annee,
  });
  const rapportJour = rapportJourQuery.data ?? [];

  // Distribution par creneau actif (agregation backend)
  const rapportCreneauQuery = useQuery({
    queryKey: ['absences', 'rapport-par-creneau', annee, selDepId] as const,
    queryFn:  () => apiFetch<RapportCreneauRow[]>(
      `/api/v1/absences/presences/rapport-par-creneau/?annee_universitaire=${encodeURIComponent(annee)}${selDepId ? `&departement=${selDepId}` : ''}`,
    ),
    enabled:  !!annee,
  });
  const rapportCreneau = rapportCreneauQuery.data ?? [];

  // Distribution par creneau actif x genre
  const rapportCreneauGenreQuery = useQuery({
    queryKey: ['absences', 'rapport-par-creneau-genre', annee, selDepId] as const,
    queryFn:  () => apiFetch<RapportCreneauGenreRow[]>(
      `/api/v1/absences/presences/rapport-par-creneau-genre/?annee_universitaire=${encodeURIComponent(annee)}${selDepId ? `&departement=${selDepId}` : ''}`,
    ),
    enabled:  !!annee,
  });
  const rapportCreneauGenre = rapportCreneauGenreQuery.data ?? [];

  // Sync newSeuil quand seuilData arrive
  useEffect(() => {
    if (seuilData) setNewSeuil(String(seuilData.seuil));
  }, [seuilData]);

  const loading = rapportQuery.isLoading || seuilQuery.isLoading;
  const error   = rapportQuery.error
    ? (rapportQuery.error instanceof Error ? rapportQuery.error.message : 'Erreur de chargement.')
    : null;

  const seuilMut = useMutation({
    mutationFn: (v: number) => updateSeuil(v),
    onSuccess:  (res) => {
      qc.setQueryData(['absences', 'seuil'], res);
      setSeuilMsg('Seuil mis à jour avec succès.');
      setConfirmSeuil(false);
    },
    onError: () => setSeuilMsg('Erreur lors de la mise à jour.'),
  });
  const savingSeuil = seuilMut.isPending;

  function saveSeuil() {
    const v = parseInt(newSeuil);
    if (!v || v < 1) return;
    setSeuilMsg('');
    seuilMut.mutate(v);
  }

  /* ─── Statistiques calculées ── */
  const totalAbsences = rapport?.reduce((s, r) => s + r.total_absences, 0) ?? 0;
  const totalJust     = rapport?.reduce((s, r) => s + r.absences_justifiees, 0) ?? 0;
  const totalNonJust  = rapport?.reduce((s, r) => s + r.absences_injustifiees, 0) ?? 0;
  const totalSanc     = Math.max(0, totalAbsences - totalJust - totalNonJust);
  const tauxJust      = totalAbsences > 0 ? Math.round(totalJust / totalAbsences * 100) : 0;
  const seuil         = seuilData?.seuil ?? 3;

  const listeRouge = (rapport ?? [])
    .filter(r => r.absences_injustifiees >= seuil)
    .sort((a, b) => b.absences_injustifiees - a.absences_injustifiees);

  const top15 = [...(rapport ?? [])]
    .sort((a, b) => b.total_absences - a.total_absences)
    .slice(0, 15);

  const deptData = rapport ? byDept(rapport) : [];

  /* ─── Config graphique par département ── */
  // null sur les valeurs 0 → chart.js ne rend AUCUN segment (pas de rectangle vide).
  // Combine avec minBarLength: 8 → si > 0 le segment est garanti visible (>= 8 px).
  // Cela evite que les barres avec 0 sanctions/justifications affichent des
  // segments verts/jaunes vides trompeurs.
  const barDeptConfig: ChartData<'bar'> = {
    labels: deptData.map(([d]) => d),
    datasets: [
      {
        label: 'Non just.',
        data: deptData.map(([, v]) => (v.nonJust > 0 ? v.nonJust : null)),
        backgroundColor: 'rgba(200,32,32,0.85)',
        borderColor: 'rgba(160,16,16,1)',
        borderWidth: 1,
        stack: 'a',
      },
      {
        label: 'Justifiées',
        data: deptData.map(([, v]) => (v.just > 0 ? v.just : null)),
        backgroundColor: 'rgba(0,102,51,0.95)',
        borderColor: 'rgba(0,80,40,1)',
        borderWidth: 1,
        minBarLength: 8,
        stack: 'a',
      },
      {
        label: 'Sanct.',
        data: deptData.map(([, v]) => (v.sanc > 0 ? v.sanc : null)),
        backgroundColor: 'rgba(184,150,12,1)',
        borderColor: 'rgba(120,98,8,1)',
        borderWidth: 1,
        minBarLength: 8,
        stack: 'a',
      },
    ],
  };
  const barDeptOptions: ChartOptions<'bar'> = {
    responsive: true, maintainAspectRatio: true, aspectRatio: 1.7,
    layout: { padding: { top: 12 } },  // peu d'espace : plus de bulle total au-dessus
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 12, padding: 12, font: { size: 12, weight: 'bold' } },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        padding: 10, cornerRadius: 8,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label} : ${ctx.parsed.y}`,
          footer: (items) => {
            const sum = items.reduce((s, i) => s + (i.parsed.y || 0), 0);
            return `Total : ${sum}`;
          },
        },
      },
      datalabels: {
        // Une SEULE etiquette par segment : la valeur affichee DES QUE > 0, meme pour 1.
        // display: true (pas 'auto') -> jamais cachee meme si segment tres petit.
        // Le total global etait en bulle au-dessus mais entrait en conflit visuel avec
        // les petits segments Sanctions/Just (1 ne s'affichait pas). Le total reste
        // dispo dans la bande resume sous le chart + le tooltip au survol.
        labels: {
          value: {
            color: '#fff',
            font: { size: 11, weight: 'bold' as const },
            textShadowColor: 'rgba(0,0,0,0.6)',
            textShadowBlur: 3,
            anchor: 'center',
            align: 'center',
            formatter: (v: number) => (typeof v === 'number' && v > 0 ? String(v) : ''),
            display: true,
            clip: false,
          },
          // Total bubble retiree pour eviter le conflit visuel avec les petits
          // segments. Les totaux restent disponibles dans la bande resume sous
          // le chart + dans le tooltip au survol.
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { font: { weight: 'bold' as const, size: 11 } },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { font: { size: 11 }, precision: 0 },
      },
    },
  };

  /* ─── Distribution par jour de la semaine ──
     Match jour_id de l'agregation backend avec joursList (modele Jour parametres).
     Affiche les jours dans l'ordre defini en BD (id ASC). */
  const jourCountMap = new Map<number, RapportJourRow>();
  rapportJour.forEach(r => jourCountMap.set(r.jour_id, r));

  // null sur les valeurs 0 → pas de segment rendu (cf. commentaire chart Dept).
  const distJoursData: ChartData<'bar'> | null = joursList.length > 0 ? {
    labels: joursList.map(j => j.jour),
    datasets: [
      {
        label: 'Non justifiées',
        data: joursList.map(j => {
          const v = jourCountMap.get(j.id)?.injustifiees ?? 0;
          return v > 0 ? v : null;
        }),
        backgroundColor: 'rgba(200,32,32,0.85)',
        borderColor: 'rgba(160,16,16,1)',
        borderWidth: 1,
        stack: 'a',
      },
      {
        label: 'Justifiées',
        data: joursList.map(j => {
          const v = jourCountMap.get(j.id)?.justifiees ?? 0;
          return v > 0 ? v : null;
        }),
        backgroundColor: 'rgba(0,102,51,0.95)',
        borderColor: 'rgba(0,80,40,1)',
        borderWidth: 1,
        minBarLength: 8,
        stack: 'a',
      },
      {
        label: 'Sanctions',
        data: joursList.map(j => {
          const v = jourCountMap.get(j.id)?.sanctions ?? 0;
          return v > 0 ? v : null;
        }),
        backgroundColor: 'rgba(184,150,12,1)',
        borderColor: 'rgba(120,98,8,1)',
        borderWidth: 1,
        minBarLength: 8,
        stack: 'a',
      },
    ],
  } : null;

  const distJoursOptions: ChartOptions<'bar'> = {
    responsive: true, maintainAspectRatio: true, aspectRatio: 1.7,
    layout: { padding: { top: 12 } },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 12, padding: 12, font: { size: 12, weight: 'bold' } },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        padding: 10, cornerRadius: 8,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label} : ${ctx.parsed.y}`,
          footer: (items) => {
            const sum = items.reduce((s, i) => s + (i.parsed.y || 0), 0);
            return `Total : ${sum}`;
          },
        },
      },
      datalabels: {
        labels: {
          value: {
            color: '#fff',
            font: { size: 11, weight: 'bold' as const },
            textShadowColor: 'rgba(0,0,0,0.6)',
            textShadowBlur: 3,
            anchor: 'center',
            align: 'center',
            formatter: (v: number) => (typeof v === 'number' && v > 0 ? String(v) : ''),
            display: true,
            clip: false,
          },
          // Total bubble retiree pour eviter le conflit visuel avec les petits
          // segments. Les totaux restent disponibles dans la bande resume sous
          // le chart + dans le tooltip au survol.
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { font: { weight: 'bold' as const, size: 12 } },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { font: { size: 11 }, precision: 0 },
      },
    },
  };

  const totalAbsencesParJour = rapportJour.reduce((s, r) => s + r.total, 0);

  /* ─── Distribution par creneau actif ──
     L'agregation backend filtre deja sur creneau.is_actif=True et trie par
     creneau.ordre. On affiche tels quels les creneaux retournes (donc seuls
     ceux qui ont >= 1 absence). */
  const distCreneauxData: ChartData<'bar'> | null = rapportCreneau.length > 0 ? {
    labels: rapportCreneau.map(r => r.creneau),
    datasets: [
      {
        label: 'Non justifiées',
        data: rapportCreneau.map(r => (r.injustifiees > 0 ? r.injustifiees : null)),
        backgroundColor: 'rgba(200,32,32,0.85)',
        borderColor: 'rgba(160,16,16,1)',
        borderWidth: 1,
        stack: 'a',
      },
      {
        label: 'Justifiées',
        data: rapportCreneau.map(r => (r.justifiees > 0 ? r.justifiees : null)),
        backgroundColor: 'rgba(0,102,51,0.95)',
        borderColor: 'rgba(0,80,40,1)',
        borderWidth: 1,
        minBarLength: 8,
        stack: 'a',
      },
      {
        label: 'Sanctions',
        data: rapportCreneau.map(r => (r.sanctions > 0 ? r.sanctions : null)),
        backgroundColor: 'rgba(184,150,12,1)',
        borderColor: 'rgba(120,98,8,1)',
        borderWidth: 1,
        minBarLength: 8,
        stack: 'a',
      },
    ],
  } : null;

  // Reuse exact options du chart Jours (memes axes, memes etiquettes)
  const distCreneauxOptions = distJoursOptions;
  const totalAbsencesParCreneau = rapportCreneau.reduce((s, r) => s + r.total, 0);

  /* ─── Distribution par creneau x genre ──
     Bar chart groupe (NON empile) : 2 datasets cote a cote (Filles / Garcons)
     pour faciliter la comparaison sur chaque creneau. */
  const distCreneauxGenreData: ChartData<'bar'> | null = rapportCreneauGenre.length > 0 ? {
    labels: rapportCreneauGenre.map(r => r.creneau),
    datasets: [
      {
        label: 'Filles',
        data: rapportCreneauGenre.map(r => (r.filles > 0 ? r.filles : null)),
        backgroundColor: 'rgba(219, 39, 119, 0.85)',
        borderColor: 'rgba(157, 23, 77, 1)',
        borderWidth: 1,
        minBarLength: 8,
      },
      {
        label: 'Garçons',
        data: rapportCreneauGenre.map(r => (r.garcons > 0 ? r.garcons : null)),
        backgroundColor: 'rgba(37, 99, 235, 0.85)',
        borderColor: 'rgba(29, 78, 216, 1)',
        borderWidth: 1,
        minBarLength: 8,
      },
    ],
  } : null;

  const distCreneauxGenreOptions: ChartOptions<'bar'> = {
    responsive: true, maintainAspectRatio: true, aspectRatio: 1.7,
    layout: { padding: { top: 12 } },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 12, padding: 12, font: { size: 12, weight: 'bold' } },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        padding: 10, cornerRadius: 8,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label} : ${ctx.parsed.y}`,
        },
      },
      datalabels: {
        color: '#fff',
        font: { size: 11, weight: 'bold' as const },
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowBlur: 3,
        anchor: 'center',
        align: 'center',
        formatter: (v: number) => (typeof v === 'number' && v > 0 ? String(v) : ''),
        display: true,
        clip: false,
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { weight: 'bold' as const, size: 12 } } },
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 }, precision: 0 } },
    },
  };

  // Pic d'absentéisme par genre (creneau le plus problematique)
  const totalFilles  = rapportCreneauGenre.reduce((s, r) => s + r.filles, 0);
  const totalGarcons = rapportCreneauGenre.reduce((s, r) => s + r.garcons, 0);
  const picFilles    = rapportCreneauGenre.reduce<RapportCreneauGenreRow | null>(
    (m, r) => (m === null || r.filles > m.filles ? r : m), null);
  const picGarcons   = rapportCreneauGenre.reduce<RapportCreneauGenreRow | null>(
    (m, r) => (m === null || r.garcons > m.garcons ? r : m), null);

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/absences"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #B8960C, #D4A915)' }}>
          <BarChart2 size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Statistiques des absences</h1>
        </div>
        <button onClick={() => rapportQuery.refetch()} disabled={loading}
          className="ml-auto p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors"
          title="Actualiser">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Filter size={16} />}
        </button>
      </div>

      {/* Filtre département */}
      <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Filtrer par département <span className="text-gray-400">(optionnel — tous si vide)</span>
            </label>
            <select value={selDepId} onChange={e => setSelDepId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#B8960C]">
              <option value="">— Tous les départements —</option>
              {departements.map(d => <option key={d.id} value={d.id}>{deptLabel(d)}</option>)}
            </select>
          </div>
          <button onClick={() => rapportQuery.refetch()} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg, #B8960C, #D4A915)' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />}
            Appliquer
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-2xl p-12 shadow-card border border-gray-100 text-center">
          <Loader2 size={32} className="animate-spin mx-auto mb-3" style={{ color: '#B8960C' }} />
          <p className="text-sm text-iss-gray">Chargement des statistiques…</p>
        </div>
      )}

      {!loading && rapport !== null && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total absences', value: totalAbsences, color: '#1a5c8f', bg: 'rgba(26,92,143,0.08)' },
              { label: 'Non justifiées', value: totalNonJust,  color: '#C82020', bg: 'rgba(200,32,32,0.08)' },
              { label: 'Justifiées',     value: totalJust,     color: '#006633', bg: 'rgba(0,102,51,0.08)'  },
              { label: 'Sanctionnées',   value: totalSanc,     color: '#B8960C', bg: 'rgba(184,150,12,0.08)' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className="bg-white rounded-2xl p-5 shadow-card border border-gray-100"
                style={{ borderLeft: `4px solid ${color}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: bg }}>
                    <TrendingUp size={20} style={{ color }} />
                  </div>
                  <div>
                    <p className="text-3xl font-extrabold leading-none" style={{ color }}>{value}</p>
                    <p className="text-xs text-iss-gray mt-0.5 uppercase tracking-wide">{label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Taux justification */}
          <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-iss-dark flex items-center gap-1.5">
                <TrendingUp size={14} style={{ color: '#1a5c8f' }} /> Taux de justification
              </span>
              <span className="text-2xl font-extrabold" style={{ color: '#1a5c8f' }}>{tauxJust}%</span>
            </div>
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-3 rounded-full transition-all duration-500"
                style={{ width: `${tauxJust}%`, background: 'linear-gradient(90deg, #006633, #008844)' }} />
            </div>
          </div>

          {/* Seuil (DA/admin only) */}
          {isDA && (
            <div className="bg-white rounded-2xl p-5 shadow-card border-2 border-amber-200"
              style={{ background: 'linear-gradient(135deg, #fff8e1, #fffdf5)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Settings size={16} style={{ color: '#B8960C' }} />
                <span className="text-sm font-bold text-iss-dark">Seuil d&apos;absences non justifiées</span>
                <span className="ml-auto px-3 py-1 rounded-xl text-xs font-bold"
                  style={{ background: 'rgba(184,150,12,0.12)', color: '#B8960C' }}>
                  Actuel : {seuil} abs.
                </span>
              </div>
              {!confirmSeuil ? (
                <div className="flex items-center gap-3">
                  <input type="number" min="1" max="99" value={newSeuil}
                    onChange={e => setNewSeuil(e.target.value)}
                    className="w-24 px-3 py-2 rounded-xl border border-amber-200 text-sm text-center font-bold bg-white focus:outline-none" />
                  <button onClick={() => setConfirmSeuil(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
                    style={{ background: 'linear-gradient(135deg, #B8960C, #D4A915)' }}>
                    <Save size={12} /> Modifier
                  </button>
                  {seuilMsg && <span className="text-xs text-amber-700">{seuilMsg}</span>}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-amber-800">
                    Confirmer le nouveau seuil : <strong>{newSeuil}</strong> absence(s) ?
                  </p>
                  <button onClick={saveSeuil} disabled={savingSeuil}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 transition-all"
                    style={{ background: '#006633' }}>
                    {savingSeuil ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                    Confirmer
                  </button>
                  <button onClick={() => setConfirmSeuil(false)}
                    className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
                    Annuler
                  </button>
                </div>
              )}
              <p className="mt-2 text-xs text-amber-700">
                Tout étudiant avec ≥ <strong>{seuil}</strong> absence{seuil > 1 ? 's' : ''} non justifiée{seuil > 1 ? 's' : ''} apparaît dans la liste rouge.
              </p>
            </div>
          )}

          {/* Liste rouge */}
          {listeRouge.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-card overflow-hidden"
              style={{ border: '1.5px solid #C82020' }}>
              <div className="px-5 py-3 flex items-center gap-2" style={{ background: '#C82020' }}>
                <AlertTriangle size={16} className="text-white" />
                <span className="text-sm font-bold text-white">Liste rouge</span>
                <span className="ml-1 text-white/70 text-xs">
                  — ≥ {seuil} abs. non just.
                </span>
                <span className="ml-auto px-2 py-0.5 rounded-lg text-xs font-bold bg-white text-red-600">
                  {listeRouge.length} étudiant(s)
                </span>
              </div>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Matricule</th>
                      <th>Nom</th>
                      <th>Département</th>
                      <th className="text-center text-red-600">Non just.</th>
                      <th className="text-center">Just.</th>
                      <th className="text-center">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listeRouge.map((r, i) => (
                      <tr key={`${r.etudiant__matricule}-${i}`} className="bg-red-50/30">
                        <td className="text-xs text-iss-gray">{i + 1}</td>
                        <td><code className="text-xs">{r.etudiant__matricule}</code></td>
                        <td className="font-semibold text-iss-dark">{r.etudiant__nom}</td>
                        <td className="text-xs text-iss-gray">{r.etudiant__departement__nom}</td>
                        <td className="text-center font-bold text-red-600">{r.absences_injustifiees}</td>
                        <td className="text-center font-semibold" style={{ color: '#1a5c8f' }}>{r.absences_justifiees}</td>
                        <td className="text-center font-bold text-iss-dark">{r.total_absences}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-50 border border-green-200">
              <CheckCircle size={20} style={{ color: '#006633' }} />
              <p className="text-sm text-green-800">
                Aucun étudiant n&apos;a atteint le seuil de <strong>{seuil}</strong> absence{seuil > 1 ? 's' : ''} non just.
              </p>
            </div>
          )}

          {/* Graphiques */}
          {deptData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Bar par département */}
              <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-card border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-iss-dark flex items-center gap-2">
                    <BarChart2 size={14} className="text-iss-primary" />
                    Absences par département
                  </h3>
                  <button onClick={() => downloadChart(deptChartRef, `absences_par_departement_${annee}`)}
                    title="Télécharger en PNG"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-iss-gray border border-gray-200 hover:bg-gray-50 hover:text-iss-primary hover:border-iss-primary/30 transition-colors">
                    Télécharger <Download size={14} />
                  </button>
                </div>
                <div ref={deptChartRef}>
                  <Bar data={barDeptConfig} options={barDeptOptions} />
                </div>
              </div>

              {/* Top 15 */}
              <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-iss-dark flex items-center gap-2">
                    <Users size={14} className="text-iss-gray" />
                    Top 15 absentéistes
                  </h3>
                </div>
                <div className="overflow-y-auto max-h-72">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Nom</th>
                        <th>Dép.</th>
                        <th className="text-center">Total</th>
                        <th className="text-center">NJ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {top15.map((r, i) => (
                        <tr key={`${r.etudiant__matricule ?? r.etudiant__nom}-${i}`}
                          className={r.absences_injustifiees >= seuil ? 'bg-red-50/50' : ''}>
                          <td className="text-xs text-iss-gray">{i + 1}</td>
                          <td className="text-xs font-medium text-iss-dark">{r.etudiant__nom}</td>
                          <td className="text-xs text-iss-gray">{r.etudiant__departement__nom}</td>
                          <td className="text-center font-bold text-xs text-iss-dark">{r.total_absences}</td>
                          <td className="text-center font-bold text-xs text-red-600">{r.absences_injustifiees}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Distribution par jour de la semaine — donnees via parametres.Jour
              + endpoint /rapport-par-jour/ (agrege par suivi.jour_fk). */}
          {distJoursData && totalAbsencesParJour > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-iss-dark flex items-center gap-2">
                  <BarChart2 size={14} className="text-iss-primary" />
                  Distribution par jour de la semaine
                  <span className="text-xs text-gray-400 font-normal">({totalAbsencesParJour} absences)</span>
                </h3>
                <button onClick={() => downloadChart(joursChartRef, `absences_par_jour_${annee}`)}
                  title="Télécharger en PNG"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-iss-gray border border-gray-200 hover:bg-gray-50 hover:text-iss-primary hover:border-iss-primary/30 transition-colors">
                  Télécharger <Download size={14} />
                </button>
              </div>
              <div ref={joursChartRef}>
                <Bar data={distJoursData} options={distJoursOptions} />
              </div>
            </div>
          )}

          {/* Distribution par creneau actif — endpoint /rapport-par-creneau/
              filtre creneau.is_actif=True, trie par creneau.ordre. */}
          {distCreneauxData && totalAbsencesParCreneau > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-iss-dark flex items-center gap-2">
                  <BarChart2 size={14} className="text-iss-primary" />
                  Distribution par créneau (actifs)
                  <span className="text-xs text-gray-400 font-normal">({totalAbsencesParCreneau} absences)</span>
                </h3>
                <button onClick={() => downloadChart(creneauxChartRef, `absences_par_creneau_${annee}`)}
                  title="Télécharger en PNG"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-iss-gray border border-gray-200 hover:bg-gray-50 hover:text-iss-primary hover:border-iss-primary/30 transition-colors">
                  Télécharger <Download size={14} />
                </button>
              </div>
              <div ref={creneauxChartRef}>
                <Bar data={distCreneauxData} options={distCreneauxOptions} />
              </div>
            </div>
          )}

          {/* Distribution par creneau x genre — pour identifier le creneau ou
              les filles/garcons s'absentent le plus. */}
          {distCreneauxGenreData && (totalFilles + totalGarcons) > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-iss-dark flex items-center gap-2">
                  <BarChart2 size={14} className="text-iss-primary" />
                  Absences par créneau et par genre
                </h3>
                <button onClick={() => downloadChart(creneauxGenreChartRef, `absences_creneau_genre_${annee}`)}
                  title="Télécharger en PNG"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-iss-gray border border-gray-200 hover:bg-gray-50 hover:text-iss-primary hover:border-iss-primary/30 transition-colors">
                  Télécharger <Download size={14} />
                </button>
              </div>

              {/* Bande pic d'absenteisme par genre */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="px-4 py-3 rounded-xl border" style={{ background: 'rgba(219,39,119,0.06)', borderColor: 'rgba(219,39,119,0.2)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#BE185D' }}>
                    Pic absentéisme — Filles
                  </p>
                  {picFilles && picFilles.filles > 0 ? (
                    <p className="text-sm font-bold mt-1" style={{ color: '#9D174D' }}>
                      {picFilles.creneau} <span className="text-xs font-normal text-iss-gray">({picFilles.filles} absences sur {totalFilles})</span>
                    </p>
                  ) : (
                    <p className="text-xs text-iss-gray mt-1">Aucune absence enregistrée</p>
                  )}
                </div>
                <div className="px-4 py-3 rounded-xl border" style={{ background: 'rgba(37,99,235,0.06)', borderColor: 'rgba(37,99,235,0.2)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#1D4ED8' }}>
                    Pic absentéisme — Garçons
                  </p>
                  {picGarcons && picGarcons.garcons > 0 ? (
                    <p className="text-sm font-bold mt-1" style={{ color: '#1E3A8A' }}>
                      {picGarcons.creneau} <span className="text-xs font-normal text-iss-gray">({picGarcons.garcons} absences sur {totalGarcons})</span>
                    </p>
                  ) : (
                    <p className="text-xs text-iss-gray mt-1">Aucune absence enregistrée</p>
                  )}
                </div>
              </div>

              <div ref={creneauxGenreChartRef}>
                <Bar data={distCreneauxGenreData} options={distCreneauxGenreOptions} />
              </div>
            </div>
          )}

          {rapport.length === 0 && (
            <div className="bg-white rounded-2xl p-12 shadow-card border border-gray-100 text-center">
              <CheckCircle size={40} className="mx-auto mb-3" style={{ color: '#006633' }} />
              <p className="text-sm font-semibold text-iss-dark">Aucune absence enregistrée pour {annee}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
