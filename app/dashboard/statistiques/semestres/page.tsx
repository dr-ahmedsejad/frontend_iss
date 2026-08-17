'use client';

import React, { useRef } from 'react';
import { Bar } from '@/components/charts';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { Download } from 'lucide-react';
// F-6 : chart.js + plugins enregistres dans @/components/charts

export default function AvancementSemestresPage() {
  const user = getStoredUser();
  const sessionAnnee = user?.annee_universitaire ?? '';
  const sessionSemestre = user?.semestre || 'Pairs';

  const chartRef = useRef<any>(null);

  const { data, isLoading, error: queryError } = useQuery({
    queryKey: ['statistiques', 'semestres', sessionAnnee, sessionSemestre] as const,
    queryFn:  () => apiFetch<any>(
      `/api/v1/avancement/semestres/?annee_universitaire=${encodeURIComponent(sessionAnnee)}&semestres=${encodeURIComponent(sessionSemestre)}`,
    ),
    enabled:  !!sessionAnnee,
  });
  const loading = !!sessionAnnee && isLoading;
  const error = !sessionAnnee
    ? "Année universitaire introuvable dans la session."
    : queryError ? (queryError as Error).message : null;

  const handleDownload = () => {
    if (chartRef.current) {
      const url = chartRef.current.toBase64Image();
      const link = document.createElement('a');
      link.download = `avancement_semestres_${sessionAnnee}_${sessionSemestre}.png`;
      link.href = url;
      link.click();
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Chargement...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* En-tête de la page (sans le bouton) */}
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-800">Avancement par Semestre</h3>
        <p className="text-sm text-gray-500">
          Période : <strong>Semestres {sessionSemestre}</strong>
        </p>
      </div>

      {/* Carte du graphique */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative min-h-[450px]">
        
        {/* Bouton de téléchargement intégré en haut à droite de la carte */}
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

        {error ? (
          <div className="text-red-500 bg-red-50 p-4 rounded-lg text-center italic border border-red-200 mt-8">
            Erreur : {error}
          </div>
        ) : (
          <div style={{ height: '420px', width: '100%' }}>
            <Bar
              ref={chartRef}
              data={{
                labels: data?.labels || [],
                datasets: [
                  { 
                    label: 'CM', 
                    data: data?.progress_cm || [], 
                    backgroundColor: 'rgba(99, 102, 241, 0.85)', // Indigo doux
                    hoverBackgroundColor: '#4f46e5',
                    borderRadius: { topLeft: 6, topRight: 6 },
                  },
                  { 
                    label: 'TD', 
                    data: data?.progress_td || [], 
                    backgroundColor: 'rgba(6, 182, 212, 0.85)', // Cyan apaisant
                    hoverBackgroundColor: '#0891b2',
                    borderRadius: { topLeft: 6, topRight: 6 },
                  },
                  { 
                    label: 'TP', 
                    data: data?.progress_tp || [], 
                    backgroundColor: 'rgba(0, 136, 68, 0.85)', // Vert raccord avec le thème
                    hoverBackgroundColor: '#004d26',
                    borderRadius: { topLeft: 6, topRight: 6 },
                  },
                  { 
                    label: 'PR', 
                    data: data?.progress_pr || [], 
                    backgroundColor: 'rgba(245, 158, 11, 0.85)', // Ambre chaleureux
                    hoverBackgroundColor: '#d97706',
                    borderRadius: { topLeft: 6, topRight: 6 },
                  },
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
                    position: 'top',
                    labels: {
                      usePointStyle: true,
                      padding: 20,
                      font: { family: "'Inter', sans-serif", size: 12, weight: 'bold' }
                    }
                  },
                  datalabels: { 
                    formatter: (v) => v + '%', 
                    anchor: 'end', 
                    align: 'top',
                    offset: 4,
                    color: '#4b5563',
                    font: { size: 11, weight: 'bold' }
                  },
                  tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                      label: (context) => ` ${context.dataset.label}: ${context.raw}%`
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
                    suggestedMax: 110,
                    grid: { color: '#f3f4f6' },
                    border: { display: false, dash: [5, 5] },
                    ticks: { callback: (v) => v + '%', stepSize: 20 }
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