'use client';

import { useState, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { Etudiant } from '@/types/absences';

interface Props {
  value?: string;
  onSelect: (etu: Etudiant) => void;
  placeholder?: string;
  className?: string;
}

export default function EtudiantAutocomplete({
  value = '', onSelect, placeholder = 'Matricule ou nom…', className = '',
}: Props) {
  const [query,   setQuery]   = useState(value);
  const [results, setResults] = useState<Etudiant[]>([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(v: string) {
    setQuery(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.length < 2) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{ results: Etudiant[] } | Etudiant[]>(
          `/api/v1/absences/etudiants/?search=${encodeURIComponent(v)}&page_size=10`,
        );
        const list = Array.isArray(res) ? res : res.results;
        setResults(list);
        setOpen(list.length > 0);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
  }

  function select(etu: Etudiant) {
    setQuery(`${etu.matricule} — ${etu.nom}`);
    setOpen(false);
    onSelect(etu);
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative flex items-center">
        <input
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#006633] focus:ring-1 focus:ring-[#006633]/30"
        />
        <Search size={14} className="absolute left-3 text-gray-400 pointer-events-none" />
        {loading && <Loader2 size={12} className="absolute right-3 animate-spin text-gray-400" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-30 top-full mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden max-h-64 overflow-y-auto">
          {results.map(etu => (
            <button
              key={etu.id}
              onMouseDown={() => select(etu)}
              className="w-full flex flex-col items-start px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
            >
              <span className="text-sm font-semibold text-gray-900">{etu.nom}</span>
              <span className="text-xs text-gray-500">{etu.matricule} · {etu.departement_nom}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
