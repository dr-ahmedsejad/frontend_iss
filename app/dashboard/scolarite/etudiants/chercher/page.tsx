'use client';

import { API_BASE_URL as API } from '@/lib/api';
import { useState, useEffect, useRef } from 'react';
import { Search, User, Loader2, X } from 'lucide-react';
import { etudiantsApi } from '@/lib/api/scolarite';
import StatusPill from '@/components/ui/StatusPill';
import EtudiantDossier from '@/components/scolarite/EtudiantDossier';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import type { Etudiant } from '@/types/scolarite';
export default function ChercherEtudiantPage() {
  const toast = useToast();

  const [query,       setQuery]       = useState('');   // valeur affichée dans l'input
  const [searchTerm,  setSearchTerm]  = useState('');   // terme qui déclenche la recherche
  const [suggestions, setSuggestions] = useState<Etudiant[]>([]);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const [showSugg,    setShowSugg]    = useState(false);
  const [dossier,     setDossier]     = useState<Etudiant | null>(null);

  const inputRef    = useRef<HTMLInputElement>(null);
  const wrapperRef  = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Debounce search — déclenché uniquement par searchTerm ─────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchTerm.trim() || searchTerm.length < 2) {
      setSuggestions([]); setShowSugg(false); return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoadingSugg(true);
      try {
        const res = await etudiantsApi.search(searchTerm);
        setSuggestions(res);
        setShowSugg(true);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoadingSugg(false);
      }
    }, 300);
  }, [searchTerm]);

  // Fermer dropdown au clic extérieur
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setShowSugg(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function selectStudent(e: Etudiant) {
    setDossier(e);
    setShowSugg(false);
    setSuggestions([]);
    // On met à jour l'affichage SANS toucher searchTerm → pas de nouvelle recherche
    setQuery(`${[e.prenom_fr, e.nom_fr].filter(Boolean).join(' ')} — ${e.matricule}`);
  }

  function clear() {
    setDossier(null);
    setQuery('');
    setSearchTerm('');
    setSuggestions([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
          <Search size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Chercher un étudiant</h1>
          <p className="text-sm text-iss-gray">Recherche par nom, prénom ou matricule</p>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card">
        <div ref={wrapperRef} className="relative">
          <div className="relative flex items-center">
            {loadingSugg
              ? <Loader2 size={18} className="absolute left-4 text-iss-primary animate-spin" />
              : <Search size={18} className="absolute left-4 text-iss-gray" />
            }
            <input
              ref={inputRef}
              type="text"
              placeholder="Saisissez un nom, prénom ou matricule…"
              value={query}
              onChange={e => {
                const v = e.target.value;
                setQuery(v);
                setSearchTerm(v);
                if (dossier) setDossier(null);
              }}
              onFocus={() => suggestions.length > 0 && setShowSugg(true)}
              autoFocus
              className="w-full border border-gray-200 rounded-xl pl-11 pr-12 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary transition-all"
            />
            {query && (
              <button onClick={clear}
                className="absolute right-4 text-iss-gray hover:text-iss-dark transition-colors">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Suggestions */}
          {showSugg && suggestions.length > 0 && (
            <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
              {suggestions.map(e => (
                <button key={e.id} onMouseDown={() => selectStudent(e)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 transition-colors text-left border-b border-gray-50 last:border-0">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {e.photo
                      ? <img src={e.photo.startsWith('http') ? e.photo : `${API}${e.photo}`}
                          alt="" className="w-10 h-10 object-cover" />
                      : <User size={16} className="text-iss-gray" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-iss-dark">
                      {[e.prenom_fr, e.nom_fr].filter(Boolean).join(' ')}
                      {e.nom_ar && (
                        <span className="ml-2 text-iss-gray font-normal text-xs" dir="rtl">
                          {[e.prenom_ar, e.nom_ar].filter(Boolean).join(' ')}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-iss-gray font-mono">
                      {e.matricule}
                      {(e.inscription_actuelle?.filiere_nom ?? e.filiere_nom) ? ` · ${e.inscription_actuelle?.filiere_nom ?? e.filiere_nom}` : ''}
                      {(e.inscription_actuelle?.niveau ?? e.niveau_nom) ? ` · ${e.inscription_actuelle?.niveau ?? e.niveau_nom}` : ''}
                    </p>
                  </div>
                  <StatusPill statut={e.statut_effectif ?? e.statut} />
                </button>
              ))}
            </div>
          )}

          {showSugg && !loadingSugg && suggestions.length === 0 && query.length >= 2 && (
            <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white rounded-xl border border-gray-200 shadow-lg px-5 py-4">
              <p className="text-sm text-iss-gray">Aucun étudiant trouvé pour « {query} »</p>
            </div>
          )}
        </div>

        {!dossier && !query && (
          <p className="mt-4 text-xs text-iss-gray text-center">
            Tapez au moins 2 caractères pour lancer la recherche
          </p>
        )}
      </div>

      {/* Dossier */}
      {dossier && (
        <EtudiantDossier etudiant={dossier} onClose={clear} />
      )}
    </div>
  );
}
