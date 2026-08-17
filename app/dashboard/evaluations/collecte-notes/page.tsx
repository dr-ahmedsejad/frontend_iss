'use client';

import { useState, useEffect } from 'react';
import { Download, FileText } from 'lucide-react';
import { downloadBlob } from '@/lib/downloadBlob';
import { sessionsApi, collecteNotesApi } from '@/lib/api/evaluations';
import { emsApi, semestresApi } from '@/lib/api/scolarite';
import FiliereSelect from '@/components/scolarite/FiliereSelect';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { getStoredUser } from '@/lib/auth';
import type { SessionEvaluation } from '@/types/evaluations';
import type { EMPlanification, Semestre } from '@/types/scolarite';

type TypeNote = 'CC' | 'TP' | 'EXAM';

export default function CollecteNotesPage() {
  const toast = useToast();
  // Annee universitaire active du user (contexte session) — utilisee pour ne
  // proposer QUE les sessions de l'annee en cours, pas l'historique complet.
  const userAnnee = getStoredUser()?.annee_universitaire ?? '';

  const [sessions,   setSessions]   = useState<SessionEvaluation[]>([]);
  const [selSession, setSelSession] = useState('');
  const [filiere,    setFiliere]    = useState<number | null>(null);
  const [semestres,  setSemestres]  = useState<Semestre[]>([]);
  const [selSem,     setSelSem]     = useState('');
  const [ems,        setEms]        = useState<EMPlanification[]>([]);
  const [selEm,      setSelEm]      = useState('');
  const [typeNote,   setTypeNote]   = useState<TypeNote>('EXAM');
  const [anonymat,   setAnonymat]   = useState(false);
  const [format,     setFormat]     = useState<'pdf' | 'excel'>('pdf');
  const [loading,    setLoading]    = useState(false);

  const sessionObj       = sessions.find(s => String(s.id) === selSession) ?? null;
  const emObj            = ems.find(e => String(e.id) === selEm) ?? null;
  const isRatt           = sessionObj?.type_session === 'rattrapage';
  const hasTP            = Boolean(emObj?.has_tp);
  const semType          = sessionObj?.type_semestre === 'Impairs' ? 'I' : 'P';
  const anonymatAllowed  = typeNote === 'EXAM';   // anonymat uniquement pour l'examen

  useEffect(() => {
    sessionsApi.list({ page_size: 200 })
      .then(r => {
        // On ne propose QUE les sessions de l'annee active (contexte) ET non
        // cloturees. Si pas d'annee dans le contexte (cas degrade), on n'exige
        // que le critere "non cloturee" pour ne pas tout bloquer.
        const filtered = r.results.filter(s =>
          !s.est_cloturee && (!userAnnee || s.annee_universitaire === userAnnee),
        );
        setSessions(filtered);
      })
      .catch(() => {});
  }, [userAnnee]);

  // Session change → reset tout
  useEffect(() => {
    setFiliere(null); setSemestres([]); setSelSem(''); setEms([]); setSelEm('');
  }, [selSession]);

  // Filière change → charger les semestres filtrés par type de la session ET par
  // le NIVEAU de la filière (accord niveau ↔ semestres : ex. une filière L1 ne
  // propose que S1/S2, une filière L2-L3 que S3..S6).
  useEffect(() => {
    setSemestres([]); setSelSem(''); setEms([]); setSelEm('');
    if (!filiere || !selSession) return;
    semestresApi.list({ type_semestre: semType, filiere, page_size: 20 })
      .then(r => setSemestres(r.results))
      .catch(() => {});
  }, [filiere, selSession]);

  // Semestre change → charger EMs via inscriptions → filière
  useEffect(() => {
    setEms([]); setSelEm('');
    if (!selSem || !filiere || !sessionObj?.annee_univ) return;
    emsApi.list({
      page_size: 200,
      semestre: Number(selSem),
      'inscriptions_elements__inscription_ped__inscription_admin__filiere': filiere,
      'inscriptions_elements__inscription_ped__inscription_admin__annee_univ': sessionObj.annee_univ,
    }).then(r => setEms(r.results)).catch(() => {});
  }, [selSem, filiere]);

  const download = async () => {
    if (!selSession || !selSem || !filiere) {
      toast.error('Session, filière et semestre sont requis.');
      return;
    }
    setLoading(true);
    try {
      let blob: Blob;
      let filename: string;
      const anon = anonymat ? 1 : 0;
      const suffix = isRatt ? 'rattrapage' : 'normale';
      const isExcel = format === 'excel';
      const ext = isExcel ? 'xlsx' : 'pdf';

      if (selEm) {
        // Fiche individuelle
        const params = { em: Number(selEm), session: Number(selSession), type_note: typeNote, anonymat: anon } as const;
        blob = isExcel
          ? (isRatt ? await collecteNotesApi.excelRattrapage(params) : await collecteNotesApi.excelNormale(params))
          : (isRatt ? await collecteNotesApi.pdfRattrapage(params)   : await collecteNotesApi.pdfNormale(params));
        filename = `collecte_${emObj?.code_em ?? selEm}_${typeNote}_${suffix}.${ext}`;
      } else {
        // Toutes les fiches de la filière / semestre
        const params = { session: Number(selSession), filiere, semestre: Number(selSem), type_note: typeNote, anonymat: anon } as const;
        blob = isExcel
          ? (isRatt ? await collecteNotesApi.excelTousRattrapage(params) : await collecteNotesApi.excelTous(params))
          : (isRatt ? await collecteNotesApi.pdfTousRattrapage(params)   : await collecteNotesApi.pdfTous(params));
        filename = `collecte_tous_${typeNote}_${suffix}.${ext}`;
      }

      downloadBlob(blob, filename);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
          <FileText size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Fiche de collecte de notes</h1>
          <p className="text-sm text-iss-gray">Générer la feuille de saisie pour un EM</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 max-w-lg space-y-4">

        {/* Session */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Session *</label>
          <select
            value={selSession}
            onChange={e => setSelSession(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40"
          >
            <option value="">— Sélectionner —</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.intitule || s.code} ({s.type_session === 'rattrapage' ? 'Rattrapage' : 'Normale'} — {s.annee_universitaire})
              </option>
            ))}
          </select>
          {isRatt && (
            <p className="mt-1 text-xs text-amber-600 font-medium">⚠ Session de rattrapage — liste filtrée aux étudiants concernés</p>
          )}
        </div>

        {/* Filière */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Filière *</label>
          <FiliereSelect value={filiere} onChange={v => setFiliere(v)} label="" />
        </div>

        {/* Semestre */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Semestre *</label>
          <select
            value={selSem}
            onChange={e => setSelSem(e.target.value)}
            disabled={!filiere || !selSession}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40 disabled:opacity-50"
          >
            <option value="">— Sélectionner —</option>
            {semestres.map(s => (
              <option key={s.id} value={s.id}>{s.code_semestre}</option>
            ))}
          </select>
        </div>

        {/* EM */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Élément de module (EM) *</label>
          <select
            value={selEm}
            onChange={e => setSelEm(e.target.value)}
            disabled={!selSem}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40 disabled:opacity-50"
          >
            <option value="">— Sélectionner —</option>
            {ems.map(e => (
              <option key={e.id} value={e.id}>{e.code_em} — {e.intitule}</option>
            ))}
          </select>
          {selSem && ems.length === 0 && (
            <p className="mt-1 text-xs text-slate-400">Aucun EM trouvé pour cette filière / semestre / année.</p>
          )}
        </div>

        {/* Type de note */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Type de note *</label>
          <div className="flex gap-4">
            {(['CC', 'TP', 'EXAM'] as TypeNote[]).map(t => {
              const disabledRatt = isRatt && t !== 'EXAM';
              const disabledTP   = t === 'TP' && !hasTP;
              const isDisabled   = disabledRatt || disabledTP;
              return (
                <label key={t} className={`flex items-center gap-2 cursor-pointer ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <input
                    type="radio"
                    name="type_note"
                    value={t}
                    checked={typeNote === t}
                    disabled={isDisabled}
                    onChange={() => { setTypeNote(t); if (t !== 'EXAM') setAnonymat(false); }}
                    className="accent-[#006633]"
                  />
                  <span className="text-sm">{t === 'CC' ? 'Contrôle Continu' : t === 'TP' ? 'Travaux Pratiques' : 'Examen'}</span>
                </label>
              );
            })}
          </div>
          {isRatt && <p className="mt-1 text-xs text-amber-600">Session de rattrapage — uniquement Examen disponible.</p>}
          {typeNote === 'TP' && !hasTP && selEm && <p className="mt-1 text-xs text-red-600">Cet EM n'a pas de TP</p>}
        </div>

        {/* Anonymat */}
        <div className={`flex items-center gap-3 ${!anonymatAllowed ? 'opacity-50' : ''}`}>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={anonymat && anonymatAllowed}
              disabled={!anonymatAllowed}
              onChange={e => setAnonymat(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-[#006633] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
          </label>
          <span className="text-sm text-slate-700">Mode anonymat</span>
          {!anonymatAllowed && (
            <span className="text-xs text-slate-400">(disponible uniquement pour l'Examen)</span>
          )}
        </div>

        {/* Format de sortie */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Format *</label>
          <div className="flex gap-4">
            {(['pdf', 'excel'] as const).map(f => (
              <label key={f} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value={f}
                  checked={format === f}
                  onChange={() => setFormat(f)}
                  className="accent-[#006633]"
                />
                <span className="text-sm">{f === 'pdf' ? 'PDF' : 'Excel'}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={download}
          disabled={loading || !selSession || !selSem}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
        >
          {loading
            ? <><svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Génération en cours…</>
            : <>
                <Download size={16} />
                {(() => {
                  const modeLabel = anonymat && anonymatAllowed ? 'Anonymat' : isRatt ? 'Rattrapage' : 'Normale';
                  const fmtLabel = format === 'excel' ? 'Excel' : 'PDF';
                  return selEm
                    ? `Télécharger fiche EM (${fmtLabel} · ${modeLabel})`
                    : `Télécharger tous les ${typeNote} (${fmtLabel} · ${modeLabel})`;
                })()}
              </>
          }
        </button>
      </div>
    </div>
  );
}
