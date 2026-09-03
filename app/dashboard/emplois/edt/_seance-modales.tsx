'use client';

/**
 * Les modales d'une séance RÉELLE, partagées par les écrans d'emploi du temps.
 *
 * `FormulaireSeance` vivait dans « Emploi de la semaine », écran retiré depuis
 * que la grille type ouvre elle-même les semaines. Le formulaire, lui, reste :
 * c'est lui qui décide de `origine: permutation` — donc de qui sera payé — et
 * son corps est celui de l'écran d'origine, repris à l'identique.
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, Ban, Layers, Repeat, RotateCcw, Save, Users, X } from 'lucide-react';

import { edtApi, type SeanceReelle } from '@/lib/api/edt';
import { AC } from './_autocomplete';
import { BTN_PRIMAIRE, BTN_SECONDAIRE, CARTE, DEGRADE, INPUT, SELECT } from './_ui';
import { type Prof, type Salle } from './_referentiels';

/** Un groupe, tel que les sélecteurs d'emploi du temps le manipulent. */
export interface Dept {
  id: number; nom: string; groupe?: string;
  /** Année d'étude et année universitaire : ce qui borne « Cours partagé ». */
  niveau?: number | null;
  annee_universitaire?: string | null;
}

export function FormulaireSeance({
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

  // Un cours ne se partage qu'entre groupes du MÊME NIVEAU, de la même année :
  // un L1 et un L3 n'ont pas le même programme, et proposer tous les groupes
  // faisait défiler une liste où presque rien n'était légitime. Quand le niveau
  // du groupe n'est pas connu, on ne filtre pas — mieux vaut trop que rien.
  const moi = depts.find(d => d.id === seance.departement);
  const partageables = depts.filter(d =>
    !dejaDedans.has(d.id)
    && (moi?.niveau == null || d.niveau === moi.niveau)
    && (moi?.annee_universitaire == null
        || d.annee_universitaire === moi.annee_universitaire));

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
              Séance d&apos;un seul groupe. L&apos;étendre à d&apos;autres groupes
              du même niveau crée le même cours chez eux — l&apos;enseignant
              reste payé une fois.
            </p>
          )}

          {partageables.length === 0 && (
            <p className="text-[11px] text-amber-800">
              Aucun autre groupe de ce niveau cette année.
            </p>
          )}
          <select multiple value={aAjouter.map(String)} size={3}
            disabled={partageables.length === 0}
            onChange={e => setAAjouter(
              [...e.target.selectedOptions].map(o => Number(o.value)))}
            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white
              disabled:opacity-50">
            {partageables.map(d => (
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

// ── Permutation d'enseignants ────────────────────────────────────────────────

/** Une séance telle qu'elle se lit dans l'échange : élément, enseignant, salle. */
function Trio({ seance }: { seance: SeanceReelle }) {
  return (
    <span className="text-sm">
      <span className="font-bold text-iss-dark">{seance.em_code ?? seance.type_libelle}</span>
      <span className="text-iss-gray"> · {seance.prof_nom || 'sans enseignant'}</span>
      {seance.salle_nom && <span className="text-iss-gray"> · {seance.salle_nom}</span>}
    </span>
  );
}

/**
 * Permuter deux enseignants — la fenêtre d'IPGEI, sans son circuit.
 *
 * Le clic sur ↻ ouvre directement cette fenêtre avec les échanges possibles :
 * le serveur exige deux séances du même créneau et de la même semaine, la liste
 * des candidates est donc connue d'avance. Faire désigner la seconde dans la
 * grille obligeait à un aller-retour pour une information que l'écran avait
 * déjà.
 *
 * Pas de « Demander la permutation » : l'ISS n'a qu'un planificateur, il n'y a
 * personne à qui demander. L'échange s'applique sur-le-champ.
 */
export function ModalePermutation({
  depart, candidats, onFerme, onFait,
}: {
  depart: SeanceReelle; candidats: SeanceReelle[];
  onFerme: () => void; onFait: (message: string) => void;
}) {
  // Une seule possibilité — G1 et G2 au même créneau, le cas courant — ne
  // mérite pas qu'on fasse choisir : elle est retenue d'emblée.
  const [cible, setCible]           = useState<SeanceReelle | null>(
    candidats.length === 1 ? candidats[0] : null);
  // Même portée que la duplication : cette semaine, ou un lot de N semaines
  // à partir d'elle. Deux écrans, un seul vocabulaire.
  const [enLot, setEnLot]           = useState(false);
  const [nbSemaines, setNbSemaines] = useState('4');
  const [motif, setMotif]           = useState('');
  const [erreur, setErreur]         = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (corps: { seance_a: number; seance_b: number;
                          nb_semaines: number; motif: string }) =>
      edtApi.permuter(corps),
  });

  const enregistrer = () => {
    if (!cible) { setErreur('Choisissez la séance à échanger.'); return; }
    setErreur(null);
    mutation.mutate(
      { seance_a: depart.id, seance_b: cible.id,
        nb_semaines: enLot ? Number(nbSemaines) || 1 : 1, motif },
      {
        onSuccess: (r) => {
          const n = r?.seances_impactees ?? 0;
          onFait(`Permutation appliquée — ${n} séance${n > 1 ? 's' : ''} touchée${n > 1 ? 's' : ''}`);
        },
        onError: (e: unknown) => setErreur(e instanceof Error ? e.message : 'Erreur'),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
         onClick={onFerme} role="presentation">
      <div className={`${CARTE} w-full max-w-lg p-6`} onClick={e => e.stopPropagation()}
           role="presentation">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-iss-dark">Permuter les enseignants</h3>
            <p className="text-xs text-iss-gray">
              Les créneaux ne bougent pas : ce sont l&apos;enseignant, la salle et
              l&apos;élément qui s&apos;échangent.
            </p>
          </div>
          <button onClick={onFerme}
                  className="p-1 rounded-lg text-iss-gray hover:bg-gray-100 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* La séance de départ, rappelée : on a cliqué une case, il faut
            pouvoir vérifier laquelle sans refermer la fenêtre. */}
        <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 mb-3">
          <p className="text-xs font-semibold text-iss-gray uppercase tracking-wide mb-1">
            Séance de départ
          </p>
          <Trio seance={depart} />
          <p className="text-xs text-iss-gray mt-0.5">
            {depart.departement_nom} · {depart.jour_libelle} {depart.creneau_libelle}
          </p>
        </div>

        {candidats.length === 0 ? (
          <p className="text-sm text-amber-700 mb-3">
            Aucune autre séance sur {depart.creneau_libelle} cette semaine dans
            un groupe de même filière et de même année d&apos;étude. La
            permutation échange les enseignants d&apos;une même promotion —
            typiquement G1 et G2 au même horaire.
          </p>
        ) : (
        <div className="space-y-3">
          {/* Plusieurs possibilités : on les montre entières plutôt qu'en
              libellés dans un menu — c'est l'enseignant et le groupe qui font
              choisir, pas le code de l'élément. */}
          {candidats.length > 1 && (
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">
                Échanger avec
              </label>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {candidats.map(c => (
                  <button key={c.id} onClick={() => setCible(c)}
                          className={`w-full text-left px-3 py-2 rounded-xl border transition-colors ${
                            cible?.id === c.id
                              ? 'border-[#7c3aed] bg-[#7c3aed]/6'
                              : 'border-gray-200 hover:border-[#7c3aed]/40'}`}>
                    <Trio seance={c} />
                    <p className="text-xs text-iss-gray mt-0.5">
                      {c.departement_nom} · {c.jour_libelle} {c.creneau_libelle}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* L'échange tel qu'il sera, ligne à ligne : on confirmait sans voir
              le résultat. */}
          {cible && (
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
              {[[depart, cible], [cible, depart]].map(([avant, apres]) => (
                <div key={avant.id} className="px-4 py-3">
                  <p className="text-xs text-iss-gray mb-1">
                    {avant.departement_nom} · {avant.jour_libelle} {avant.creneau_libelle}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Trio seance={avant} />
                    <ArrowRight size={13} className="text-[#7c3aed] flex-shrink-0" />
                    <Trio seance={apres} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-1 border-t border-gray-100">
            <label className="flex items-start gap-2 text-sm text-iss-dark cursor-pointer">
              <input type="checkbox" checked={enLot} onChange={e => setEnLot(e.target.checked)}
                     className="w-4 h-4 mt-0.5 accent-[#7c3aed]" />
              <span>
                <Layers size={12} className="inline mr-1 text-iss-gray" />
                Appliquer à plusieurs semaines
                <span className="block text-xs text-iss-gray">
                  Sans cette option, l&apos;échange ne vaut que pour la semaine affichée.
                </span>
              </span>
            </label>
            {enLot && (
              <div className="mt-2 flex items-center gap-2">
                <input type="number" min={1} max={40} value={nbSemaines} className={INPUT}
                       style={{ width: 90 }} onChange={e => setNbSemaines(e.target.value)} />
                <span className="text-xs text-iss-gray">
                  semaines de cours, à partir de celle-ci. Une semaine où l&apos;une
                  des deux séances manque est sautée.
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">
              Motif <span className="font-normal text-iss-gray">(facultatif)</span>
            </label>
            <input value={motif} className={INPUT} placeholder="Mission, indisponibilité…"
                   onChange={e => setMotif(e.target.value)} />
          </div>
        </div>
        )}

        {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}

        <div className="flex gap-2 mt-5">
          <button onClick={enregistrer}
                  disabled={mutation.isPending || !cible}
                  className={BTN_PRIMAIRE} style={{ background: DEGRADE }}>
            <Repeat size={14} />
            {mutation.isPending ? 'En cours…' : 'Permuter'}
          </button>
          <button onClick={onFerme} className={BTN_SECONDAIRE}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
