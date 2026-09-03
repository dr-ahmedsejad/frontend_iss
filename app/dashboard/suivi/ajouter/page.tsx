'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, Play, Trash2, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { ConfirmModal } from '@/components/ConfirmModal';

interface Semaine {
  id: number;
  numero_semaine: number | null;
  jour: string;
  date: string;
  type_semaine?: 'cours' | 'ferie' | 'vacances' | 'examen';
}

export default function AjouterSuiviPage() {
  const user = getStoredUser();
  const annee = user?.annee_universitaire ?? '';
  const ts    = user?.semestre === 'Pairs' ? 'P' : 'I';

  const qc = useQueryClient();
  const [selected, setSelected] = useState<number | null>(null);
  const [msg,      setMsg]      = useState<{ type: 'ok'|'err'; text: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmBackfill, setConfirmBackfill] = useState(false);
  // Message du 409 « force » quand des absences existent (2e confirmation).
  const [forcePrompt, setForcePrompt] = useState<string | null>(null);

  const semainesQuery = useQuery({
    queryKey: ['parametres', 'semaines', 'list-cours', { annee, ts }] as const,
    queryFn:  async () => {
      const res = await apiFetch<{ results: Semaine[] }>(
        `/api/v1/parametres/semaines/?annee_universitaire=${annee}&type_semestre=${ts}&type_semaine=cours&ordering=numero_semaine&page_size=500`,
      ).catch(() => ({ results: [] as Semaine[] }));
      // Filtre defense-in-depth : seules les semaines de cours avec un numero
      // sont eligibles (ferie/vacances/examen ont numero_semaine = NULL).
      const rows = (res.results ?? [])
        .filter(s => s.type_semaine === 'cours' && s.numero_semaine !== null);
      // Compute date_debut/date_fin pour chaque numero_semaine (jours regroupes)
      const ranges = new Map<number, { date_debut: string; date_fin: string }>();
      for (const r of rows) {
        const n = r.numero_semaine as number;
        const cur = ranges.get(n);
        if (!cur) {
          ranges.set(n, { date_debut: r.date, date_fin: r.date });
        } else {
          if (r.date < cur.date_debut) cur.date_debut = r.date;
          if (r.date > cur.date_fin)   cur.date_fin   = r.date;
        }
      }
      return [...ranges.entries()]
        .map(([numero, range]) => ({ numero, ...range }))
        .sort((a, b) => a.numero - b.numero);
    },
    enabled: !!annee,
  });
  const semainesData = semainesQuery.data ?? [];
  const semaines = semainesData.map(s => s.numero);
  const semaineRange = new Map(semainesData.map(s => [s.numero, s]));

  const fmtDateShort = (s: string) => {
    if (!s) return '';
    try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }); }
    catch { return s; }
  };
  const semaineLabel = (n: number) => {
    const r = semaineRange.get(n);
    if (!r || !r.date_debut || !r.date_fin) return `Semaine ${n}`;
    return `Semaine ${n} (du ${fmtDateShort(r.date_debut)} au ${fmtDateShort(r.date_fin)})`;
  };

  // Clé DISTINCTE de celle des huit autres écrans (fiches, absences,
  // remplissage…) : eux rangent sous `['suivi', 'semaines-generees', …]` une
  // LISTE de numéros, cet écran range l'OBJET complet (current_week,
  // authorized_weeks…). Partager la clé faisait servir l'objet à l'écran
  // suivant, qui appelait `.map` dessus — « semainesGlobal.map is not a
  // function » sur les fiches individuelles, juste après une génération.
  const semainesGenereesKey = ['suivi', 'semaines-generees', 'detail', annee, ts] as const;
  const semainesGenereesQuery = useQuery({
    queryKey: semainesGenereesKey,
    // staleTime: 0 -> refetch a chaque mount de la page pour capter les nouvelles
    // autorisations de rattrapage accordees par l'admin pendant que le user est connecte.
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn:  async () => {
      const res = await apiFetch<{
        semaines_generees: number[];
        current_week?: number | null;
        is_admin_user?: boolean;
        grace_days_after_week_end?: number;
        authorized_weeks?: number[];
      }>(
        `/api/v1/suivi/suivies/semaines-generees/?annee_universitaire=${annee}&type_semestre=${ts}`,
      ).catch(() => ({
        semaines_generees: [] as number[], current_week: null,
        is_admin_user: false, grace_days_after_week_end: 0,
        authorized_weeks: [] as number[],
      }));
      return {
        semaines_generees: res.semaines_generees ?? [],
        current_week:      res.current_week ?? null,
        is_admin_user:     res.is_admin_user ?? false,
        grace_days:        res.grace_days_after_week_end ?? 0,
        authorized_weeks:  res.authorized_weeks ?? [],
      };
    },
    enabled: !!annee,
  });
  const semainesGenerees = semainesGenereesQuery.data?.semaines_generees ?? [];
  const currentWeek      = semainesGenereesQuery.data?.current_week ?? null;
  const isAdminUser      = semainesGenereesQuery.data?.is_admin_user ?? false;
  const graceDays        = semainesGenereesQuery.data?.grace_days ?? 0;
  const authorizedWeeks  = semainesGenereesQuery.data?.authorized_weeks ?? [];
  const loading = semainesQuery.isLoading || semainesGenereesQuery.isLoading;

  const isGenerated = (n: number) => semainesGenerees.includes(n);

  const generateMut = useMutation({
    mutationFn: () => apiFetch<{ message: string }>('/api/v1/suivi/suivies/ajouter/', {
      method: 'POST',
      body: { annee_universitaire: annee, numero_semaine: selected, type_semestre: ts },
    }),
    onSuccess: (res) => {
      setMsg({ type: 'ok', text: res.message });
      qc.invalidateQueries({ queryKey: semainesGenereesKey });
    },
    onError: (e) => setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erreur lors de la génération.' }),
  });

  const removeMut = useMutation({
    mutationFn: (force: boolean = false) => apiFetch<{ deleted: number; restored: number; remaining: number }>(
      `/api/v1/suivi/suivies/par-semaine/?numero_semaine=${selected}&annee_universitaire=${annee}&type_semestre=${ts}${force ? '&force=1' : ''}`,
      { method: 'DELETE' },
    ),
    onSuccess: (res) => {
      const txt = res.restored > 0
        ? `Suivi semaine ${selected} supprimé. EDT restauré (${res.restored} séances).`
        : res.remaining > 0
          ? `Suivi semaine ${selected} supprimé. (${res.remaining} enregistrements restants — restauration non déclenchée)`
          : `Suivi semaine ${selected} supprimé. (archive vide — aucune séance restaurée)`;
      setMsg({ type: res.restored > 0 ? 'ok' : 'err', text: txt });
      setForcePrompt(null);
      qc.invalidateQueries({ queryKey: semainesGenereesKey });
      setSelected(null);
    },
    onError: (e) => {
      const text = e instanceof Error ? e.message : 'Erreur lors de la suppression.';
      // Le backend renvoie un 409 « …Relancez avec ?force=1 » quand des absences
      // sont enregistrées : on demande une 2e confirmation explicite.
      if (text.includes('force=1')) setForcePrompt(text);
      else setMsg({ type: 'err', text });
    },
  });

  const busy = generateMut.isPending || removeMut.isPending;

  function generate() {
    if (!selected || !annee) return;
    setMsg(null);
    // Confirmation pour les semaines passees (admin uniquement, vu que
    // non-admin ne les voit plus). Evite les rattrapages accidentels.
    if (!isGenerated(selected) && isAdminUser && currentWeek !== null && selected < currentWeek) {
      setConfirmBackfill(true);
      return;
    }
    generateMut.mutate();
  }

  function doBackfill() {
    setConfirmBackfill(false);
    if (!selected) return;
    generateMut.mutate();
  }

  function remove() {
    if (!selected || !annee) return;
    setConfirmRemove(true);
  }

  function doRemove() {
    setConfirmRemove(false);
    setMsg(null);
    removeMut.mutate(false);
  }

  const semNonGenRaw = semaines.filter(n => !isGenerated(n));
  const semGen       = semaines.filter(n =>  isGenerated(n));
  const maxGenerated = semGen.length > 0 ? Math.max(...semGen) : null;
  const canDelete    = selected !== null && isGenerated(selected) && selected === maxGenerated;

  // Classification : current/future/past selon la semaine pedagogique en cours.
  const weekStatus = (n: number): 'current' | 'future' | 'past' => {
    if (currentWeek === null) return 'future';
    if (n === currentWeek)   return 'current';
    if (n > currentWeek)     return 'future';
    return 'past';
  };

  // Regle : seul admin/superuser peut generer une semaine passee. Les non-admins
  // peuvent generer une semaine cloturee SI ils ont recu une autorisation
  // de rattrapage explicite (authorized_weeks).
  const isAuthorizedBackfill = (n: number) => authorizedWeeks.includes(n);
  const isPastBlocked = (n: number) => {
    if (currentWeek === null) return false;
    if (isAdminUser) return false;
    if (isAuthorizedBackfill(n)) return false;   // autorisation explicite
    const graceWeeks = Math.floor(graceDays / 7);
    return n < currentWeek - graceWeeks;
  };
  const canGenerate = (n: number) => !isPastBlocked(n);
  // Le suivi se génère dans l'ordre et se refait en RECULANT depuis la
  // dernière semaine : régénérer la 1 quand la 2 existe réécrirait un pointage
  // sur lequel la suite s'appuie. Même règle que pour la suppression, déjà
  // ordonnée ci-dessus — et même règle que le serveur, qui refuse (409).
  const bloqueeParLaSuite = selected !== null && maxGenerated !== null
    && selected < maxGenerated;
  const canGenerateSelected = selected !== null && !bloqueeParLaSuite
    && (isGenerated(selected) || canGenerate(selected));

  // Liste affichee : TOUTES les semaines sont visibles (admin ou pas).
  // Les passees apparaissent avec un badge "Clôturée" et sont non cliquables
  // pour les non-admins. Pour les admins, elles restent cliquables (rattrapage).
  const semNonGen = [...semNonGenRaw].sort((a, b) => a - b);
  const isClotured = (n: number) => isPastBlocked(n);   // alias UI


  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/suivi" className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <ClipboardList size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Ajouter suivi</h1>
            <p className="text-xs text-iss-gray">Générer le suivi hebdomadaire à partir de l&apos;emploi du temps</p>
          </div>
        </div>
      </div>

      {/* Contexte */}
      <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100 flex flex-wrap gap-4 text-sm">
        <span className="text-iss-gray">Année : <strong className="text-iss-dark">{annee || '—'}</strong></span>
        <span className="w-px h-4 bg-gray-200 self-center" />
        <span className="text-iss-gray">Semestres : <strong className="text-iss-dark">{user?.semestre || '—'}</strong></span>
        <span className="w-px h-4 bg-gray-200 self-center" />
        <span className="text-iss-gray">
          Générées : <strong style={{ color: '#006633' }}>{semGen.length}</strong>
          {' / '}
          Non générées : <strong style={{ color: '#C82020' }}>{semNonGen.length}</strong>
        </span>
      </div>

      {/* Message */}
      {msg && (
        <div className={`flex items-start gap-3 p-4 rounded-2xl border ${
          msg.type === 'ok'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {msg.type === 'ok'
            ? <CheckCircle size={16} className="shrink-0 mt-0.5" />
            : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
          <span className="text-sm">{msg.text}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-iss-primary" />
        </div>
      ) : !annee ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-800">
          Année universitaire non définie dans votre profil.
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Semaines non générées */}
          <div className="bg-white rounded-2xl shadow-card border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-iss-dark flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                Semaines non générées ({semNonGen.length})
              </h2>
            </div>
            <div className="p-3 max-h-72 overflow-y-auto space-y-1">
              {semNonGen.length === 0 ? (
                <p className="text-center py-6 text-xs text-iss-gray/50">Toutes les semaines ont été générées</p>
              ) : (
                semNonGen.map(n => {
                  const status     = weekStatus(n);
                  const clotured   = isClotured(n);
                  const authorized = isAuthorizedBackfill(n) && status === 'past';
                  const title = clotured
                    ? 'Semaine clôturée — contactez un administrateur pour le rattrapage'
                    : authorized
                      ? 'Autorisation de rattrapage accordée par admin'
                      : undefined;
                  return (
                    <button key={n}
                      onClick={() => { if (!clotured) { setSelected(n); setMsg(null); } }}
                      disabled={clotured}
                      title={title}
                      className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all flex items-center justify-between gap-2 ${
                        selected === n
                          ? 'font-bold text-white'
                          : clotured
                            ? 'text-iss-gray/50 cursor-not-allowed bg-gray-50/50'
                            : authorized
                              ? 'text-iss-primary hover:bg-iss-primary/5'
                              : status === 'past'
                                ? 'text-iss-gray/70 hover:bg-gray-50'
                                : 'text-iss-dark-soft hover:bg-gray-50'
                      }`}
                      style={selected === n ? { background: 'linear-gradient(135deg, #006633, #008844)' } : {}}>
                      <span>{semaineLabel(n)}</span>
                      {selected !== n && clotured && (
                        <span className="text-[10px] font-bold text-iss-gray bg-gray-200 rounded-md px-1.5 py-0.5">
                          🔒 Clôturée
                        </span>
                      )}
                      {selected !== n && authorized && (
                        <span className="text-[10px] font-bold rounded-md px-2 py-0.5"
                          style={{ background: '#006633', color: '#ffffff' }}>
                          🔓 Autorisée
                        </span>
                      )}
                      {selected !== n && !clotured && !authorized && status === 'current' && (
                        <span className="text-[10px] font-bold text-white bg-green-600 rounded-md px-1.5 py-0.5">
                          ● En cours
                        </span>
                      )}
                      {selected !== n && !clotured && !authorized && status === 'future' && currentWeek !== null && (
                        <span className="text-[10px] font-normal text-iss-primary bg-iss-primary/10 border border-iss-primary/20 rounded-md px-1.5 py-0.5">
                          +{n - currentWeek}&nbsp;sem
                        </span>
                      )}
                      {selected !== n && !clotured && !authorized && status === 'past' && currentWeek !== null && (
                        <span className="text-[10px] font-normal text-iss-gray bg-gray-100 border border-gray-200 rounded-md px-1.5 py-0.5">
                          Rattrapage (-{currentWeek - n}&nbsp;sem)
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Semaines déjà générées */}
          <div className="bg-white rounded-2xl shadow-card border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-iss-dark flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Semaines générées ({semGen.length})
              </h2>
            </div>
            <div className="p-3 max-h-72 overflow-y-auto space-y-1">
              {semGen.length === 0
                ? <p className="text-center py-6 text-xs text-iss-gray/50">Aucune semaine générée</p>
                : semGen.map(n => (
                  <button key={n} onClick={() => { setSelected(n); setMsg(null); }}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 ${
                      selected === n
                        ? 'font-bold text-white'
                        : 'text-iss-dark-soft hover:bg-gray-50'
                    }`}
                    style={selected === n ? { background: 'linear-gradient(135deg, #006633, #008844)' } : {}}>
                    <CheckCircle size={13} style={{ color: selected === n ? '#E5C018' : '#4CAF50' }} />
                    {semaineLabel(n)}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {selected !== null && !loading && (
        <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100">
          <p className="text-sm font-semibold text-iss-dark mb-4">
            Semaine sélectionnée : <span style={{ color: '#006633' }}>{semaineLabel(selected)}</span>
            {isGenerated(selected) && (
              <span className="ml-2 text-xs font-normal text-green-600">(déjà générée)</span>
            )}
          </p>

          {!isGenerated(selected) ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={generate}
                disabled={busy || !canGenerateSelected}
                title={!canGenerateSelected ? 'Semaine passée — rattrapage administrateur' : undefined}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                Générer le suivi semaine {selected}
              </button>
              {bloqueeParLaSuite ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  La semaine {maxGenerated} est déjà générée. Le suivi se refait en
                  reculant depuis la dernière semaine : supprimez d&apos;abord
                  la semaine {maxGenerated}.
                </p>
              ) : !canGenerateSelected && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Génération impossible — cette semaine est passée. Contactez un administrateur pour le rattrapage.
                </p>
              )}
              {canGenerateSelected && isAdminUser && currentWeek !== null && selected < currentWeek && (
                <p className="text-xs text-iss-gray bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                  ℹ️ Rattrapage admin — une confirmation vous sera demandée.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={generate}
                disabled={busy || bloqueeParLaSuite}
                title={bloqueeParLaSuite
                  ? `Supprimez d'abord la semaine ${maxGenerated} : le suivi se refait en reculant`
                  : undefined}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                Regénérer semaine {selected}
              </button>
              <button
                onClick={remove}
                disabled={busy || !canDelete}
                title={!canDelete ? `Supprimez d'abord la semaine ${maxGenerated}` : undefined}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #C82020, #e53535)' }}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Supprimer semaine {selected}
              </button>
              {!canDelete && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Suppression impossible — supprimez d&apos;abord la semaine <strong>{maxGenerated}</strong>.
                </p>
              )}
            </div>
          )}

          {!isGenerated(selected) && (
            <p className="mt-3 text-xs text-iss-gray">
              L&apos;EDT actuel sera archivé, puis vidé pour permettre la saisie d&apos;une nouvelle version.
            </p>
          )}
        </div>
      )}

      <ConfirmModal
        open={confirmRemove}
        title="Supprimer le suivi"
        message={`Supprimer le suivi semaine ${selected} et restaurer l'EDT archivé ?`}
        confirmLabel="Supprimer"
        variant="danger"
        loading={removeMut.isPending}
        onConfirm={doRemove}
        onCancel={() => setConfirmRemove(false)}
      />

      <ConfirmModal
        open={confirmBackfill}
        title="Générer une semaine ancienne ?"
        message={
          selected !== null && currentWeek !== null
            ? `Vous allez générer la ${semaineLabel(selected)}, qui date d'il y a ${currentWeek - selected} semaine(s). Cas légitimes : rattrapage après stage, absence prolongée, migration de données. Confirmer la génération ?`
            : `Confirmer la génération de la semaine ${selected} ?`
        }
        confirmLabel="Continuer la génération"
        variant="danger"
        loading={generateMut.isPending}
        onConfirm={doBackfill}
        onCancel={() => setConfirmBackfill(false)}
      />

      <ConfirmModal
        open={forcePrompt !== null}
        title="Des absences sont enregistrées"
        message={`${forcePrompt ?? ''}\n\nCet historique d'absences/justificatifs sera définitivement perdu. Confirmer la suppression ?`}
        confirmLabel="Supprimer quand même"
        variant="danger"
        loading={removeMut.isPending}
        onConfirm={() => removeMut.mutate(true)}
        onCancel={() => setForcePrompt(null)}
      />
    </div>
  );
}
