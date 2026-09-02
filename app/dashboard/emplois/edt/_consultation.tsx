'use client';

/**
 * Grille hebdomadaire en LECTURE SEULE, partagée par les trois vues de
 * consultation (par groupe, par enseignant, par salle).
 *
 * Même grille que la saisie — jours en lignes, créneaux en colonnes, en-tête
 * vert — mais sans autocomplétions : on consulte et on imprime. Ce qu'affiche
 * la carte varie selon l'axe : sur l'emploi du temps d'un enseignant, sa
 * propre identité n'apporte rien, c'est le groupe qui manque.
 */
import { ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { apiFetchBlob } from '@/lib/api';
import type { SeanceReelle } from '@/lib/api/edt';

import { BTN_PRIMAIRE, CARTE, Chargement, DEGRADE, SELECT, Vide } from './_ui';
import {
  CarteMatiere, type LigneSeance,
  STYLE_CELLULE, STYLE_CELLULE_JOUR, STYLE_ENTETE_CRENEAU,
  STYLE_ENTETE_JOUR, STYLE_ENTETE_LIGNE, STYLE_TABLE, couleurType,
} from './_cellule';
import { useReferentielsEDT } from './_referentiels';
import { jjmmaa, semaineAProposer, type SemaineCal } from './_semaines';

/**
 * Ce qu'il faut d'une séance pour la DESSINER — rien de plus.
 *
 * La grille sert aussi bien aux séances vivantes qu'aux archives : les lier au
 * type complet obligerait l'archive à porter des champs qui n'ont pas de sens
 * pour elle (sa clé de partage, sa date de modification).
 */
export type SeanceAffichable = Pick<SeanceReelle,
  'id' | 'jour_fk' | 'creneau_fk' | 'em' | 'em_code' | 'em_intitule'
  | 'prof_nom' | 'prof_initial_nom' | 'salle_nom'
  | 'departement_nom' | 'departement_groupe'
  | 'type_seance_fk' | 'type_libelle' | 'type_special'
  | 'origine' | 'annulee'>;

/** Axe de lecture : détermine ce que la carte met en avant. */
export type AxeEDT = 'groupe' | 'prof' | 'salle';

// ── Navigation par semaine, commune aux trois vues ───────────────────────────
export const BTN_FLECHE =
  'p-2.5 rounded-xl border border-gray-200 text-iss-gray hover:bg-gray-50 '
  + 'disabled:opacity-40 transition-colors';

/**
 * Sélecteur de semaine, identifié par le NUMÉRO.
 *
 * Le socle n'a pas d'entité « semaine » à laquelle se référer par identifiant :
 * une ligne y est un jour. Le numéro, lui, est ce que tout le monde emploie —
 * « la semaine 7 » — et c'est aussi la clé qu'attendent les endpoints.
 */
export function SelecteurSemaine({
  semaines, numero, onChange,
}: {
  semaines: SemaineCal[];
  numero:   string;
  onChange: (numero: string) => void;
}) {
  // S'ouvre sur la semaine en cours plutôt que sur la première du semestre.
  useEffect(() => {
    if (semaines.length === 0) return;
    if (semaines.some(s => String(s.numero_semaine) === numero)) return;
    const proposee = semaineAProposer(semaines);
    if (proposee) onChange(String(proposee.numero_semaine));
  }, [semaines, numero, onChange]);

  const index = semaines.findIndex(s => String(s.numero_semaine) === numero);

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => semaines[index - 1]
                && onChange(String(semaines[index - 1].numero_semaine))}
              disabled={index <= 0} title="Semaine précédente"
              className={BTN_FLECHE}>
        <ChevronLeft size={14} />
      </button>
      <select value={numero} className={SELECT} style={{ minWidth: 180 }}
              onChange={e => onChange(e.target.value)}>
        <option value="">—</option>
        {semaines.map(s => (
          <option key={s.numero_semaine} value={String(s.numero_semaine)}>
            S{s.numero_semaine} · {jjmmaa(s.date_debut)}
          </option>
        ))}
      </select>
      <button onClick={() => semaines[index + 1]
                && onChange(String(semaines[index + 1].numero_semaine))}
              disabled={index < 0 || index >= semaines.length - 1}
              title="Semaine suivante" className={BTN_FLECHE}>
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

/**
 * Téléchargement du PDF, généré par le serveur.
 *
 * Seule voie d'impression : le PDF porte l'en-tête de l'établissement — logo,
 * noms français et arabe — et la mise en page paysage, que l'impression
 * navigateur ne sait pas reproduire. Proposer les deux laissait choisir la
 * mauvaise.
 *
 * Même gabarit et même moteur (wkhtmltopdf) que les autres documents du
 * projet : deux emplois du temps imprimés côte à côte doivent se ressembler.
 */
export function BoutonPDF({ params, nomDefaut, actif = true }: {
  params:     Record<string, string>;
  nomDefaut:  string;
  actif?:     boolean;
}) {
  const [erreur, setErreur] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => apiFetchBlob('/api/v1/edt/seances/pdf/', params),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = nomDefaut;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (e) => {
      const message = e instanceof Error ? e.message : 'Erreur inconnue';
      // Le navigateur lâche parfois la lecture du corps alors que les octets
      // sont déjà arrivés : le fichier se télécharge quand même.
      if (message === 'Failed to fetch') return;
      setErreur(message);
      setTimeout(() => setErreur(null), 5000);
    },
  });

  return (
    <>
      {/* Vert institutionnel, comme les autres boutons de téléchargement du
          projet : c'est l'action principale de l'écran, pas un geste
          secondaire. */}
      <button onClick={() => mutation.mutate()}
              disabled={!actif || mutation.isPending}
              className={BTN_PRIMAIRE} style={{ background: DEGRADE }}>
        {mutation.isPending
          ? <Loader2 size={14} className="animate-spin" />
          : <Download size={14} />}
        {mutation.isPending ? 'Génération…' : 'Télécharger'}
      </button>
      {erreur && <span className="text-xs text-red-600">{erreur}</span>}
    </>
  );
}

/**
 * Regroupe les séances d'une case par matière et par type.
 *
 * Un TP dédoublé donne deux séances sur le même créneau ; sans regroupement,
 * la matière est réécrite à chaque fois et la case double de hauteur.
 */
function grouperParMatiere(seances: SeanceAffichable[], axe: AxeEDT) {
  /**
   * Ce que la ligne nomme dépend de l'axe, et se décompose en deux :
   *
   *   `fixe`     — commun aux séances d'un même cours, écrit UNE fois ;
   *   `variable` — ce qui distingue chaque séance, énuméré.
   *
   * Sur l'emploi du temps d'un enseignant, répéter son nom n'apprend rien :
   * ce qui varie, ce sont les groupes, et la salle est commune. Sur celui
   * d'une salle, l'enseignant est commun et les groupes varient. Sur celui
   * d'un groupe, la salle est commune et ce sont les enseignants qui varient
   * — un TP dédoublé entre deux intervenants.
   */
  const parts = (s: SeanceAffichable) => {
    const groupe = s.departement_nom || s.departement_groupe || '';
    const [fixe, variable] =
      axe === 'prof'  ? [s.salle_nom || '', groupe]              :
      axe === 'salle' ? [s.prof_nom  || '', groupe]              :
                        [s.salle_nom || '', s.prof_nom || ''];
    return { fixe, variable };
  };

  const blocs = new Map<string, {
    cle: string; type: string; intitule: string; speciale: boolean;
    lignes: LigneSeance[];
  }>();
  /** Les séances d'un bloc, avant réunion. */
  const pack = new Map<string, SeanceAffichable[]>();

  for (const s of seances) {
    const cle = `${s.em ?? 'x'}__${s.type_seance_fk}`;
    if (!blocs.has(cle)) {
      blocs.set(cle, {
        cle,
        type: s.type_libelle,
        // Sans matière, le type nomme seul la séance.
        intitule: s.em_intitule || s.em_code || s.type_libelle,
        speciale: !!s.type_special,
        lignes:   [],
      });
    }
    const { fixe, variable } = parts(s);
    // Une séance spéciale — sport, instruction militaire — n'a ni enseignant
    // ni salle : la ligne serait vide, autant ne pas l'écrire.
    if (!fixe && !variable) continue;
    (pack.get(cle) ?? pack.set(cle, []).get(cle)!).push(s);
  }

  // Un cours partagé produit une séance par groupe : autant de lignes presque
  // identiques, qui débordaient de la case. On les réunit sur ce qu'elles ont
  // de COMMUN — « El AOUN · Groupe 1, Groupe 2, Groupe 3 ».
  for (const [cle, lot] of pack) {
    const fusion = new Map<string, { variables: string[]; fixe: string;
                                     modele: SeanceAffichable }>();
    for (const s of lot) {
      const { fixe, variable } = parts(s);
      const empreinte = [fixe, s.annulee, s.origine,
                         s.prof_initial_nom ?? ''].join('|');
      const groupe = fusion.get(empreinte);
      if (groupe) {
        if (variable && !groupe.variables.includes(variable)) {
          groupe.variables.push(variable);
        }
      } else {
        fusion.set(empreinte, { variables: variable ? [variable] : [], fixe, modele: s });
      }
    }
    for (const { variables, fixe, modele } of fusion.values()) {
      // Les énumérations sont triées : leur ordre en base n'a rien à dire.
      const enumeration = variables.slice().sort().join(', ');
      const commun: LigneSeance = {
        cle:         String(modele.id),
        texte:       '',
        annulee:     modele.annulee,
        permutee:    modele.origine === 'permutation',
        profInitial: modele.prof_initial_nom ?? undefined,
      };
      if (axe === 'salle') {
        // Deux lignes : l'enseignant, puis ses groupes. Sur une seule, la
        // liste des groupes poussait le nom hors de la case — et c'est le nom
        // qu'on cherche d'abord quand on regarde qui occupe une salle.
        blocs.get(cle)!.lignes.push({ ...commun, texte: fixe || '—' });
        if (enumeration) {
          blocs.get(cle)!.lignes.push({
            cle: `${modele.id}-groupes`, texte: enumeration,
          });
        }
      } else {
        blocs.get(cle)!.lignes.push({
          ...commun,
          texte: [enumeration || '—', fixe].filter(Boolean).join(' — '),
        });
      }
    }
  }
  return [...blocs.values()];
}

// ── Grille ───────────────────────────────────────────────────────────────────
export function GrilleConsultation({
  seances, axe, isLoading, titreImpression, sousTitresImpression = [], vide,
}: {
  seances: SeanceAffichable[];
  axe: AxeEDT;
  isLoading?: boolean;
  titreImpression?: string;
  /**
   * Lignes du cartouche d'impression : semestre, numéro de semaine et dates
   * qui la bornent, année universitaire.
   *
   * Une grille imprimée circule détachée de l'écran qui l'a produite ; sans
   * ces repères, deux semaines se ressemblent au point d'être
   * interchangeables.
   */
  sousTitresImpression?: (string | false | undefined)[];
  vide?: string;
}) {
  const { jours, creneaux, isLoading: chargeRef } = useReferentielsEDT();

  if (isLoading || chargeRef) return <div className={CARTE}><Chargement /></div>;
  if (seances.length === 0) {
    return (
      <div className={CARTE}>
        <Vide texte={vide ?? 'Aucune séance programmée sur cette semaine.'} />
      </div>
    );
  }

  const dansLaCase = (jour: number, creneau: number) =>
    seances.filter(s => s.jour_fk === jour && s.creneau_fk === creneau);

  return (
    <div className={`${CARTE} overflow-hidden`}>
      {titreImpression && (
        <div className="hidden print:block px-4 py-3 border-b text-center">
          <div className="font-bold text-base">{titreImpression}</div>
          {sousTitresImpression.filter(Boolean).map(ligne => (
            <div key={String(ligne)} className="text-xs mt-0.5">{ligne}</div>
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={STYLE_TABLE}>
          <thead>
            <tr style={STYLE_ENTETE_LIGNE}>
              <th style={STYLE_ENTETE_JOUR}>Jour</th>
              {creneaux.map(c => (
                <th key={c.id} style={STYLE_ENTETE_CRENEAU}>{c.creneau}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jours.map((j, ligne) => (
              <tr key={j.id} style={{ background: ligne % 2 === 0 ? 'white' : '#fafafa' }}>
                <td style={STYLE_CELLULE_JOUR}>{j.jour}</td>
                {creneaux.map(c => (
                  <td key={c.id} style={STYLE_CELLULE}>
                    {/* Colonne pleine hauteur : les cartes s'étirent pour
                        occuper la case, quel que soit leur nombre de lignes. */}
                    <div className="flex flex-col gap-1" style={{ height: '100%' }}>
                      {grouperParMatiere(dansLaCase(j.id, c.id), axe).map(bloc => (
                        <CarteMatiere
                          key={bloc.cle}
                          type={bloc.type}
                          intitule={bloc.intitule}
                          speciale={bloc.speciale}
                          lignes={bloc.lignes}
                        />
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-3 flex-wrap print:hidden">
        <span className="text-xs font-semibold text-iss-gray uppercase tracking-wide">Légende</span>
        {/* Construite à partir des types réellement présents, et non d'une
            liste figée : le référentiel est administrable, une légende écrite
            en dur y deviendrait fausse au premier type ajouté. */}
        {[...new Set(seances.map(s => s.type_libelle).filter(Boolean))].map(libelle => {
          const coul = couleurType(libelle);
          return (
            <span key={libelle} className="inline-flex items-center gap-1.5 text-xs text-iss-gray">
              <span style={{
                width: 12, height: 12, borderRadius: 3,
                background: coul.bg, border: `1px solid ${coul.border}`, display: 'inline-block',
              }} />
              {coul.label === '—' ? libelle : coul.label}
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1.5 text-xs text-iss-gray">
          <span style={{
            width: 12, height: 12, borderRadius: 3,
            background: 'transparent', border: '1px solid #7c3aed', display: 'inline-block',
          }} />
          Remplacée
        </span>
        <span className="ml-auto text-xs text-iss-gray">
          {seances.length} séance{seances.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
