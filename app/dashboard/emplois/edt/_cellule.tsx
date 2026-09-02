'use client';

/**
 * Cellule d'emploi du temps IPGEI — même langage visuel que la grille SIGA
 * (`components/emplois/CellEmploi.tsx`) : carte colorée par type de séance,
 * badge du type en haut à droite, prof / matière / salle empilés.
 *
 * La grille elle-même reprend l'orientation SIGA : **jours en lignes,
 * créneaux en colonnes**.
 */
import type { CSSProperties, ReactNode } from 'react';


// Palette alignée sur celle de SIGA : cours = bleu (CM), TD = vert, TP = orange,
// DS = violet (PR). Un préparationnaire retrouve donc les mêmes repères.
// Clés = libellés du référentiel du socle (« Paramètres → Séances »), et non
// plus des codes IPGEI figés. Un type inconnu de cette table — « Encadrement »,
// « Mission »… — tombe sur le style neutre, ce qui reste lisible.
const COULEURS: Record<string, { bg: string; border: string; color: string; label: string }> = {
  CM:    { bg: 'rgba(63,81,181,0.08)',  border: '#3f51b5', color: '#3f51b5', label: 'Cours' },
  TD:    { bg: 'rgba(76,175,80,0.10)',  border: '#4CAF50', color: '#2E7D32', label: 'TD' },
  TP:    { bg: 'rgba(255,152,0,0.10)',  border: '#FF9800', color: '#EF6C00', label: 'TP' },
  // Rouge, et non violet comme dans le socle : une evaluation n'est pas un
  // cours parmi d'autres. Elle doit sauter aux yeux sur une grille imprimee
  // comme a l'ecran — c'est le seul creneau qu'on ne peut ni deplacer ni
  // manquer sans consequence pour les etudiants.
  DS:    { bg: 'rgba(200,32,32,0.12)',  border: '#C82020', color: '#B71C1C', label: 'DS' },
  // Les examens rejoignent le devoir : ce sont les seuls creneaux qu'on ne peut
  // ni deplacer ni manquer sans consequence.
  EF:    { bg: 'rgba(200,32,32,0.12)',  border: '#C82020', color: '#B71C1C', label: 'Examen' },
  ER:    { bg: 'rgba(200,32,32,0.12)',  border: '#C82020', color: '#B71C1C', label: 'Rattrapage' },
};
const DEFAUT = { bg: 'rgba(96,125,139,0.08)', border: '#607D8B', color: '#37474F', label: '—' };

// ── Couleurs de pôle ────────────────────────────────────────────────────────
//
// Sur un groupe de promotion, HE et ST travaillent la MÊME grille : deux
// responsables, deux moitiés d'un même tableau. Le type de séance ne les
// distingue pas — un CM de HE et un CM de ST se ressemblent trait pour trait —
// et il fallait lire l'élément de chaque case pour savoir à qui elle était.
//
// Le fond porte donc désormais le pôle (à qui la case appartient), et le liseré
// gauche garde le type (ce qu'on y fait). Deux informations, deux supports, au
// lieu d'une information écrite deux fois.
//
// À l'ISS il n'y a pas de pôles : le fond reste libre, et le TYPE de séance
// porte seul la couleur. C'est aussi ce que fait la grille du socle, et deux
// emplois du temps côte à côte doivent se lire de la même façon.


/**
 * Style d'un type de séance, à partir de son LIBELLÉ de référentiel.
 *
 * `''` ou un libellé absent de la palette retombent sur le style neutre : le
 * référentiel étant administrable, on ne peut pas présumer de son contenu.
 */
export function couleurType(libelle: string | undefined) {
  return COULEURS[libelle ?? ''] ?? DEFAUT;
}

// ── En-tête et cadres de la grille, communs aux deux écrans EDT ──────────────
// `tableLayout: 'fixed'` est la clé de l'uniformité : en mode automatique, une
// colonne se dimensionne sur son contenu, si bien qu'un créneau vide devenait
// plus étroit que son voisin chargé et que la grille perdait son quadrillage.
// `minWidth` garde des colonnes lisibles sur petit écran, le conteneur parent
// se chargeant du défilement horizontal.
export const STYLE_TABLE: CSSProperties = {
  width: '100%', minWidth: 980, tableLayout: 'fixed',
  borderCollapse: 'collapse', background: 'white',
  fontSize: 12, marginBottom: 0,
};

/** Hauteur commune à toutes les cases, vides comprises. */
export const HAUTEUR_CASE = 104;

export const STYLE_ENTETE_LIGNE: CSSProperties = {
  background: 'linear-gradient(135deg,#006633,#008844)',
};

// En mise en page fixe, la largeur des colonnes est décidée par cette première
// ligne : celle du jour est bornée, les créneaux se partagent le reste à parts
// égales.
export const STYLE_ENTETE_JOUR: CSSProperties = {
  padding: '10px 12px', textAlign: 'center',
  // Blanc franc, comme les créneaux voisins : à 85 % il paraissait terne
  // à côté d'eux, sans que rien ne justifie la différence.
  color: 'white', fontWeight: 700, fontSize: 11,
  border: '1px solid rgba(255,255,255,0.15)', width: 96,
};

export const STYLE_ENTETE_CRENEAU: CSSProperties = {
  padding: '10px 8px', textAlign: 'center',
  color: 'white', fontWeight: 700, fontSize: 11,
  border: '1px solid rgba(255,255,255,0.15)',
};

export const STYLE_CELLULE_JOUR: CSSProperties = {
  padding: '8px 10px', textAlign: 'center', fontWeight: 700,
  border: '1px solid #ccc', fontSize: 12, color: '#374151',
  verticalAlign: 'middle', whiteSpace: 'nowrap', background: '#f9fafb',
  height: HAUTEUR_CASE,
};

export const STYLE_CELLULE: CSSProperties = {
  border: '1px solid #ccc', padding: 4, verticalAlign: 'top',
  // Hauteur imposée, sinon une journée sans cours produisait une ligne écrasée
  // et le quadrillage devenait irrégulier d'un jour à l'autre.
  height: HAUTEUR_CASE,
};

/**
 * Carte d'une séance. `actions` est rendu en survol, en haut à droite —
 * l'appel et la permutation restent ainsi à un clic sans encombrer la grille.
 */
export function CarteSeance({
  type, matiere, intitule, prof, salle, sousGroupe, annulee, permutee,
  profInitial, onClick, actions, compact,
}: {
  /** Libellé du référentiel : « CM », « TP », « Sport »… */
  type:         string;
  matiere:      string;
  intitule?:    string;
  prof?:        string;
  salle?:       string;
  sousGroupe?:  string;
  annulee?:     boolean;
  permutee?:    boolean;
  profInitial?: string;
  onClick?:     () => void;
  actions?:     ReactNode;
  compact?:     boolean;
}) {
  const c = couleurType(type);
  // Une séance permutée garde sa couleur de type mais prend un liseré violet :
  // le type de cours ne change pas, seul l'intervenant a bougé.
  const bordure = permutee ? '#7c3aed' : c.border;

  return (
    <div className="group relative" style={{
      background:   annulee ? 'rgba(0,0,0,0.03)' : c.bg,
      border:       `1px solid ${bordure}`,
      borderRadius: 8,
      padding:      compact ? '20px 5px 5px 5px' : '22px 6px 6px 6px',
      minHeight:    compact ? 62 : 70,
      opacity:      annulee ? 0.55 : 1,
    }}>
      {/* Largeur imposée : « Cours » est trois fois plus long que « TP », et
          les pastilles prenaient des tailles différentes d'une case à l'autre. */}
      <span style={{
        position: 'absolute', top: 3, right: 4,
        background: 'rgba(255,255,255,0.92)', border: `1px solid ${c.border}`,
        color: c.color, borderRadius: 10, padding: '1px 6px',
        fontSize: 10, fontWeight: 700,
        display: 'inline-block', minWidth: 46, textAlign: 'center',
      }}>{c.label}</span>

      <button type="button" onClick={onClick} disabled={!onClick}
              className="block w-full text-left disabled:cursor-default">
        <div style={{
          fontWeight: 700, fontSize: 12, color: '#1a1a1a',
          textDecoration: annulee ? 'line-through' : 'none',
        }}>
          {matiere}
          {sousGroupe && (
            <span style={{ marginLeft: 4, fontWeight: 500, color: c.color }}>({sousGroupe})</span>
          )}
        </div>
        {intitule && (
          <div style={{ fontSize: 10, color: '#6b7280' }} className="truncate">{intitule}</div>
        )}
        <div style={{ fontSize: 11, color: '#4b5563' }} className="truncate">{prof || '—'}</div>
        <div style={{ fontSize: 11, color: '#6b7280' }} className="truncate">{salle || '—'}</div>
        {permutee && profInitial && (
          <div style={{ fontSize: 9, color: '#7c3aed', marginTop: 2 }} className="truncate">
            permuté — initialement {profInitial}
          </div>
        )}
        {annulee && (
          <div style={{ fontSize: 9, color: '#b91c1c', fontWeight: 700, marginTop: 2 }}>
            SÉANCE ANNULÉE
          </div>
        )}
      </button>

      {/* `gap-1` sépare les cibles : collées, deux boutons de 26 px se lisent
          comme un seul de 52. */}
      {actions && (
        <div className="absolute top-1 left-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {actions}
        </div>
      )}
    </div>
  );
}

/** Une intervention à l'intérieur d'une carte matière. */
export interface LigneSeance {
  cle:          string;
  texte:        string;
  annulee?:     boolean;
  permutee?:    boolean;
  profInitial?: string;
}

/**
 * Carte REGROUPÉE : une matière, une ou plusieurs interventions.
 *
 * Un TP dédoublé produit deux séances sur la même case. Les afficher comme
 * deux cartes complètes répétait le nom de la matière et doublait la hauteur
 * de toute la ligne du jour. Ici l'en-tête n'est écrit qu'une fois, suivi
 * d'une ligne par groupe — même présentation que le PDF, pour qu'un emploi du
 * temps consulté à l'écran et le même imprimé se lisent à l'identique.
 */
export function CarteMatiere({ type, intitule, speciale, lignes }: {
  /** Libellé du référentiel. */
  type:      string;
  intitule:  string;
  /** Sport, instruction militaire : la case ne porte que son nom. */
  speciale?: boolean;
  lignes:    LigneSeance[];
}) {
  const c = couleurType(type);
  // Une séance permutée garde sa couleur de type mais prend un liseré violet :
  // le type de cours ne change pas, seul l'intervenant a bougé.
  const permutee = lignes.some(l => l.permutee);
  const toutAnnule = lignes.length > 0 && lignes.every(l => l.annulee);

  return (
    // `flex: 1` fait remplir la case : sans cela le fond épousait le nombre de
    // lignes, et un TP dédoublé produisait une carte plus haute que le cours
    // d'à côté. Deux matières sur le même créneau se partagent la hauteur.
    <div className="relative" style={{
      background:   toutAnnule ? 'rgba(0,0,0,0.03)' : c.bg,
      border:       `1px solid ${permutee ? '#7c3aed' : c.border}`,
      borderRadius: 8,
      padding:      speciale ? '6px' : '22px 6px 6px 6px',
      display:      speciale ? 'flex' : undefined,
      alignItems:   speciale ? 'center'  : undefined,
      justifyContent: speciale ? 'center' : undefined,
      textAlign:    speciale ? 'center'  : undefined,
      flex:         '1 1 0',
      minHeight:    0,
      opacity:      toutAnnule ? 0.55 : 1,
    }}>
      {/* Une séance spéciale n'a ni matière, ni enseignant, ni salle : son nom
          est tout ce que la case a à dire. La pastille le répéterait dans un
          coin, alors que centré il se lit d'un coup d'œil — c'est aussi ce que
          fait le PDF. */}
      {!speciale && (
      <span style={{
        position: 'absolute', top: 3, right: 4,
        background: 'rgba(255,255,255,0.92)', border: `1px solid ${c.border}`,
        color: c.color, borderRadius: 10, padding: '1px 6px',
        fontSize: 10, fontWeight: 700,
        display: 'inline-block', minWidth: 46, textAlign: 'center',
      }}>{c.label}</span>
      )}

      <div style={{
        fontWeight: 700, fontSize: 13, color: '#000',
        textDecoration: toutAnnule ? 'line-through' : 'none',
      }}>
        {intitule}
      </div>

      {lignes.map(ligne => (
        <div key={ligne.cle}>
          <div style={{
            fontSize: 11, color: '#000', marginTop: 2,
            textDecoration: ligne.annulee ? 'line-through' : 'none',
          }} className="truncate">
            {ligne.texte}
          </div>
          {ligne.permutee && ligne.profInitial && (
            <div style={{ fontSize: 9, color: '#7c3aed' }} className="truncate">
              permuté — initialement {ligne.profInitial}
            </div>
          )}
          {ligne.annulee && (
            <div style={{ fontSize: 9, color: '#b91c1c', fontWeight: 700 }}>
              SÉANCE ANNULÉE
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Case vide cliquable — même affordance que le « + » de la grille SIGA. */
export function CaseVide({ onClick, libelle = '+' }: { onClick?: () => void; libelle?: string }) {
  if (!onClick) return <div style={{ minHeight: 62 }} />;
  return (
    <button type="button" onClick={onClick}
            className="w-full rounded-lg border border-dashed border-gray-300 text-gray-400
                       hover:border-[#006633] hover:text-[#006633] hover:bg-[#006633]/5 transition-all"
            style={{ minHeight: 62, fontSize: 16, fontWeight: 600 }}>
      {libelle}
    </button>
  );
}
