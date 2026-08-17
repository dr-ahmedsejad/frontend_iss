'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, ArrowUpCircle, CalendarDays } from 'lucide-react';
import { useAnneesList } from '@/lib/api/annees-hooks';

interface AnneeOption {
  id:        number;
  annee:     string;
  est_active?: boolean;
}

export default function ProgressionsIndexPage() {
  const router = useRouter();
  const { data, isLoading, error: queryError } = useAnneesList({ page: 1 });

  const annees: AnneeOption[] = (data?.results ?? [])
    .slice()
    .sort((a, b) => b.annee.localeCompare(a.annee));
  const loading = isLoading;
  const error   = queryError ? (queryError as Error).message : '';

  // Si une seule année → redirection immédiate
  useEffect(() => {
    if (!loading && annees.length === 1) {
      router.replace(`/dashboard/scolarite/progressions/${annees[0].id}`);
    }
  }, [loading, annees, router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16 text-slate-500 text-sm gap-2">
        <Loader2 size={18} className="animate-spin" /> Chargement des années universitaires…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-16 gap-3 text-slate-500">
        <AlertCircle size={32} className="text-[#C82020]" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (annees.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 gap-2 text-slate-500">
        <CalendarDays size={32} className="text-slate-300" />
        <p className="text-sm font-medium">Aucune année universitaire</p>
        <p className="text-xs text-slate-400">Créez d'abord une année dans Paramétrage.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Progressions N+1</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Sélectionnez l'année universitaire cible des réinscriptions à gérer
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {annees.map(a => (
          <button
            key={a.id}
            onClick={() => router.push(`/dashboard/scolarite/progressions/${a.id}`)}
            className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 text-left hover:border-[#006633] hover:shadow-md transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#006633]/10 text-[#006633] group-hover:bg-[#006633] group-hover:text-white transition-colors">
                <ArrowUpCircle size={20} />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{a.annee}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Année cible des réinscriptions
                </p>
                {a.est_active && (
                  <span className="inline-flex items-center px-2 py-0.5 mt-2 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                    Active
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-400">
        Astuce : la table Progression est créée à partir d'un PV de délibération clos,
        puis exécutée à la rentrée pour générer les inscriptions N+1.
      </p>
    </div>
  );
}
