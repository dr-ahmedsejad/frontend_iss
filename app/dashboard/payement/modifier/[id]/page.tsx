'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Banknote, Loader2, X, ChevronDown } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { setFlash } from '@/lib/flash';

const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";

interface Prof        { id: number; nom: string; type?: string; }
interface EM          {
  id: number; code_em: string; intitule: string; departement_nom?: string;
  filiere_id?: number | null;
  module_filiere_id?: number | null;
  niveau_id?: number | null;
}
interface Seance      { id: number; type_seance: string; }
interface Departement { id: number; nom: string; filiere?: number | null; niveau?: number | null; }

interface Vacation {
  id: number; prof: number; em: number | null; type: number;
  duree: number; date: string; annee_univ: string;
  departements: number[];
}

/* ── Autocomplete generique (copie du formulaire d'ajout) ──────────── */
function AutocompleteField<T extends { id: number }>({
  label, required, placeholder, fetchUrl, localItems, getLabel, value, onChange,
}: {
  label: string;
  required?: boolean;
  placeholder: string;
  fetchUrl?: (q: string) => string;
  localItems?: T[];
  getLabel: (item: T) => string;
  value: T | null;
  onChange: (item: T | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<T[]>([]);
  const [open,  setOpen]  = useState(false);
  const [busy,  setBusy]  = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-remplit le champ texte quand value est defini exterieurement
  useEffect(() => {
    if (value) setQuery(getLabel(value));
    else       setQuery('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.id]);

  useEffect(() => { if (localItems) setItems(localItems); }, [localItems]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = useCallback((q: string) => {
    if (localItems) {
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

  const displayed = localItems ? (query ? items : localItems) : items;

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-xs font-semibold text-iss-dark mb-1.5">
        {label}{required && <span className="text-iss-secondary ml-0.5">*</span>}
      </label>
      <div className="relative">
        <input type="text" value={query} onChange={handleInput} onFocus={handleFocus}
          placeholder={placeholder} className={`${INPUT} pr-8`} autoComplete="off" />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          {busy ? <Loader2 size={14} className="text-gray-400 animate-spin" />
            : value ? (
              <button type="button" onMouseDown={handleClear}
                className="pointer-events-auto text-gray-400 hover:text-red-500">
                <X size={14} />
              </button>
            ) : <ChevronDown size={14} className="text-gray-400" />}
        </span>
      </div>

      {open && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto text-sm">
          {displayed.length > 0 ? displayed.map(item => (
            <li key={item.id} onMouseDown={() => handleSelect(item)}
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

/* ── Page principale ──────────────────────────────────────────────── */
export default function ModifierVacationPage() {
  const router  = useRouter();
  const params  = useParams<{ id: string }>();
  const id      = params?.id ?? '';
  const user    = getStoredUser();
  const annee   = user?.annee_universitaire ?? '';
  const typeSem = user?.semestre === 'Impairs' ? 'I' : user?.semestre === 'Pairs' ? 'P' : '';

  const [selectedProf,   setSelectedProf]   = useState<Prof | null>(null);
  const [selectedEM,     setSelectedEM]     = useState<EM | null>(null);
  const [selectedSeance, setSelectedSeance] = useState<Seance | null>(null);
  const [duree,     setDuree]     = useState('1.5');
  const [date,      setDate]      = useState('');
  const [anneeUniv, setAnneeUniv] = useState(annee);
  const [selDepts,  setSelDepts]  = useState<string[]>([]);
  const [error,     setError]     = useState<string | null>(null);
  const [loaded,    setLoaded]    = useState(false);

  // 1. Charge la vacation existante
  const vacationQuery = useQuery({
    queryKey: ['vacations', 'detail', id] as const,
    queryFn:  () => apiFetch<Vacation>(`/api/v1/vacations/${id}/`),
    enabled:  !!id,
  });
  const vacation = vacationQuery.data;

  // 2. Charge les references (profs, ems, seances, depts)
  const seancesQuery = useQuery({
    queryKey: ['parametres', 'seances', 'all'] as const,
    queryFn:  async () => {
      const r = await apiFetch<{ results: Seance[] } | Seance[]>('/api/v1/parametres/seances/all/').catch(() => [] as Seance[]);
      return Array.isArray(r) ? r : r.results;
    },
  });
  const seances = seancesQuery.data ?? [];

  const deptsQuery = useQuery({
    queryKey: ['departements', 'list', 'modifier-vacation', anneeUniv] as const,
    queryFn:  async () => {
      const p = new URLSearchParams();
      if (anneeUniv) p.set('annee_universitaire', anneeUniv);
      p.set('is_container', 'false');
      p.set('page_size', '500');
      // EDT scope : seuls les groupes geres par ce user sont selectionnables.
      p.set('edt_scope', '1');
      const r = await apiFetch<{ results: Departement[] } | Departement[]>(`/api/v1/departements/?${p}`).catch(() => [] as Departement[]);
      return Array.isArray(r) ? r : r.results;
    },
    enabled: !!anneeUniv,
  });
  const depts = deptsQuery.data ?? [];

  const profFetchUrl = useCallback((q: string) =>
    `/api/v1/profs/?search=${encodeURIComponent(q)}&page_size=25`,
  []);

  const emsQuery = useQuery({
    queryKey: ['ems', 'vacation-modifier', anneeUniv || annee, typeSem] as const,
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set('departement__annee_universitaire', anneeUniv || annee);
      if (typeSem) p.set('semestre__type_semestre', typeSem);
      p.set('page_size', '500');
      const r = await apiFetch<{ results: EM[] } | EM[]>(`/api/v1/ems/?${p.toString()}`)
        .catch(() => [] as EM[]);
      const all = Array.isArray(r) ? r : (r.results ?? []);
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

  // 3. Charge le prof correspondant (par id) — pas dans les listes pre-fetched
  const profQuery = useQuery({
    queryKey: ['profs', 'detail', vacation?.prof] as const,
    queryFn:  () => apiFetch<Prof>(`/api/v1/profs/${vacation!.prof}/`),
    enabled:  !!vacation?.prof,
  });
  const profDetail = profQuery.data;

  // 4. EM hors-listing (semestres differents, stages...) charge a la demande
  const emQuery = useQuery({
    queryKey: ['ems', 'detail', vacation?.em] as const,
    queryFn:  () => apiFetch<EM>(`/api/v1/ems/${vacation!.em}/`),
    enabled:  !!vacation?.em,
  });
  const emDetail = emQuery.data;

  // 5. Pre-population une fois toutes les donnees pretes
  useEffect(() => {
    if (loaded || !vacation) return;
    setAnneeUniv(vacation.annee_univ || annee);
    setDuree(String(vacation.duree));
    setDate(vacation.date);
    setSelDepts(vacation.departements.map(String));

    if (profDetail) setSelectedProf(profDetail);
    if (vacation.em) {
      const local = ems.find(e => e.id === vacation.em);
      if (local) setSelectedEM(local);
      else if (emDetail && emDetail.id === vacation.em) setSelectedEM(emDetail);
    }
    const s = seances.find(x => x.id === vacation.type);
    if (s) setSelectedSeance(s);

    if (profDetail && (!vacation.em || selectedEM) && s) setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vacation, profDetail, emDetail, ems, seances]);

  const toggleDept = (id: string) =>
    setSelDepts(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);

  // Encadrement / Mission : ni EM ni groupes ne sont requis (séances forfaitaires
  // sans rattachement pédagogique à un module ou un groupe précis). Doit rester
  // aligné avec la page d'ajout.
  const seanceLabel    = (selectedSeance?.type_seance ?? '').toLowerCase();
  const isExemptSeance = seanceLabel.includes('encadrement') || seanceLabel.includes('mission');

  // Filtrage groupes par filiere/niveau du EM (apres chargement initial)
  const emFiliereId = selectedEM?.module_filiere_id ?? selectedEM?.filiere_id ?? null;
  const emNiveauId  = selectedEM?.niveau_id ?? null;
  const visibleDepts = selectedEM
    ? depts.filter(d =>
        (emFiliereId == null || d.filiere === emFiliereId) &&
        (emNiveauId  == null || d.niveau  === emNiveauId)
      )
    : depts;

  // Quand l'EM change MANUELLEMENT (apres chargement), on purge les groupes hors filiere.
  // IMPORTANT : on renvoie la MÊME référence quand rien n'est retiré (filter est
  // soustractif → longueur égale = contenu identique). Sinon `prev.filter()` crée
  // toujours un nouveau tableau → setState → re-rendu → et comme `depts` (= data ?? [])
  // est un tableau neuf à chaque rendu pendant un refetch (changement d'anneeUniv au
  // pré-remplissage), l'effet reboucle à l'infini ("Too many re-renders"). Ce cas se
  // déclenche surtout pour les vacations Encadrement (loaded=true sans attendre depts).
  useEffect(() => {
    if (!loaded) return;
    const allowed = new Set(visibleDepts.map(d => String(d.id)));
    setSelDepts(prev => {
      const next = prev.filter(id => allowed.has(id));
      return next.length === prev.length ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEM?.id, emFiliereId, emNiveauId, depts]);

  const qc = useQueryClient();
  const saveMut = useMutation({
    mutationFn: () => apiFetch(`/api/v1/vacations/${id}/`, {
      method: 'PATCH',
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
      setFlash('Vacation modifiée avec succès');
      router.push('/dashboard/payement/liste');
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Erreur'),
  });
  const saving = saveMut.isPending;

  const handleSave = () => {
    if (!selectedProf)                            { setError('Le professeur est requis.');     return; }
    if (!selectedSeance)                          { setError('Le type de séance est requis.'); return; }
    if (!isExemptSeance && !selectedEM)           { setError("L'élément de module (EM) est requis."); return; }
    if (!duree)                                   { setError('La durée est requise.');         return; }
    if (!date)                                    { setError('La date est requise.');          return; }
    if (!anneeUniv)                               { setError("L'année universitaire est requise."); return; }
    if (!isExemptSeance && selDepts.length === 0) { setError('Sélectionnez au moins un groupe concerné.'); return; }
    setError(null);
    saveMut.mutate();
  };

  if (vacationQuery.isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 size={24} className="animate-spin text-iss-gray" />
      </div>
    );
  }
  if (vacationQuery.error) {
    return (
      <div className="rounded-2xl p-4 border bg-red-50 border-red-200 text-sm text-iss-secondary max-w-2xl">
        {vacationQuery.error instanceof Error ? vacationQuery.error.message : 'Vacation introuvable.'}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <input type="hidden" value={anneeUniv} readOnly />

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
          <h1 className="text-xl font-bold text-iss-dark">Modifier la vacation</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 divide-y divide-gray-100">

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

        <div className="p-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-iss-gray">
            Groupes concernés {isExemptSeance && <span className="ml-1 normal-case font-medium text-iss-gray/60">(optionnel pour ce type)</span>}
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
              {visibleDepts.map(d => (
                <button key={d.id} type="button"
                  onClick={() => toggleDept(String(d.id))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    selDepts.includes(String(d.id))
                      ? 'text-white border-transparent'
                      : 'text-iss-gray border-gray-200 bg-gray-50 hover:border-[#006633] hover:text-iss-primary'
                  }`}
                  style={selDepts.includes(String(d.id)) ? { background: 'linear-gradient(135deg,#006633,#008844)' } : {}}>
                  {d.nom}
                </button>
              ))}
              {visibleDepts.length === 0 && (
                <p className="text-xs text-iss-gray/50">
                  Aucun groupe ne correspond à la filière et au niveau de cet EM.
                </p>
              )}
            </div>
          )}
        </div>

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
