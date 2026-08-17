'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BarChart2, Loader2, Filter, Users, Download } from 'lucide-react';
import { Bar } from '@/components/charts';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

interface GroupeData {
  eq_cm:        number;
  h_brutes:     number;
  pct_eq_cm:    number;
  pct_h_brutes: number;
}

interface Row {
  type_semestre:       'I' | 'P';
  type_semestre_label: string;
  permanent:           GroupeData;
  vacataire:           GroupeData;
  total_eq_cm:         number;
  total_h_brutes:      number;
}

interface TotauxGlobaux {
  permanent_eq_cm:    number;
  vacataire_eq_cm:    number;
  permanent_h_brutes: number;
  vacataire_h_brutes: number;
  permanent_pct_eq:   number;
  vacataire_pct_eq:   number;
  permanent_pct_h:    number;
  vacataire_pct_h:    number;
  global_eq_cm:       number;
  global_h_brutes:    number;
}

interface ApiResponse {
  annee:          string;
  data:           Row[];
  totaux_globaux: TotauxGlobaux;
}

const COLOR_PERM = 'rgba(0,102,51,0.85)';
const COLOR_VAC  = 'rgba(184,150,12,0.85)';

export default function RepartitionChargesPage() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';
  const [unit, setUnit] = useState<'eq_cm' | 'h_brutes'>('eq_cm');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);

  const handleDownload = () => {
    if (chartRef.current) {
      const url = chartRef.current.toBase64Image('image/png', 1);
      const link = document.createElement('a');
      const safeYear = (annee || '').replace(/[^\w\-]+/g, '_');
      link.download = `repartition_charges_${safeYear}_${unit}.png`;
      link.href = url;
      link.click();
    }
  };

  const { data: response, isLoading, error: queryError } = useQuery({
    queryKey: ['statistiques', 'repartition-charges', annee] as const,
    queryFn:  () => apiFetch<ApiResponse>(
      `/api/v1/avancement/repartition-charges/?annee_universitaire=${encodeURIComponent(annee)}`,
    ),
    enabled: !!annee,
  });
  const loading = !!annee && isLoading;
  const error   = !annee
    ? "Année universitaire introuvable dans la session."
    : queryError ? (queryError as Error).message : null;

  const data   = response?.data ?? null;
  const totaux = response?.totaux_globaux ?? null;

  // Extraire les pourcentages selon l'unité sélectionnée
  const pctKey: keyof GroupeData = unit === 'eq_cm' ? 'pct_eq_cm' : 'pct_h_brutes';
  const valKey: keyof GroupeData = unit;
  const totKey: keyof TotauxGlobaux = unit === 'eq_cm' ? 'permanent_pct_eq' : 'permanent_pct_h';

  const permPct = data?.map(d => d.permanent[pctKey]) ?? [];
  const vacPct  = data?.map(d => d.vacataire[pctKey]) ?? [];
  const labels  = data?.map(d => d.type_semestre_label) ?? [];

  const chartData = {
    labels,
    datasets: [
      {
        label:           'Permanents',
        data:            permPct,
        backgroundColor: COLOR_PERM,
        borderRadius:    4,
        stack:           'pct',
        maxBarThickness: 80,
      },
      {
        label:           'Vacataires',
        data:            vacPct,
        backgroundColor: COLOR_VAC,
        borderRadius:    4,
        stack:           'pct',
        maxBarThickness: 80,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend:  { position: 'top' as const, labels: { padding: 16, font: { weight: 'bold' as const } } },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        padding:         12,
        cornerRadius:    8,
        callbacks: {
          label: (ctx: { datasetIndex: number; dataIndex: number; dataset: { label?: string }; parsed: { y: number | null } }) => {
            const row = data?.[ctx.dataIndex];
            if (!row) return '';
            const groupe = ctx.datasetIndex === 0 ? row.permanent : row.vacataire;
            const val    = groupe[valKey];
            const labelUnite = unit === 'eq_cm' ? 'éq.CM' : 'h';
            const y = ctx.parsed.y ?? 0;
            return ` ${ctx.dataset.label} : ${y.toFixed(1)} %  (${val.toFixed(1)} ${labelUnite})`;
          },
        },
      },
      datalabels: {
        color:    '#fff',
        font:     { weight: 'bold' as const, size: 14 },
        formatter: (v: number) => v > 3 ? `${v.toFixed(1)}%` : '',
      },
    },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { font: { weight: 'bold' as const, size: 13 } } },
      y: {
        stacked:     true,
        beginAtZero: true,
        max:         100,
        ticks:       { callback: (v: string | number) => `${v} %` },
        grid:        { color: '#f3f4f6' },
        title:       { display: true, text: 'Répartition (%)', color: '#6b7280', font: { size: 12 } },
      },
    },
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/statistiques"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <BarChart2 size={17} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Répartition des charges</h1>
          <p className="text-xs text-iss-gray">
            Permanents vs Vacataires par type de semestre — types CM, TD, TP, PR, Encadrement
          </p>
        </div>
      </div>

      {/* Toggle unité + année */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-[#006633]" />
          <span className="text-sm font-semibold text-iss-dark">Année universitaire :</span>
          <span className="text-sm text-iss-dark font-bold">{annee || '—'}</span>
        </div>
        <div className="ml-auto flex items-center gap-2 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setUnit('eq_cm')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              unit === 'eq_cm' ? 'bg-white shadow-sm text-iss-dark' : 'text-iss-gray hover:text-iss-dark'
            }`}>
            éq. CM
          </button>
          <button
            onClick={() => setUnit('h_brutes')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              unit === 'h_brutes' ? 'bg-white shadow-sm text-iss-dark' : 'text-iss-gray hover:text-iss-dark'
            }`}>
            Heures brutes
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl p-4 border bg-red-50 border-red-200 text-sm text-iss-secondary">{error}</div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-iss-primary" />
        </div>
      ) : totaux && data ? (
        <>
          {/* Cards résumé global */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-iss-gray mb-1">Permanents (global)</p>
              <p className="text-2xl font-bold" style={{ color: '#006633' }}>
                {totaux[unit === 'eq_cm' ? 'permanent_pct_eq' : 'permanent_pct_h'].toFixed(1)} %
              </p>
              <p className="text-xs text-iss-gray mt-1">
                {totaux[unit === 'eq_cm' ? 'permanent_eq_cm' : 'permanent_h_brutes'].toFixed(1)}
                {unit === 'eq_cm' ? ' éq.CM' : ' h'}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-iss-gray mb-1">Vacataires (global)</p>
              <p className="text-2xl font-bold" style={{ color: '#B8960C' }}>
                {totaux[unit === 'eq_cm' ? 'vacataire_pct_eq' : 'vacataire_pct_h'].toFixed(1)} %
              </p>
              <p className="text-xs text-iss-gray mt-1">
                {totaux[unit === 'eq_cm' ? 'vacataire_eq_cm' : 'vacataire_h_brutes'].toFixed(1)}
                {unit === 'eq_cm' ? ' éq.CM' : ' h'}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-iss-gray mb-1">Total Semestres Impairs</p>
              <p className="text-2xl font-bold text-iss-dark">
                {(data[0]?.[unit === 'eq_cm' ? 'total_eq_cm' : 'total_h_brutes'] ?? 0).toFixed(1)}
              </p>
              <p className="text-xs text-iss-gray mt-1">{unit === 'eq_cm' ? 'éq.CM' : 'heures brutes'}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-iss-gray mb-1">Total Semestres Pairs</p>
              <p className="text-2xl font-bold text-iss-dark">
                {(data[1]?.[unit === 'eq_cm' ? 'total_eq_cm' : 'total_h_brutes'] ?? 0).toFixed(1)}
              </p>
              <p className="text-xs text-iss-gray mt-1">{unit === 'eq_cm' ? 'éq.CM' : 'heures brutes'}</p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative">
            <div className="flex items-center gap-2 mb-4">
              <Users size={15} className="text-[#006633]" />
              <span className="text-sm font-bold text-iss-dark">
                Répartition par type de semestre (%)
              </span>
            </div>
            <button
              onClick={handleDownload}
              className="absolute top-4 right-4 z-10 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-[#006633] transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#006633] focus:ring-opacity-20"
              title="Télécharger le graphique"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Télécharger</span>
            </button>
            <div style={{ height: '380px', width: '100%' }}>
              <Bar ref={chartRef} data={chartData} options={chartOptions} />
            </div>
          </div>

          {/* Tableau détaillé */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-iss-dark mb-4">Détail par catégorie</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-iss-gray">Type de semestre</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-iss-gray">Permanents</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-iss-gray">% Perm.</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-iss-gray">Vacataires</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-iss-gray">% Vac.</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-iss-gray">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr key={row.type_semestre} className={`border-b border-gray-50 last:border-0 ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                      <td className="px-4 py-3 font-semibold text-iss-dark">{row.type_semestre_label}</td>
                      <td className="px-4 py-3 text-center font-bold" style={{ color: '#006633' }}>
                        {row.permanent[valKey].toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-center text-iss-gray">
                        {row.permanent[pctKey].toFixed(1)} %
                      </td>
                      <td className="px-4 py-3 text-center font-bold" style={{ color: '#B8960C' }}>
                        {row.vacataire[valKey].toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-center text-iss-gray">
                        {row.vacataire[pctKey].toFixed(1)} %
                      </td>
                      <td className="px-4 py-3 text-center font-extrabold text-iss-dark">
                        {row[unit === 'eq_cm' ? 'total_eq_cm' : 'total_h_brutes'].toFixed(1)}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: 'rgba(0,102,51,0.08)', borderTop: '2px solid #006633' }}>
                    <td className="px-4 py-3 font-extrabold text-sm text-iss-dark">TOTAL</td>
                    <td className="px-4 py-3 text-center font-extrabold" style={{ color: '#006633' }}>
                      {totaux[unit === 'eq_cm' ? 'permanent_eq_cm' : 'permanent_h_brutes'].toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-iss-gray">
                      {totaux[unit === 'eq_cm' ? 'permanent_pct_eq' : 'permanent_pct_h'].toFixed(1)} %
                    </td>
                    <td className="px-4 py-3 text-center font-extrabold" style={{ color: '#B8960C' }}>
                      {totaux[unit === 'eq_cm' ? 'vacataire_eq_cm' : 'vacataire_h_brutes'].toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-iss-gray">
                      {totaux[unit === 'eq_cm' ? 'vacataire_pct_eq' : 'vacataire_pct_h'].toFixed(1)} %
                    </td>
                    <td className="px-4 py-3 text-center font-extrabold text-iss-dark">
                      {totaux[unit === 'eq_cm' ? 'global_eq_cm' : 'global_h_brutes'].toFixed(1)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
          <p className="text-sm text-iss-gray">Aucune donnée disponible pour {annee || 'cette année'}.</p>
        </div>
      )}

    </div>
  );
}
