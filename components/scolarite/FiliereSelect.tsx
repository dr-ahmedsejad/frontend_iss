'use client';

import { useState, useEffect } from 'react';
import { filieresApi } from '@/lib/api/scolarite';
import type { Filiere } from '@/types/scolarite';

interface FiliereSelectProps {
  value:       number | null;
  onChange:    (id: number | null) => void;
  required?:   boolean;
  label?:      string;
  error?:      string;
  placeholder?: string;
  className?:  string;
  /** Afficher seulement les filières actives. Défaut: true */
  activeOnly?: boolean;
}

/** Select filière avec cache 5 min. Réutilisé sur toutes les pages qui nécessitent une filière. */
export default function FiliereSelect({
  value, onChange, required = false, label = 'Filière',
  error, placeholder = 'Sélectionner une filière', className = '', activeOnly = true,
}: FiliereSelectProps) {
  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    filieresApi.all()
      .then(data => setFilieres(activeOnly ? data.filter(f => f.est_active) : data))
      .catch(() => {/* ignore — UI continues without list */})
      .finally(() => setLoading(false));
  }, [activeOnly]);

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
        <option value="">{loading ? 'Chargement…' : placeholder}</option>
        {filieres.map(f => (
          <option key={f.id} value={f.id}>
            {f.code} — {f.intitule_fr}
          </option>
        ))}
      </select>
      {error && <p className="text-[11px] text-red-600 font-medium">{error}</p>}
    </div>
  );
}
