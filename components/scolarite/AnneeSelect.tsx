'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface Year { id: number; annee: string; est_active: boolean; }

interface AnneeSelectProps {
  value:       number | null;
  onChange:    (id: number | null) => void;
  required?:   boolean;
  label?:      string;
  error?:      string;
  className?:  string;
}

/** Select année universitaire — charge depuis /api/v1/parametres/annees/. */
export default function AnneeSelect({
  value, onChange, required = false, label = 'Année universitaire',
  error, className = '',
}: AnneeSelectProps) {
  const [annees, setAnnees] = useState<Year[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ results: Year[] } | Year[]>('/api/v1/parametres/annees/?page_size=20')
      .then(raw => {
        const list = Array.isArray(raw) ? raw : raw.results;
        setAnnees(list);
        // Auto-select l'année active si aucune valeur
        if (!value) {
          const active = list.find(a => a.est_active);
          if (active) onChange(active.id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const base = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-iss-dark focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary transition-all bg-white disabled:bg-gray-50';

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-sm font-medium text-iss-dark-soft">
        {label}
        {required && <span className="text-iss-secondary ml-1">*</span>}
      </label>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={loading}
        required={required}
        className={`${base} ${error ? 'border-red-400' : ''}`}
      >
        <option value="">{loading ? 'Chargement…' : 'Sélectionner une année'}</option>
        {annees.map(a => (
          <option key={a.id} value={a.id}>
            {a.annee}{a.est_active ? ' (active)' : ''}
          </option>
        ))}
      </select>
      {error && <p className="text-[11px] text-red-600 font-medium">{error}</p>}
    </div>
  );
}
