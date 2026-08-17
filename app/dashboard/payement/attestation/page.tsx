'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Award, Loader2, Download, CheckCircle, Eye, AlertCircle } from 'lucide-react';
import { apiFetch, API_BASE_URL as API } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { useTimeout } from '@/hooks/useTimeout';
import { formatDeptNoms, type DeptInfo } from '@/lib/format-depts';

const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";

interface Prof        { id: number; nom: string; type?: string; }
interface AnneeOption { id: number; annee: string; }
interface FiliereOption { id: number; intitule_fr: string; type_diplome?: string; }
interface AttestationInfo {
  has_data: boolean;
  error?: string;
  prof_nom?: string;
  prof_type?: string;
  qualite?: string;
  titre_document?: string;
  numero_attestation?: string;
  meta?: {
    nb_modules: number;
    total_heures_cm: number;
    total_heures_td: number;
    total_heures_tp: number;
    grand_total_ponde: number;
    nb_filieres: number;
    nb_departements: number;
  };
  filieres?: string[];
  niveaux?: string[];
  departements?: string[];
}

// ── Autocomplete prof (meme pattern que rattrapage / emplois prof) ─────────
interface Option { id: string; label: string; }
function ProfAC({ value, profs, onChange }: {
  value:    string;
  profs:    Prof[];
  onChange: (id: string) => void;
}) {
  const options: Option[] = profs.map(p => ({
    id: String(p.id),
    label: p.type ? `${p.nom} (${p.type})` : p.nom,
  }));
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
        className={INPUT}
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

export default function AttestationPage() {
  const user         = getStoredUser();
  const defaultAnnee = user?.annee_universitaire ?? '';

  const [profId,    setProfId]    = useState('');
  const [anneeUniv, setAnneeUniv] = useState(defaultAnnee);
  const [filiereId, setFiliereId] = useState('');     // optionnel
  const [dateDebut, setDateDebut] = useState('');     // optionnel
  const [dateFin,   setDateFin]   = useState('');     // optionnel
  const [loading,   setLoading]   = useState(false);
  const [success,   setSuccess]   = useState(false);
  const downloadTimer = useTimeout();
  const [error,     setError]     = useState<string | null>(null);

  const profsQuery = useQuery({
    queryKey: ['profs', 'list', { page_size: 200 }] as const,
    queryFn:  async () => {
      const r = await apiFetch<{ results: Prof[] } | Prof[]>('/api/v1/profs/?page_size=200').catch(() => [] as Prof[]);
      return Array.isArray(r) ? r : r.results;
    },
  });
  const profs = profsQuery.data ?? [];

  // Annees universitaires disponibles, triees decroissant
  const anneesQuery = useQuery({
    queryKey: ['parametres', 'years', 'all'] as const,
    queryFn:  async () => {
      const list = await apiFetch<AnneeOption[]>('/api/v1/parametres/years/all/').catch(() => [] as AnneeOption[]);
      return [...list].sort((a, b) => b.annee.localeCompare(a.annee));
    },
  });
  const annees = anneesQuery.data ?? [];

  const filieresQuery = useQuery({
    queryKey: ['scolarite', 'filieres', 'all'] as const,
    queryFn:  async () => {
      const r = await apiFetch<{ results: FiliereOption[] } | FiliereOption[]>('/api/v1/scolarite/filieres/?page_size=200').catch(() => [] as FiliereOption[]);
      return Array.isArray(r) ? r : (r.results ?? []);
    },
  });
  const filieres = filieresQuery.data ?? [];

  // Départements (pour afficher "LPSTAT - L1 (G1 / G2)" comme remplissage)
  const deptsQuery = useQuery({
    queryKey: ['departements', 'all', anneeUniv] as const,
    queryFn:  () => apiFetch<(DeptInfo & { id: number })[]>(
      `/api/v1/departements/all/?annee_universitaire=${encodeURIComponent(anneeUniv)}`,
    ).catch(() => [] as (DeptInfo & { id: number })[]),
    enabled: !!anneeUniv,
  });
  const deptByNom = new Map<string, DeptInfo>(
    (deptsQuery.data ?? []).map(d => [d.nom, d])
  );

  // ── Precheck info : appele a chaque changement de filtres (debounced via React Query)
  const infoQuery = useQuery<AttestationInfo>({
    queryKey: ['attestation-info', { profId, anneeUniv, filiereId, dateDebut, dateFin }] as const,
    queryFn: async () => {
      const params = new URLSearchParams({ prof_id: profId, annee_univ: anneeUniv });
      if (filiereId) params.set('filiere_id', filiereId);
      if (dateDebut) params.set('date_debut', dateDebut);
      if (dateFin)   params.set('date_fin', dateFin);
      try {
        return await apiFetch<AttestationInfo>(`/api/v1/vacations/attestation-info/?${params}`);
      } catch (e) {
        // Erreur 404 : pas de donnees pour cette combinaison
        const msg = e instanceof Error ? e.message : 'Erreur';
        return { has_data: false, error: msg };
      }
    },
    enabled: !!(profId && anneeUniv),
    staleTime: 30_000,
  });
  const info = infoQuery.data;
  const infoLoading = infoQuery.isLoading || infoQuery.isFetching;

  const profNom = profs.find(p => String(p.id) === profId)?.nom ?? '';

  function generer() {
    if (!profId)    { setError('Le professeur est requis.');           return; }
    if (!anneeUniv) { setError("L'année universitaire est requise."); return; }
    if (dateDebut && dateFin && dateDebut > dateFin) {
      setError('La date de début doit être antérieure à la date de fin.'); return;
    }
    if (info && !info.has_data) {
      setError(info.error || 'Aucune séance trouvée — vérifiez vos filtres.'); return;
    }
    setError(null); setSuccess(false); setLoading(true);

    const params = new URLSearchParams({ prof_id: profId, annee_univ: anneeUniv });
    if (filiereId) params.set('filiere_id', filiereId);
    if (dateDebut) params.set('date_debut', dateDebut);
    if (dateFin)   params.set('date_fin', dateFin);

    const a = document.createElement('a');
    a.href = `${API}/api/v1/vacations/pdf-attestation/?${params}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    downloadTimer.set(() => { setLoading(false); setSuccess(true); }, 2000);
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/payement"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
            <Award size={14} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-iss-dark">Attestation d&apos;enseignement</h1>
        </div>
      </div>

      {/* Formulaire */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
        style={{ borderLeft: '3px solid #006633' }}>

        <h3 className="text-xs font-bold uppercase tracking-widest text-iss-gray mb-4">Paramètres</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">
              Professeur <span className="text-iss-secondary">*</span>
            </label>
            <ProfAC value={profId} profs={profs} onChange={(id) => { setProfId(id); setSuccess(false); }} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">
              Année universitaire <span className="text-iss-secondary">*</span>
            </label>
            <select value={anneeUniv} onChange={e => { setAnneeUniv(e.target.value); setSuccess(false); }}
              className={INPUT}>
              {annees.length === 0 && <option value={defaultAnnee}>{defaultAnnee || '—'}</option>}
              {annees.map(a => (
                <option key={a.id} value={a.annee}>{a.annee}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filtres optionnels — affichés en accordéon discret */}
        <details className="mb-5">
          <summary className="text-xs font-semibold text-iss-gray cursor-pointer hover:text-iss-primary">
            🔍 Filtres optionnels (filière, période)
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Filière</label>
              <select value={filiereId} onChange={e => { setFiliereId(e.target.value); setSuccess(false); }}
                className={INPUT}>
                <option value="">Toutes les filières</option>
                {filieres.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.intitule_fr}{f.type_diplome ? ` (${f.type_diplome})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Date début</label>
              <input type="date" value={dateDebut}
                onChange={e => { setDateDebut(e.target.value); setSuccess(false); }}
                className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Date fin</label>
              <input type="date" value={dateFin}
                onChange={e => { setDateFin(e.target.value); setSuccess(false); }}
                className={INPUT} />
            </div>
          </div>
        </details>

        {/* Aperçu enrichi avec précheck info */}
        {profId && anneeUniv && (
          <div className="mb-5">
            {infoLoading ? (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-sm flex items-center gap-2 text-iss-gray">
                <Loader2 size={14} className="animate-spin" /> Analyse des séances en cours…
              </div>
            ) : info && !info.has_data ? (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-sm flex items-start gap-2">
                <AlertCircle size={15} className="text-orange-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-orange-800">Aucune séance trouvée</p>
                  <p className="text-orange-700 text-xs mt-1">
                    {info.error || `${profNom} n'a aucune séance enregistrée pour ces filtres. Élargissez la période ou retirez la filière.`}
                  </p>
                </div>
              </div>
            ) : info && info.has_data && info.meta ? (
              <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <Eye size={14} className="text-iss-primary" />
                  <p className="text-xs font-bold text-iss-gray uppercase tracking-widest">Aperçu avant génération</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white rounded-lg p-2 border border-green-100">
                    <p className="text-iss-gray">Modules</p>
                    <p className="text-lg font-bold text-iss-dark">{info.meta.nb_modules}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-green-100">
                    <p className="text-iss-gray">Heures CM</p>
                    <p className="text-lg font-bold text-iss-dark">{info.meta.total_heures_cm.toFixed(1)} h</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-green-100">
                    <p className="text-iss-gray">Heures TD/TP</p>
                    <p className="text-lg font-bold text-iss-dark">
                      {(info.meta.total_heures_td + info.meta.total_heures_tp).toFixed(1)} h
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-green-100">
                    <p className="text-iss-gray">Éq. CM total</p>
                    <p className="text-lg font-bold" style={{ color: '#006633' }}>
                      {info.meta.grand_total_ponde.toFixed(2)} h
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex flex-wrap gap-1 items-baseline">
                    <span className="text-iss-gray">Document :</span>
                    <span className="font-semibold text-iss-dark">{info.titre_document}</span>
                    <span className="text-iss-gray">— Qualité :</span>
                    <span className="font-semibold text-iss-dark">{info.qualite}</span>
                  </div>
                  {info.filieres && info.filieres.length > 0 && (
                    <div className="flex flex-wrap gap-1 items-baseline">
                      <span className="text-iss-gray">Filières :</span>
                      {info.filieres.map((f, i) => (
                        <span key={i} className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                  {info.niveaux && info.niveaux.length > 0 && (
                    <div className="flex flex-wrap gap-1 items-baseline">
                      <span className="text-iss-gray">Niveaux :</span>
                      {info.niveaux.map((n, i) => (
                        <span key={i} className="inline-block px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">
                          {n}
                        </span>
                      ))}
                    </div>
                  )}
                  {info.departements && info.departements.length > 0 && (
                    <div className="flex flex-wrap gap-1 items-baseline">
                      <span className="text-iss-gray">Groupes :</span>
                      <span className="text-iss-dark">{formatDeptNoms(info.departements, deptByNom)}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 mb-5 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
            <CheckCircle size={15} />
            L&apos;attestation a été générée et le téléchargement a démarré.
          </div>
        )}

        {error && (
          <p className="mb-4 text-xs text-iss-secondary">{error}</p>
        )}

        <div className="flex gap-3 justify-end">
          <Link href="/dashboard/payement"
            className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-iss-gray hover:bg-gray-50 transition-colors">
            Annuler
          </Link>
          <button onClick={generer}
            disabled={loading || !profId || !anneeUniv || (info != null && !info.has_data)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}
            title={info && !info.has_data ? 'Aucune séance — ajustez les filtres' : ''}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {loading ? 'Génération…' : "Générer l'attestation PDF"}
          </button>
        </div>
      </div>

    </div>
  );
}
