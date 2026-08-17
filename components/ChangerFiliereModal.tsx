'use client';

import { useEffect, useState } from 'react';
import { X, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useModalA11y } from '@/hooks/useModalA11y';

interface Filiere {
  id:             number;
  code:           string;
  intitule_fr:    string;
  filiere_parent: number | null;
  niveau_debut:   number;
  niveau_fin:     number;
  label_niveaux?: string;
}

export interface ProgressionLike {
  id:            number;
  matricule:     string;
  etudiant:      string;
  filiere_source: { id: number; code: string; filiere_parent?: number | null };
  filiere_cible:  { id: number; code: string } | null;
  niveau_source:  number;
  niveau_cible:   number | null;
}

interface Props {
  open:        boolean;
  progression: ProgressionLike | null;
  onClose:     () => void;
  onSuccess:   (updated: ProgressionLike) => void;
}

export function ChangerFiliereModal({ open, progression, onClose, onSuccess }: Props) {
  const containerRef = useModalA11y<HTMLDivElement>({ open, onClose });
  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [filiereCibleId, setFiliereCibleId] = useState<number | ''>('');
  const [motif, setMotif] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingFilieres, setLoadingFilieres] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !progression) return;
    setFiliereCibleId('');
    setMotif('');
    setError('');

    setLoadingFilieres(true);
    // L'API filières est paginée → on demande page_size élevé pour récupérer toutes les filières
    apiFetch<Filiere[] | { results: Filiere[] }>('/api/v1/scolarite/filieres/?page_size=500')
      .then(data => {
        const list: Filiere[] = Array.isArray(data) ? data : (data?.results ?? []);
        const sourceId       = progression.filiere_source.id;
        const sourceParentId = progression.filiere_source.filiere_parent ?? null;
        const niveauCible    = progression.niveau_cible;

        // Compatibilité hiérarchique (filiere_parent) ET de niveau (niveau_debut/fin)
        const compatibles = list.filter(f => {
          if (f.id === sourceId) return false;

          // 1) Vérification hiérarchique
          let hierarchieOk = false;
          if (sourceParentId === null && (f.filiere_parent ?? null) === null) hierarchieOk = true;
          else if (sourceParentId !== null && f.filiere_parent === sourceParentId) hierarchieOk = true;
          else if (sourceParentId !== null && f.id === sourceParentId) hierarchieOk = true;
          else if (f.filiere_parent === sourceId) hierarchieOk = true;
          if (!hierarchieOk) return false;

          // 2) Vérification du niveau cible (la filière doit couvrir ce niveau)
          if (niveauCible !== null) {
            if (niveauCible < f.niveau_debut || niveauCible > f.niveau_fin) return false;
          }
          return true;
        });
        setFilieres(compatibles);
      })
      .catch(() => setFilieres([]))
      .finally(() => setLoadingFilieres(false));
  }, [open, progression]);

  // Fermeture sur Échap
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open || !progression) return null;

  const handleSubmit = async () => {
    if (!filiereCibleId) { setError('Veuillez sélectionner une filière cible.'); return; }
    if (!motif.trim())   { setError('Le motif de modification est obligatoire.'); return; }
    setError('');
    setLoading(true);
    try {
      const updated = await apiFetch<ProgressionLike>(
        `/api/v1/inscriptions/progressions/${progression.id}/`,
        {
          method: 'PATCH',
          body:   { filiere_cible_id: filiereCibleId, motif: motif.trim() },
        },
      );
      onSuccess(updated);
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Erreur lors de la modification.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,15,26,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="changer-filiere-title"
        className="bg-white rounded-lg shadow-lg w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 id="changer-filiere-title" className="text-lg font-semibold text-slate-900">Changer de filière</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {progression.matricule} — {progression.etudiant}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:bg-slate-100 transition-colors"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Filière courante → cible */}
        <div className="flex items-center gap-2 text-sm mb-4 p-3 bg-slate-50 rounded-md border border-slate-200">
          <span className="font-medium text-slate-700">{progression.filiere_source.code}</span>
          <ArrowRight size={14} className="text-slate-400 shrink-0" />
          <span className="text-slate-400">(à sélectionner)</span>
        </div>

        {/* Information */}
        <div className="flex gap-2 p-3 rounded-md bg-blue-50 border border-blue-200 mb-4">
          <AlertTriangle size={15} className="text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 leading-relaxed">
            Cette modification s'applique à la <strong>réinscription N+1</strong> uniquement.
            L'inscription en cours et toutes les notes/résultats de l'année actuelle
            restent intacts et rattachés à la filière d'origine.
          </p>
        </div>

        {/* Sélection filière */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Nouvelle filière <span className="text-red-500">*</span>
          </label>
          {loadingFilieres ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
              <Loader2 size={14} className="animate-spin" /> Chargement…
            </div>
          ) : filieres.length === 0 ? (
            <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Aucune filière compatible disponible pour le niveau cible
                <strong> L{progression.niveau_cible ?? '?'}</strong>.
                Vérifiez que la filière source a une parente commune avec d'autres filières
                couvrant ce niveau, ou ajustez les bornes <em>niveau_debut</em> / <em>niveau_fin</em>
                des filières.
              </p>
            </div>
          ) : (
            <select
              value={filiereCibleId}
              onChange={e => setFiliereCibleId(e.target.value ? Number(e.target.value) : '')}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40"
            >
              <option value="">— Sélectionner —</option>
              {filieres.map(f => {
                const niveaux = f.niveau_debut === f.niveau_fin
                  ? `L${f.niveau_debut}`
                  : `L${f.niveau_debut} → L${f.niveau_fin}`;
                return (
                  <option key={f.id} value={f.id}>
                    {f.code} — {f.intitule_fr} ({niveaux})
                  </option>
                );
              })}
            </select>
          )}
        </div>

        {/* Motif */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Motif <span className="text-red-500">*</span>
          </label>
          <textarea
            value={motif}
            onChange={e => setMotif(e.target.value)}
            rows={3}
            placeholder="Ex : Demande de transfert validée en conseil pédagogique du 12/09/2025"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40 resize-none"
          />
        </div>

        {/* Erreur */}
        {error && (
          <p className="text-xs text-[#C82020] mb-3">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || loadingFilieres}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-[#006633] hover:bg-[#00552a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Confirmer le changement
          </button>
        </div>
      </div>
    </div>
  );
}
