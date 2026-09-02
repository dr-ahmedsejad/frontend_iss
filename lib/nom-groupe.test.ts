/**
 * La règle de nommage des groupes.
 *
 * Les noms employés ici sont ceux de la base `iss`, relevés le 02/09/2026.
 * Ce qui se joue : un onglet mal nommé fait remplir le mauvais groupe, et
 * l'erreur ne se voit qu'au pointage.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compterHomonymes, nomDuGroupe, nommerLesGroupes,
         type GroupeNommable } from './nom-groupe.ts';

const g = (nom: string, filiere: number | null = null,
           filiere_code: string | null = null,
           niveau: number | null = null): GroupeNommable =>
  ({ nom, groupe: '', filiere, filiere_code, niveau });

const nommer = (liste: GroupeNommable[]) =>
  liste.map(d => nomDuGroupe(d, compterHomonymes(liste)));

test('un nom unique est affiché tel quel', () => {
  assert.deepEqual(
    nommer([g('SEA L2 - G1', 1, 'SEA'), g('SDID L2', 4, 'SDID')]),
    ['SEA L2 - G1', 'SDID L2'],
  );
});

test('les groupes de TD gardent leur nom : il les distingue déjà', () => {
  assert.deepEqual(
    nommer([g('G1', 1, 'SEA'), g('G2', 1, 'SEA')]),
    ['G1', 'G2'],
  );
});

test('trois « G1 » de filières différentes sont distingués', () => {
  // Le cas réel de 2026-2027 : trois groupes homonymes, trois filières.
  assert.deepEqual(
    nommer([g('G1', 5, 'STAT'), g('G1', 1, 'SEA'), g('G1', 6, 'LPSEA')]),
    ['G1 (STAT)', 'G1 (SEA)', 'G1 (LPSEA)'],
  );
});

test('la précision n’apparaît que si elle lève une ambiguïté', () => {
  // Un seul G1 visible : préciser ferait chercher un jumeau inexistant.
  assert.deepEqual(nommer([g('G1', 1, 'SEA')]), ['G1']);
});

test('un groupe transversal se nomme par lui-même', () => {
  assert.deepEqual(nommer([g('HE'), g('ST')]), ['HE', 'ST']);
});

test('deux homonymes sans filière tombent sur le semestre', () => {
  const liste = [g('SEA L3', null, null, 5), g('SEA L3', null, null, 2)];
  const h = compterHomonymes(liste);
  const code = (n: number | null | undefined) => (n === 5 ? 'S5' : 'S3');
  assert.deepEqual(
    liste.map(d => nomDuGroupe(d, h, code)),
    ['SEA L3 (S5)', 'SEA L3 (S3)'],
  );
});

test('des homonymes qu’on ne peut pas distinguer gardent leur nom', () => {
  // Mieux vaut deux noms identiques qu’un « (undefined) » au milieu.
  assert.deepEqual(nommer([g('SDID'), g('SDID')]), ['SDID', 'SDID']);
});

test('la casse ne crée pas de faux homonymes distincts', () => {
  assert.deepEqual(
    nommer([g('G1', 1, 'SEA'), g('g1', 5, 'STAT')]),
    ['G1 (SEA)', 'g1 (STAT)'],
  );
});

test('le champ `groupe` sert de secours quand le nom manque', () => {
  const d: GroupeNommable = { nom: '', groupe: 'G4', filiere: 1 };
  assert.equal(nomDuGroupe(d, compterHomonymes([d])), 'G4');
});

test('un groupe sans nom ni groupe ne casse rien', () => {
  const d: GroupeNommable = { nom: '', groupe: '' };
  assert.equal(nomDuGroupe(d, compterHomonymes([d])), '');
});

test('le comptage porte sur la liste affichée, pas sur toute la base', () => {
  // Deux « G1 » existent en base, mais un seul est dans cette liste-ci.
  const visible = [g('G1', 1, 'SEA'), g('G2', 1, 'SEA')];
  assert.deepEqual(nommer(visible), ['G1', 'G2']);
});

test('nommerLesGroupes rend la même chose, en une passe', () => {
  const liste = [g('G1', 5, 'STAT'), g('G1', 1, 'SEA'), g('HE')];
  const noms  = nommerLesGroupes(liste);
  assert.deepEqual(liste.map(d => noms.get(d)),
                   ['G1 (STAT)', 'G1 (SEA)', 'HE']);
});
