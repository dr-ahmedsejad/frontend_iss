'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft, Search, UserX, Calendar, CheckCircle,
  AlertCircle, Loader2, Download, ChevronDown,
} from 'lucide-react';
import { getStoredUser } from '@/lib/auth';
import { parEtudiant } from '@/lib/api/absences';
import { apiFetchBlob } from '@/lib/api';
import StatutBadge from '@/components/absences/StatutBadge';
import type { Etudiant, Presence } from '@/types/absences';
import { apiFetch } from '@/lib/api';

function today()        { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

interface SuggestItem {
  id: number; matricule: string; nom: string; departement_nom: string;
}

export default function EtudiantAbsencesPage() {
  const user   = getStoredUser();
  const router = useRouter();

  /* ─── RBAC : les étudiants sont redirigés vers le portail ── */
  useEffect(() => {
    if (user?.role === 'etudiant') {
      router.replace('/dashboard/portail/absences');
    }
  }, [user, router]);

  const [query,      setQuery]      = useState('');
  const [suggestions, setSuggestions] = useState<SuggestItem[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [selectedEtu, setSelectedEtu] = useState<Etudiant | null>(null);
  const [dateDebut,  setDateDebut]  = useState(daysAgo(30));
  const [dateFin,    setDateFin]    = useState(today());
  const [suggesting, setSuggesting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [searched,   setSearched]   = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Autocomplete ── */
  function handleQueryChange(val: string) {
    setQuery(val);
    setSelectedEtu(null);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (val.length < 2) { setSuggestions([]); setShowSuggest(false); return; }
    suggestTimer.current = setTimeout(async () => {
      setSuggesting(true);
      try {
        const res = await apiFetch<{ results: SuggestItem[] } | SuggestItem[]>(
          `/api/v1/absences/etudiants/?search=${encodeURIComponent(val)}&page_size=10`,
        );
        const list = Array.isArray(res) ? res : res.results;
        setSuggestions(list);
        setShowSuggest(list.length > 0);
      } catch { setSuggestions([]); }
      finally { setSuggesting(false); }
    }, 300);
  }

  function selectSuggestion(s: SuggestItem) {
    setQuery(`${s.matricule} — ${s.nom}`);
    setSelectedEtu({
      id: s.id, matricule: s.matricule, nom: s.nom,
      genre: '', departement: 0, departement_nom: s.departement_nom,
    });
    setShowSuggest(false);
  }

  /* ─── Recherche ── */
  const searchMut = useMutation({
    mutationFn: async (): Promise<Presence[]> => {
      const res = await parEtudiant(selectedEtu!.id);
      // Filtrer côté client par date (le backend ne supporte pas encore ce filtre)
      let items = res.filter(p => p.statut !== 0); // Exclure Présent
      if (dateDebut || dateFin) {
        items = items.filter(p => {
          const d = p.date_modification?.slice(0, 10);
          if (!d) return true;
          if (dateDebut && d < dateDebut) return false;
          if (dateFin   && d > dateFin)   return false;
          return true;
        });
      }
      return items;
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Erreur de chargement.'),
  });
  const absences = searchMut.data ?? null;
  const loading  = searchMut.isPending;

  function search() {
    if (!selectedEtu) { setError('Veuillez sélectionner un étudiant.'); return; }
    setError(null); setSearched(true);
    searchMut.mutate();
  }

  // Telechargement PDF rapport etudiant avec vrai loading state
  const pdfMut = useMutation({
    mutationFn: () => {
      const params: Record<string, string> = { etudiant: String(selectedEtu!.id) };
      if (dateDebut) params.date_debut = dateDebut;
      if (dateFin)   params.date_fin   = dateFin;
      return apiFetchBlob('/api/v1/absences/presences/rapport-etudiant-pdf/', params);
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `rapport_absences_${selectedEtu?.matricule ?? selectedEtu?.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      if (msg !== 'Failed to fetch') setError(`Erreur téléchargement : ${msg}`);
    },
  });
  const pdfLoading = pdfMut.isPending;

  const stats = absences ? {
    total:     absences.length,
    absences:  absences.filter(p => p.statut === 1).length,
    sanctions: absences.filter(p => p.statut === 2).length,
    just:      absences.filter(p => p.statut === 3).length,
  } : null;

  /* Ne rien rendre si l'utilisateur est étudiant (redirection en cours) */
  if (user?.role === 'etudiant') return null;

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/absences"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <Search size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">ABS par étudiant(e)</h1>
          <p className="text-xs text-iss-gray">Rechercher les absences d&apos;un étudiant</p>
        </div>
      </div>

      {/* Formulaire de recherche */}
      <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Autocomplete */}
          <div className="sm:col-span-1 relative">
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Étudiant(e)</label>
            <div className="relative flex items-center">
              <input
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
                onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                placeholder="Matricule ou nom…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-iss-primary"
              />
              <Search size={14} className="absolute left-3 text-iss-gray pointer-events-none" />
              {suggesting && <Loader2 size={12} className="absolute right-3 animate-spin text-iss-gray" />}
            </div>
            {showSuggest && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                {suggestions.map(s => (
                  <button key={s.id} onMouseDown={() => selectSuggestion(s)}
                    className="w-full flex flex-col items-start px-3 py-2.5 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0">
                    <span className="text-sm font-semibold text-iss-dark">{s.nom}</span>
                    <span className="text-xs text-iss-gray">{s.matricule} · {s.departement_nom}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Plage de dates */}
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Du</label>
            <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-iss-primary" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Au</label>
            <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-iss-primary" />
          </div>
        </div>

        {/* Raccourcis de période */}
        <div className="mt-3 flex flex-wrap gap-2">
          {[7, 30, 60, 90].map(d => (
            <button key={d} onClick={() => { setDateDebut(daysAgo(d)); setDateFin(today()); }}
              className="px-3 py-1 rounded-lg border border-gray-200 text-xs text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
              {d} jours
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <button onClick={search} disabled={loading || !selectedEtu}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {loading ? 'Recherche…' : 'Rechercher'}
          </button>
          {absences && absences.length > 0 && selectedEtu && (
            <button
              onClick={() => pdfMut.mutate()}
              disabled={pdfLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-all"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              {pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {pdfLoading ? 'Génération…' : 'Télécharger PDF'}
            </button>
          )}
        </div>
      </div>

      {/* Carte étudiant sélectionné */}
      {selectedEtu && (
        <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-bold text-white text-lg"
            style={{ background: selectedEtu.genre === 'F'
              ? 'linear-gradient(135deg, #e91e8c, #f06292)'
              : 'linear-gradient(135deg, #006633, #008844)' }}>
            {selectedEtu.nom.slice(0, 1)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-iss-dark">{selectedEtu.nom}</p>
            <p className="text-xs text-iss-gray">
              {selectedEtu.matricule}
              {selectedEtu.departement_nom && ` · ${selectedEtu.departement_nom}`}
            </p>
          </div>
          {stats && (
            <div className="flex gap-3">
              {[
                { v: stats.total,     label: 'Total',     color: '#64748b' },
                { v: stats.absences,  label: 'Abs.',      color: '#C82020' },
                { v: stats.sanctions, label: 'Sanct.',    color: '#B8960C' },
                { v: stats.just,      label: 'Just.',     color: '#1a5c8f' },
              ].map(({ v, label, color }) => (
                <div key={label} className="text-center">
                  <p className="text-2xl font-extrabold" style={{ color }}>{v}</p>
                  <p className="text-[10px] text-iss-gray">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tableau de résultats */}
      {searched && !loading && (
        <>
          {absences && absences.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 shadow-card border border-gray-100 text-center">
              <CheckCircle size={40} className="mx-auto mb-3" style={{ color: '#006633' }} />
              <p className="text-sm font-semibold text-iss-dark">Aucune absence enregistrée</p>
              <p className="text-xs text-iss-gray mt-1">sur cette période pour cet étudiant.</p>
            </div>
          ) : absences && absences.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-iss-dark">{absences.length} absence(s)</h3>
                <div className="flex items-center gap-1.5 text-xs text-iss-gray">
                  <Calendar size={12} /> {dateDebut} → {dateFin}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date</th>
                      <th>Jour</th>
                      <th>Créneau</th>
                      <th>Type</th>
                      <th>Matière</th>
                      <th>Professeur</th>
                      <th>Statut</th>
                      <th>Commentaire</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absences.map((p, i) => (
                      <tr key={p.id}>
                        <td className="text-iss-gray text-xs">{i + 1}</td>
                        <td className="text-sm">
                          {p.suivi_date
                            ? new Date(p.suivi_date).toLocaleDateString('fr-FR')
                            : new Date(p.date_modification).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="text-xs text-iss-gray">{p.suivi_jour || '—'}</td>
                        <td className="text-xs">{p.suivi_creneau || '—'}</td>
                        <td className="text-xs">{p.suivi_type || '—'}</td>
                        <td className="text-xs text-iss-dark font-medium">{p.suivi_em || '—'}</td>
                        <td className="text-xs text-iss-gray">{p.suivi_prof || '—'}</td>
                        <td><StatutBadge statut={p.statut} /></td>
                        <td className="text-xs text-iss-gray">{p.commentaire || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      )}

      {!searched && (
        <div className="bg-white rounded-2xl p-12 shadow-card border border-gray-100 text-center">
          <UserX size={40} className="mx-auto mb-3 text-iss-gray/30" />
          <p className="text-sm text-iss-gray">
            Tapez le matricule ou le nom, sélectionnez dans la liste et cliquez sur <strong>Rechercher</strong>.
          </p>
        </div>
      )}

      {/* Récapitulatif par type */}
      {absences && absences.length > 0 && (
        <details className="bg-white rounded-2xl shadow-card border border-gray-100">
          <summary className="px-5 py-4 cursor-pointer flex items-center gap-2 text-sm font-semibold text-iss-dark list-none">
            <ChevronDown size={16} className="text-iss-gray" />
            Récapitulatif par type
          </summary>
          <div className="px-5 pb-5 grid grid-cols-3 gap-3">
            {[
              { statut: 1, label: 'Absent',     color: '#C82020', bg: 'rgba(200,32,32,0.08)' },
              { statut: 2, label: 'Sanctionné', color: '#B8960C', bg: 'rgba(184,150,12,0.08)' },
              { statut: 3, label: 'Justifiée',  color: '#1a5c8f', bg: 'rgba(26,92,143,0.08)' },
            ].map(({ statut, label, color, bg }) => {
              const count = absences.filter(p => p.statut === statut).length;
              return (
                <div key={statut} className="rounded-xl p-4 text-center" style={{ background: bg }}>
                  <p className="text-2xl font-extrabold" style={{ color }}>{count}</p>
                  <p className="text-xs font-medium mt-0.5" style={{ color }}>{label}</p>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
