/**
 * La règle de nommage des groupes.
 *
 * Les noms employés ici sont ceux de la base `iss`, relevés le 03/09/2026.
 * Ce qui se joue : un onglet mal nommé fait remplir le mauvais groupe, et
 * l'erreur ne se voit qu'au pointage.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { libelleComplet, nommerLesGroupes, nomDuGroupe,
         type GroupeNommable } from './nom-groupe.ts';

const g = (nom: string,
           filiere_code: string | null = null,
           niveau_nom: string | null = null): GroupeNommable =>
  ({ nom, groupe: '', filiere_code, niveau_nom });

const nommer = (liste: GroupeNommable[]) => {
  const noms = nommerLesGroupes(liste);
  return liste.map(d => noms.get(d));
};

test('le code de filière précède le nom', () => {
  assert.deepEqual(
    nommer([g('G1', 'LPSEA'), g('G2', 'STAT')]),
    ['LPSEA - G1', 'STAT - G2'],
  );
});

test('la précision est là même sans ambiguïté', () => {
  // C'est tout le changement : « G1 » seul ne disait pas quelle promotion.
  assert.deepEqual(nommer([g('G1', 'SEA')]), ['SEA - G1']);
});

test('un nom portant déjà son code n’est pas préfixé deux fois', () => {
  assert.deepEqual(
    nommer([g('STAT L1', 'STAT'), g('SDID', 'SDID'), g('SEA L2 - G1', 'SEA')]),
    ['STAT L1', 'SDID', 'SEA L2 - G1'],
  );
});

test('le code doit s’arrêter sur une frontière de mot', () => {
  // Sans la frontière, « SE » se croirait présent dans « SEA L2 ».
  assert.deepEqual(nommer([g('SEA L2', 'SE')]), ['SE - SEA L2']);
});

test('deux « G1 » de la même filière gagnent leur année d’étude', () => {
  // Le cas réel de 2026-2027 : LPSEA porte un G1 en L2 et un autre en L3.
  assert.deepEqual(
    nommer([g('G1', 'LPSEA', 'L2'), g('G1', 'LPSEA', 'L3')]),
    ['LPSEA L2 - G1', 'LPSEA L3 - G1'],
  );
});

test('l’année d’étude n’apparaît que là où elle tranche', () => {
  // Trois G1 de filières différentes : le code suffit déjà.
  assert.deepEqual(
    nommer([g('G1', 'STAT', 'L1'), g('G1', 'SEA', 'L3'), g('G1', 'LPSEA', 'L2')]),
    ['STAT - G1', 'SEA - G1', 'LPSEA - G1'],
  );
});

test('un groupe transversal se nomme par lui-même', () => {
  assert.deepEqual(nommer([g('HE'), g('ST')]), ['HE', 'ST']);
});

test('des homonymes qu’on ne peut pas distinguer gardent leur nom', () => {
  // Mieux vaut deux noms identiques qu’un tiret suivi de rien.
  assert.deepEqual(nommer([g('SDID'), g('SDID')]), ['SDID', 'SDID']);
});

test('la casse ne crée pas de faux homonymes distincts', () => {
  assert.deepEqual(
    nommer([g('G1', 'LPSEA', 'L2'), g('g1', 'LPSEA', 'L3')]),
    ['LPSEA L2 - G1', 'LPSEA L3 - g1'],
  );
});

test('le champ `groupe` sert de secours quand le nom manque', () => {
  const d: GroupeNommable = { nom: '', groupe: 'G4', filiere_code: 'SEA' };
  assert.deepEqual(nommer([d]), ['SEA - G4']);
});

test('un groupe sans nom ni groupe ne casse rien', () => {
  const d: GroupeNommable = { nom: '', groupe: '' };
  assert.deepEqual(nommer([d]), ['']);
});

test('un groupe sans filière garde son nom nu', () => {
  assert.deepEqual(nommer([g('G1'), g('G2')]), ['G1', 'G2']);
});

test('le libellé est stable d’une liste à l’autre', () => {
  // Un G1 de LPSEA L3 doit se nommer pareil, seul ou avec ses frères : c'est
  // la liste de l'ANNÉE qu'on passe, pas celle des onglets visibles.
  const l2 = g('G1', 'LPSEA', 'L2');
  const l3 = g('G1', 'LPSEA', 'L3');
  const annee = nommerLesGroupes([l2, l3, g('G2', 'STAT', 'L1')]);
  assert.equal(annee.get(l3), 'LPSEA L3 - G1');
});

test('nomDuGroupe nomme un groupe isolé, sans lever d’ambiguïté', () => {
  assert.equal(nomDuGroupe(g('G1', 'LPSEA', 'L2')), 'LPSEA - G1');
  assert.equal(nomDuGroupe(g('STAT L1', 'STAT')), 'STAT L1');
});

test('libelleComplet : filière, année d’étude, nom — toujours dans cet ordre', () => {
  assert.equal(libelleComplet(g('G1', 'STAT', 'L1')),   'STAT - L1 - G1');
  assert.equal(libelleComplet(g('G1', 'LPSEA', 'L2')),  'LPSEA - L2 - G1');
  // Le code se répète : voulu, la colonne du milieu reste alignée.
  assert.equal(libelleComplet(g('SDID', 'SDID', 'L3')), 'SDID - L3 - SDID');
});

test('libelleComplet omet simplement un segment absent', () => {
  assert.equal(libelleComplet(g('HE')),              'HE');
  assert.equal(libelleComplet(g('HE', null, 'L1')),  'L1 - HE');
  assert.equal(libelleComplet(g('G2', 'STAT')),      'STAT - G2');
});
