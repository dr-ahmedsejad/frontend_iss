'use client';

import { API_BASE_URL as API } from '@/lib/api';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, User } from 'lucide-react';
import { etudiantsApi } from '@/lib/api/scolarite';
import type { Etudiant } from '@/types/scolarite';
interface EtudiantPickerProps {
  value:      Etudiant | null;
  onChange:   (e: Etudiant | null) => void;
  label?:     string;
  required?:  boolean;
  error?:     string;
  className?: string;
}

/** Recherche + sélection d'un étudiant via autocomplete. */
export default function EtudiantPicker({
  value, onChange, label = 'Étudiant', required = false, error, className = '',
}: EtudiantPickerProps) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<Etudiant[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await etudiantsApi.search(q);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(e.target.value), 350);
  }

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function select(etudiant: Etudiant) {
    onChange(etudiant);
    setQuery('');
    setOpen(false);
    setResults([]);
  }

  const base = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary transition-all bg-white';

  return (
    <div className={`flex flex-col gap-1 ${className}`} ref={ref}>
      {label && (
        <label className="text-sm font-medium text-iss-dark-soft">
          {label}
          {required && <span className="text-iss-secondary ml-1">*</span>}
        </label>
      )}

      {value ? (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-iss-primary/30 bg-green-50">
          {value.photo ? (
            <img src={value.photo.startsWith('http') ? value.photo : `${API}${value.photo}`} alt="" width={28} height={28} loading="lazy" className="w-7 h-7 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'rgba(0,102,51,0.12)' }}>
              <User size={13} style={{ color: '#006633' }} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-iss-dark truncate">
              {value.prenom_fr} {value.nom_fr}
            </p>
            <p className="text-[11px] text-iss-gray">{value.matricule}</p>
          </div>
          <button type="button" onClick={() => onChange(null)}
            className="shrink-0 text-iss-gray hover:text-iss-secondary transition-colors">
            <X size={15} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray" />
          <input
            type="text"
            value={query}
            onChange={onInput}
            onFocus={() => query.length >= 2 && setOpen(true)}
            placeholder="Rechercher par nom, matricule ou CNI…"
            className={`${base} pl-9 ${error ? 'border-red-400' : ''}`}
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-iss-primary/30 border-t-iss-primary rounded-full animate-spin" />
          )}

          {open && results.length > 0 && (
            <div className="absolute z-50 w-full top-full mt-1 bg-white rounded-xl border border-gray-200 shadow-card-lg overflow-hidden">
              {results.map(e => (
                <button key={e.id} type="button" onClick={() => select(e)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                  {e.photo ? (
                    <img src={e.photo.startsWith('http') ? e.photo : `${API}${e.photo}`} alt="" width={28} height={28} loading="lazy" className="w-7 h-7 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <User size={13} className="text-iss-gray" />
                    </div>
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-iss-dark truncate">{e.prenom_fr} {e.nom_fr}</p>
                    <p className="text-[11px] text-iss-gray">{e.matricule} · {e.filiere_nom ?? '—'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {open && !loading && query.length >= 2 && results.length === 0 && (
            <div className="absolute z-50 w-full top-full mt-1 bg-white rounded-xl border border-gray-200 shadow-card p-4 text-center">
              <p className="text-sm text-iss-gray">Aucun étudiant trouvé</p>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-[11px] text-red-600 font-medium">{error}</p>}
    </div>
  );
}
