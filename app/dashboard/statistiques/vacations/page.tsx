'use client';

import React, { useRef } from 'react';
import { Bar } from '@/components/charts';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { Download } from 'lucide-react';
// F-6 : chart.js + plugins enregistres dans @/components/charts (loader dynamique)

interface VacationsDataResponse {
  labels: string[];
  values: number[];
}

export default function StatistiquesVacationsMensuelles() {
  const user = getStoredUser();
  const sessionAnnee = user?.annee_universitaire ?? '';

  const chartRef = useRef<any>(null);

  const { data, isLoading, error: queryError } = useQuery({
    queryKey: ['statistiques', 'vacations', sessionAnnee] as const,
    queryFn:  () => apiFetch<VacationsDataResponse>(
      `/api/v1/avancement/vacations/?annee_universitaire=${encodeURIComponent(sessionAnnee)}`,
    ),
    enabled:  !!sessionAnnee,
  });
  const loading = !!sessionAnnee && isLoading;
  const error = !sessionAnnee
    ? "Année universitaire introuvable dans la session."
    : queryError ? (queryError as Error).message : null;

  const handleDownload = () => {
    if (chartRef.current) {
      const url = chartRef.current.toBase64Image('image/png', 1);
      const link = document.createElement('a');
      const safeYear = sessionAnnee.replace(/[^\w\-]+/g, '_');
      link.download = `vacations_mensuelles_${safeYear}.png`;
      link.href = url;
      link.click();
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Chargement des données...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* En-tête de la page */}
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-800">Vacations par mois</h3>
      </div>

      {/* Carte du graphique */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative min-h-[450px]">
        
        {/* Bouton de téléchargement */}
        {data && !error && (
          <button 
            onClick={handleDownload}
            className="absolute top-4 right-4 z-10 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-[#006633] transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#006633] focus:ring-opacity-20"
            title="Télécharger le graphique"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Télécharger</span>
          </button>
        )}

        <div className="mb-4">
          <span className="text-sm font-medium text-gray-500">Montant total (MRU) par mois</span>
        </div>

        {error ? (
          <div className="text-red-500 bg-red-50 p-4 rounded-lg text-center italic border border-red-200 mt-8">
            Erreur : {error}
          </div>
        ) : (
          <div style={{ height: '380px', width: '100%' }}>
            <Bar
              ref={chartRef}
              data={{
                labels: data?.labels || [],
                datasets: [
                  { 
                    label: 'Montant total (MRU)', 
                    data: data?.values || [], 
                    backgroundColor: 'rgba(59, 130, 246, 0.85)', // Un beau bleu professionnel
                    hoverBackgroundColor: '#2563eb',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                    borderRadius: 6,
                    maxBarThickness: 60,
                  }
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                  padding: { top: 30 }
                },
                plugins: {
                  legend: {
                    display: false, // On masque la légende comme dans ton template original
                  },
                  datalabels: { 
                    formatter: (v) => new Intl.NumberFormat('fr-FR').format(v) + ' MRU', 
                    anchor: 'end', 
                    align: 'top',
                    offset: 4,
                    color: '#374151',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    borderColor: 'rgba(0, 0, 0, 0.1)',
                    borderWidth: 1,
                    borderRadius: 4,
                    padding: { left: 6, right: 6, top: 4, bottom: 4 },
                    font: { size: 11, weight: 'bold' },
                    display: (ctx) => {
                      // Context de chartjs-plugin-datalabels : on lit la valeur
                      // via dataset.data[dataIndex] (API documentee), pas ctx.parsed
                      // qui n'existe pas dans ce Context.
                      const v = ctx.dataset.data[ctx.dataIndex];
                      return typeof v === 'number' && v > 0;
                    },
                  },
                  tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                      label: (context) => ` ${new Intl.NumberFormat('fr-FR').format(context.raw as number)} MRU`
                    }
                  }
                },
                scales: {
                  x: {
                    grid: { display: false },
                    ticks: { font: { weight: 'bold' as const } }
                  },
                  y: {
                    beginAtZero: true,
                    grid: { color: '#f3f4f6' },
                    border: { display: false, dash: [5, 5] },
                    ticks: { callback: (v) => new Intl.NumberFormat('fr-FR').format(v as number) },
                    title: { display: true, text: 'Montant (MRU)', color: '#6b7280', font: { size: 12 } }
                  }
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}