'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { yearsApi } from '@/lib/api/scolarite';
import { updateContexte } from '@/lib/auth';
import type { Contexte, SemestreType } from '@/lib/auth';

interface Props {
  annee:     string;
  semestre:  SemestreType;
  /** Appelé après une mise à jour réussie du contexte (année/semestre). */
  onChanged: (c: Contexte) => void;
}

const SEMESTRES: { value: SemestreType; label: string; hint: string }[] = [
  { value: 'Impairs', label: 'Impairs', hint: 'S1 · S3 · S5' },
  { value: 'Pairs',   label: 'Pairs',   hint: 'S2 · S4 · S6' },
];

/**
 * Sélecteur de contexte (année universitaire + semestre) dans la barre du haut.
 * Persiste côté serveur via PATCH /auth/contexte/ (pas de re-login) puis remonte
 * le changement au layout, qui purge le cache et remonte la page courante.
 */
export default function ContextSwitcher({ annee, semestre, onChanged }: Props) {
  const [open,   setOpen]   = useState(false);
  const [draftA, setDraftA] = useState(annee);
  const [draftS, setDraftS] = useState<SemestreType>(semestre);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // (re)synchronise le brouillon à l'ouverture / si le contexte change ailleurs
  useEffect(() => {
    if (open) { setDraftA(annee); setDraftS(semestre); setError(null); }
  }, [open, annee, semestre]);

  // Liste des années — chargée seulement quand le menu est ouvert.
  const { data: yearsData } = useQuery({
    queryKey: ['scolarite', 'years', 'list'] as const,
    queryFn:  () => yearsApi.list(),
    enabled:  open,
  });
  const years = yearsData?.results ?? [];

  // Fermeture au clic extérieur + Escape.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const dirty = draftA !== annee || draftS !== semestre;

  async function apply() {
    if (!dirty || saving) return;
    setSaving(true); setError(null);
    try {
      const c = await updateContexte({ annee_universitaire: draftA, semestre: draftS });
      setOpen(false);
      onChanged(c);
    } catch (e) {
      setError((e as Error).message || 'Échec de la mise à jour.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative hidden sm:block" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        title="Changer l'année universitaire et le semestre"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors">
        <span className="text-xs font-bold text-iss-dark">{annee || '—'}</span>
        <span className="w-px h-3 bg-gray-300" />
        <span className="text-xs font-medium" style={{ color: '#006633' }}>{semestre}</span>
        <ChevronDown size={13} className={`text-iss-gray transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-gray-100 bg-white shadow-lg p-4 z-50 space-y-3">
          <p className="text-xs font-semibold text-iss-dark-soft">Contexte de travail</p>

          {/* Année universitaire */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-iss-gray">Année universitaire</label>
            <select value={draftA} onChange={e => setDraftA(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary">
              {years.length === 0 && <option value={annee}>{annee || '—'}</option>}
              {years.map(y => (
                <option key={y.id} value={y.annee}>
                  {y.annee}{y.est_active ? ' (active)' : ''}{y.est_cloturee ? ' (clôturée)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Semestre */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-iss-gray">Semestre</label>
            <div className="grid grid-cols-2 gap-2">
              {SEMESTRES.map(s => {
                const active = draftS === s.value;
                return (
                  <button key={s.value} type="button" onClick={() => setDraftS(s.value)}
                    className={`rounded-xl border px-2 py-1.5 text-center transition-colors
                      ${active ? 'border-iss-primary bg-iss-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
                    <span className="block text-xs font-semibold text-iss-dark">{s.label}</span>
                    <span className="block text-[10px] text-iss-gray">{s.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-[11px] text-red-600">{error}</p>}

          <button type="button" onClick={apply} disabled={!dirty || saving}
            className="w-full py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {saving ? 'Application…' : 'Appliquer'}
          </button>
        </div>
      )}
    </div>
  );
}
