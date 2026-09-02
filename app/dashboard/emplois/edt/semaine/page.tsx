'use client';

/**
 * Emploi du temps d'une semaine — ce que l'on ajuste au fil du semestre.
 *
 * Les séances viennent de la grille type, dupliquée ; on les modifie ici sans
 * toucher au patron : remplacer un enseignant, changer de salle, annuler une
 * séance qui n'aura pas lieu.
 *
 * La **projection** est l'étape à ne pas oublier avant « Générer le suivi » :
 * le socle lit `emplois.Emplois` et ne sait rien de cette planification. Sans
 * elle, le pointage travaille sur une grille périmée — donc paie le remplacé
 * plutôt que le remplaçant, et facture une séance annulée.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays, Ban, RotateCcw, X, Save,
  Users, DoorClosed, Lock,
} from 'lucide-react';
import { edtApi, liberationsApi, type Occupation, type SeanceReelle } from '@/lib/api/edt';
import { useToast, ToastContainer } from '@/components/ui/Toast';

import { anneeParDefaut, libelleSemestreSession, typeSemestreSession } from '../_annee';
import {
  Badge, CARTE, Chargement, EnTetePage, Erreur,
  SELECT, VERT, Vide,
} from '../_ui';
import {
  CarteSeance, CaseVide, couleurType,
  STYLE_CELLULE, STYLE_CELLULE_JOUR, STYLE_ENTETE_CRENEAU,
  STYLE_ENTETE_JOUR, STYLE_ENTETE_LIGNE, STYLE_TABLE,
} from '../_cellule';
import { AC } from '../_autocomplete';
import { SelecteurSemaine } from '../_consultation';
import { useGroupesEDT, useReferentielsEDT, type Prof, type Salle } from '../_referentiels';
import { jjmmaa, useSemainesCours } from '../_semaines';
import { useCoherence } from '../_coherence';

interface Dept { id: number; nom: string; groupe?: string }

export default function SemaineEdtPage() {
  const toast = useToast();
  const qc    = useQueryClient();
  // Année et période viennent de la session : elles ont été choisies à la
  // connexion, les redemander ici n'ajouterait rien et permettrait d'éditer
  // une période différente de celle qu'on croit ouverte.
  const annee   = anneeParDefaut();
  const typeSem = typeSemestreSession();
  const [numero, setNumero]   = useState('');
  const [deptId, setDeptId]   = useState('');
  const [edite, setEdite]     = useState<SeanceReelle | null>(null);
  const [aDemander, setADemander] = useState<Occupation | null>(null);
  const [motif, setMotif]     = useState('');

  const { jours, creneaux, salles, profs } = useReferentielsEDT();
  const depts: Dept[] = useGroupesEDT().data ?? [];

  // Les semaines du calendrier. Taper un numéro obligeait à connaître par
  // cœur le découpage du semestre — et ne disait pas si la semaine existe,
  // ni quelles dates elle couvre, ni si c'est une semaine de cours.
  const { semaines: semainesCours, isLoading: chargeSemaines,
          error: erreurSemaines } = useSemainesCours(annee, typeSem);
  const semaineEnCours = semainesCours.find(
    x => String(x.numero_semaine) === numero) ?? null;

  const cle = ['edt', 'semaine', annee, typeSem, numero, deptId] as const;
  const semaineQuery = useQuery({
    queryKey: cle,
    enabled:  !!(annee && typeSem && numero),
    queryFn:  () => edtApi.semaine(annee, typeSem, Number(numero),
                                   deptId ? [Number(deptId)] : undefined),
  });
  const seances = semaineQuery.data ?? [];

  // Jours en lignes, créneaux en colonnes — l'orientation de toutes les
  // grilles de la maison. Un même emploi du temps lu tantôt dans un sens,
  // tantôt dans l'autre se relit à chaque fois.
  const parCase = useMemo(() => {
    const m: Record<string, SeanceReelle[]> = {};
    for (const x of seances) {
      (m[`${x.jour_fk}__${x.creneau_fk}`] ??= []).push(x);
    }
    return m;
  }, [seances]);

  // La date de chaque jour de CETTE semaine, pour l'écrire sous son nom.
  const dateDuJour = useMemo(() => {
    const m: Record<number, string> = {};
    for (const x of seances) if (x.jour_fk && x.date) m[x.jour_fk] = x.date;
    return m;
  }, [seances]);

  // Ce qui est pris CHEZ LES AUTRES. Le périmètre masque leurs séances : sans
  // cette lecture, on ne voit pas qu'une salle est occupée, et on ne peut donc
  // ni l'éviter ni la demander.
  const occupationQuery = useQuery({
    queryKey: ['edt', 'occupation', annee, typeSem, numero] as const,
    enabled:  !!(annee && typeSem && numero),
    queryFn:  () => edtApi.occupation(annee, typeSem, Number(numero)),
  });
  const occupees: Occupation[] = (occupationQuery.data ?? []).filter(o => o.salle);

  const rafraichir = () => qc.invalidateQueries({ queryKey: ['edt'] });

  const partager = useMutation({
    mutationFn: ({ id, groupes }: { id: number; groupes: number[] }) =>
      edtApi.partager(id, groupes),
    onSuccess: (r) => {
      toast.success(r.detail
        ? r.detail
        : `Cours partagé avec ${r.ajoutes.length} groupe${r.ajoutes.length > 1 ? 's' : ''}.`);
      setEdite(null); rafraichir();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const demanderSalle = useMutation({
    mutationFn: ({ seance, motif }: { seance: number; motif: string }) =>
      liberationsApi.demander(seance, motif),
    onSuccess: () => {
      toast.success('Demande envoyée. Le responsable de la séance décidera.');
      setADemander(null); qc.invalidateQueries({ queryKey: ['edt', 'liberations'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const majSeance = useMutation({
    mutationFn: ({ id, ...body }: Partial<SeanceReelle> & { id: number }) =>
      edtApi.majSeance(id, body),
    onSuccess: () => { toast.success('Séance mise à jour.'); setEdite(null); rafraichir(); },
    onError:   (e) => toast.error((e as Error).message),
  });

  // Le témoin de cohérence : cette semaine a-t-elle bougé depuis que le
  // suivi en a été tiré ? Sans lui, la divergence est silencieuse.
  const coherence = useCoherence(annee, typeSem);
  const etatSemaine = coherence.etat(numero ? Number(numero) : null);

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <EnTetePage
        icone={<CalendarDays size={14} className="text-white" />}
        titre="Emploi du temps hebdomadaire"
        sousTitre="Séances issues de la grille type, ajustables sur une semaine sans toucher au patron. Rien à transmettre : la génération du suivi lit cet écran."
      />

      <div className={`${CARTE} p-4`}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Groupe</label>
            <select value={deptId} onChange={e => setDeptId(e.target.value)} className={SELECT}>
              <option value="">Tous mes groupes</option>
              {depts.map(d => (
                <option key={d.id} value={d.id}>{d.nom}{d.groupe ? ` — ${d.groupe}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Période</label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: VERT }} />
              <span className="font-semibold text-iss-dark truncate">
                {annee} · {libelleSemestreSession()}
              </span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Semaine</label>
            <SelecteurSemaine semaines={semainesCours} numero={numero} onChange={setNumero} />
          </div>
        </div>
      </div>

      {/* Où l'on se trouve dans le semestre — et, sinon, pourquoi il n'y a rien. */}
      {erreurSemaines && <Erreur erreur={erreurSemaines} />}

      {annee && semainesCours.length === 0 && !chargeSemaines && !erreurSemaines && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 text-xs text-amber-900">
          Aucune semaine de cours n&apos;est déclarée pour {annee} en semestres{' '}
          {typeSem === 'I' ? 'impairs' : 'pairs'}. Le calendrier se pose dans{' '}
          <Link href="/dashboard/parametres/semaines/ajouter"
                className="underline font-semibold">Paramètres → Semaines</Link> ;
          sans lui, aucune séance ne peut être datée.
        </div>
      )}

      {semaineEnCours && (
        <div className={`${CARTE} px-4 py-3 flex items-center gap-3 flex-wrap`}
             style={{ borderLeft: '3px solid #006633' }}>
          <span className="text-sm font-bold text-iss-dark">
            Semaine {semaineEnCours.numero_semaine}
          </span>
          <span className="text-xs text-iss-gray">
            du {jjmmaa(semaineEnCours.date_debut)} au {jjmmaa(semaineEnCours.date_fin)}
          </span>
          <Badge ton="neutre">
            {seances.length} séance{seances.length !== 1 ? 's' : ''}
          </Badge>
          {seances.some(x => x.origine === 'permutation') && (
            <Badge ton="violet">Contient des remplacements</Badge>
          )}
          {seances.some(x => x.annulee) && (
            <Badge ton="rouge">Contient des annulations</Badge>
          )}
          {etatSemaine === 'aligne' && <Badge ton="vert">Suivi à jour</Badge>}
          {etatSemaine === 'divergent' && (
            <Badge ton="ambre">Suivi à régénérer</Badge>
          )}
        </div>
      )}

      {/* Le cas qui coûte : le suivi existe, mais il ne décrit plus cette
          semaine-ci. On le dit là où la modification vient d'être faite, et on
          nomme la conséquence — sinon le message n'apprend rien. */}
      {etatSemaine === 'divergent' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3
                        text-xs text-amber-900">
          <strong>Semaine {numero} : le suivi ne correspond plus.</strong>{' '}
          Vous avez modifié l&apos;emploi du temps depuis sa génération.
          Demandez à ce qu&apos;il soit régénéré.
        </div>
      )}

      {semaineQuery.isLoading ? (
        <div className={CARTE}><Chargement /></div>
      ) : seances.length === 0 ? (
        <div className={CARTE}>
          <Vide texte="Aucune séance sur cette semaine."
                action={
                  <Link href="/dashboard/emplois/edt/grille"
                        className="text-sm underline text-iss-primary">
                    Dupliquer une grille type
                  </Link>
                } />
        </div>
      ) : (
        <div className={`${CARTE} overflow-hidden`}>
          <div style={{ overflowX: 'auto' }}>
            <table style={STYLE_TABLE}>
              <thead>
                <tr style={STYLE_ENTETE_LIGNE}>
                  <th style={STYLE_ENTETE_JOUR}>Jour</th>
                  {creneaux.map(cr => (
                    <th key={cr.id} style={STYLE_ENTETE_CRENEAU}>{cr.creneau}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jours.map((j, ligne) => (
                  <tr key={j.id} style={{ background: ligne % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={STYLE_CELLULE_JOUR}>
                      {j.jour}
                      {dateDuJour[j.id] && (
                        <span className="block text-[10px] font-normal text-iss-gray">
                          {jjmmaa(dateDuJour[j.id])}
                        </span>
                      )}
                    </td>
                    {creneaux.map(cr => {
                      const liste = parCase[`${j.id}__${cr.id}`] ?? [];
                      return (
                        <td key={cr.id} style={STYLE_CELLULE}>
                          <div className="flex flex-col gap-1" style={{ height: '100%' }}>
                            {/* Un même cours donné à plusieurs groupes tenait
                                autant de cartes empilées, qui débordaient de la
                                case. On l'écrit une fois, et chaque groupe
                                devient un bouton : la séance reste modifiable
                                une par une — elles sont indépendantes, même
                                identiques. */}
                            {grouperCase(liste).map(bloc => (
                              bloc.seances.length === 1 ? (
                                <CarteSeance
                                  key={bloc.cle}
                                  type={bloc.modele.type_libelle}
                                  matiere={bloc.modele.em_code ?? bloc.modele.type_libelle}
                                  intitule={bloc.modele.em_intitule ?? undefined}
                                  prof={bloc.modele.prof_nom ?? undefined}
                                  salle={bloc.modele.salle_nom ?? undefined}
                                  sousGroupe={bloc.modele.departement_nom || undefined}
                                  annulee={bloc.modele.annulee}
                                  permutee={bloc.modele.origine === 'permutation'}
                                  profInitial={bloc.modele.prof_initial_nom ?? undefined}
                                  onClick={() => setEdite(bloc.modele)}
                                  compact
                                />
                              ) : (
                                <CarteGroupee key={bloc.cle} bloc={bloc}
                                              onOuvrir={setEdite} />
                              )
                            ))}
                            {liste.length === 0 && <CaseVide libelle="—" />}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Occupé ailleurs — le verrou de salle */}
      {occupees.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock size={15} className="text-amber-600" />
              <h2 className="text-sm font-bold text-iss-dark">
                Salles occupées par d&apos;autres groupes
              </h2>
            </div>
            <Link href="/dashboard/emplois/edt/liberations"
              className="text-xs text-iss-primary hover:underline">
              Mes demandes →
            </Link>
          </div>
          <p className="px-5 pt-3 text-xs text-iss-gray">
            Ces salles ne sont pas libres cette semaine. Vous ne pouvez pas les
            prendre : demandez-les à celui qui les détient, lui seul décide.
          </p>
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {occupees.map(o => (
              <div key={o.seance}
                className="flex items-center justify-between gap-2 border border-gray-100
                  rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-iss-dark truncate">
                    <DoorClosed size={11} className="inline mr-1 text-iss-gray" />
                    {o.salle_nom}
                  </p>
                  <p className="text-[11px] text-iss-gray truncate">
                    {o.departement_nom} · {o.jour_libelle} {o.creneau_libelle}
                    {o.em_code && ` · ${o.em_code}`}
                  </p>
                </div>
                <button onClick={() => { setADemander(o); setMotif(''); }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-iss-primary
                    border border-iss-primary/30 hover:bg-iss-primary/5 flex-shrink-0">
                  Demander
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demande de libération */}
      {aDemander && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-iss-dark">
                Demander la salle {aDemander.salle_nom}
              </h3>
              <button onClick={() => setADemander(null)}
                className="p-1.5 rounded-lg text-iss-gray hover:bg-gray-100"><X size={16} /></button>
            </div>
            <p className="text-xs text-iss-gray leading-relaxed">
              Elle est occupée par <strong>{aDemander.departement_nom}</strong> le{' '}
              {aDemander.jour_libelle} {aDemander.date} ({aDemander.creneau_libelle}).
              Le responsable de cette séance recevra votre demande ; <strong>lui
              seul</strong> peut libérer la salle. Son cours aura toujours lieu —
              il lui faudra une autre salle.
            </p>
            <div>
              <label className="block text-xs font-bold text-iss-gray uppercase mb-1">
                Motif
              </label>
              <input value={motif} onChange={e => setMotif(e.target.value)}
                className={SELECT}
                placeholder="Pourquoi cette salle en particulier ?" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setADemander(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50">
                Annuler
              </button>
              <button
                onClick={() => demanderSalle.mutate({ seance: aDemander.seance, motif })}
                disabled={demanderSalle.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-iss-primary
                  disabled:opacity-50 hover:opacity-90">
                {demanderSalle.isPending ? 'Envoi…' : 'Envoyer la demande'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Édition d'une séance */}
      {edite && (
        <FormulaireSeance
          seance={edite} profs={profs} salles={salles} depts={depts}
          onFermer={() => setEdite(null)}
          onEnregistrer={(v) => majSeance.mutate({ id: edite.id, ...v })}
          onPartager={(g) => partager.mutate({ id: edite.id, groupes: g })}
          enCours={majSeance.isPending || partager.isPending}
        />
      )}

    </div>
  );
}

// ── Formulaire d'une séance ─────────────────────────────────────────────────
function FormulaireSeance({
  seance, profs, salles, depts, onFermer, onEnregistrer, onPartager, enCours,
}: {
  seance: SeanceReelle; profs: Prof[]; salles: Salle[]; depts: Dept[];
  onFermer: () => void;
  onEnregistrer: (v: Partial<SeanceReelle>) => void;
  onPartager: (groupes: number[]) => void;
  enCours: boolean;
}) {
  const [prof, setProf]   = useState(seance.prof ? String(seance.prof) : '');
  const [salle, setSalle] = useState(seance.salle ? String(seance.salle) : '');
  const [obs, setObs]     = useState(seance.observations ?? '');
  const [aAjouter, setAAjouter] = useState<number[]>([]);

  const partages = seance.groupes_partages ?? [];
  const dejaDedans = new Set([seance.departement, ...partages.map(g => g.departement)]);

  const remplace = !!prof && Number(prof) !== seance.prof;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-iss-dark">
              {seance.em_code ?? seance.type_libelle}
            </h3>
            <p className="text-xs text-iss-gray">
              {seance.jour_libelle} {seance.date} · {seance.creneau_libelle} · {seance.departement_nom}
            </p>
          </div>
          <button onClick={onFermer}
            className="p-1.5 rounded-lg text-iss-gray hover:bg-gray-100"><X size={16} /></button>
        </div>

        {seance.annulee && (
          <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
            Cette séance est annulée : elle ne sera ni transmise au suivi, ni
            pointée, ni payée.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-iss-gray uppercase mb-1">Enseignant</label>
            <AC value={prof} onChange={setProf} placeholder="Nom de l'enseignant…"
                options={profs.map(p => ({ id: String(p.id), label: p.nom }))} />
          </div>
          <div>
            <label className="block text-xs font-bold text-iss-gray uppercase mb-1">Salle</label>
            <AC value={salle} onChange={setSalle} placeholder="Salle…"
                options={salles.map(x => ({ id: String(x.id), label: x.nom }))} />
          </div>
        </div>

        {remplace && (
          <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2 leading-relaxed">
            Changement d&apos;enseignant sur <strong>cette semaine seulement</strong>.
            Le titulaire est conservé pour mémoire ; la charge et la vacation
            suivront celui qui assure réellement la séance.
          </p>
        )}

        {/* ── Cours partagé ──────────────────────────────────────────────
            Une séance par groupe, reliées par une clé. C'est la forme que le
            socle attend : il les refusionne au pointage et ne compte les heures
            qu'une fois. Modifier ici modifie donc tous les groupes — sinon la
            clé de fusion du socle, qui inclut salle et enseignant, les
            séparerait et l'enseignant serait payé deux fois. */}
        <div className="border border-gray-100 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Users size={14} className="text-iss-primary" />
            <span className="text-xs font-bold text-iss-dark">Cours partagé</span>
          </div>

          {partages.length > 0 ? (
            <>
              <p className="text-xs text-iss-dark">
                Ce cours réunit aussi :{' '}
                <strong>{partages.map(g => g.nom).join(', ')}</strong>.
              </p>
              <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg px-2.5 py-1.5">
                Ce que vous modifiez ici s&apos;applique à <strong>tous ces
                groupes</strong> : c&apos;est un seul cours, et l&apos;enseignant
                ne doit être payé qu&apos;une fois.
              </p>
            </>
          ) : (
            <p className="text-[11px] text-iss-gray">
              Séance d&apos;un seul groupe. L&apos;étendre à d&apos;autres crée
              le même cours chez eux — l&apos;enseignant reste payé une fois.
            </p>
          )}

          <select multiple value={aAjouter.map(String)} size={3}
            onChange={e => setAAjouter(
              [...e.target.selectedOptions].map(o => Number(o.value)))}
            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">
            {depts.filter(d => !dejaDedans.has(d.id)).map(d => (
              <option key={d.id} value={d.id}>
                {d.nom}{d.groupe ? ` — ${d.groupe}` : ''}
              </option>
            ))}
          </select>
          <button onClick={() => onPartager(aAjouter)}
            disabled={aAjouter.length === 0 || enCours}
            className="w-full py-1.5 rounded-lg text-xs font-bold text-iss-primary
              border border-iss-primary/30 hover:bg-iss-primary/5 disabled:opacity-40">
            Étendre à {aAjouter.length || '…'} groupe{aAjouter.length > 1 ? 's' : ''}
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold text-iss-gray uppercase mb-1">Observation</label>
          <input value={obs} onChange={e => setObs(e.target.value)} className={SELECT}
            placeholder="Motif du changement, précision…" />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onEnregistrer({ annulee: !seance.annulee })}
            disabled={enCours}
            className={`px-3 py-2.5 rounded-xl border text-sm font-semibold disabled:opacity-50 ${
              seance.annulee
                ? 'border-green-200 text-green-700 hover:bg-green-50'
                : 'border-red-200 text-red-600 hover:bg-red-50'}`}>
            {seance.annulee
              ? <span className="flex items-center gap-1.5"><RotateCcw size={14} /> Rétablir</span>
              : <span className="flex items-center gap-1.5"><Ban size={14} /> Annuler</span>}
          </button>
          <button onClick={onFermer}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50">
            Fermer
          </button>
          <button
            onClick={() => onEnregistrer({
              prof: prof ? Number(prof) : null,
              salle: salle ? Number(salle) : null,
              observations: obs,
              // Le titulaire n'est mémorisé qu'au PREMIER remplacement : sinon
              // un second changement effacerait qui devait réellement assurer.
              ...(remplace && !seance.prof_initial
                ? { prof_initial: seance.prof, origine: 'permutation' as const }
                : {}),
            })}
            disabled={enCours}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-iss-primary
              flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90">
            <Save size={14} /> {enCours ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Cours donné à plusieurs groupes ─────────────────────────────────────────

interface BlocCase {
  cle:     string;
  modele:  SeanceReelle;
  seances: SeanceReelle[];
}

/**
 * Réunit les séances d'une case qui décrivent le MÊME cours.
 *
 * Recopier un cours vers G1, G2 et G3 crée trois séances indépendantes et
 * identiques. Empilées, elles répétaient la matière, l'enseignant et la salle
 * trois fois, et la case débordait. Ce qui les distingue vraiment — une autre
 * salle, un remplacement, une annulation — les sépare toujours.
 */
function grouperCase(liste: SeanceReelle[]): BlocCase[] {
  const blocs = new Map<string, BlocCase>();
  for (const s of liste) {
    const cle = [s.em ?? 'x', s.type_seance_fk, s.prof ?? '-', s.salle ?? '-',
                 s.annulee, s.origine].join('|');
    const bloc = blocs.get(cle);
    if (bloc) bloc.seances.push(s);
    else blocs.set(cle, { cle, modele: s, seances: [s] });
  }
  // Les groupes sont triés : leur ordre en base n'a rien à dire, et
  // « G3, G1, G2 » se lit de travers.
  for (const b of blocs.values()) {
    b.seances.sort((x, y) => (x.departement_nom ?? '').localeCompare(y.departement_nom ?? ''));
  }
  return [...blocs.values()];
}

/**
 * Le cours écrit une fois, puis un bouton par groupe.
 *
 * Chaque séance reste modifiable séparément : elles sont indépendantes même
 * quand elles se ressemblent, et fondre le clic ferait éditer l'une en croyant
 * toucher les autres.
 */
function CarteGroupee({ bloc, onOuvrir }: {
  bloc: BlocCase;
  onOuvrir: (s: SeanceReelle) => void;
}) {
  const m = bloc.modele;
  const c = couleurType(m.type_libelle);
  return (
    <div style={{
      background: m.annulee ? 'rgba(0,0,0,0.03)' : c.bg,
      border: `1px solid ${m.origine === 'permutation' ? '#7c3aed' : c.border}`,
      borderRadius: 8, padding: '20px 5px 5px 5px', position: 'relative',
      opacity: m.annulee ? 0.55 : 1,
    }}>
      <span style={{
        position: 'absolute', top: 3, right: 4,
        background: 'rgba(255,255,255,0.92)', border: `1px solid ${c.border}`,
        color: c.color, borderRadius: 10, padding: '1px 6px',
        fontSize: 10, fontWeight: 700, minWidth: 46, textAlign: 'center',
      }}>{c.label}</span>

      <div style={{ fontWeight: 700, fontSize: 12, color: '#1a1a1a',
                    textDecoration: m.annulee ? 'line-through' : 'none' }}>
        {m.em_code ?? m.type_libelle}
      </div>
      {m.em_intitule && (
        <div style={{ fontSize: 10, color: '#6b7280' }} className="truncate">
          {m.em_intitule}
        </div>
      )}
      <div style={{ fontSize: 11, color: '#4b5563' }} className="truncate">
        {m.prof_nom || '—'}
      </div>
      <div style={{ fontSize: 11, color: '#6b7280' }} className="truncate">
        {m.salle_nom || '—'}
      </div>

      <div className="flex flex-wrap gap-1 mt-1">
        {bloc.seances.map(s => (
          <button key={s.id} onClick={() => onOuvrir(s)}
            title={`Modifier la séance de ${s.departement_nom}`}
            style={{
              fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
              background: 'rgba(255,255,255,0.85)', border: `1px solid ${c.border}`,
              color: c.color, cursor: 'pointer',
            }}>
            {s.departement_nom}
          </button>
        ))}
      </div>
    </div>
  );
}
