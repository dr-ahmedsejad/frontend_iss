'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Calendar, Loader2, AlertTriangle,
  CheckCircle, Download, Trash2, RefreshCw, Users,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { ConfirmModal } from '@/components/ConfirmModal';
import { departementsApi, type Departement } from '@/lib/api/departements';

interface TemplateWeek {
  numero_semaine: number;
  nb_cours:       number;
  nb_profs:       number;
  nb_em:          number;
  date_debut:     string;
  date_fin:       string;
  importable:     boolean;
}

interface ImportResponse {
  created:        number;
  warnings:       string[];
  source_week:    number;
  rollback_url:   string;
  rollback_body:  { annee_universitaire: string; type_semestre: string };
}

export default function EmploisImporterPage() {
  const user      = getStoredUser();
  const annee     = user?.annee_universitaire ?? '';
  const semestreS = user?.semestre ?? 'Impairs';
  const ts        = semestreS === 'Pairs' ? 'P' : 'I';
  const qc        = useQueryClient();

  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [confirmRollback, setConfirmRollback] = useState(false);
  const [lastImport, setLastImport]     = useState<ImportResponse | null>(null);
  const [lastImportDepts, setLastImportDepts] = useState<number[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<number[]>([]);

  // Liste des departements (pour filtrer par groupe) — scope EDT : ne renvoie
  // que les groupes que le user peut gerer (admin bypass cote API).
  const deptsQuery = useQuery({
    queryKey: ['departements', 'edt-scope', annee] as const,
    queryFn:  () => departementsApi.list({ anneeUniv: annee, page: 1, edtScope: true }).then(r => r.results),
    enabled:  !!annee,
    staleTime: 5 * 60_000,
  });
  const depts = useMemo(() => {
    const all = deptsQuery.data ?? [];
    return all.filter(d =>
      !d.is_container &&
      !/stage/i.test(d.nom || '') &&
      !/stage/i.test(d.code || '')
    );
  }, [deptsQuery.data]);

  const deptsKey = useMemo(() => [...selectedDepts].sort((a, b) => a - b).join(','), [selectedDepts]);

  // Compte courant Emplois (scope sur les depts selectionnes)
  const emploisCountQuery = useQuery({
    queryKey: ['emplois', 'count-scoped', annee, ts, deptsKey] as const,
    queryFn:  async () => {
      const params = new URLSearchParams({ annee_universitaire: annee, type_semestre: ts });
      if (deptsKey) params.append('departements', deptsKey);
      const res = await apiFetch<{ count: number }>(
        `/api/v1/emplois/count-scoped/?${params}`,
      );
      return res.count ?? 0;
    },
    enabled: !!annee,
  });
  const currentCount = emploisCountQuery.data ?? 0;

  // Liste des semaines disponibles (scope sur les depts pour les compteurs)
  const weeksQuery = useQuery({
    queryKey: ['emplois', 'template-weeks', annee, ts, deptsKey] as const,
    queryFn:  async () => {
      const params = new URLSearchParams({ annee_universitaire: annee, type_semestre: ts });
      if (deptsKey) params.append('departements', deptsKey);
      return apiFetch<TemplateWeek[]>(`/api/v1/emplois/template-weeks/?${params}`);
    },
    enabled: !!annee,
  });
  const weeks = weeksQuery.data ?? [];

  // Import
  const importMut = useMutation({
    mutationFn: async () => {
      if (selectedWeek === null) throw new Error('Aucune semaine sélectionnée');
      return apiFetch<ImportResponse>('/api/v1/emplois/import-from-suivi/', {
        method: 'POST',
        body: {
          annee_universitaire: annee,
          type_semestre:       ts,
          numero_semaine:      selectedWeek,
          departements:        selectedDepts,
        },
      });
    },
    onSuccess: (data) => {
      setLastImport(data);
      setLastImportDepts([...selectedDepts]);
      qc.invalidateQueries({ queryKey: ['emplois'] });
    },
  });

  // Vider (rollback) — meme scope dept
  const viderMut = useMutation({
    mutationFn: () => apiFetch<{ deleted: number }>('/api/v1/emplois/vider/', {
      method: 'POST',
      body: {
        annee_universitaire: annee,
        type_semestre:       ts,
        departements:        selectedDepts,
      },
    }),
    onSuccess: () => {
      setLastImport(null);
      setLastImportDepts([]);
      setSelectedWeek(null);
      qc.invalidateQueries({ queryKey: ['emplois'] });
    },
  });

  const toggleDept = (id: number) => {
    setSelectedWeek(null);
    setSelectedDepts(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };
  const clearDepts = () => { setSelectedWeek(null); setSelectedDepts([]); };

  const deptLabel = (d: Departement) =>
    [d.filiere_code, d.niveau_nom, d.nom].filter(Boolean).join(' - ') || d.code || `#${d.id}`;

  const fmtDate = (s: string) => {
    if (!s) return '';
    try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); }
    catch { return s; }
  };

  const isImportable = (w: TemplateWeek) => w.importable !== false && w.nb_cours > 0;

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/emplois/gerer"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <Download size={17} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-iss-dark">Importer un EDT depuis une semaine de suivi</h1>
          <p className="text-xs text-iss-gray">
            Pré-remplit l&apos;EDT à partir d&apos;une semaine passée — institution principale ·{' '}
            <span className="font-semibold text-iss-dark">Année {annee || '—'}</span> · Semestre {ts}
          </p>
        </div>
        {currentCount > 0 && (
          <button onClick={() => setConfirmRollback(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #C82020, #e53535)' }}>
            <Trash2 size={14} />
            Vider l&apos;EDT{selectedDepts.length > 0 ? ' (groupes sél.)' : ''} ({currentCount})
          </button>
        )}
      </div>

      {/* Message succès dernier import — DEPLACE EN TETE pour visibilite immediate */}
      {lastImport && (
        <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-5 flex items-start gap-3 shadow-card">
          <CheckCircle size={22} className="text-green-700 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-bold text-green-900 text-base">
              ✅ {lastImport.created} cours importés depuis la semaine {lastImport.source_week}
            </p>
            <div className="mt-3 p-3 rounded-xl bg-white border border-green-200">
              <p className="text-xs font-bold text-iss-dark mb-2 uppercase tracking-wide">
                {lastImportDepts.length > 0
                  ? `Groupes importés (${lastImportDepts.length})`
                  : 'Tous les groupes ont été importés'}
              </p>
              {lastImportDepts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {lastImportDepts.map(id => {
                    const d = depts.find(x => x.id === id);
                    return (
                      <span key={id}
                        className="px-3 py-1 rounded-full text-xs font-semibold bg-iss-primary text-white">
                        {d ? deptLabel(d) : `#${id}`}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-iss-gray italic">Aucun filtre de groupe appliqué — l&apos;import a porté sur tous les groupes de la semaine.</p>
              )}
            </div>
            {lastImport.warnings.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-amber-700 cursor-pointer">
                  ⚠️ {lastImport.warnings.length} ligne(s) ignorée(s) — voir détail
                </summary>
                <ul className="mt-2 list-disc list-inside text-xs text-amber-800">
                  {lastImport.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </details>
            )}
            <p className="text-xs text-iss-gray mt-2">
              Tu peux maintenant éditer l&apos;EDT depuis{' '}
              <Link href="/dashboard/emplois/gerer" className="text-iss-primary underline">
                /dashboard/emplois/gerer
              </Link>
              {' '}ou{' '}
              <button onClick={() => setConfirmRollback(true)} className="text-iss-secondary underline">
                annuler cet import
              </button>.
            </p>
          </div>
        </div>
      )}

      {/* Filtre par departement (groupe) */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <Users size={15} className="text-[#006633]" />
          <span className="text-sm font-bold text-iss-dark">
            Filtrer par groupe
          </span>
          <span className="text-xs text-iss-gray">
            ({selectedDepts.length === 0
              ? 'tous les groupes'
              : `${selectedDepts.length}/${depts.length} sélectionné${selectedDepts.length > 1 ? 's' : ''}`})
          </span>
          {selectedDepts.length > 0 && (
            <button onClick={clearDepts}
              className="ml-auto text-xs text-iss-secondary hover:underline">
              Tout désélectionner
            </button>
          )}
        </div>
        <div className="px-5 py-4">
          {deptsQuery.isLoading ? (
            <div className="flex justify-center py-3">
              <Loader2 size={18} className="animate-spin text-iss-primary" />
            </div>
          ) : depts.length === 0 ? (
            <p className="text-xs text-iss-gray italic">Aucun groupe pour {annee || '—'}.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {depts.map((d: Departement) => {
                const sel = selectedDepts.includes(d.id);
                return (
                  <button key={d.id} type="button"
                    onClick={() => toggleDept(d.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                      sel
                        ? 'text-white border-transparent'
                        : 'text-iss-gray border-gray-200 bg-gray-50 hover:border-[#006633] hover:text-iss-primary'
                    }`}
                    style={sel ? { background: 'linear-gradient(135deg,#006633,#008844)' } : {}}>
                    {deptLabel(d)}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-iss-gray mt-3 italic">
            Astuce : sélectionnez un ou plusieurs groupes pour importer leur EDT sans toucher aux autres. Sans sélection, l&apos;import porte sur tous les groupes.
          </p>
        </div>
      </div>

      {/* État courant */}
      <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-iss-gray mb-1">
              EDT actuel{selectedDepts.length > 0 ? ' (groupes sélectionnés)' : ''}
            </p>
            <p className="text-2xl font-bold" style={{ color: currentCount > 0 ? '#006633' : '#9ca3af' }}>
              {currentCount} cours
            </p>
          </div>
          {currentCount > 0 ? (
            <div className="text-xs text-iss-gray">
              <p>L&apos;EDT contient déjà des cours{selectedDepts.length > 0 ? ' pour ces groupes' : ''}.</p>
              <p>Videz-le avant un nouvel import, ou modifiez directement via{' '}
                <Link href="/dashboard/emplois/gerer" className="text-iss-primary underline">/emplois/gerer</Link>.
              </p>
            </div>
          ) : (
            <p className="text-xs text-iss-gray">
              EDT vide{selectedDepts.length > 0 ? ' pour ces groupes' : ''}. Sélectionnez une semaine ci-dessous pour le pré-remplir.
            </p>
          )}
        </div>
      </div>

      {/* Erreur import */}
      {importMut.error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-700 shrink-0 mt-0.5" />
          <p className="text-sm text-red-900">
            {importMut.error instanceof Error ? importMut.error.message : 'Erreur lors de l\'import'}
          </p>
        </div>
      )}

      {/* Liste des semaines */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Calendar size={15} className="text-[#006633]" />
          <span className="text-sm font-bold text-iss-dark">Semaines disponibles ({weeks.length})</span>
          <button onClick={() => weeksQuery.refetch()}
            disabled={weeksQuery.isFetching}
            className="ml-auto p-1.5 rounded-lg text-iss-gray hover:text-iss-primary hover:bg-gray-50"
            title="Rafraîchir">
            <RefreshCw size={13} className={weeksQuery.isFetching ? 'animate-spin' : ''} />
          </button>
        </div>

        {weeksQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin text-iss-primary" />
          </div>
        ) : weeks.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-iss-dark">Aucune semaine de suivi disponible</p>
            <p className="text-xs text-iss-gray mt-1">
              Aucune semaine n&apos;a été générée pour {annee} / semestre {ts}.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {weeks.map(w => {
              const isSelected = isImportable(w) && selectedWeek === w.numero_semaine;
              const disabled   = currentCount > 0 || !isImportable(w);
              return (
                <button
                  key={w.numero_semaine}
                  onClick={() => isImportable(w) && setSelectedWeek(w.numero_semaine)}
                  disabled={disabled}
                  title={!isImportable(w) ? 'Semaine vide — aucun cours régulier à importer' : undefined}
                  className={`w-full flex items-center gap-4 px-5 py-3 text-left transition-all
                    ${isSelected ? 'bg-iss-primary/5 border-l-4 border-iss-primary' : 'hover:bg-gray-50'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm"
                    style={{
                      background: isSelected ? '#006633' : isImportable(w) ? '#f3f4f6' : '#fef2f2',
                      color:      isSelected ? '#fff'    : isImportable(w) ? '#006633' : '#9ca3af',
                    }}>
                    S{w.numero_semaine}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-iss-dark text-sm flex items-center gap-2">
                      Semaine {w.numero_semaine}
                      <span className="text-xs text-iss-gray font-normal">
                        ({fmtDate(w.date_debut)} → {fmtDate(w.date_fin)})
                      </span>
                      {!isImportable(w) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-iss-gray uppercase tracking-wide">
                          vide
                        </span>
                      )}
                    </p>
                    {isImportable(w) ? (
                      <p className="text-xs text-iss-gray mt-0.5">
                        <span className="font-semibold text-iss-dark">{w.nb_cours}</span> cours ·{' '}
                        <span className="font-semibold text-iss-dark">{w.nb_profs}</span> profs ·{' '}
                        <span className="font-semibold text-iss-dark">{w.nb_em}</span> EM
                      </p>
                    ) : (
                      <p className="text-xs text-iss-gray mt-0.5 italic">
                        Aucun cours régulier — semaine non importable
                      </p>
                    )}
                  </div>
                  {isSelected && <CheckCircle size={18} className="text-iss-primary" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Action : Importer */}
      {selectedWeek !== null && currentCount === 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100 flex items-center justify-between gap-4">
          <p className="text-sm text-iss-dark">
            Importer <strong>Semaine {selectedWeek}</strong> dans l&apos;EDT{' '}
            {selectedDepts.length > 0 ? (
              <>pour <strong>
                {selectedDepts
                  .map(id => {
                    const d = depts.find(x => x.id === id);
                    return d ? deptLabel(d) : `#${id}`;
                  })
                  .join(', ')}
              </strong> · </>
            ) : <>(tous groupes) · </>}
            <strong>{annee}</strong> / Sem. <strong>{ts}</strong> ?
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedWeek(null)}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-iss-gray hover:bg-gray-50">
              Annuler
            </button>
            <button onClick={() => importMut.mutate()}
              disabled={importMut.isPending}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              {importMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {importMut.isPending ? 'Import en cours…' : 'Importer'}
            </button>
          </div>
        </div>
      )}

      {/* Confirm rollback */}
      <ConfirmModal
        open={confirmRollback}
        title={selectedDepts.length > 0 ? "Vider l'EDT des groupes sélectionnés ?" : "Vider l'EDT ?"}
        message={`Supprimer les ${currentCount} cours actuels de l'EDT (${annee} / ${ts}${selectedDepts.length > 0 ? ` · ${selectedDepts.length} groupe(s)` : ''}). Cette action est définitive (auditée).`}
        confirmLabel="Vider l'EDT"
        variant="danger"
        loading={viderMut.isPending}
        onConfirm={() => { viderMut.mutate(); setConfirmRollback(false); }}
        onCancel={() => setConfirmRollback(false)}
      />

    </div>
  );
}
