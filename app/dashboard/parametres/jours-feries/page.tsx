'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, CalendarX2, Loader2, Plus, Trash2, Wand2, X,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import {
  useFeriesFixes, useFeriesFixesMutations, useJoursFeries, useJourFerieMutations,
} from '@/lib/api/feries-hooks';
import type { JourFerie, JourFerieFixe, ResultatApplication } from '@/lib/api/feries';

const VERT  = '#006633';
const INPUT = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 '
            + 'focus:outline-none focus:bg-white focus:border-[#006633] transition-all';
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
              'août', 'septembre', 'octobre', 'novembre', 'décembre'];
/** Jours par mois — février à 29 : le 29/02 est un férié valide les années bissextiles. */
const JOURS_DU_MOIS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const jjmmaaaa = (iso: string) => iso.split('-').reverse().join('/');

interface Year { id: number; annee: string; }

export default function JoursFeriesPage() {
  const toast = useToast();
  const user  = getStoredUser();

  // ── Fériés fixes ───────────────────────────────────────────────────────
  const fixesQ = useFeriesFixes();
  const fixes  = fixesQ.data ?? [];
  const { create, update, remove } = useFeriesFixesMutations();

  const [jour, setJour]       = useState('1');
  const [mois, setMois]       = useState('1');
  const [libelle, setLibelle] = useState('');
  const [aSupprimer, setASupprimer] = useState<JourFerieFixe | null>(null);

  const joursPossibles = JOURS_DU_MOIS[Number(mois) - 1] ?? 31;

  function ajouterFixe() {
    create.mutate(
      { jour: Number(jour), mois: Number(mois), libelle: libelle.trim(), actif: true },
      {
        onSuccess: (f) => {
          toast.success(`${f.libelle} (${String(f.jour).padStart(2, '0')}/${String(f.mois).padStart(2, '0')}) ajouté.`);
          setLibelle('');
        },
        onError: (e) => toast.error(lireErreur(e)),
      });
  }

  // ── Jours marqués d'une période ────────────────────────────────────────
  const [annee, setAnnee] = useState(user?.annee_universitaire ?? '');
  const [typeSem, setTypeSem] = useState(user?.semestre === 'Pairs' ? 'P' : 'I');
  const anneesQ = useQuery({
    queryKey: ['parametres', 'annees', 'all'] as const,
    queryFn:  () => apiFetch<Year[]>('/api/v1/parametres/annees/all/'),
  });
  const marquesQ = useJoursFeries(annee, typeSem);
  const marques  = useMemo(() => marquesQ.data ?? [], [marquesQ.data]);
  const { retirer, appliquerFixes } = useJourFerieMutations();

  const [aRetirer, setARetirer]       = useState<JourFerie | null>(null);
  const [confirmerApplication, setConfirmerApplication] = useState(false);
  const [bilan, setBilan] = useState<ResultatApplication | null>(null);

  return (
    <div className="space-y-6 max-w-5xl">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/parametres"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#475569,#64748b)' }}>
              <CalendarX2 size={14} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-iss-dark">Jours fériés</h1>
          </div>
          <p className="text-sm text-iss-gray">
            Un jour férié garde le numéro de sa semaine. Ses séances sont annulées
            — ni pointées ni payées — et reviennent si le férié est retiré.
          </p>
        </div>
      </div>

      {/* ── Fériés fixes ───────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl shadow-card border border-gray-100 p-5 space-y-4">
        <div>
          <h2 className="font-bold text-iss-dark">Fériés à date fixe</h2>
          <p className="text-xs text-iss-gray mt-0.5 leading-relaxed">
            Appliqués automatiquement aux semaines que l’on génère. Les fêtes
            religieuses (Aïd, Mawlid, Nouvel An de l’Hégire) changent de date
            chaque année : marquez-les jour par jour dans{' '}
            <Link href="/dashboard/parametres/semaines" className="font-semibold underline">
              Semaines
            </Link>.
          </p>
        </div>

        {fixesQ.isLoading ? (
          <div className="flex justify-center py-6"><Loader2 size={22} className="animate-spin text-iss-primary" /></div>
        ) : fixes.length === 0 ? (
          <p className="text-sm text-iss-gray italic">Aucun férié fixe enregistré.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th className="w-40">Date</th><th>Libellé</th><th className="w-28">Actif</th><th className="w-16" /></tr>
            </thead>
            <tbody>
              {fixes.map(f => (
                <tr key={f.id} className={f.actif ? '' : 'opacity-60'}>
                  <td className="font-semibold text-iss-dark text-sm tabular-nums">
                    {f.jour} {MOIS[f.mois - 1]}
                  </td>
                  <td className="text-sm">{f.libelle}</td>
                  <td>
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={f.actif} disabled={update.isPending}
                        onChange={e => update.mutate({ id: f.id, actif: e.target.checked }, {
                          onError: (err) => toast.error(lireErreur(err)),
                        })} />
                      {f.actif ? 'Actif' : 'Inactif'}
                    </label>
                  </td>
                  <td>
                    <button onClick={() => setASupprimer(f)} title="Supprimer ce férié fixe"
                      className="p-1.5 rounded-lg text-iss-gray hover:text-iss-secondary hover:bg-red-50 transition-all">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-gray-100">
          <div className="w-20">
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Jour</label>
            <select value={jour} onChange={e => setJour(e.target.value)} className={INPUT}>
              {Array.from({ length: joursPossibles }, (_, i) => i + 1).map(n =>
                <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="w-36">
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Mois</label>
            <select value={mois} className={INPUT} onChange={e => {
              setMois(e.target.value);
              const max = JOURS_DU_MOIS[Number(e.target.value) - 1];
              if (Number(jour) > max) setJour(String(max));
            }}>
              {MOIS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Libellé</label>
            <input value={libelle} onChange={e => setLibelle(e.target.value)} maxLength={100}
              placeholder="ex : Fête de l’Indépendance" className={INPUT} />
          </div>
          <button onClick={ajouterFixe} disabled={!libelle.trim() || create.isPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 hover:opacity-90"
            style={{ background: `linear-gradient(135deg,${VERT},#008844)` }}>
            {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Ajouter
          </button>
        </div>
      </section>

      {/* ── Jours marqués ──────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl shadow-card border border-gray-100 p-5 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-48">
            <h2 className="font-bold text-iss-dark">Jours marqués fériés</h2>
            <p className="text-xs text-iss-gray mt-0.5">
              Les jours fériés isolés de la période. Pour en marquer un :{' '}
              <Link href="/dashboard/parametres/semaines" className="font-semibold underline">Semaines</Link>
              {' '}→ « Marquer un jour férié ».
            </p>
          </div>
          <div className="w-36">
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Année</label>
            <select value={annee} onChange={e => setAnnee(e.target.value)} className={INPUT}>
              <option value="">— Choisir —</option>
              {(anneesQ.data ?? []).map(a => <option key={a.id} value={a.annee}>{a.annee}</option>)}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Semestres</label>
            <select value={typeSem} onChange={e => setTypeSem(e.target.value)} className={INPUT}>
              <option value="I">Impairs</option>
              <option value="P">Pairs</option>
            </select>
          </div>
          <button onClick={() => { setBilan(null); setConfirmerApplication(true); }}
            disabled={!annee || fixes.length === 0 || appliquerFixes.isPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-iss-dark hover:bg-gray-50 disabled:opacity-50">
            <Wand2 size={14} /> Appliquer les fériés fixes
          </button>
        </div>

        {/* Le bilan d'une application : ce qui a été marqué, puis ce qui a
            été écarté et pourquoi — un jour bloqué n'empêche pas les autres. */}
        {bilan && (
          <div className="rounded-xl border px-4 py-3 text-xs space-y-1.5"
               style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
            <div className="flex items-start justify-between gap-2">
              <strong className="text-iss-dark">{bilan.message}</strong>
              <button onClick={() => setBilan(null)} className="text-iss-gray hover:text-iss-dark"><X size={14} /></button>
            </div>
            {bilan.ecartes.map(e => (
              <p key={e.id} className="text-amber-900">
                <strong>{jjmmaaaa(e.date)} — {e.libelle}</strong> écarté : {e.motif}
              </p>
            ))}
          </div>
        )}

        {!annee ? (
          <p className="text-sm text-iss-gray italic">Choisissez une année.</p>
        ) : marquesQ.isLoading ? (
          <div className="flex justify-center py-6"><Loader2 size={22} className="animate-spin text-iss-primary" /></div>
        ) : marques.length === 0 ? (
          <p className="text-sm text-iss-gray italic">
            Aucun jour férié marqué pour {annee} en semestres {typeSem === 'P' ? 'pairs' : 'impairs'}.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th className="w-44">Jour</th><th className="w-20">Semaine</th><th>Libellé</th><th className="w-16" /></tr>
            </thead>
            <tbody>
              {marques.map(m => (
                <tr key={m.id}>
                  <td className="font-semibold text-iss-dark text-sm tabular-nums">
                    {m.jour} {jjmmaaaa(m.date)}
                  </td>
                  <td className="text-sm tabular-nums">S{m.numero_semaine}</td>
                  <td className="text-sm">{m.libelle || <span className="text-iss-gray italic">—</span>}</td>
                  <td>
                    <button onClick={() => setARetirer(m)} title="Rendre ce jour aux cours"
                      className="p-1.5 rounded-lg text-iss-gray hover:text-iss-secondary hover:bg-red-50 transition-all">
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <ConfirmModal
        open={aSupprimer !== null}
        title="Supprimer ce férié fixe ?"
        message={aSupprimer
          ? `« ${aSupprimer.libelle} » (${aSupprimer.jour} ${MOIS[aSupprimer.mois - 1]}) ne sera plus appliqué aux semaines générées. Les jours déjà marqués fériés le restent.`
          : ''}
        confirmLabel="Supprimer"
        variant="danger"
        loading={remove.isPending}
        onConfirm={() => aSupprimer && remove.mutate(aSupprimer.id, {
          onSuccess: () => { toast.success(`« ${aSupprimer.libelle} » supprimé.`); setASupprimer(null); },
          onError:   (e) => { toast.error(lireErreur(e)); setASupprimer(null); },
        })}
        onCancel={() => setASupprimer(null)}
      />

      <ConfirmModal
        open={aRetirer !== null}
        title="Rendre ce jour aux cours ?"
        message={aRetirer
          ? `${aRetirer.jour} ${jjmmaaaa(aRetirer.date)}${aRetirer.libelle ? ` (${aRetirer.libelle})` : ''} redevient un jour de cours. Les séances annulées par ce férié sont rétablies ; une séance annulée à la main reste annulée.`
          : ''}
        confirmLabel="Rendre aux cours"
        variant="warning"
        loading={retirer.isPending}
        onConfirm={() => aRetirer && retirer.mutate(aRetirer.id, {
          onSuccess: (r) => { toast.success(r.message); setARetirer(null); },
          onError:   (e) => { toast.error(lireErreur(e)); setARetirer(null); },
        })}
        onCancel={() => setARetirer(null)}
      />

      <ConfirmModal
        open={confirmerApplication}
        title="Appliquer les fériés fixes ?"
        message={`Chaque jour de ${annee} (semestres ${typeSem === 'P' ? 'pairs' : 'impairs'}) qui tombe sur un férié fixe actif sera marqué férié, et ses séances annulées. Un jour dont le suivi est déjà généré est écarté, sans empêcher les autres.`}
        confirmLabel="Appliquer"
        variant="warning"
        loading={appliquerFixes.isPending}
        onConfirm={() => appliquerFixes.mutate({ annee, typeSemestre: typeSem }, {
          onSuccess: (r) => { setBilan(r); setConfirmerApplication(false); toast.success(r.message); },
          onError:   (e) => { toast.error(lireErreur(e)); setConfirmerApplication(false); },
        })}
        onCancel={() => setConfirmerApplication(false)}
      />
    </div>
  );
}

/**
 * Le message d'un refus. `apiFetch` lit `error` et `detail` ; une erreur de
 * sérialiseur arrive sous `errors` et lui échappe — elle est alors rendue en
 * JSON. On en tire le premier message lisible.
 */
function lireErreur(e: unknown): string {
  const brut = e instanceof Error ? e.message : String(e);
  try {
    const j = JSON.parse(brut) as { errors?: Record<string, string[] | string> };
    const premier = j.errors && Object.values(j.errors)[0];
    if (Array.isArray(premier)) return premier[0];
    if (typeof premier === 'string') return premier;
  } catch { /* pas du JSON : déjà lisible */ }
  return brut;
}
