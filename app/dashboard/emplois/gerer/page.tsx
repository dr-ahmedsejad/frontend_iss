'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ClipboardEdit, CheckCircle, Loader2, Save, Copy, Clock } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { useTimeout } from '@/hooks/useTimeout';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Jour     { id: number; jour: string; }
interface Creneau  { id: number; creneau: string; ordre: number; }
interface Dept     { id: number; nom: string; code: string; niveau: number | null; filiere: number | null; niveau_nom?: string | null; filiere_code?: string | null; is_container?: boolean; }
interface Semestre { id: number; semestre: string; code_semestre: string; type_semestre: string; niveau_semestre: number; }
interface Seance   { id: number; type_seance: string; is_special?: boolean; }
interface Salle    { id: number; nom: string; }
interface Prof     { id: number; nom: string; type: string; }
interface EM       { id: number; code_em: string; intitule: string; departement: number; module_lmd?: number | null; }
interface Option   { id: string; label: string; }

interface Emploi {
  id: number; type_seance: string;
  prof: number | null; em: number | null; salle: number | null;
  prof_nom: string | null; em_code: string | null; em_intitule: string | null; salle_nom: string | null;
  all_depts: { id: number; nom: string }[];
}
type Grille = Record<string, Record<string, Emploi[]>>;

interface CellData {
  profId:     string;
  emId:       string;
  typeSeance: string;
  salleId:    string;
  originalId: number | null;
  dupDepts:   string[];
}
const EMPTY_CELL: CellData = { profId: '', emId: '', typeSeance: '', salleId: '', originalId: null, dupDepts: [] };

// ── Autocomplete Component ────────────────────────────────────────────────────
function AC({ value, options, onChange, placeholder }: {
  value:       string;
  options:     Option[];
  onChange:    (id: string) => void;
  placeholder: string;
}) {
  const [text,     setText]    = useState('');
  const [open,     setOpen]    = useState(false);
  const [filtered, setFiltered] = useState<Option[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useTimeout();

  useEffect(() => {
    const opt = options.find(o => o.id === value);
    setText(opt ? opt.label : (value ? value : ''));
  }, [value, options]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setText(q);
    const f = q ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase())) : options;
    setFiltered(f);
    setOpen(true);
    if (!q) onChange('');
  };

  const handleFocus = () => { setFiltered(options); setOpen(true); };

  const handleBlur = () => {
    blurTimer.set(() => {
      const match = options.find(o => o.label.toLowerCase() === text.toLowerCase());
      if (!match && text) {
        const cur = options.find(o => o.id === value);
        setText(cur ? cur.label : '');
      }
      setOpen(false);
    }, 180);
  };

  const handleSelect = (opt: Option) => { setText(opt.label); onChange(opt.id); setOpen(false); };

  const STYLE: React.CSSProperties = {
    width: '100%', padding: '3px 5px', fontSize: 11,
    border: text ? '1px solid #3498db' : '1px solid #ccc',
    borderRadius: 4, background: text ? '#f8f9fa' : 'white',
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'relative', marginBottom: 3 }}>
      <input
        ref={inputRef}
        type="text" value={text}
        onChange={handleInput} onFocus={handleFocus} onBlur={handleBlur}
        placeholder={placeholder} style={STYLE}
        spellCheck={false} autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul style={{
          position: 'absolute', zIndex: 9999,
          left: 0, right: 0, top: '100%',
          background: 'white', border: '1px solid #ccc',
          borderTop: 'none', borderRadius: '0 0 4px 4px',
          maxHeight: 160, overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          padding: 0, margin: 0, listStyle: 'none',
        }}>
          {filtered.map(opt => (
            <li key={opt.id} onMouseDown={() => handleSelect(opt)}
              style={{ padding: '4px 8px', fontSize: 11, cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#eaf4fd')}
              onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GererEmploisPage() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';

  // "Impairs" → "I", "Pairs" → "P"
  const typeSem = user?.semestre === 'Impairs' ? 'I' : 'P';

  const qc = useQueryClient();

  const [deptId,     setDeptId]     = useState('');
  const [semestreId, setSemestreId] = useState('');

  // Grilles des autres depts — utilisées dans handleSave pour PATCH vs POST
  const otherGrillesRef = useRef<Record<string, Grille>>({});

  const [cells,     setCells]     = useState<Record<string, CellData>>({});
  const [originals, setOriginals] = useState<Record<string, CellData>>({});
  const [toast,     setToast]     = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  /* ─── Données de référence (queries) ── */
  const joursQuery = useQuery({
    queryKey: ['parametres', 'jours', 'all'] as const,
    queryFn:  () => apiFetch<Jour[]>('/api/v1/parametres/jours/all/').catch(() => [] as Jour[]),
  });
  const jours = joursQuery.data ?? [];

  const creneauxQuery = useQuery({
    queryKey: ['parametres', 'creneaux', 'all', { is_actif: true }] as const,
    queryFn:  () => apiFetch<Creneau[]>('/api/v1/parametres/creneaux/all/?is_actif=true').catch(() => [] as Creneau[]),
  });
  const creneaux = creneauxQuery.data ?? [];

  const seancesQuery = useQuery({
    queryKey: ['parametres', 'seances', 'all'] as const,
    queryFn:  () => apiFetch<Seance[]>('/api/v1/parametres/seances/all/').catch(() => [] as Seance[]),
  });
  const seances = seancesQuery.data ?? [];

  const sallesQuery = useQuery({
    queryKey: ['salles', 'all'] as const,
    queryFn:  () => apiFetch<Salle[]>('/api/v1/salles/all/').catch(() => [] as Salle[]),
  });
  const salles = sallesQuery.data ?? [];

  const profsQuery = useQuery({
    queryKey: ['profs', 'all'] as const,
    // Exclure les personnels non-enseignants : ils ne peuvent pas dispenser d'EM/emploi.
    queryFn:  () => apiFetch<Prof[]>('/api/v1/profs/all/?type__in=vacataire,permanent,contractuel,militaire').catch(() => [] as Prof[]),
  });
  const profs = profsQuery.data ?? [];

  const deptsQuery = useQuery({
    queryKey: ['departements', 'all', 'edt-scope', annee] as const,
    queryFn:  () => apiFetch<Dept[]>(`/api/v1/departements/all/?annee_universitaire=${encodeURIComponent(annee)}&edt_scope=1`).catch(() => [] as Dept[]),
    enabled: !!annee,
    // Groupes gérés = données de permission qui changent hors de cette page
    // (permissions-edt). On les garde TOUJOURS fraîches pour qu'un groupe
    // nouvellement autorisé apparaisse aussitôt dans le select — au chargement
    // de la page comme au retour sur l'onglet.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const depts = deptsQuery.data ?? [];

  const semestresQuery = useQuery({
    queryKey: ['parametres', 'semestres', 'all'] as const,
    queryFn:  () => apiFetch<Semestre[]>('/api/v1/parametres/semestres/all/').catch(() => [] as Semestre[]),
  });
  const semestres = semestresQuery.data ?? [];

  // ── Auto-déduction du semestre à partir du département ────────────────────
  useEffect(() => {
    if (!deptId || !depts.length || !semestres.length) { setSemestreId(''); return; }
    const dept = depts.find(d => String(d.id) === deptId);
    if (!dept?.niveau) { setSemestreId(''); return; }
    const match = semestres.find(s => s.niveau_semestre === dept.niveau && s.type_semestre === typeSem);
    setSemestreId(match ? String(match.id) : '');
  }, [deptId, depts, semestres, typeSem]);

  // ── Derived: sibling depts for duplication ─────────────────────────────────
  const currentDept = depts.find(d => String(d.id) === deptId);
  const stHeIds     = new Set(depts.filter(d => ['ST', 'HE'].includes(d.nom)).map(d => d.id));

  /** Returns target depts available for duplication given a cell's emId */
  function getTargetDepts(emId: string): Dept[] {
    if (!currentDept) return [];
    // Conteneurs d'inscription (STATL1...) : pas de duplication d'emploi vers eux.
    const notContainer = (d: Dept) => !d.is_container;
    if (emId) {
      const em = ems.find(e => String(e.id) === emId);
      if (em && stHeIds.has(em.departement)) {
        // EM transversal (ST/HE) → propose tous les depts du meme niveau
        return depts.filter(d =>
          d.id !== currentDept.id &&
          !stHeIds.has(d.id) &&
          notContainer(d) &&
          d.niveau === currentDept.niveau
        );
      }
    }
    // EM "metier" : duplication entre groupes de meme filiere + meme niveau
    // (au lieu de l'ancien hack "same code", grace au lien EM -> Module -> Filiere)
    return depts.filter(d =>
      d.id !== currentDept.id &&
      !stHeIds.has(d.id) &&
      notContainer(d) &&
      d.filiere === currentDept.filiere &&
      d.niveau  === currentDept.niveau
    );
  }

  // ── EMs (chaine Filiere/Niveau via Module + transversaux ST/HE) ──────────
  // Phase EM↔Module : on filtre par filiere+niveau (chaine stable d'annee en
  // annee via module_lmd) au lieu de ?departement (couplage annuel fragile).
  // Fallback automatique sur ?departement pour les EMs pas encore lies a un
  // module (transition douce — la mise en place dans /scolarite/modules est
  // manuelle et progressive).
  const emsQuery = useQuery({
    queryKey: ['ems', 'gerer-emplois', {
      deptId, semestreId,
      filiere: currentDept?.filiere ?? null,
      niveau:  currentDept?.niveau  ?? null,
      deptsCount: depts.length,
    }] as const,
    queryFn:  async () => {
      const transversalIds = depts
        .filter(d => ['ST', 'HE'].includes(d.nom))
        .map(d => String(d.id));

      // 1. EMs du dept courant via la chaine filiere/niveau (preferee), sinon fallback departement
      const fetchForCurrent = async (): Promise<EM[]> => {
        if (currentDept?.filiere && currentDept?.niveau) {
          const p = new URLSearchParams({
            filiere: String(currentDept.filiere),
            niveau:  String(currentDept.niveau),
          });
          if (semestreId) p.set('semestre', semestreId);
          const result = await apiFetch<EM[]>(`/api/v1/ems/all/?${p}`).catch(() => [] as EM[]);
          // Si la chaine ne trouve rien (EMs pas encore lies a un module),
          // fallback sur l'ancien filtre departement pour ne pas vider la liste
          if (result.length > 0) return result;
        }
        const p = new URLSearchParams({ departement: deptId });
        if (semestreId) p.set('semestre', semestreId);
        return apiFetch<EM[]>(`/api/v1/ems/all/?${p}`).catch(() => [] as EM[]);
      };

      // 2. EMs transversaux ST/HE (toujours via departement, ils n'ont pas de filiere)
      const fetchTransversal = (id: string): Promise<EM[]> => {
        const p = new URLSearchParams({ departement: id });
        if (semestreId) p.set('semestre', semestreId);
        return apiFetch<EM[]>(`/api/v1/ems/all/?${p}`).catch(() => [] as EM[]);
      };

      const [currentEms, ...transvEms] = await Promise.all([
        fetchForCurrent(),
        ...transversalIds.map(fetchTransversal),
      ]);

      const seen = new Set<number>();
      return [currentEms, ...transvEms].flat().filter(e => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
    },
    enabled: !!deptId && depts.length > 0,
  });
  const ems = emsQuery.data ?? [];

  // ── Grille principale ────────────────────────────────────────────────────
  const grilleKey = ['emplois', 'grille-gerer', { annee, deptId, semestreId, typeSem }] as const;
  const grilleQuery = useQuery({
    queryKey: grilleKey,
    queryFn:  async () => {
      // 1. Grille du département courant
      const g = await apiFetch<Grille>('/api/v1/emplois/grille/', {
        params: { annee_universitaire: annee, departement: deptId, semestre: semestreId },
      });

      // 2. Charger les grilles de TOUS les depts
      const otherGrillesMap: Record<string, Grille> = {};
      try {
        const allGrilles = await apiFetch<Record<string, Grille>>('/api/v1/emplois/grille-all/', {
          params: { annee_universitaire: annee, type_semestre: typeSem },
        });
        for (const [dId, grille] of Object.entries(allGrilles)) {
          if (dId !== deptId) otherGrillesMap[dId] = grille;
        }
      } catch { /* ignorer si grille-all indisponible */ }

      // 3. Maps d'occupation
      const profMap:  Record<string, number[]> = {};
      const salleMap: Record<string, number[]> = {};
      for (const grille of Object.values(otherGrillesMap)) {
        for (const [jourName, jourData] of Object.entries(grille)) {
          for (const [crIdStr, emplois] of Object.entries(jourData)) {
            const key = `${jourName}__${crIdStr}`;
            for (const e of emplois) {
              if (e.prof != null) {
                if (!profMap[key]) profMap[key] = [];
                profMap[key].push(e.prof);
              }
              if (e.salle != null) {
                if (!salleMap[key]) salleMap[key] = [];
                salleMap[key].push(e.salle);
              }
            }
          }
        }
      }

      // 4. Construire les cells initiales avec dupDepts pré-cochés
      const init: Record<string, CellData> = {};
      for (const [jourName, jourData] of Object.entries(g)) {
        for (const [crIdStr, emplois] of Object.entries(jourData)) {
          if (emplois.length > 0) {
            const e   = emplois[0];
            const key = `${jourName}__${crIdStr}`;
            const dupDepts: string[] = [];
            for (const [otherId, otherGrille] of Object.entries(otherGrillesMap)) {
              const otherSlot = otherGrille[jourName]?.[crIdStr];
              if (otherSlot?.length > 0) {
                const s = otherSlot[0];
                if (s.prof === e.prof && s.em === e.em &&
                    s.type_seance === e.type_seance && s.salle === e.salle) {
                  dupDepts.push(otherId);
                }
              }
            }
            init[key] = {
              profId:     String(e.prof ?? ''),
              emId:       String(e.em ?? ''),
              typeSeance: e.type_seance ?? '',
              salleId:    String(e.salle ?? ''),
              originalId: e.id,
              dupDepts,
            };
          }
        }
      }

      return { otherGrillesMap, profMap, salleMap, init };
    },
    enabled: !!annee && !!deptId && !!semestreId,
  });
  const occupiedProfs  = grilleQuery.data?.profMap  ?? {};
  const occupiedSalles = grilleQuery.data?.salleMap ?? {};
  const loading = grilleQuery.isLoading || grilleQuery.isFetching;
  const error   = grilleQuery.error
    ? (grilleQuery.error instanceof Error ? grilleQuery.error.message : 'Erreur de chargement')
    : null;

  // Sync cells/originals + ref quand les données arrivent
  useEffect(() => {
    if (!grilleQuery.data) {
      setCells({}); setOriginals({});
      otherGrillesRef.current = {};
      return;
    }
    otherGrillesRef.current = grilleQuery.data.otherGrillesMap;
    setCells(grilleQuery.data.init);
    setOriginals(JSON.parse(JSON.stringify(grilleQuery.data.init)));
  }, [grilleQuery.data]);

  // ── Cell updates ───────────────────────────────────────────────────────────
  const updateCell = (key: string, field: keyof Omit<CellData, 'originalId' | 'dupDepts'>, val: string) => {
    setCells(prev => ({ ...prev, [key]: { ...(prev[key] ?? EMPTY_CELL), [field]: val } }));
  };

  const toggleDupDept = (key: string, dId: string, checked: boolean) => {
    setCells(prev => {
      const cur = prev[key] ?? EMPTY_CELL;
      const dupDepts = checked
        ? [...cur.dupDepts, dId]
        : cur.dupDepts.filter(x => x !== dId);
      return { ...prev, [key]: { ...cur, dupDepts } };
    });
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async () => {
      const sem = semestres.find(s => String(s.id) === semestreId);
      const semType = sem?.type_semestre ?? typeSem;

      const allKeys = new Set([...Object.keys(cells), ...Object.keys(originals)]);
      let created = 0, updated = 0, deleted = 0, duplicated = 0, errors = 0;

      for (const key of allKeys) {
        const cur  = cells[key];
        const orig = originals[key];
        const hasData = !!(cur?.typeSeance);
        const hadData = !!(orig?.originalId);

        const parts    = key.split('__');
        const jourName = parts[0];
        const crId     = Number(parts[1]);

        // Type special (Sport, Instruction militaire...) : on ignore prof/em/salle
        // meme si l'utilisateur les avait remplis avant de basculer sur ce type.
        const seanceObjSave = seances.find(s => s.type_seance === cur?.typeSeance);
        const isSpecialSave = !!seanceObjSave?.is_special;

        const body = {
          prof:                isSpecialSave ? null : (cur?.profId  ? Number(cur.profId)  : null),
          em:                  isSpecialSave ? null : (cur?.emId    ? Number(cur.emId)    : null),
          salle:               isSpecialSave ? null : (cur?.salleId ? Number(cur.salleId) : null),
          departement:         Number(deptId),
          semestre:            Number(semestreId),
          creneau_fk:          crId,
          jour:                jourName,
          annee_universitaire: annee,
          type_seance:         cur?.typeSeance ?? '',
          type_semestre:       semType,
        };

        try {
          if (hasData && !hadData) {
            await apiFetch('/api/v1/emplois/', { method: 'POST', body });
            created++;
          } else if (hasData && hadData) {
            if (
              cur.profId !== orig.profId || cur.emId !== orig.emId ||
              cur.typeSeance !== orig.typeSeance || cur.salleId !== orig.salleId
            ) {
              await apiFetch(`/api/v1/emplois/${orig.originalId}/`, { method: 'PATCH', body });
              updated++;
            }
          } else if (!hasData && hadData) {
            await apiFetch<void>(`/api/v1/emplois/${orig.originalId}/`, { method: 'DELETE' });
            deleted++;
          }
        } catch { errors++; }

        if (hasData && cur?.dupDepts?.length) {
          for (const targetDeptId of cur.dupDepts) {
            const dupBody = { ...body, departement: Number(targetDeptId) };
            const existingSlot = otherGrillesRef.current[targetDeptId]?.[jourName]?.[String(crId)];
            const existingId   = existingSlot?.[0]?.id ?? null;
            try {
              if (existingId) {
                await apiFetch(`/api/v1/emplois/${existingId}/`, { method: 'PATCH', body: dupBody });
              } else {
                await apiFetch('/api/v1/emplois/', { method: 'POST', body: dupBody });
              }
              duplicated++;
            } catch { errors++; }
          }
        }
      }

      return { created, updated, deleted, duplicated, errors };
    },
    onSuccess: ({ created, updated, deleted, duplicated, errors }) => {
      const parts: string[] = [];
      if (created)    parts.push(`${created} ajouté${created > 1 ? 's' : ''}`);
      if (updated)    parts.push(`${updated} modifié${updated > 1 ? 's' : ''}`);
      if (deleted)    parts.push(`${deleted} supprimé${deleted > 1 ? 's' : ''}`);
      if (duplicated) parts.push(`${duplicated} dupliqué${duplicated > 1 ? 's' : ''}`);
      if (errors)     parts.push(`${errors} erreur${errors > 1 ? 's' : ''}`);
      if (!parts.length) parts.push('Aucune modification');
      showToast(parts.join(' · '));
      qc.invalidateQueries({ queryKey: ['emplois'] });
    },
  });
  const saving = saveMut.isPending;

  function handleSave() {
    if (!deptId || !semestreId || !annee) return;
    saveMut.mutate();
  }

  // ── Options ────────────────────────────────────────────────────────────────
  const profOptions:   Option[] = profs.map(p => ({ id: String(p.id), label: `${p.nom} (${p.type})` }));
  const emOptions:     Option[] = ems.map(e => ({ id: String(e.id), label: `${e.code_em} — ${e.intitule}` }));
  const seanceOptions: Option[] = seances.map(s => ({ id: s.type_seance, label: s.type_seance }));
  const salleOptions:  Option[] = salles.map(s => ({ id: String(s.id), label: s.nom }));

  const ready    = Boolean(deptId && semestreId && annee);
  const deptNom  = depts.find(d => String(d.id) === deptId)?.nom ?? '';
  const semNom   = semestres.find(s => String(s.id) === semestreId)?.semestre ?? '';
  const semLabel = user?.semestre ?? '';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/emplois"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              <ClipboardEdit size={14} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-iss-dark">Gérer les emplois</h1>
          </div>
          <p className="text-sm text-iss-gray">
            Année : <strong>{annee || '—'}</strong>
            {semLabel && <> · Période : <strong>{semLabel}</strong></>}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center print:hidden">
        <select value={deptId} onChange={e => setDeptId(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#006633] transition-all min-w-[200px]">
          <option value="">— Département —</option>
          {depts
            .filter(d => !d.is_container && !(d.nom || '').toLowerCase().includes('stage'))
            .map(d => {
              const label = [d.filiere_code, d.niveau_nom, d.nom].filter(Boolean).join(' - ');
              return <option key={d.id} value={d.id}>{label}</option>;
            })}
        </select>

        {/* Semestre auto-déduit — lecture seule */}
        <div className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 min-w-[180px] flex items-center gap-2">
          {semestreId ? (
            <>
              <span className="w-2 h-2 rounded-full bg-[#006633] flex-shrink-0" />
              <span className="font-semibold text-iss-dark">{semNom}</span>
            </>
          ) : (
            <span className="text-iss-gray italic">Semestre auto</span>
          )}
        </div>

        {ready && !loading && (
          <>
            <Link href="/dashboard/historique?model=Emplois"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-iss-gray hover:bg-gray-50 transition-colors">
              <Clock size={14} /> Historique
            </Link>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-60 ml-auto"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              {saving
                ? <><Loader2 size={14} className="animate-spin" /> Enregistrement…</>
                : <><Save size={14} /> Enregistrer</>}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-2xl p-4 border bg-red-50 border-red-200 text-sm text-iss-secondary">{error}</div>
      )}

      {/* Grid */}
      {!ready ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-16 text-center">
          <ClipboardEdit size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-iss-gray">Sélectionnez un département et un semestre pour commencer la saisie</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-16 text-center">
          <div className="w-8 h-8 border-2 border-[#006633] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-iss-gray">Chargement…</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
          {/* Print header */}
          <div className="hidden print:block px-4 py-3 border-b font-bold text-base text-center">
            EMPLOIS DU TEMPS {annee}<br />{deptNom} — {semNom}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', fontSize: 12, marginBottom: 0 }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
                  <th style={{
                    padding: '10px 12px', textAlign: 'center',
                    color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: 11,
                    border: '1px solid rgba(255,255,255,0.15)', minWidth: 80,
                  }}>Jour</th>
                  {creneaux.map(cr => (
                    <th key={cr.id} style={{
                      padding: '10px 8px', textAlign: 'center',
                      color: 'white', fontWeight: 700, fontSize: 11,
                      border: '1px solid rgba(255,255,255,0.15)', minWidth: 170,
                    }}>{cr.creneau}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jours.map((j, ri) => (
                  <tr key={j.id} style={{ background: ri % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{
                      padding: '8px 10px', textAlign: 'center', fontWeight: 700,
                      border: '1px solid #ccc', fontSize: 12, color: '#374151',
                      verticalAlign: 'middle', whiteSpace: 'nowrap',
                    }}>{j.jour}</td>
                    {creneaux.map(cr => {
                      const key      = `${j.jour}__${cr.id}`;
                      const cell     = cells[key] ?? EMPTY_CELL;
                      const targets  = getTargetDepts(cell.emId);
                      const hasDup   = targets.length > 0 && !!cell.typeSeance;

                      // Filtrer profs et salles déjà occupés à ce créneau dans d'autres depts
                      const occupiedProfSet  = new Set(occupiedProfs[key]  ?? []);
                      const occupiedSalleSet = new Set(occupiedSalles[key] ?? []);
                      const availableProfOptions  = profOptions.filter(p =>
                        !occupiedProfSet.has(Number(p.id)) || p.id === cell.profId
                      );
                      const availableSalleOptions = salleOptions.filter(s =>
                        !occupiedSalleSet.has(Number(s.id)) || s.id === cell.salleId
                      );

                      // Type special (Sport, Instruction militaire, ...) :
                      // pas de prof/em/salle requis -> on masque ces champs.
                      const seanceObj = seances.find(s => s.type_seance === cell.typeSeance);
                      const isSpecial = !!seanceObj?.is_special;

                      return (
                        <td key={cr.id} style={{
                          border: '1px solid #ccc', padding: 4,
                          verticalAlign: 'top', minWidth: 170,
                        }}>
                          {!isSpecial && (
                            <>
                              <AC value={cell.profId}    options={availableProfOptions}  onChange={id => updateCell(key, 'profId', id)}    placeholder="Professeur" />
                              <AC value={cell.emId}      options={emOptions}             onChange={id => updateCell(key, 'emId', id)}       placeholder="EM" />
                            </>
                          )}
                          <AC value={cell.typeSeance} options={seanceOptions}         onChange={id => updateCell(key, 'typeSeance', id)} placeholder="Type séance" />
                          {!isSpecial && (
                            <AC value={cell.salleId}   options={availableSalleOptions} onChange={id => updateCell(key, 'salleId', id)}   placeholder="Salle" />
                          )}
                          {isSpecial && (
                            <div style={{
                              fontSize: 10, color: '#9C4221', fontStyle: 'italic',
                              textAlign: 'center', padding: '4px 0',
                            }}>
                              Type spécial — pas de prof/EM/salle
                            </div>
                          )}

                          {/* Duplication panel */}
                          {hasDup && (
                            <div style={{ marginTop: 4, borderTop: '1px dashed #d1d5db', paddingTop: 3 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                                <Copy size={9} style={{ color: '#006633', flexShrink: 0 }} />
                                <span style={{ fontSize: 9, color: '#006633', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                  Dupliquer vers
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                                {targets.map(d => {
                                  const checked = cell.dupDepts.includes(String(d.id));
                                  return (
                                    <label key={d.id} style={{
                                      display: 'flex', alignItems: 'center', gap: 2,
                                      fontSize: 10, cursor: 'pointer',
                                      padding: '1px 5px', borderRadius: 4,
                                      background: checked ? '#dcfce7' : '#f3f4f6',
                                      border: `1px solid ${checked ? '#006633' : '#d1d5db'}`,
                                      color: checked ? '#006633' : '#374151',
                                      fontWeight: checked ? 600 : 400,
                                    }}>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={e => toggleDupDept(key, String(d.id), e.target.checked)}
                                        style={{ width: 10, height: 10, margin: 0, accentColor: '#006633' }}
                                      />
                                      {d.nom}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom save bar */}
          <div className="px-4 py-3 border-t border-gray-100 flex justify-end print:hidden">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              {saving
                ? <><Loader2 size={14} className="animate-spin" /> Enregistrement…</>
                : <><Save size={14} /> Enregistrer</>}
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-xl"
          style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
          <CheckCircle size={15} /> {toast}
        </div>
      )}
    </div>
  );
}
