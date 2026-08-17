'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Banknote, Loader2, X, ChevronDown } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { setFlash } from '@/lib/flash';

const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";

interface Prof        { id: number; nom: string; type?: string; }
interface EM          {
  id: number; code_em: string; intitule: string; departement_nom?: string;
  filiere_id?: number | null;          // depuis departement.filiere (annuel)
  module_filiere_id?: number | null;   // depuis module_lmd.filiere (stable, prioritaire)
  niveau_id?: number | null;           // depuis semestre.niveau_semestre
}
interface Seance      { id: number; type_seance: string; }
interface Departement { id: number; nom: string; filiere?: number | null; niveau?: number | null; niveau_nom?: string | null; filiere_code?: string | null; groupe?: string | null; }

/* ── Composant autocomplete générique ────────────────────────────── */
function AutocompleteField<T extends { id: number }>({
  label, required, placeholder, fetchUrl, localItems, getLabel, value, onChange,
}: {
  label: string;
  required?: boolean;
  placeholder: string;
  fetchUrl?: (q: string) => string;
  localItems?: T[];                 // si fourni, filtre en local sans fetch
  getLabel: (item: T) => string;
  value: T | null;
  onChange: (item: T | null) => void;
}) {
  const [query,   setQuery]   = useState('');
  const [items,   setItems]   = useState<T[]>([]);
  const [open,    setOpen]    = useState(false);
  const [busy,    setBusy]    = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (!value) setQuery(''); }, [value]);

  // Init local items
  useEffect(() => {
    if (localItems) setItems(localItems);
  }, [localItems]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = useCallback((q: string) => {
    if (localItems) {
      // Filtrage local instantané
      const lq = q.toLowerCase();
      setItems(lq ? localItems.filter(i => getLabel(i).toLowerCase().includes(lq)) : localItems);
      return;
    }
    if (!fetchUrl) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const data = await apiFetch<{ results: T[] } | T[]>(fetchUrl(q));
        setItems(Array.isArray(data) ? data : (data as { results: T[] }).results ?? []);
      } catch { setItems([]); }
      finally { setBusy(false); }
    }, 280);
  }, [fetchUrl, localItems, getLabel]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    onChange(null);
    setOpen(true);
    doSearch(q);
  };

  const handleFocus = () => {
    setOpen(true);
    if (!localItems && items.length === 0) doSearch(query);
  };

  const handleSelect = (item: T) => {
    onChange(item);
    setQuery(getLabel(item));
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
    if (localItems) setItems(localItems); else doSearch('');
  };

  const displayed = localItems
    ? (query ? items : localItems)
    : items;

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-xs font-semibold text-iss-dark mb-1.5">
        {label}{required && <span className="text-iss-secondary ml-0.5">*</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={`${INPUT} pr-8`}
          autoComplete="off"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          {busy ? (
            <Loader2 size={14} className="text-gray-400 animate-spin" />
          ) : value ? (
            <button type="button" onMouseDown={handleClear} className="pointer-events-auto text-gray-400 hover:text-red-500">
              <X size={14} />
            </button>
          ) : (
            <ChevronDown size={14} className="text-gray-400" />
          )}
        </span>
      </div>

      {open && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto text-sm">
          {displayed.length > 0 ? displayed.map(item => (
            <li key={item.id}
              onMouseDown={() => handleSelect(item)}
              className={`px-3 py-2 cursor-pointer transition-colors hover:bg-[#006633]/5 hover:text-[#006633]
                ${value?.id === item.id ? 'text-[#006633] font-medium' : ''}`}>
              {getLabel(item)}
            </li>
          )) : !busy ? (
            <li className="px-3 py-2 text-gray-400 italic">Aucun résultat</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

/* ── Page principale ───────────────────────────────────────────── */
export default function AjouterVacationPage() {
  const router = useRouter();
  const user   = getStoredUser();
  const annee  = user?.annee_universitaire ?? '';
  const typeSem = user?.semestre === 'Impairs' ? 'I' : user?.semestre === 'Pairs' ? 'P' : '';

  const [selectedProf,   setSelectedProf]   = useState<Prof | null>(null);
  const [selectedEM,     setSelectedEM]     = useState<EM | null>(null);
  const [selectedSeance, setSelectedSeance] = useState<Seance | null>(null);
  const [duree,     setDuree]     = useState('1.5');
  const [date,      setDate]      = useState('');
  const [anneeUniv, setAnneeUniv] = useState(annee);
  const [selDepts,  setSelDepts]  = useState<string[]>([]);
  const [error,     setError]     = useState<string | null>(null);

  const seancesQuery = useQuery({
    queryKey: ['parametres', 'seances', 'all'] as const,
    queryFn:  async () => {
      const r = await apiFetch<{ results: Seance[] } | Seance[]>('/api/v1/parametres/seances/all/').catch(() => [] as Seance[]);
      return Array.isArray(r) ? r : r.results;
    },
  });
  const seances = seancesQuery.data ?? [];

  const deptsQuery = useQuery({
    queryKey: ['departements', 'list', 'ajouter-vacation', anneeUniv] as const,
    queryFn:  async () => {
      const p = new URLSearchParams();
      if (anneeUniv) p.set('annee_universitaire', anneeUniv);
      // Exclure les conteneurs d'inscription (STATL1...) : pas de planning vacation.
      p.set('is_container', 'false');
      p.set('page_size', '500');
      // EDT scope : ne montrer que les groupes que ce user peut gerer (admin bypass).
      p.set('edt_scope', '1');
      const r = await apiFetch<{ results: Departement[] } | Departement[]>(`/api/v1/departements/?${p}`).catch(() => [] as Departement[]);
      return Array.isArray(r) ? r : r.results;
    },
    enabled: !!anneeUniv,
  });
  const depts = deptsQuery.data ?? [];

  // fetchUrl factories (stable via useCallback not needed — passed inline, recreated on render but that's fine)
  const profFetchUrl = useCallback((q: string) =>
    `/api/v1/profs/?search=${encodeURIComponent(q)}&page_size=25`,
  []);

  // EMs du semestre actif uniquement (les stages sont exclus : ils ne donnent pas
  // lieu a vacation puisque pris en charge dans le module Stages).
  const emsQuery = useQuery({
    queryKey: ['ems', 'vacation-ajouter', 'edt-scope', anneeUniv || annee, typeSem] as const,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('departement__annee_universitaire', anneeUniv || annee);
      if (typeSem) params.set('semestre__type_semestre', typeSem);
      params.set('page_size', '500');
      // EDT scope : ne propose que les EMs rattaches aux groupes geres
      // par le user (admin compris s'il a configure ses managed_departements).
      params.set('edt_scope', '1');
      const r = await apiFetch<{ results: EM[] } | EM[]>(
        `/api/v1/ems/?${params.toString()}`,
      ).catch(() => [] as EM[]);
      const all = Array.isArray(r) ? r : (r.results ?? []);
      // Exclure les EMs de stage (code commence par "Stage" ou intitule contient "stage")
      const filtered = all.filter(e => {
        const code = (e.code_em ?? '').toLowerCase();
        const intt = (e.intitule ?? '').toLowerCase();
        return !code.startsWith('stage') && !intt.includes('stage');
      });
      return filtered.sort((a, b) => a.code_em.localeCompare(b.code_em));
    },
    enabled: !!(anneeUniv || annee),
  });
  const ems = emsQuery.data ?? [];

  const toggleDept = (id: string) =>
    setSelDepts(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);

  // Encadrement / Mission : ni EM ni groupes ne sont requis (séances forfaitaires
  // sans rattachement pédagogique à un module ou un groupe précis).
  const seanceLabel = (selectedSeance?.type_seance ?? '').toLowerCase();
  const isExemptSeance = seanceLabel.includes('encadrement') || seanceLabel.includes('mission');
  // Surveillance : liée à un examen (EM reste requis) mais le surveillant ne dépend
  // PAS d'un groupe précis → aucun groupe requis.
  const isSurveillance = seanceLabel.includes('surveillance');
  // Groupe optionnel pour les séances forfaitaires ET la surveillance.
  const groupeOptionnel = isExemptSeance || isSurveillance;

  // UX : groupes affiches uniquement APRES selection d'un EM, filtres par
  // filiere ET niveau. On privilegie module_lmd.filiere (chaine stable),
  // sinon fallback sur departement.filiere (annuel).
  const emFiliereId = selectedEM?.module_filiere_id ?? selectedEM?.filiere_id ?? null;
  const emNiveauId  = selectedEM?.niveau_id ?? null;
  const visibleDepts = selectedEM
    ? depts.filter(d =>
        (emFiliereId == null || d.filiere === emFiliereId) &&
        (emNiveauId  == null || d.niveau  === emNiveauId)
      )
    : [];

  // Quand l'EM change, on purge les groupes selectionnes qui ne sont plus eligibles.
  // On renvoie la MÊME référence quand rien n'est retiré (filter soustractif →
  // longueur égale = contenu identique) pour éviter un re-rendu inutile et toute
  // boucle effet↔rendu si `depts` (= data ?? []) est neuf à chaque rendu (refetch).
  useEffect(() => {
    const allowed = new Set(visibleDepts.map(d => String(d.id)));
    setSelDepts(prev => {
      const next = prev.filter(id => allowed.has(id));
      return next.length === prev.length ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEM?.id, emFiliereId, emNiveauId, depts]);

  const qc = useQueryClient();
  // useRef synchrone : verrouille AVANT le re-render React qui pose disabled={saving}.
  // Evite la fenetre de race condition lors d'un double-clic rapide qui creait
  // 2 vacations identiques en BD (bug confirme cote serveur).
  const submittingRef = useRef(false);
  const saveMut = useMutation({
    mutationFn: () => apiFetch('/api/v1/vacations/', {
      method: 'POST',
      body: {
        prof:         selectedProf!.id,
        em:           selectedEM?.id ?? null,
        type:         selectedSeance!.id,
        duree:        Number(duree),
        date,
        annee_univ:   anneeUniv,
        departements: selDepts.map(Number),
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vacations'] });
      setFlash('Vacation ajoutée avec succès');
      router.push('/dashboard/payement/liste');
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Erreur'),
    onSettled: () => { submittingRef.current = false; },
  });
  const saving = saveMut.isPending;

  const handleSave = () => {
    // Garde synchrone : si la requete est deja en cours (ou tres rapproche
    // d'un click precedent), on bloque immediatement sans attendre React.
    if (submittingRef.current || saveMut.isPending) return;
    if (!selectedProf)                       { setError('Le professeur est requis.');     return; }
    if (!selectedSeance)                     { setError('Le type de séance est requis.'); return; }
    if (!isExemptSeance && !selectedEM)      { setError("L'élément de module (EM) est requis."); return; }
    if (!duree)                              { setError('La durée est requise.');         return; }
    if (!date)                               { setError('La date est requise.');          return; }
    if (!anneeUniv)                          { setError("L'année universitaire est requise."); return; }
    if (!groupeOptionnel && selDepts.length === 0) { setError('Sélectionnez au moins un groupe concerné.'); return; }
    setError(null);
    submittingRef.current = true;
    saveMut.mutate();
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <input type="hidden" value={anneeUniv} readOnly />

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/payement/liste"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
          <Banknote size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Nouvelle vacation</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 divide-y divide-gray-100">

        {/* ── Section 1 : Enseignant + EM ── */}
        <div className="p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-iss-gray">Enseignant &amp; cours</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AutocompleteField<Prof>
              label="Professeur" required
              placeholder="Rechercher par nom…"
              fetchUrl={profFetchUrl}
              getLabel={p => p.nom}
              value={selectedProf}
              onChange={setSelectedProf}
            />
            <AutocompleteField<EM>
              label="Élément de module (EM)"
              required={!isExemptSeance}
              placeholder={isExemptSeance ? 'Optionnel pour ce type…' : 'Code ou intitulé…'}
              localItems={ems}
              getLabel={e => `${e.code_em} — ${e.intitule}`}
              value={selectedEM}
              onChange={setSelectedEM}
            />
          </div>
        </div>

        {/* ── Section 2 : Séance ── */}
        <div className="p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-iss-gray">Détails de la séance</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <AutocompleteField<Seance>
              label="Type de séance" required
              placeholder="CM, TD, TP…"
              localItems={seances}
              getLabel={s => s.type_seance}
              value={selectedSeance}
              onChange={setSelectedSeance}
            />
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">
                Durée (h) <span className="text-iss-secondary">*</span>
              </label>
              <input type="number" min={0.5} step={0.5} value={duree}
                onChange={e => setDuree(e.target.value)} placeholder="1.5" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">
                Date <span className="text-iss-secondary">*</span>
              </label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT} />
            </div>
          </div>
        </div>

        {/* ── Section 3 : Groupes ── */}
        <div className="p-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-iss-gray">
            Groupes concernés {groupeOptionnel && <span className="ml-1 normal-case font-medium text-iss-gray/60">(optionnel pour ce type)</span>}
          </p>
          {isExemptSeance && !selectedEM ? (
            <p className="text-xs text-iss-gray/50 italic">
              Aucun groupe requis pour une séance de type «&nbsp;{selectedSeance?.type_seance}&nbsp;».
            </p>
          ) : !selectedEM ? (
            <p className="text-xs text-iss-gray/50 italic">
              Choisissez un élément de module pour afficher les groupes éligibles.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {visibleDepts.map(d => {
                // Label compact "filiere - niveau - nom" (ex. LPSTAT - L1 - SEA L1 - G1)
                const label = [d.filiere_code, d.niveau_nom, d.nom].filter(Boolean).join(' - ');
                return (
                  <button key={d.id} type="button"
                    onClick={() => toggleDept(String(d.id))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                      selDepts.includes(String(d.id))
                        ? 'text-white border-transparent'
                        : 'text-iss-gray border-gray-200 bg-gray-50 hover:border-[#006633] hover:text-iss-primary'
                    }`}
                    style={selDepts.includes(String(d.id)) ? { background: 'linear-gradient(135deg,#006633,#008844)' } : {}}>
                    {label}
                  </button>
                );
              })}
              {visibleDepts.length === 0 && (
                <p className="text-xs text-iss-gray/50">
                  Aucun groupe ne correspond à la filière et au niveau de cet EM.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 flex items-center justify-between gap-3">
          {error
            ? <p className="text-xs text-iss-secondary">{error}</p>
            : <span />
          }
          <div className="flex gap-3">
            <Link href="/dashboard/payement/liste"
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-iss-gray hover:bg-gray-50 transition-colors">
              Annuler
            </Link>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-60 transition-all"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              {saving && <Loader2 size={13} className="animate-spin" />}
              Enregistrer
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
