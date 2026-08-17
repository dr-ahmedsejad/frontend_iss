'use client';

import React, { useRef } from 'react';
import { Pie } from '@/components/charts';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Download } from 'lucide-react';
// F-6 : chart.js + plugins enregistres dans @/components/charts

interface BackendStatsResponse {
  total: number;
  vacataires: number;
  permanents: number;
  contractuels: number;
  hommes: number;
  femmes: number;
  diplomes_labels?: string[];
  diplomes_data?: number[];
}

interface ChartDataResponse {
  labels: string[];
  data: number[];
  total: number;
}

interface StatsResponse {
  genre: ChartDataResponse;
  type: ChartDataResponse;
  diplome: ChartDataResponse;
  annee_univ: string;
}

export default function DashboardProfStats() {
  const chartGenreRef = useRef<any>(null);
  const chartTypeRef = useRef<any>(null);
  const chartDipRef = useRef<any>(null);

  const { data: stats, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['profs', 'stats'] as const,
    queryFn:  async () => {
      const rawData = await apiFetch<BackendStatsResponse>('/api/v1/profs/stats/');
      if (rawData.total === undefined) {
        throw new Error("Format de données invalide reçu de l'API");
      }
      const formattedStats: StatsResponse = {
        genre: {
          labels: ['Hommes', 'Femmes'],
          data: [rawData.hommes, rawData.femmes],
          total: rawData.hommes + rawData.femmes,
        },
        type: {
          labels: ['Vacataires', 'Permanents', 'Contractuels'],
          data: [rawData.vacataires, rawData.permanents, rawData.contractuels],
          total: rawData.vacataires + rawData.permanents + rawData.contractuels,
        },
        diplome: {
          labels: rawData.diplomes_labels?.length ? rawData.diplomes_labels : ['Aucun diplôme'],
          data: rawData.diplomes_data?.length ? rawData.diplomes_data : [0],
          total: rawData.diplomes_data ? rawData.diplomes_data.reduce((a, b) => a + b, 0) : 0,
        },
        annee_univ: new Date().getFullYear().toString(),
      };
      return formattedStats;
    },
  });
  const error = queryError ? (queryError as Error).message : null;

  if (loading) return <div className="p-8 text-center text-gray-500">Chargement des statistiques...</div>;
  if (error || !stats) return <div className="p-8 text-center text-red-500">{error || "Erreur de chargement."}</div>;

  const safeYear = stats.annee_univ ? stats.annee_univ.replace(/[^\w\-]+/g, '_') : 'annee';

  const downloadChart = (ref: React.RefObject<any>, filename: string) => {
    if (ref.current) {
      const base64Url = ref.current.toBase64Image('image/png', 1);
      const link = document.createElement('a');
      link.href = base64Url;
      link.download = filename;
      link.click();
    }
  };

  const datalabelsOptions = {
    color: '#ffffff',
    font: { weight: 'bold' as const, size: 14 },
    formatter: (value: number) => value,
  };

  const getPieOptions = (total: number) => ({
    responsive: true,
    plugins: {
      legend: { 
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { family: "'Inter', sans-serif", size: 12, weight: 'bold' as const }
        }
      },
      datalabels: datalabelsOptions,
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx: any) => {
            const v = ctx.parsed;
            const p = total > 0 ? ((v / total) * 100).toFixed(1) : 0;
            return ` ${ctx.label}: ${v} (${p}%)`;
          }
        }
      }
    }
  });

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h4 className="text-2xl font-bold mb-6 text-gray-800">Tableau de bord des professeurs</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Carte Genre */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 relative" style={{ borderTop: '4px solid #006633' }}>
          <div className="flex justify-between items-center mb-6">
            <h5 className="text-lg font-bold text-gray-700">Par genre</h5>
            {/* BOUTON CORRIGÉ ICI */}
            <button 
              onClick={() => downloadChart(chartGenreRef, `professeurs_par_genre_${safeYear}.png`)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-[#006633] transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#006633] focus:ring-opacity-20"
              title="Télécharger le graphique"
            >
              <Download size={14} />
              <span className="hidden xl:inline">Télécharger</span>
            </button>
          </div>
          <div className="px-4 pb-4">
            <Pie 
              ref={chartGenreRef}
              options={getPieOptions(stats.genre.total)}
              data={{
                labels: stats.genre.labels,
                datasets: [{
                  data: stats.genre.data,
                  backgroundColor: ['rgba(99, 102, 241, 0.85)', 'rgba(236, 72, 153, 0.85)'],
                  hoverBackgroundColor: ['#4f46e5', '#db2777'],
                  borderColor: '#ffffff',
                  borderWidth: 2,
                  hoverOffset: 4
                }]
              }}
            />
          </div>
        </div>

        {/* Carte Type */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 relative" style={{ borderTop: '4px solid #006633' }}>
          <div className="flex justify-between items-center mb-6">
            <h5 className="text-lg font-bold text-gray-700">Par statut</h5>
            {/* BOUTON CORRIGÉ ICI */}
            <button 
              onClick={() => downloadChart(chartTypeRef, `professeurs_par_type_${safeYear}.png`)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-[#006633] transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#006633] focus:ring-opacity-20"
              title="Télécharger le graphique"
            >
              <Download size={14} />
              <span className="hidden xl:inline">Télécharger</span>
            </button>
          </div>
          <div className="px-4 pb-4">
            <Pie 
              ref={chartTypeRef}
              options={getPieOptions(stats.type.total)}
              data={{
                labels: stats.type.labels,
                datasets: [{
                  data: stats.type.data,
                  backgroundColor: ['rgba(6, 182, 212, 0.85)', 'rgba(0, 136, 68, 0.85)', 'rgba(245, 158, 11, 0.85)'],
                  hoverBackgroundColor: ['#0891b2', '#004d26', '#d97706'],
                  borderColor: '#ffffff',
                  borderWidth: 2,
                  hoverOffset: 4
                }]
              }}
            />
          </div>
        </div>

        {/* Carte Diplôme */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 relative" style={{ borderTop: '4px solid #006633' }}>
          <div className="flex justify-between items-center mb-6">
            <h5 className="text-lg font-bold text-gray-700">Par diplôme</h5>
            {/* BOUTON CORRIGÉ ICI */}
            <button 
              onClick={() => downloadChart(chartDipRef, `professeurs_par_diplome_${safeYear}.png`)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-[#006633] transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#006633] focus:ring-opacity-20"
              title="Télécharger le graphique"
            >
              <Download size={14} />
              <span className="hidden xl:inline">Télécharger</span>
            </button>
          </div>
          <div className="px-4 pb-4">
            <Pie 
              ref={chartDipRef}
              options={getPieOptions(stats.diplome.total)}
              data={{
                labels: stats.diplome.labels,
                datasets: [{
                  data: stats.diplome.data,
                  backgroundColor: ['rgba(168, 85, 247, 0.85)', 'rgba(59, 130, 246, 0.85)', 'rgba(16, 185, 129, 0.85)', 'rgba(249, 115, 22, 0.85)', 'rgba(20, 184, 166, 0.85)', 'rgba(239, 68, 68, 0.85)'],
                  hoverBackgroundColor: ['#9333ea', '#2563eb', '#059669', '#ea580c', '#0d9488', '#dc2626'],
                  borderColor: '#ffffff',
                  borderWidth: 2,
                  hoverOffset: 4
                }]
              }}
            />
          </div>
        </div>

      </div>
    </div>
  );
}