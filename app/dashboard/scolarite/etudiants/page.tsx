'use client';

import { API_BASE_URL as API } from '@/lib/api';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Download, User, X, Loader2 } from 'lucide-react';
import { etudiantsApi } from '@/lib/api/scolarite';
import { useEtudiantsList } from '@/lib/api/scolarite-hooks';
import { canAccess } from '@/lib/auth';
import { popFlash } from '@/lib/flash';
import DataTable from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { Pagination } from '@/components/Pagination';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import FiliereSelect from '@/components/scolarite/FiliereSelect';
import EtudiantDossier from '@/components/scolarite/EtudiantDossier';
import type { Etudiant, StatutEtudiant } from '@/types/scolarite';
import type { Column } from '@/components/ui/DataTable';
const STATUT_OPTIONS: { value: StatutEtudiant; label: string }[] = [
  { value: 'actif',     label: 'Actif'     },
  { value: 'suspendu',  label: 'Suspendu'  },
  { value: 'diplome',   label: 'Diplômé'   },
  { value: 'exclu',     label: 'Exclu'     },
  { value: 'transfere', label: 'Transféré' },
];

export default function EtudiantsPage() {
  const router = useRouter();
  const toast  = useToast();

  // ── Liste principale (TanStack Query) ─────────────────────────────────────
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [filterFiliere, setFilterFiliere] = useState<number | null>(null);
  const [filterStatut, setFilterStatut] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [exporting, setExporting] = useState(false);

  const filters = useMemo(() => {
    const f: Record<string, string | number> = { page };
    if (search)        f.search  = search;
    if (filterFiliere) f.filiere = filterFiliere;
    if (filterStatut)  f.statut  = filterStatut;
    if (filterGenre)   f.genre   = filterGenre;
    return f;
  }, [page, search, filterFiliere, filterStatut, filterGenre]);

  const { data, isLoading, error } = useEtudiantsList(filters);
  if (error) toast.error((error as Error).message);

  const items   = data?.results ?? [];
  const count   = data?.count   ?? 0;
  const pages   = data?.pages   ?? 1;
  const loading = isLoading;

  // ── Recherche rapide ──────────────────────────────────────────────────────
  const [quickQuery,    setQuickQuery]    = useState('');
  const [suggestions,   setSuggestions]   = useState<Etudiant[]>([]);
  const [loadingSugg,   setLoadingSugg]   = useState(false);
  const [showSugg,      setShowSugg]      = useState(false);
  const [dossier,       setDossier]       = useState<Etudiant | null>(null);
  const quickRef    = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canEdit   = canAccess('scolarite_etudiants', 'modifier');
  const canExport = canAccess('scolarite_etudiants', 'exporter');

  const load = (p: number) => setPage(p);

  useEffect(() => {
    const msg = popFlash();
    if (msg) toast.success(msg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Suggestions autocomplete ──────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!quickQuery.trim() || quickQuery.length < 2) {
      setSuggestions([]); setShowSugg(false); return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoadingSugg(true);
      try {
        const res = await etudiantsApi.search(quickQuery);
        setSuggestions(res);
        setShowSugg(true);
      } catch { setSuggestions([]); }
      finally { setLoadingSugg(false); }
    }, 300);
  }, [quickQuery]);

  // Fermer suggestions au clic hors du champ
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (quickRef.current && !quickRef.current.contains(e.target as Node)) {
        setShowSugg(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function selectStudent(e: Etudiant) {
    setDossier(e);
    setShowSugg(false);
    setQuickQuery(`${e.prenom_fr} ${e.nom_fr} — ${e.matricule}`);
    // Scroll to dossier
    setTimeout(() => {
      document.getElementById('dossier-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function clearDossier() {
    setDossier(null);
    setQuickQuery('');
    setSuggestions([]);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params: Record<string, string> = {};
      if (search)        params.search  = search;
      if (filterFiliere) params.filiere = String(filterFiliere);
      if (filterStatut)  params.statut  = filterStatut;
      const blob = await etudiantsApi.exportExcel(params);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'etudiants.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  const columns: Column<Etudiant>[] = useMemo(() => [
    { key: 'photo', header: '', width: 'w-16', render: r => (
      r.photo
        ? <img
            src={r.photo.startsWith('http') ? r.photo : `${API}${r.photo}`}
            alt=""
            width={44}
            height={44}
            loading="lazy"
            className="w-11 h-11 rounded-full object-cover border border-gray-200"
          />
        : <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center">
            <User size={20} className="text-iss-gray" />
          </div>
    )},
    { key: 'matricule', header: 'Matricule', width: 'w-32',
      render: r => <span className="font-mono text-xs font-semibold">{r.matricule}</span> },
    { key: 'nom_fr', header: 'Nom & Prénom',
      render: r => (
        <div>
          <p className="font-semibold text-iss-dark">{r.nom_fr} {r.prenom_fr}</p>
          {r.nom_ar && <p className="text-xs text-iss-gray" dir="rtl">{r.nom_ar} {r.prenom_ar}</p>}
        </div>
      )
    },
    { key: 'filiere_nom', header: 'Filière',
      render: r => <span className="text-sm">{r.filiere_nom ?? '—'}</span> },
    { key: 'niveau_nom', header: 'Niveau', width: 'w-24',
      render: r => <span className="text-sm font-medium">{r.niveau_nom ?? '—'}</span> },
    { key: 'statut', header: 'Statut', render: r => <StatusPill statut={r.statut_effectif ?? r.statut} /> },
  ], []);

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <User size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Étudiants</h1>
            <p className="text-sm text-iss-gray">{count} étudiant{count !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canExport && (
            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-iss-gray hover:bg-gray-50 transition-colors disabled:opacity-60">
              <Download size={15} />
              {exporting ? 'Export…' : 'Exporter'}
            </button>
          )}
          <Link href="/dashboard/scolarite/etudiants/ajouter"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <Plus size={16} />
            Ajouter
          </Link>
        </div>
      </div>

      {/* ── Recherche rapide ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card">
        <p className="text-xs font-semibold text-iss-gray uppercase tracking-wider mb-3">
          Recherche rapide — dossier étudiant
        </p>
        <div ref={quickRef} className="relative">
          <div className="relative flex items-center">
            {loadingSugg
              ? <Loader2 size={15} className="absolute left-3 text-iss-primary animate-spin" />
              : <Search size={15} className="absolute left-3 text-iss-gray" />
            }
            <input
              type="text"
              placeholder="Nom, prénom ou matricule…"
              value={quickQuery}
              onChange={e => { setQuickQuery(e.target.value); if (dossier) setDossier(null); }}
              onFocus={() => suggestions.length > 0 && setShowSugg(true)}
              className="w-full border border-gray-200 rounded-xl pl-9 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary transition-all"
            />
            {quickQuery && (
              <button onClick={clearDossier}
                className="absolute right-3 text-iss-gray hover:text-iss-dark transition-colors">
                <X size={15} />
              </button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {showSugg && suggestions.length > 0 && (
            <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
              {suggestions.map(e => (
                <button key={e.id} onMouseDown={() => selectStudent(e)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 transition-colors text-left border-b border-gray-50 last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    {e.photo
                      ? <img src={e.photo.startsWith('http') ? e.photo : `${API}${e.photo}`} alt="" className="w-8 h-8 rounded-lg object-cover" />
                      : <User size={14} className="text-iss-gray" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-iss-dark truncate">
                      {e.prenom_fr} {e.nom_fr}
                    </p>
                    <p className="text-xs text-iss-gray font-mono">{e.matricule}
                      {e.filiere_nom ? ` · ${e.filiere_nom}` : ''}
                      {e.niveau_nom  ? ` · ${e.niveau_nom}`  : ''}
                    </p>
                  </div>
                  <StatusPill statut={e.statut_effectif ?? e.statut} />
                </button>
              ))}
            </div>
          )}

          {showSugg && !loadingSugg && suggestions.length === 0 && quickQuery.length >= 2 && (
            <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white rounded-xl border border-gray-200 shadow-lg px-4 py-3">
              <p className="text-sm text-iss-gray">Aucun étudiant trouvé pour « {quickQuery} »</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Dossier étudiant ────────────────────────────────────────────────── */}
      {dossier && (
        <div id="dossier-panel">
          <EtudiantDossier etudiant={dossier} onClose={clearDossier} />
        </div>
      )}

      {/* ── Filtres liste ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray" />
            <input type="text" placeholder="Nom, matricule, CNI…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary" />
          </div>
          <div className="w-52">
            <FiliereSelect value={filterFiliere} onChange={v => setFilterFiliere(v)}
              placeholder="Toutes filières" label="" />
          </div>
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30">
            <option value="">Tous statuts</option>
            {STATUT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={filterGenre} onChange={e => setFilterGenre(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30">
            <option value="">Tous genres</option>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </select>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="Aucun étudiant"
          emptyDesc="Ajoutez des étudiants ou importez via Excel"
          onRowClick={r => router.push(`/dashboard/scolarite/etudiants/${r.id}`)}
        />
        {pages > 1 && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <Pagination page={page} pages={pages} count={count} onPage={p => load(p)} />
          </div>
        )}
      </div>
    </div>
  );
}
