'use client';

import {
  TrendingUp, RotateCcw, Calendar, AlertCircle,
  Loader2, Lock, CheckCircle2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProgressionEtudiant {
  decision:          string;
  decision_label:    string;
  filiere_source:    { code: string; intitule_fr: string };
  filiere_cible:     { code: string; intitule_fr: string } | null;
  niveau_source:     number;
  niveau_cible:      number | null;
  credits_annuels:   number;
  taux_capitalisation: string | null;
  annee_source:      string;
  annee_cible:       string;
  seuil_progression: number;
  type_diplome:      string;
  statut:            string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DECISION_CONFIG: Record<string, {
  label: string; bg: string; text: string; border: string; icon: React.ElementType;
}> = {
  progression:   { label: 'Admis — Passage au niveau supérieur', bg: 'bg-green-50',  text: 'text-green-800',  border: 'border-green-200',  icon: TrendingUp    },
  redoublement:  { label: 'Redoublement autorisé',               bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200', icon: RotateCcw     },
  annee_blanche: { label: 'Année blanche — Absence médicale',    bg: 'bg-blue-50',   text: 'text-blue-800',   border: 'border-blue-200',   icon: Calendar      },
  exclusion:     { label: 'Exclusion du cycle',                  bg: 'bg-red-50',    text: 'text-red-800',    border: 'border-red-200',    icon: AlertCircle   },
};

function niveauLabel(n: number | null, type: string): string {
  if (n === null) return '—';
  const prefix = type === 'ING' ? 'E' : 'L';
  return `${prefix}${n}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProgressionEtudiantPage() {
  const { data, isLoading, error: queryError } = useQuery({
    queryKey: ['inscriptions', 'etudiant', 'progression'] as const,
    queryFn:  () => apiFetch<ProgressionEtudiant>('/api/v1/inscriptions/etudiant/progression/'),
  });
  const loading = isLoading;
  const error   = queryError ? (queryError as Error).message : '';

  // ── États de chargement ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center py-16 text-slate-500 text-sm gap-2">
        <Loader2 size={18} className="animate-spin" /> Chargement de votre progression…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center py-16 gap-3 text-slate-500">
        <AlertCircle size={32} className="text-[#C82020]" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 flex flex-col items-center py-16 gap-2 text-slate-500">
        <Lock size={32} className="text-slate-300" />
        <p className="text-sm font-medium">Résultats non encore publiés</p>
        <p className="text-xs text-slate-400">La délibération annuelle n'a pas encore été clôturée.</p>
      </div>
    );
  }

  const config = DECISION_CONFIG[data.decision] ?? {
    label: data.decision_label,
    bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-200',
    icon: CheckCircle2,
  };
  const Icon = config.icon;

  const creditsRestants = 60 - data.credits_annuels;
  const tauxNum = data.taux_capitalisation ? Number(data.taux_capitalisation) : 0;

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ma progression</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Année {data.annee_source} — Décision du jury
        </p>
      </div>

      {/* Carte décision */}
      <div className={`rounded-lg border p-5 ${config.bg} ${config.border}`}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-white/60 ${config.text}`}>
            <Icon size={20} />
          </div>
          <div>
            <p className={`font-semibold ${config.text}`}>{config.label}</p>
            <p className={`text-sm mt-0.5 ${config.text} opacity-75`}>
              Année cible : {data.annee_cible}
            </p>
          </div>
        </div>
      </div>

      {/* Détails filière / niveau */}
      {data.decision !== 'exclusion' && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 space-y-3">
          <h2 className="text-base font-semibold text-slate-800">Inscription prévue</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Filière actuelle</p>
              <p className="font-medium text-slate-800">{data.filiere_source.code}</p>
              <p className="text-xs text-slate-500">{data.filiere_source.intitule_fr}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Filière N+1</p>
              {data.filiere_cible ? (
                <>
                  <p className={`font-medium ${data.filiere_cible.code !== data.filiere_source.code ? 'text-blue-700' : 'text-slate-800'}`}>
                    {data.filiere_cible.code}
                  </p>
                  <p className="text-xs text-slate-500">{data.filiere_cible.intitule_fr}</p>
                </>
              ) : (
                <p className="text-slate-400 italic text-xs">Non définie</p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Niveau actuel</p>
              <p className="font-medium text-slate-800">{niveauLabel(data.niveau_source, data.type_diplome)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Niveau N+1</p>
              <p className="font-medium text-slate-800">{niveauLabel(data.niveau_cible, data.type_diplome)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Crédits & seuil */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Crédits capitalisés</h2>

        {/* Barre de progression */}
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{data.credits_annuels} / 60 crédits</span>
            <span>{tauxNum.toFixed(0)} %</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                tauxNum >= data.seuil_progression ? 'bg-green-500' :
                tauxNum >= data.seuil_progression * 0.8 ? 'bg-yellow-400' : 'bg-red-400'
              }`}
              style={{ width: `${Math.min(tauxNum, 100)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center text-sm">
          <div className="bg-slate-50 rounded-md p-3">
            <p className="text-xl font-bold tabular-nums text-slate-900">{data.credits_annuels}</p>
            <p className="text-xs text-slate-500 mt-0.5">Crédits validés</p>
          </div>
          <div className="bg-slate-50 rounded-md p-3">
            <p className="text-xl font-bold tabular-nums text-slate-400">{creditsRestants}</p>
            <p className="text-xs text-slate-500 mt-0.5">Restants</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center">
        Cette page est mise à jour après la clôture officielle du procès-verbal de délibération.
      </p>
    </div>
  );
}
