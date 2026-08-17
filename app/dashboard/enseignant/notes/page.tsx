'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Save, ChevronDown, BookOpen, Lock } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { useToast, ToastContainer } from '@/components/ui/Toast';

interface Session {
  id:              number;
  code:            string;
  intitule:        string;
  type_session:    string;
  type_semestre:   string;   // 'Impairs' | 'Pairs'
  est_ouverte:     boolean;
  est_cloturee:    boolean;   // source backend : est_close
}

interface EM {
  id:       number;
  code_em:  string;
  intitule: string;
}

interface FeuilleRow {
  inscription_element: number;
  etudiant_nom:        string;
  etudiant_matricule:  string;
  cc:   { id: number | null; valeur: number | null };
  tp:   { id: number | null; valeur: number | null };
  exam: { id: number | null; valeur: number | null };
}

const NOTE_INPUT = "w-16 border border-slate-200 rounded px-2 py-1 text-xs text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-[#006633]/40";

export default function NotesEnseignantPage() {
  const toast   = useToast();
  const user    = getStoredUser();
  const annee   = user?.annee_universitaire ?? '';
  const typeSem = user?.semestre ?? 'Impairs';   // 'Impairs' | 'Pairs'

  const qc = useQueryClient();
  const [sessionId,   setSessionId]   = useState('');
  const [emId,        setEmId]        = useState('');
  const [editNotes, setEditNotes] = useState<Record<number, { cc: string; tp: string; exam: string }>>({});

  // ── Toutes les sessions du semestre (ouvertes + closes) + de l'année ──────
  // On liste aussi les sessions clôturées/non ouvertes : elles s'affichent avec
  // leur statut et basculent la saisie en lecture seule (miroir garde backend).
  const { data: sessionsRaw, isLoading: loadSess, error: sessError } = useQuery({
    queryKey: ['evaluations', 'sessions', 'list', { annee, type_semestre: typeSem, page_size: 100 }] as const,
    queryFn:  () => {
      const p = new URLSearchParams({
        type_semestre: typeSem,
        page_size:     '100',
      });
      if (annee) p.set('annee_univ', annee);
      return apiFetch<Session[] | { results: Session[] }>(
        `/api/v1/evaluations/sessions/?${p}`,
      );
    },
    enabled: !!annee,
  });
  if (sessError) toast.error('Impossible de charger les sessions.');
  const sessions: Session[] = Array.isArray(sessionsRaw)
    ? sessionsRaw
    : ((sessionsRaw as { results: Session[] })?.results ?? []);

  // Reset emId quand session change
  useEffect(() => { setEmId(''); }, [sessionId]);

  // ── EMs du prof selon session selectionnee ───────────────────────────────
  const sessionObj = sessions.find(s => String(s.id) === sessionId);
  const sessTs = sessionObj?.type_semestre === 'Pairs' ? 'P' : 'I';
  const { data: emsData = [], isLoading: loadEms, error: emsError } = useQuery({
    queryKey: ['suivi', 'pointages', 'ems-prof', annee, sessionId, sessTs] as const,
    queryFn:  () => apiFetch<EM[]>(
      `/api/v1/suivi/pointages/ems-prof/?annee_universitaire=${encodeURIComponent(annee)}&type_semestre=${sessTs}`,
    ),
    enabled:  !!sessionId,
  });
  if (emsError) toast.error('Impossible de charger vos EMs.');
  const ems = emsData;

  // ── Feuille de notes ─────────────────────────────────────────────────────
  const feuilleKey = ['evaluations', 'notes', 'feuille', { sessionId, emId }] as const;
  const { data: feuilleQueryData, isLoading: loadingFeuille, error: feuilleError } = useQuery({
    queryKey: feuilleKey,
    queryFn:  () => apiFetch<FeuilleRow[]>(`/api/v1/evaluations/notes/feuille/?session=${sessionId}&em=${emId}`),
    enabled:  !!sessionId && !!emId,
  });
  // useMemo pour stabiliser la référence : sans ça, `?? []` crée un nouveau []
  // à chaque render quand data est undefined → useEffect en boucle infinie.
  const feuille = useMemo(() => feuilleQueryData ?? [], [feuilleQueryData]);
  const feuilleData = feuille;
  const errorFeuille = feuilleError ? (feuilleError instanceof Error ? feuilleError.message : 'Impossible de charger la feuille de notes.') : '';

  // Sync editNotes quand la feuille charge
  useEffect(() => {
    const init: Record<number, { cc: string; tp: string; exam: string }> = {};
    feuilleData.forEach(r => {
      init[r.inscription_element] = {
        cc:   r.cc.valeur   != null ? String(r.cc.valeur)   : '',
        tp:   r.tp.valeur   != null ? String(r.tp.valeur)   : '',
        exam: r.exam.valeur != null ? String(r.exam.valeur) : '',
      };
    });
    setEditNotes(init);
  }, [feuilleData]);

  const loadFeuille = () => qc.invalidateQueries({ queryKey: feuilleKey });

  // ── Enregistrer (mutation) ───────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: () => {
      const rows = feuille.map(r => {
        const e = editNotes[r.inscription_element] ?? { cc: '', tp: '', exam: '' };
        const parse = (v: string) => {
          const n = parseFloat(v);
          return isNaN(n) ? null : Math.min(20, Math.max(0, n));
        };
        return {
          inscription_element: r.inscription_element,
          cc:   parse(e.cc),
          tp:   parse(e.tp),
          exam: parse(e.exam),
        };
      });
      return apiFetch<{ created: number; updated: number }>(
        '/api/v1/evaluations/notes/saisir-bulk/',
        { method: 'POST', body: { session: Number(sessionId), rows } },
      );
    },
    onSuccess: (res) => {
      toast.success(`${res.created + res.updated} note(s) enregistrée(s).`);
      qc.invalidateQueries({ queryKey: feuilleKey });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement."),
  });
  const saving = saveMut.isPending;

  const selectedSession = sessions.find(s => String(s.id) === sessionId);
  // Saisie autorisée uniquement si la session est ouverte ET non clôturée.
  const isEditable = (s?: Session) => !!s && s.est_ouverte && !s.est_cloturee;
  const readOnly   = !!selectedSession && !isEditable(selectedSession);
  // Suffixe de statut affiché dans le libellé de chaque session.
  const sessionStatut = (s: Session) =>
    s.est_cloturee ? ' — clôturée' : (!s.est_ouverte ? ' — non ouverte' : '');
  // Vrai si des sessions existent mais aucune n'est saisissable.
  const allClosed = sessions.length > 0 && !sessions.some(isEditable);

  function handleSave() {
    // Miroir du garde backend (est_close) : aucune sauvegarde en lecture seule.
    if (readOnly) {
      toast.error('La session est clôturée. La saisie de notes est impossible.');
      return;
    }
    if (!feuille.length || !sessionId) return;
    saveMut.mutate();
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
          <BookOpen size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Saisie des notes</h1>
          <p className="text-xs text-slate-400">{annee} — Semestre {typeSem}</p>
        </div>
      </div>

      {/* Sélection session + EM */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Session */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Session d'évaluation</label>
          <div className="relative">
            {loadSess ? (
              <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            ) : (
              <>
                <select
                  value={sessionId}
                  onChange={e => setSessionId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#006633]/40">
                  <option value="">— Choisir une session —</option>
                  {sessions.map(s => (
                    <option key={s.id} value={String(s.id)}>
                      {(s.intitule || s.code || `Session ${s.id}`) + sessionStatut(s)}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </>
            )}
          </div>
          {!loadSess && sessions.length === 0 && (
            <p className="text-xs text-slate-400 mt-1">Aucune session pour le semestre {typeSem}.</p>
          )}
          {!loadSess && allClosed && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <Lock size={12} /> Toutes les sessions sont clôturées — saisie en lecture seule.
            </p>
          )}
        </div>

        {/* EM */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Élément de module</label>
          <div className="relative">
            <select
              value={emId}
              onChange={e => setEmId(e.target.value)}
              disabled={!sessionId || loadEms || readOnly}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#006633]/40 disabled:bg-slate-50 disabled:cursor-not-allowed">
              <option value="">
                {readOnly ? '— Session fermée —' : (loadEms ? 'Chargement…' : '— Choisir un EM —')}
              </option>
              {!readOnly && ems.map(e => (
                <option key={e.id} value={String(e.id)}>{e.code_em} — {e.intitule}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          {readOnly ? (
            <p className="text-xs text-amber-600 mt-1">La session est clôturée : la saisie de notes est impossible.</p>
          ) : sessionId && !loadEms && ems.length === 0 ? (
            <p className="text-xs text-slate-400 mt-1">Aucun EM trouvé pour ce semestre.</p>
          ) : null}
        </div>
      </div>

      {/* Bandeau lecture seule (session clôturée / non ouverte) */}
      {readOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2 text-sm text-amber-800">
          <Lock size={16} className="mt-0.5 shrink-0" />
          <span>
            <b>Session en lecture seule.</b> {selectedSession?.est_cloturee
              ? 'Cette session est clôturée : les notes ne peuvent plus être saisies ni modifiées.'
              : "Cette session n'est pas encore ouverte à la saisie."}
          </span>
        </div>
      )}

      {/* Feuille */}
      {loadingFeuille ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <div className="w-7 h-7 border-2 border-[#006633] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-slate-500">Chargement de la feuille…</p>
        </div>
      ) : errorFeuille ? (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-[#C82020]">
          <AlertCircle size={16} /> {errorFeuille}
        </div>
      ) : feuille.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <div>
              <p className="text-sm font-semibold text-slate-700">{feuille.length} étudiant(s)</p>
              {selectedSession && (
                <p className="text-xs text-slate-400">{selectedSession.intitule || selectedSession.code}</p>
              )}
            </div>
            {readOnly ? (
              <span className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200">
                <Lock size={14} /> Lecture seule
              </span>
            ) : (
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white bg-[#006633] hover:bg-[#00552a] disabled:opacity-50 transition-colors">
                {saving
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Save size={14} />}
                Enregistrer
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'linear-gradient(135deg,#004d24,#006633)', color: 'white' }}>
                  <th className="px-3 py-3 text-left text-xs font-semibold w-8">#</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold">Matricule</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold">Nom</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold">CC /20</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold">TP /20</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold">Exam /20</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {feuille.map((row, i) => {
                  const e = editNotes[row.inscription_element] ?? { cc: '', tp: '', exam: '' };
                  const upd = (field: 'cc' | 'tp' | 'exam', val: string) =>
                    setEditNotes(prev => ({
                      ...prev,
                      [row.inscription_element]: { ...e, [field]: val },
                    }));
                  return (
                    <tr key={row.inscription_element} className={`hover:bg-slate-50 ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                      <td className="px-3 py-2 text-xs text-slate-400 tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs text-[#006633] font-semibold whitespace-nowrap">
                        {row.etudiant_matricule}
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-800">{row.etudiant_nom}</td>
                      {(['cc', 'tp', 'exam'] as const).map(field => (
                        <td key={field} className="px-3 py-2 text-center">
                          <input
                            type="number" min={0} max={20} step={0.25}
                            value={e[field]}
                            onChange={ev => upd(field, ev.target.value)}
                            disabled={readOnly}
                            className={`${NOTE_INPUT} disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`}
                            placeholder="—"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end px-5 py-3 border-t border-slate-100">
            {readOnly ? (
              <span className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200">
                <Lock size={14} /> Lecture seule
              </span>
            ) : (
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white bg-[#006633] hover:bg-[#00552a] disabled:opacity-50 transition-colors">
                {saving
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Save size={14} />}
                Enregistrer
              </button>
            )}
          </div>
        </div>
      ) : emId ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <BookOpen size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">Aucun étudiant inscrit dans cet EM.</p>
        </div>
      ) : sessionId && !readOnly ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <BookOpen size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">Sélectionnez un EM pour afficher la feuille de notes.</p>
        </div>
      ) : null}

      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
  );
}
