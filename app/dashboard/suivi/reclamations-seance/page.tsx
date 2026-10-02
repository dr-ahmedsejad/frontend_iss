'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Info, Loader2 } from 'lucide-react';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/formatters';
import {
  fetchReclamationsSeance, reclamationSeanceKeys, traiterReclamationSeance,
  type ReclamationSeance, type StatutSeance,
} from '@/lib/api/portail-en-ligne';

const VERT = 'linear-gradient(135deg,#006633,#008844)';

const ONGLETS: { valeur: StatutSeance | ''; label: string }[] = [
  { valeur: 'en_attente', label: 'En attente' },
  { valeur: 'acceptee',   label: 'Acceptées' },
  { valeur: 'rejetee',    label: 'Rejetées' },
  { valeur: '',           label: 'Toutes' },
];

const PASTILLE: Record<StatutSeance, string> = {
  en_attente: 'bg-amber-100 text-amber-800',
  acceptee:   'bg-green-100 text-green-800',
  rejetee:    'bg-red-100 text-red-800',
};
const LIBELLE: Record<StatutSeance, string> = {
  en_attente: 'En attente', acceptee: 'Acceptée', rejetee: 'Rejetée',
};

export default function ReclamationsSeancePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [statut, setStatut] = useState<StatutSeance | ''>('en_attente');
  const { data, isLoading } = useQuery({
    queryKey: reclamationSeanceKeys.list(statut),
    queryFn:  () => fetchReclamationsSeance(statut || undefined),
  });

  return (
    <div className="max-w-5xl space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: VERT }}>
          <ClipboardCheck size={14} className="text-white" />
        </div>
        <h1 className="text-xl font-bold text-iss-dark">Réclamations de séance</h1>
      </div>

      {/* Ce que le traitement fait — et ne fait pas */}
      <div className="flex gap-2 rounded-2xl border px-4 py-3 text-xs text-blue-950"
        style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.30)' }}>
        <Info size={14} className="shrink-0 mt-0.5 text-blue-700" />
        <p>Déposées par les enseignants sur le portail en ligne. Accepter ou rejeter <strong>informe
          l’enseignant</strong> : cela ne corrige ni le pointage, ni la charge, ni la paie. La correction se
          fait sur le serveur de travail, et apparaît sur le portail à la publication suivante.</p>
      </div>

      <div className="flex flex-wrap gap-1">
        {ONGLETS.map(o => (
          <button key={o.label} onClick={() => setStatut(o.valeur)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${statut === o.valeur
              ? 'bg-iss-primary text-white' : 'bg-white border border-gray-200 text-iss-gray hover:bg-gray-50'}`}>
            {o.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-iss-gray">Chargement…</p>}
      {data?.length === 0 && (
        <p className="text-sm text-iss-gray bg-white rounded-2xl border border-gray-100 p-6 text-center">
          Aucune réclamation {statut ? LIBELLE[statut as StatutSeance].toLowerCase() : ''}.
        </p>
      )}
      <div className="space-y-3">
        {(data ?? []).map(r => (
          <Carte key={r.id} r={r}
            onTraitee={(msg) => { toast.success(msg); qc.invalidateQueries({ queryKey: reclamationSeanceKeys.all }); }}
            onErreur={(msg) => toast.error(msg)} />
        ))}
      </div>
    </div>
  );
}

function Carte({ r, onTraitee, onErreur }: {
  r: ReclamationSeance; onTraitee: (m: string) => void; onErreur: (m: string) => void;
}) {
  const [reponse, setReponse] = useState('');
  const traiter = useMutation({
    mutationFn: (s: 'acceptee' | 'rejetee') => traiterReclamationSeance(r.id, s, reponse.trim()),
    onSuccess: (x) => onTraitee(x.statut === 'acceptee' ? 'Réclamation acceptée.' : 'Réclamation rejetée.'),
    onError: (e: Error) => onErreur(e.message),
  });
  const seance = [r.jour, r.creneau, r.type_seance].filter(Boolean).join(' · ');

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-iss-dark">
            {r.prof_nom || '—'} — <code className="text-xs">{r.em_code || '—'}</code> {r.em_intitule}
          </p>
          <p className="text-xs text-iss-gray">
            Semaine {r.numero_semaine ?? '—'} · {seance || '—'}
            {r.salle_nom ? ` · ${r.salle_nom}` : ''}{r.groupes ? ` · ${r.groupes}` : ''}
          </p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${PASTILLE[r.statut]}`}>{LIBELLE[r.statut]}</span>
      </div>
      <p className="text-sm text-iss-dark-soft whitespace-pre-line">{r.motif}</p>
      <p className="text-[11px] text-iss-gray">Déposée le {formatDateTime(r.date_soumission)}</p>

      {r.statut === 'en_attente' ? (
        <div className="space-y-2 pt-1">
          <textarea value={reponse} onChange={e => setReponse(e.target.value)} rows={2}
            placeholder="Réponse à l’enseignant (facultatif)"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button disabled={traiter.isPending} onClick={() => traiter.mutate('acceptee')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-60"
              style={{ background: VERT }}>
              {traiter.isPending && <Loader2 size={12} className="animate-spin" />} Accepter
            </button>
            <button disabled={traiter.isPending} onClick={() => traiter.mutate('rejetee')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-60">
              Rejeter
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-iss-dark-soft border-t border-gray-100 pt-2">
          {r.reponse || <span className="text-iss-gray">Sans réponse.</span>}
          <span className="text-iss-gray"> — {r.traitee_par_nom ?? '—'}, {formatDateTime(r.date_traitement)}</span>
        </p>
      )}
    </div>
  );
}
