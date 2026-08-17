'use client';

import { useState, useMemo } from 'react';
import { AlertCircle, MessageSquarePlus, X, Loader2, Lock, Clock, Info, ChevronDown, ChevronRight, BookOpen, Archive, Calendar, FileText } from 'lucide-react';
import { useCreerReclamation, useMesNotes, usePeriodesReclamationActives } from '@/lib/api/portail-hooks';
import { type PeriodeReclamationActive } from '@/lib/api/portail';
import { getStoredUser } from '@/lib/auth';
import { validateUpload } from '@/lib/file-validation';
import { useModalA11y } from '@/hooks/useModalA11y';
import type { NoteEtudiant } from '@/types/portail';

interface ReclamationModal {
  inscriptionElementId: number;
  emLibelle: string;
}

export default function MesNotesPage() {
  const { data: notesData, isLoading, error: queryError } = useMesNotes();
  const { data: periodesData } = usePeriodesReclamationActives();
  const creerReclMut = useCreerReclamation();

  const notes: NoteEtudiant[] = Array.isArray(notesData) ? notesData : [];
  const loading = isLoading;
  const error = queryError ? 'Impossible de charger vos notes.' : '';
  const periodesActives: PeriodeReclamationActive[] = periodesData ?? [];

  const [modal,       setModal]       = useState<ReclamationModal | null>(null);
  const [motif,       setMotif]       = useState('');
  const [justif,      setJustif]      = useState<File | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [submitted,   setSubmitted]   = useState<Set<number>>(new Set());
  const modalRef = useModalA11y<HTMLDivElement>({ open: !!modal, onClose: () => setModal(null) });
  const submitting = creerReclMut.isPending;

  const anneeActive = getStoredUser()?.annee_universitaire ?? '';

  // Determine si une note est dans une fenetre de reclamation ouverte.
  // Pour matcher : annee + parite du semestre (S1/S3/S5 = I, S2/S4/S6 = P)
  function periodeOuverte(n: NoteEtudiant): PeriodeReclamationActive | null {
    if (!n.semestre || !n.annee_univ) return null;
    // Extraire le numero du semestre pour deduire la parite
    const m = String(n.semestre).match(/(\d+)/);
    if (!m) return null;
    const num = parseInt(m[1], 10);
    const parite: 'I' | 'P' = num % 2 === 0 ? 'P' : 'I';
    return periodesActives.find(p =>
      p.est_en_cours
      && p.annee_univ_label === n.annee_univ
      && p.type_semestre === parite
    ) ?? null;
  }

  function fmtDateShort(iso: string): string {
    try {
      return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  }

  const openModal = (n: NoteEtudiant) => {
    setModal({ inscriptionElementId: n.id, emLibelle: n.em_libelle });
    setMotif('');
    setJustif(null);
    setSubmitError('');
  };

  const closeModal = () => {
    if (submitting) return;
    setModal(null);
  };

  const handleSubmit = () => {
    if (!modal) return;
    if (!motif.trim()) { setSubmitError('Le motif est obligatoire.'); return; }
    setSubmitError('');
    const ieId = modal.inscriptionElementId;
    creerReclMut.mutate({
      type_reclamation:    'note',
      inscription_element: ieId,
      motif:               motif.trim(),
      justificatif:        justif ?? null,
    }, {
      onSuccess: () => {
        setSubmitted(prev => new Set(prev).add(ieId));
        setModal(null);
      },
      onError: () => setSubmitError('Erreur lors de la soumission. Réessayez.'),
    });
  };

  // ── Filtres + groupement hierarchique : annee -> semestre ──────────────
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [openArchives, setOpenArchives] = useState<Set<string>>(new Set());

  function hasAnyNote(n: NoteEtudiant): boolean {
    return n.note_cc != null || n.note_tp != null || n.note_exam != null || n.note_finale != null;
  }

  // semestre helper : "Semestre 1" -> 1, "Semestre1" -> 1, "S3" -> 3
  function semestreNum(label: string | null | undefined): number {
    const m = String(label ?? '').match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  type SemGroup = { semestre: string; notes: NoteEtudiant[]; nbAvecNote: number };
  type YearGroup = { annee: string; isActive: boolean; semestres: SemGroup[]; total: number; totalAvecNote: number };

  const yearGroups: YearGroup[] = useMemo(() => {
    const byYear: Record<string, Record<string, NoteEtudiant[]>> = {};
    for (const n of notes) {
      const a = n.annee_univ || '—';
      const s = n.semestre   || '—';
      byYear[a] ??= {};
      byYear[a][s] ??= [];
      byYear[a][s].push(n);
    }
    const groups: YearGroup[] = Object.entries(byYear).map(([annee, sems]) => {
      const semList: SemGroup[] = Object.entries(sems)
        .map(([sem, ns]) => ({ semestre: sem, notes: ns, nbAvecNote: ns.filter(hasAnyNote).length }))
        .sort((a, b) => semestreNum(a.semestre) - semestreNum(b.semestre));
      const total = semList.reduce((s, g) => s + g.notes.length, 0);
      const totalAvecNote = semList.reduce((s, g) => s + g.nbAvecNote, 0);
      return { annee, isActive: annee === anneeActive, semestres: semList, total, totalAvecNote };
    });
    // Tri : annee active en premier, puis annees decroissantes
    return groups.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return b.annee.localeCompare(a.annee);
    });
  }, [notes, anneeActive]);

  const allYears = yearGroups.map(g => g.annee);
  const filteredYearGroups = yearFilter === 'all' ? yearGroups : yearGroups.filter(g => g.annee === yearFilter);

  function toggleArchive(annee: string) {
    setOpenArchives(prev => {
      const next = new Set(prev);
      if (next.has(annee)) next.delete(annee); else next.add(annee);
      return next;
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900">Mes notes</h1>

      {/* ── Bandeau periodes de reclamation ────────────────────────────── */}
      {periodesActives.length > 0 ? (
        <div className="space-y-2">
          {periodesActives.map(p => (
            <div key={p.id} className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2 text-sm">
              <Clock size={16} className="text-emerald-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-emerald-900">
                  Période de réclamation ouverte — {p.motif || `${p.type_session_label} ${p.type_semestre_label}`}
                </p>
                <p className="text-xs text-emerald-800">
                  {p.annee_univ_label} · {p.type_semestre_label}
                  {' · Vous pouvez réclamer jusqu’au '}
                  <strong>{fmtDateShort(p.date_fermeture)}</strong>
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-2 text-sm">
          <Info size={16} className="text-slate-500 shrink-0 mt-0.5" />
          <p className="text-slate-600">
            Aucune période de réclamation n&apos;est ouverte pour le moment. Les réclamations seront
            possibles après la clôture des sessions, quand l&apos;administration ouvrira la fenêtre.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-6 h-6 border-2 border-[#006633]/30 border-t-[#006633] rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 rounded-lg p-6 flex items-center gap-2 text-[#C82020]">
          <AlertCircle size={18} /> {error}
        </div>
      ) : notes.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500">
          Aucune note disponible.
        </div>
      ) : (
        <>
          {/* ── Selecteur annee + recap ──────────────────────────────────── */}
          {allYears.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Calendar size={14} className="text-slate-500" />
              <span className="text-slate-500 mr-1">Filtrer par année :</span>
              <button onClick={() => setYearFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  yearFilter === 'all' ? 'bg-[#006633] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}>
                Toutes ({yearGroups.length})
              </button>
              {allYears.map(a => {
                const g = yearGroups.find(yg => yg.annee === a)!;
                return (
                  <button key={a} onClick={() => setYearFilter(a)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      yearFilter === a
                        ? 'bg-[#006633] text-white'
                        : g.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}>
                    {a}{g.isActive ? ' (active)' : ''}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Sections par annee ───────────────────────────────────────── */}
          {filteredYearGroups.map(yg => {
            const isOpen = yg.isActive || yearFilter === yg.annee || openArchives.has(yg.annee);
            return (
              <section key={yg.annee} className={`rounded-lg overflow-hidden border ${
                yg.isActive ? 'border-[#006633]/30 shadow-sm' : 'border-slate-200'
              }`}>
                {/* En-tete annee */}
                <button
                  onClick={() => !yg.isActive && yearFilter === 'all' && toggleArchive(yg.annee)}
                  disabled={yg.isActive || yearFilter !== 'all'}
                  className={`w-full px-5 py-3 flex items-center justify-between gap-3 ${
                    yg.isActive
                      ? 'bg-gradient-to-r from-[#006633]/5 to-[#006633]/10 cursor-default'
                      : 'bg-slate-50 hover:bg-slate-100 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {yg.isActive
                      ? <BookOpen size={16} className="text-[#006633]" />
                      : <Archive size={16} className="text-slate-500" />}
                    <h2 className={`text-sm font-semibold ${yg.isActive ? 'text-[#006633]' : 'text-slate-700'}`}>
                      {yg.isActive ? 'Année en cours — ' : 'Archive — '}{yg.annee}
                    </h2>
                    <span className="text-xs text-slate-500">
                      · {yg.semestres.length} semestre{yg.semestres.length > 1 ? 's' : ''}
                      · {yg.totalAvecNote}/{yg.total} EM noté{yg.totalAvecNote > 1 ? 's' : ''}
                    </span>
                  </div>
                  {!yg.isActive && yearFilter === 'all' && (
                    isOpen ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />
                  )}
                </button>

                {/* Corps : semestres */}
                {isOpen && (
                  <div className="bg-white space-y-3 p-3">
                    {yg.semestres.map(sg => {
                      const semestreVide = sg.nbAvecNote === 0;
                      return (
                        <div key={sg.semestre} className={`rounded-lg border overflow-hidden ${
                          semestreVide ? 'border-slate-200 bg-slate-50/60' : 'border-slate-200 bg-white'
                        }`}>
                          <div className="px-4 py-2 flex items-center justify-between border-b border-slate-100 bg-slate-50">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">{sg.semestre}</h3>
                            <span className={`text-xs font-medium ${
                              semestreVide ? 'text-amber-600' : 'text-emerald-600'
                            }`}>
                              {sg.nbAvecNote}/{sg.notes.length} EM noté{sg.nbAvecNote > 1 ? 's' : ''}
                            </span>
                          </div>

                          {semestreVide ? (
                            // Placeholder pour semestre sans aucune note saisie
                            <div className="px-5 py-6 flex flex-col items-center justify-center text-center gap-2">
                              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                                <FileText size={18} className="text-amber-600" />
                              </div>
                              <p className="text-sm font-medium text-slate-700">Notes pas encore disponibles</p>
                              <p className="text-xs text-slate-500 max-w-md">
                                Les notes de ce semestre ne sont pas encore saisies par vos enseignants.
                                Vous êtes inscrit(e) à <strong>{sg.notes.length} module{sg.notes.length > 1 ? 's' : ''}</strong> en attente d&apos;évaluation.
                              </p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="data-table w-full">
                                <thead>
                                  <tr>
                                    <th>Élément de module</th>
                                    <th className="text-right">CC</th>
                                    <th className="text-right">TP</th>
                                    <th className="text-right">Examen</th>
                                    <th className="text-right">Crédits</th>
                                    <th className="text-center">Réclamation</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sg.notes.map(n => (
                                    <tr key={n.id}>
                                      <td className="font-medium">{n.em_libelle || `EM #${n.em}`}</td>
                                      <td className="text-right tabular-nums">{n.note_cc   ?? '—'}</td>
                                      <td className="text-right tabular-nums">{n.note_tp   ?? '—'}</td>
                                      <td className="text-right tabular-nums">{n.note_exam ?? '—'}</td>
                                      <td className="text-right tabular-nums">{n.credits}</td>
                                      <td className="text-center">
                                        {(() => {
                                          if (submitted.has(n.id)) {
                                            return (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                                                Soumise
                                              </span>
                                            );
                                          }
                                          if (!hasAnyNote(n)) {
                                            return <span className="text-xs text-slate-300">—</span>;
                                          }
                                          if (n.annee_univ !== anneeActive) {
                                            return (
                                              <span className="inline-flex items-center gap-1 text-xs text-slate-400 px-2 py-1"
                                                title={`Réclamation possible uniquement pour l'année active (${anneeActive || '—'})`}>
                                                <Lock size={12} />
                                                Année close
                                              </span>
                                            );
                                          }
                                          const periode = periodeOuverte(n);
                                          if (!periode) {
                                            return (
                                              <span className="inline-flex items-center gap-1 text-xs text-slate-400 px-2 py-1"
                                                title="Aucune période de réclamation ouverte pour ce semestre">
                                                <Lock size={12} />
                                                Hors période
                                              </span>
                                            );
                                          }
                                          return (
                                            <button
                                              onClick={() => openModal(n)}
                                              className="inline-flex items-center gap-1 text-xs text-[#006633] hover:bg-[#006633]/10 px-2 py-1 rounded-md transition-colors"
                                              title={`Réclamer (jusqu'au ${fmtDateShort(periode.date_fermeture)})`}
                                            >
                                              <MessageSquarePlus size={14} />
                                              Réclamer
                                            </button>
                                          );
                                        })()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}

      {/* ── Modale réclamation ── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={closeModal}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reclamation-note-title"
            className="bg-white rounded-lg shadow-lg w-[95%] max-w-md p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 id="reclamation-note-title" className="text-lg font-semibold text-slate-900">Déposer une réclamation</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-slate-500">
              Élément concerné : <span className="font-medium text-slate-700">{modal.emLibelle}</span>
            </p>

            <div className="space-y-1">
              <label htmlFor="motif" className="text-sm font-medium text-slate-700">
                Motif <span className="text-[#C82020]">*</span>
              </label>
              <textarea
                id="motif"
                rows={4}
                value={motif}
                onChange={e => setMotif(e.target.value)}
                placeholder="Décrivez le motif de votre réclamation…"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40 resize-none"
              />
              {submitError && (
                <p className="text-xs text-[#C82020]">{submitError}</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="justif" className="text-sm font-medium text-slate-700">
                Justificatif (optionnel)
              </label>
              <input
                id="justif"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => {
                  const f = e.target.files?.[0] ?? null;
                  if (!f) { setJustif(null); return; }
                  const err = validateUpload(f, { maxSizeMb: 5, accept: '.pdf,.jpg,.jpeg,.png' });
                  if (err) { alert(err); e.target.value = ''; return; }
                  setJustif(f);
                }}
                className="w-full text-sm text-slate-600 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-[#006633]/10 file:text-[#006633] hover:file:bg-[#006633]/20 cursor-pointer"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={closeModal}
                disabled={submitting}
                className="border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-md text-sm disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-[#006633] text-white hover:bg-[#00552a] px-4 py-2 rounded-md text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Soumettre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
