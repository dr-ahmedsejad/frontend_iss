'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RotateCcw, CheckCircle, XCircle, Loader2, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { Pagination } from '@/components/Pagination';

const PAGE_SIZE = 10;

interface Prof { id: number; nom: string; type: string; }

// ── Autocomplete prof (copie du pattern emplois/prof) ──────────────────────
interface Option { id: string; label: string; }
function ProfAC({ value, profs, onChange }: {
  value:    string;
  profs:    Prof[];
  onChange: (id: string) => void;
}) {
  const options: Option[] = profs.map(p => ({ id: String(p.id), label: `${p.nom} (${p.type})` }));
  const [text,     setText]     = useState('');
  const [open,     setOpen]     = useState(false);
  const [filtered, setFiltered] = useState<Option[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const opt = options.find(o => o.id === value);
    setText(opt ? opt.label : '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, profs]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setText(q);
    setFiltered(q ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase())) : options);
    setOpen(true);
    if (!q) onChange('');
  };

  const handleBlur = () => {
    setTimeout(() => {
      const match = options.find(o => o.label.toLowerCase() === text.toLowerCase());
      if (!match && text) {
        const cur = options.find(o => o.id === value);
        setText(cur ? cur.label : '');
      }
      setOpen(false);
    }, 180);
  };

  const handleSelect = (opt: Option) => { setText(opt.label); onChange(opt.id); setOpen(false); };

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text" value={text}
        onChange={handleInput}
        onFocus={() => { setFiltered(options); setOpen(true); }}
        onBlur={handleBlur}
        placeholder="Rechercher un professeur…"
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-iss-dark bg-gray-50 focus:outline-none focus:border-[#006633] transition-all"
        spellCheck={false} autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul style={{
          position: 'absolute', zIndex: 9999, left: 0, right: 0, top: '100%',
          background: 'white', border: '1px solid #cbd5e1', borderTop: 'none',
          borderRadius: '0 0 12px 12px', maxHeight: 240, overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.10)', padding: 0, margin: 0, listStyle: 'none',
        }}>
          {filtered.map(opt => (
            <li key={opt.id} onMouseDown={() => handleSelect(opt)}
              style={{ padding: '7px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
              onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
interface Seance {
  id: number; jour: string | null; date_suivie: string | null; numero_semaine: number;
  creneau: string | null; prof_nom: string; em_intitule: string; type_seance: string | null;
  salle_nom: string; commentaire: string; departement: string;
}

const MODE_OPTIONS = [
  { value: 'Non fait', label: 'Non effectuées', color: '#C82020' },
  { value: 'Fait',     label: 'Effectuées',     color: '#006633' },
];

export default function RattrapagePage() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';
  const ts    = user?.semestre === 'Pairs' ? 'P' : 'I';

  const qc = useQueryClient();
  const [selProf, setSelProf] = useState('');
  const [mode,    setMode]    = useState<'Non fait' | 'Fait'>('Non fait');
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);

  const profsQuery = useQuery({
    queryKey: ['profs', 'all'] as const,
    queryFn:  async () => {
      const p = await apiFetch<Prof[]>('/api/v1/profs/all/').catch(() => [] as Prof[]);
      return Array.isArray(p) ? p : [];
    },
    enabled: !!annee,
  });
  const profs    = profsQuery.data ?? [];
  const initLoad = profsQuery.isLoading;

  const seancesKey = ['suivi', 'pointages', 'rattrapage', { annee, ts, selProf, mode }] as const;
  const seancesQuery = useQuery({
    queryKey: seancesKey,
    queryFn:  async () => {
      const params = new URLSearchParams({
        annee_universitaire: annee,
        type_semestre: ts,
        prof: selProf,
        mode,
      });
      const data = await apiFetch<Seance[]>(`/api/v1/suivi/pointages/rattrapage/?${params}`);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!annee && !!selProf,
    placeholderData: keepPreviousData,
  });
  const seances = seancesQuery.data ?? [];
  const loading = seancesQuery.isLoading || seancesQuery.isFetching;

  function handleProfChange(profId: string) {
    setSelProf(profId);
    setPage(1);
  }

  function handleModeChange(m: 'Non fait' | 'Fait') {
    setMode(m);
    setPage(1);
  }

  const toggleMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/v1/suivi/pointages/${id}/toggle/`, { method: 'PATCH', body: {} }),
    onSuccess: (_, id) => {
      // Retirer de la liste (le commentaire a changé → n'appartient plus à ce mode)
      qc.setQueryData<Seance[]>(seancesKey, (prev) => prev?.filter(s => s.id !== id) ?? []);
    },
  });
  const toggling = toggleMut.isPending ? toggleMut.variables : null;

  function toggle(seance: Seance) {
    toggleMut.mutate(seance.id);
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? seances.filter(s => {
        // Recherche sur toutes les colonnes visibles + n° semaine + date FR
        const dateFr = s.date_suivie ? new Date(s.date_suivie).toLocaleDateString('fr-FR') : '';
        const haystack = [
          s.jour ?? '',
          s.creneau ?? '',
          s.em_intitule,
          s.type_seance ?? '',
          s.salle_nom,
          s.departement,
          s.prof_nom,
          `s${s.numero_semaine}`,
          String(s.numero_semaine),
          dateFr,
        ].join(' ').toLowerCase();
        return haystack.includes(q);
      })
    : seances;

  // Pagination frontend (le backend retourne tout)
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/suivi" className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <RotateCcw size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Rattrapage</h1>
            <p className="text-xs text-iss-gray">Visualiser et marquer les séances effectuées / non effectuées</p>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100">
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Prof — autocomplete */}
          <div>
            <label className="text-xs font-semibold text-iss-gray mb-1 block">Professeur</label>
            <ProfAC value={selProf} profs={profs} onChange={handleProfChange} />
          </div>

          {/* Mode */}
          <div>
            <label className="text-xs font-semibold text-iss-gray mb-1 block">Afficher</label>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              {MODE_OPTIONS.map(opt => (
                <button key={opt.value}
                  onClick={() => handleModeChange(opt.value as 'Non fait' | 'Fait')}
                  className="flex-1 py-2.5 text-sm font-semibold transition-all"
                  style={{
                    background: mode === opt.value ? opt.color : 'transparent',
                    color:      mode === opt.value ? '#fff'      : '#64748b',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recherche */}
      {seances.length > 0 && (
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 max-w-sm">
          <Search size={14} className="text-iss-gray shrink-0" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Filtrer..."
            className="text-sm text-iss-dark bg-transparent focus:outline-none flex-1 placeholder:text-iss-gray/50" />
        </div>
      )}

      {initLoad ? (
        <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-iss-primary" /></div>
      ) : loading ? (
        <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-iss-primary" /></div>
      ) : !selProf ? (
        <div className="bg-white rounded-2xl p-8 shadow-card border border-gray-100 text-center text-sm text-iss-gray/50">
          Sélectionnez un professeur pour afficher ses séances.
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 shadow-card border border-gray-100 text-center">
          <p className="text-sm text-iss-gray/60">
            {mode === 'Non fait'
              ? 'Aucune séance non effectuée trouvée.'
              : 'Aucune séance effectuée trouvée.'}
          </p>
        </div>
      ) : (
        <>
          {/* Résumé */}
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold" style={{ color: mode === 'Non fait' ? '#C82020' : '#006633' }}>
              {filtered.length} séance(s)
            </span>
            <span className="text-iss-gray">— {mode === 'Non fait' ? 'non effectuée(s)' : 'effectuée(s)'}</span>
            {selProf && <span className="text-iss-gray">par <strong>{profs.find(p => String(p.id) === selProf)?.nom}</strong></span>}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Semaine', 'Date', 'Jour', 'Créneau', 'Matière', 'Type', 'Salle', 'Groupe', 'Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-iss-gray whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((s, i) => (
                  <tr key={s.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/20'}`}>
                    <td className="px-4 py-2.5 text-xs text-center">
                      <span className="bg-gray-100 text-iss-gray px-2 py-0.5 rounded-full font-semibold">S{s.numero_semaine}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-iss-gray whitespace-nowrap">
                      {s.date_suivie ? new Date(s.date_suivie).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-iss-dark">{s.jour || '—'}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-iss-dark whitespace-nowrap">{s.creneau || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-iss-dark max-w-[180px] truncate" title={s.em_intitule}>{s.em_intitule || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-iss-dark">{s.type_seance || '—'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-iss-gray">{s.salle_nom || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-iss-gray">{s.departement || '—'}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => toggle(s)}
                        disabled={toggling === s.id}
                        title={mode === 'Non fait' ? 'Marquer comme effectuée' : 'Marquer comme non effectuée'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                        style={{
                          background: mode === 'Non fait' ? 'rgba(0,102,51,0.08)' : 'rgba(200,32,32,0.08)',
                          color:      mode === 'Non fait' ? '#006633'              : '#C82020',
                        }}>
                        {toggling === s.id
                          ? <Loader2 size={12} className="animate-spin" />
                          : mode === 'Non fait'
                            ? <CheckCircle size={12} />
                            : <XCircle size={12} />}
                        {mode === 'Non fait' ? 'Faite' : 'Défaire'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3">
              <Pagination
                page={safePage}
                pages={totalPages}
                count={totalCount}
                pageSize={PAGE_SIZE}
                onPage={setPage}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
