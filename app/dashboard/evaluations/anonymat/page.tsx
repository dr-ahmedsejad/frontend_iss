'use client';

import { useState, useEffect } from 'react';
import { Shield, Download, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { sessionsApi, anonymatsApi } from '@/lib/api/evaluations';
import { downloadBlob } from '@/lib/downloadBlob';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { getStoredUser } from '@/lib/auth';
import type { SessionEvaluation, AnonymatSession } from '@/types/evaluations';

export default function AnonymatPage() {
  const toast = useToast();

  // Année active (contexte session) : on ne propose que les sessions de cette
  // année ET non clôturées.
  const userAnnee = getStoredUser()?.annee_universitaire ?? '';

  const [sessions,      setSessions]      = useState<SessionEvaluation[]>([]);
  const [selSession,    setSelSession]    = useState('');
  const [anonymats,     setAnonymats]     = useState<AnonymatSession[]>([]);
  const [nbGeneres,     setNbGeneres]     = useState<number | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [loadingPdf,    setLoadingPdf]    = useState(false);
  const [confirmRegen,  setConfirmRegen]  = useState(false);

  useEffect(() => {
    sessionsApi.list({ page_size: 200 })
      .then(r => setSessions(
        r.results.filter(s =>
          !s.est_cloturee && (!userAnnee || s.annee_universitaire === userAnnee),
        ),
      ))
      .catch(() => {});
  }, [userAnnee]);

  useEffect(() => {
    if (!selSession) { setAnonymats([]); setNbGeneres(null); return; }
    anonymatsApi.list(Number(selSession)).then(r => {
      setAnonymats(r.results);
      setNbGeneres(r.count);
    }).catch(() => { setAnonymats([]); setNbGeneres(0); });
  }, [selSession]);

  const handleGenerer = async (regenerer = false) => {
    if (!selSession) return;
    if (regenerer) setConfirmRegen(false);
    setLoading(true);
    try {
      const r = await anonymatsApi.generer(Number(selSession), regenerer);
      toast.success(`${r.nb_generes} anonymats générés avec succès.`);
      setNbGeneres(r.nb_generes);
      // Reload list
      anonymatsApi.list(Number(selSession)).then(r2 => setAnonymats(r2.results)).catch(() => {});
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('existent déjà')) {
        setConfirmRegen(true);
        toast.error('Des anonymats existent déjà. Confirmer la régénération.');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLeveePdf = async () => {
    if (!selSession) return;
    setLoadingPdf(true);
    try {
      const blob = await anonymatsApi.leveePdf(Number(selSession));
      downloadBlob(blob, `levee_anonymat_session_${selSession}.pdf`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingPdf(false);
    }
  };

  const sessionObj = sessions.find(s => String(s.id) === selSession);

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
          <Shield size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Anonymat</h1>
          <p className="text-sm text-iss-gray">Gestion des numéros d'anonymat par session</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 max-w-lg space-y-4">
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
        </div>

        {selSession && (
          <div className={`rounded-xl p-4 text-sm ${nbGeneres ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'}`}>
            <p className="font-semibold text-slate-700">
              {nbGeneres !== null
                ? nbGeneres > 0
                  ? <><span className="text-green-700">✓ {nbGeneres} anonymats générés</span></>
                  : <span className="text-slate-500">Aucun anonymat généré</span>
                : '…'}
            </p>
          </div>
        )}

        {confirmRegen && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
            <p className="text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                <strong>Attention :</strong> la régénération réattribue aléatoirement les numéros aux étudiants.
                Si des copies ont déjà été numérotées ou si une saisie par anonymat a commencé,
                les notes risquent d'être <strong>attribuées aux mauvais étudiants</strong>.
                {' '}À ne faire qu'<strong>avant</strong> toute correction/saisie. Confirmer ?
              </span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleGenerer(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#C82020] hover:bg-[#a31a1a]"
              >Régénérer</button>
              <button
                onClick={() => setConfirmRegen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-600 border border-slate-300 hover:bg-slate-50"
              >Annuler</button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={() => handleGenerer(false)}
            disabled={loading || !selSession}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
          >
            <Shield size={15} />
            {loading ? 'Génération…' : 'Générer les anonymats'}
          </button>

          {nbGeneres !== null && nbGeneres > 0 && (
            <>
              <button
                onClick={() => setConfirmRegen(true)}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#C82020] hover:bg-[#a31a1a] transition-all disabled:opacity-50"
              >
                <RefreshCw size={14} />
                Régénérer (réinitialiser)
              </button>

              <button
                onClick={handleLeveePdf}
                disabled={loadingPdf}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
              >
                {loadingPdf ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                {loadingPdf ? 'Génération…' : 'Télécharger fiche de levée (scellée)'}
              </button>
            </>
          )}
        </div>
      </div>

      {anonymats.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-slate-700">{anonymats.length} anonymats — session {sessionObj?.intitule || sessionObj?.code}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-slate-500">N° Anonymat</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-slate-500">Matricule</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-slate-500">Nom &amp; Prénom</th>
                </tr>
              </thead>
              <tbody>
                {anonymats.map(a => (
                  <tr key={a.id} className="border-t border-gray-50 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-bold text-[#006633]">{a.numero_anonymat}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{a.etudiant_matricule}</td>
                    <td className="px-4 py-2.5">{a.etudiant_nom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
