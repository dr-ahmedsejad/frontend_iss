'use client';

import { useState, useEffect } from 'react';
import { semestresApi } from '@/lib/api/scolarite';
import type { Semestre } from '@/types/scolarite';

interface SemestreSelectProps {
  value:      number | null;
  onChange:   (id: number | null) => void;
  required?:  boolean;
  label?:     string;
  error?:     string;
  className?: string;
}

/** Select semestre — charge tous les semestres disponibles. */
export default function SemestreSelect({
  value, onChange, required = false,
  label = 'Semestre', error, className = '',
}: SemestreSelectProps) {
  const [semestres, setSemestres] = useState<Semestre[]>([]);
  const [loading, setLoading]    = useState(true);

  useEffect(() => {
    semestresApi.all()
      .then(data => setSemestres(data))
      .catch(() => {})
      .finally(() => setLoading(false));
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
        <option value="">{loading ? 'Chargement…' : 'Tous semestres'}</option>
        {semestres.map(s => (
          <option key={s.id} value={s.id}>
            {s.code_semestre} — {s.semestre}
          </option>
        ))}
      </select>
      {error && <p className="text-[11px] text-red-600 font-medium">{error}</p>}
    </div>
  );
}
