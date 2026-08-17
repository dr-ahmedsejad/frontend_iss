'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { FileSearch, Loader2, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { preinscriptionsApi } from '@/lib/api/inscriptions';
import Link from 'next/link';

interface SuiviData {
  token: string;
  numero_dossier: string;
  nom_fr: string;
  prenom_fr: string;
  filiere: number | null;
  annee_univ: number | null;
  statut: 'soumise' | 'en_examen' | 'acceptee' | 'rejetee' | 'inscrite';
  motif_rejet: string;
  date_soumission: string;
}

const STATUT_CONFIG: Record<SuiviData['statut'], {
  label: string;
  color: string;
  bg: string;
  border: string;
  Icon: typeof CheckCircle2;
}> = {
  soumise:    { label: 'Soumise — en attente d\'examen', color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200',   Icon: Clock },
  en_examen:  { label: 'En cours d\'examen',             color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200',  Icon: AlertCircle },
  acceptee:   { label: 'Acceptée',                       color: 'text-emerald-600',bg: 'bg-emerald-50',border: 'border-emerald-200', Icon: CheckCircle2 },
  rejetee:    { label: 'Rejetée',                        color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    Icon: XCircle },
  inscrite:   { label: 'Inscrite',                       color: 'text-iss-primary',bg: 'bg-green-50',  border: 'border-green-200',  Icon: CheckCircle2 },
};

export default function SuiviPreinscriptionPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData]       = useState<SuiviData | null>(null);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    preinscriptionsApi.suivi(token)
      .then(d => setData(d as unknown as SuiviData))
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #f0f7f3 0%, #e8f4ec 100%)' }}>

      {/* Branding */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
          <FileSearch size={24} className="text-white" />
        </div>
        <div>
          <p className="text-xl font-bold text-iss-dark">Suivi de dossier</p>
          <p className="text-sm text-iss-gray">Pré-inscription — SIGA</p>
        </div>
      </div>

      <div className="w-full max-w-md space-y-4">
        {loading && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 shadow-card flex flex-col items-center gap-4">
            <Loader2 size={36} className="text-iss-primary animate-spin" />
            <p className="text-sm text-iss-gray">Chargement du dossier…</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-white rounded-2xl border border-red-200 p-8 shadow-card text-center">
            <XCircle size={40} className="text-red-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-iss-dark mb-2">Dossier introuvable</h2>
            <p className="text-sm text-iss-gray">
              Aucun dossier ne correspond à ce numéro de suivi. Vérifiez le numéro et réessayez.
            </p>
          </div>
        )}

        {!loading && data && (() => {
          const cfg = STATUT_CONFIG[data.statut] ?? STATUT_CONFIG.soumise;
          const { Icon } = cfg;
          return (
            <div className={`bg-white rounded-2xl border ${cfg.border} p-6 shadow-card space-y-5`}>
              {/* Statut badge */}
              <div className={`flex items-center gap-3 ${cfg.bg} rounded-xl p-4`}>
                <Icon size={24} className={cfg.color} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-iss-gray">Statut</p>
                  <p className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</p>
                </div>
              </div>

              {/* Identité */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-iss-gray uppercase tracking-wide">Candidat</p>
                <p className="text-base font-semibold text-iss-dark">
                  {data.nom_fr} {data.prenom_fr}
                </p>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-iss-gray">Date de soumission</p>
                  <p className="font-medium text-iss-dark">
                    {new Date(data.date_soumission).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-iss-gray">Numéro de dossier</p>
                  <p className="font-mono text-xs text-iss-dark break-all">{String(data.token || data.numero_dossier)}</p>
                </div>
              </div>

              {/* Motif rejet */}
              {data.statut === 'rejetee' && data.motif_rejet && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-red-700 mb-1">Motif du rejet</p>
                  <p className="text-sm text-red-700">{data.motif_rejet}</p>
                </div>
              )}

              {/* Message contextuel */}
              {data.statut === 'acceptee' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700">
                  Votre dossier a été accepté. Vous serez contacté(e) pour finaliser votre inscription.
                </div>
              )}
              {data.statut === 'soumise' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
                  Votre dossier a été reçu et sera examiné prochainement. Conservez ce numéro de suivi.
                </div>
              )}
            </div>
          );
        })()}

        <Link href="/preinscription"
          className="block w-full py-3 rounded-xl text-sm font-semibold text-iss-gray border border-gray-200 text-center bg-white hover:bg-gray-50 transition-colors">
          Nouvelle demande
        </Link>
      </div>
    </div>
  );
}
