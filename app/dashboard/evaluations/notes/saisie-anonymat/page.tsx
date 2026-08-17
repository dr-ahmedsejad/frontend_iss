'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, CheckCircle, AlertTriangle, Save, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { sessionsApi, notesApi, anonymatsApi } from '@/lib/api/evaluations';
import { notesKeys } from '@/lib/api/evaluations-hooks';
import { emsApi, semestresApi } from '@/lib/api/scolarite';
import FiliereSelect from '@/components/scolarite/FiliereSelect';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import type { SessionEvaluation, FicheNote, AnonymatSession } from '@/types/evaluations';
import type { EMPlanification, Semestre } from '@/types/scolarite';

interface LigneSaisie {
  numero_anonymat: number;
  inscription_element: number;
  note_id: number | null;
  valeur: string;
  saved: boolean;
  error?: string;
}

export default function SaisieAnonymatPage() {
  const toast = useToast();
  const qc    = useQueryClient();

  const [sessions,  setSessions]  = useState<SessionEvaluation[]>([]);
  const [semestres, setSemestres] = useState<Semestre[]>([]);
  const [ems,       setEms]       = useState<EMPlanification[]>([]);

  const [selSession, setSelSession] = useState('');
  const [filiere,    setFiliere]    = useState<number | null>(null);
  const [selSem,     setSelSem]     = useState('');
  const [selEm,      setSelEm]      = useState('');

  const [lignes,      setLignes]      = useState<LigneSaisie[]>([]);
  const [loadingFeuille, setLoadingFeuille] = useState(false);
  const [saving,      setSaving]      = useState(false);

  // `dirty` = des notes saisies/modifiées pas encore enregistrées. Garde-fou
  // contre la perte de saisie (navigation, changement de sélection, fermeture).
  const [dirty, setDirty] = useState(false);
  // Action de navigation en attente de confirmation (saisies non enregistrées).
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);

  const sessionObj = sessions.find(s => String(s.id) === selSession) ?? null;
  const emObj      = ems.find(e => String(e.id) === selEm) ?? null;
  const semType    = sessionObj?.type_semestre === 'Impairs' ? 'I' : 'P';
  const isRatt     = sessionObj?.type_session === 'rattrapage';
  const isLocked   = sessionObj ? (sessionObj.est_cloturee || !sessionObj.est_ouverte) : false;

  useEffect(() => {
    sessionsApi.list({ page_size: 200 }).then(r => setSessions(r.results)).catch(() => {});
  }, []);

  useEffect(() => {
    setFiliere(null); setSemestres([]); setSelSem(''); setEms([]); setSelEm(''); setLignes([]); setDirty(false);
  }, [selSession]);

  useEffect(() => {
    setSemestres([]); setSelSem(''); setEms([]); setSelEm(''); setLignes([]); setDirty(false);
    if (!filiere || !selSession) return;
    semestresApi.list({ type_semestre: semType, page_size: 20 })
      .then(r => setSemestres(r.results)).catch(() => {});
  // semType dérive de sessionObj (donc de selSession, déjà en dépendance)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filiere, selSession]);

  useEffect(() => {
    setEms([]); setSelEm(''); setLignes([]); setDirty(false);
    if (!selSem || !filiere || !sessionObj?.annee_univ) return;
    emsApi.list({
      page_size: 200,
      semestre: Number(selSem),
      'inscriptions_elements__inscription_ped__inscription_admin__filiere': filiere,
      'inscriptions_elements__inscription_ped__inscription_admin__annee_univ': sessionObj.annee_univ,
    }).then(r => setEms(r.results)).catch(() => {});
  // sessionObj.annee_univ dérive de selSession (via sessionObj) — pas besoin en dép.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selSem, filiere]);

  // Chargement de la feuille + anonymats — extrait en callback pour le réutiliser
  // dans le bouton « Actualiser ». La feuille serveur est la base « propre » :
  // à chaque (re)chargement on remet `dirty` à false.
  const loadFeuille = useCallback(() => {
    setLignes([]); setDirty(false);
    if (!selEm || !selSession) return;
    setLoadingFeuille(true);
    Promise.all([
      notesApi.feuille(Number(selSession), Number(selEm)),
      anonymatsApi.list(Number(selSession)),
    ])
      .then(([feuille, anonResp]) => {
        // map matricule → numero_anonymat
        const anonMap = new Map<string, number>();
        (anonResp.results as AnonymatSession[]).forEach(a => {
          anonMap.set(a.etudiant_matricule, a.numero_anonymat);
        });

        const rows: LigneSaisie[] = (feuille as FicheNote[])
          .map(f => ({
            numero_anonymat: anonMap.get(f.etudiant_matricule) ?? 0,
            inscription_element: f.inscription_element,
            note_id: f.exam.id,
            valeur: f.exam.valeur !== null ? String(f.exam.valeur) : '',
            saved: false,
          }))
          .filter(r => r.numero_anonymat > 0)
          .sort((a, b) => a.numero_anonymat - b.numero_anonymat);

        setLignes(rows);
      })
      .catch(e => toast.error((e as Error).message))
      .finally(() => setLoadingFeuille(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selEm, selSession]);

  useEffect(() => { loadFeuille(); }, [loadFeuille]);

  // Garde-fou : si des saisies ne sont pas enregistrées, on diffère l'action
  // (changement de sélection / rechargement) derrière la modale de confirmation.
  function guardNav(action: () => void) {
    if (!dirty) { action(); return; }
    setPendingNav(() => action);
  }

  // Avertissement navigateur (fermeture / rechargement de l'onglet) tant que `dirty`.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const updateValeur = (idx: number, val: string) => {
    setLignes(prev =>
      prev.map((l, i) => i === idx ? { ...l, valeur: val, saved: false, error: undefined } : l)
    );
    setDirty(true);
  };

  // Enregistrement — déclenché UNIQUEMENT au clic.
  const handleSaveAll = async () => {
    const toSave = lignes.filter(l => l.valeur !== '');
    if (toSave.length === 0) { toast.error('Aucune note à enregistrer.'); return; }

    setSaving(true);
    const results = await Promise.allSettled(
      toSave.map(l =>
        notesApi.saisirAnonymat({
          session: Number(selSession),
          em: Number(selEm),
          numero_anonymat: l.numero_anonymat,
          valeur: parseFloat(l.valeur.replace(',', '.')),
          type_note: 'EXAM',
        })
      )
    );

    let saved = 0, errors = 0;
    setLignes(prev => {
      const next = [...prev];
      toSave.forEach((l, i) => {
        const idx = next.findIndex(r => r.numero_anonymat === l.numero_anonymat);
        if (idx === -1) return;
        const r = results[i];
        if (r.status === 'fulfilled') {
          next[idx] = { ...next[idx], saved: true, error: undefined };
          saved++;
        } else {
          next[idx] = { ...next[idx], saved: false, error: (r.reason as Error).message };
          errors++;
        }
      });
      return next;
    });

    // Récap agrégé (/evaluations/notes) périmé tant qu'on ne l'invalide pas.
    if (saved > 0) qc.invalidateQueries({ queryKey: notesKeys.lists() });
    // dirty reste vrai si au moins une cellule a échoué → l'utilisateur peut réessayer.
    if (errors === 0) setDirty(false);

    if (errors === 0)
      toast.success(`${saved} note${saved > 1 ? 's' : ''} enregistrée${saved > 1 ? 's' : ''}.`);
    else
      toast.error(`${errors} erreur${errors > 1 ? 's' : ''} — ${saved} enregistrée${saved > 1 ? 's' : ''}.`);

    setSaving(false);
  };

  const nbSaved  = lignes.filter(l => l.saved).length;
  const nbErrors = lignes.filter(l => !!l.error).length;
  const nbFilled = lignes.filter(l => l.valeur !== '').length;
  const canSave  = !!selEm && !isLocked && lignes.length > 0;

  // Bouton « Enregistrer » — même rendu en haut et en bas du tableau.
  // Fonction (pas composant) pour éviter un remount/no-unstable-nested-components.
  const saveButton = () => (
    <button
      onClick={handleSaveAll}
      disabled={saving || !dirty}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all"
      style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
    >
      {saving
        ? <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Enregistrement…</>
        : <><Save size={15} /> Enregistrer{nbFilled > 0 ? ` (${nbFilled})` : ''}</>
      }
    </button>
  );

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* En-tête — 2 boutons : Actualiser + Enregistrer */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Saisie par anonymat</h1>
            <p className="text-sm text-iss-gray">Saisir les notes d'examen — type de note : Examen uniquement</p>
          </div>
        </div>
        {canSave && (
          <div className="flex gap-2">
            <button onClick={() => guardNav(loadFeuille)} disabled={loadingFeuille}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-all">
              <RefreshCw size={14} className={loadingFeuille ? 'animate-spin' : ''} />
              {loadingFeuille ? 'Actualisation…' : 'Actualiser'}
            </button>
            {saveButton()}
          </div>
        )}
      </div>

      {/* Sélecteurs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 max-w-lg space-y-4">

        {/* Session */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Session *</label>
          <select value={selSession} onChange={e => { const v = e.target.value; guardNav(() => setSelSession(v)); }}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40">
            <option value="">— Sélectionner —</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.intitule || s.code} ({s.type_session === 'rattrapage' ? 'Rattrapage' : 'Normale'} — {s.annee_universitaire})
              </option>
            ))}
          </select>
          {isLocked && <p className="mt-1 text-xs text-red-600">Session clôturée — saisie impossible.</p>}
          {isRatt && <p className="mt-1 text-xs text-amber-600 font-medium">⚠ Rattrapage — uniquement les étudiants concernés.</p>}
        </div>

        {/* Filière */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Filière *</label>
          <FiliereSelect value={filiere} onChange={v => guardNav(() => setFiliere(v))} label="" />
        </div>

        {/* Semestre */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Semestre *</label>
          <select value={selSem} onChange={e => { const v = e.target.value; guardNav(() => setSelSem(v)); }}
            disabled={!filiere || !selSession}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40 disabled:opacity-50">
            <option value="">— Sélectionner —</option>
            {semestres.map(s => <option key={s.id} value={s.id}>{s.code_semestre}</option>)}
          </select>
        </div>

        {/* EM */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Élément de module (EM) *</label>
          <select value={selEm} onChange={e => { const v = e.target.value; guardNav(() => setSelEm(v)); }}
            disabled={!selSem}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40 disabled:opacity-50">
            <option value="">— Sélectionner —</option>
            {ems.map(e => <option key={e.id} value={e.id}>{e.code_em} — {e.intitule}</option>)}
          </select>
        </div>
      </div>

      {/* Bandeau « modifications non enregistrées » */}
      {dirty && canSave && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-100 max-w-2xl">
          <AlertTriangle size={15} className="text-amber-600 shrink-0" />
          <p className="text-xs font-medium text-amber-700">
            Modifications non enregistrées — cliquez sur <strong>Enregistrer</strong> pour les sauvegarder.
          </p>
        </div>
      )}

      {/* Feuille de saisie */}
      {selEm && !isLocked && (
        loadingFeuille ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-8 max-w-2xl text-center text-sm text-slate-400">
            Chargement de la feuille…
          </div>
        ) : lignes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 max-w-2xl text-sm text-amber-700">
            Aucun étudiant trouvé. Vérifiez que les anonymats ont été générés pour cette session.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden max-w-2xl">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  {emObj?.code_em} — {emObj?.intitule} · <span className="text-[#006633]">Examen{isRatt ? ' (Rattrapage)' : ''}</span>
                </p>
                <p className="text-xs text-slate-400">{lignes.length} étudiant{lignes.length > 1 ? 's' : ''}</p>
              </div>
              <div className="flex gap-3 text-xs">
                {nbSaved > 0 && (
                  <span className="text-green-700 font-semibold flex items-center gap-1">
                    <CheckCircle size={12} /> {nbSaved} OK
                  </span>
                )}
                {nbErrors > 0 && (
                  <span className="text-red-600 font-semibold flex items-center gap-1">
                    <AlertTriangle size={12} /> {nbErrors} erreur{nbErrors > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-2 text-left text-xs uppercase text-slate-500 w-1/4">N° Anonymat</th>
                  <th className="px-4 py-2 text-left text-xs uppercase text-slate-500">Note /20</th>
                  <th className="px-4 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l, i) => (
                  <tr key={l.numero_anonymat} className="border-t border-gray-50 hover:bg-slate-50/50">
                    <td className="px-4 py-1.5 font-bold text-[#006633] text-base">{l.numero_anonymat}</td>
                    <td className="px-4 py-1.5">
                      <input
                        type="number" min={0} max={20} step={0.25}
                        value={l.valeur}
                        onChange={e => updateValeur(i, e.target.value)}
                        placeholder="—"
                        className={`w-28 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40 ${l.error ? 'border-red-400' : 'border-slate-300'}`}
                      />
                    </td>
                    <td className="px-4 py-1.5 text-center">
                      {l.saved
                        ? <CheckCircle size={14} className="text-green-600 mx-auto" />
                        : l.error
                          ? <span title={l.error}><AlertTriangle size={14} className="text-red-500 mx-auto" /></span>
                          : null
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Bouton « Enregistrer » en bas du tableau */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {nbFilled} / {lignes.length} note{lignes.length > 1 ? 's' : ''} saisie{lignes.length > 1 ? 's' : ''}
              </p>
              {saveButton()}
            </div>
          </div>
        )
      )}

      {/* Confirmation d'abandon des saisies non enregistrées */}
      <ConfirmModal
        open={pendingNav !== null}
        variant="warning"
        title="Modifications non enregistrées"
        message="Des notes saisies ne sont pas encore enregistrées. Si vous continuez, elles seront perdues."
        confirmLabel="Continuer"
        confirmIcon={<AlertTriangle size={14} />}
        onConfirm={() => { pendingNav?.(); setPendingNav(null); }}
        onCancel={() => setPendingNav(null)}
      />
    </div>
  );
}
