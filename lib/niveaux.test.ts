/**
 * L'année d'étude derrière un libellé de niveau.
 *
 * Ce qui se joue : la clé de `parametres.Niveau` et l'année d'étude ne
 * coïncident pas. Sur la base `iss`, L3 porte la clé 5. Confondre les deux
 * rendait invisible tout étudiant de L3 sur l'écran d'affectation — sans
 * message, sans erreur, juste une liste vide.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { anneeEtudeDuNiveau } from './niveaux.ts';

test('un libellé de licence rend son année d’étude', () => {
  assert.equal(anneeEtudeDuNiveau('L1'), 1);
  assert.equal(anneeEtudeDuNiveau('L2'), 2);
  assert.equal(anneeEtudeDuNiveau('L3'), 3);
});

test('l’année d’étude ne suit PAS la clé du référentiel', () => {
  // Sur `iss` : L3 a la clé 5. C'est tout le bug.
  assert.notEqual(anneeEtudeDuNiveau('L3'), 5);
});

test('les autres préfixes de diplôme fonctionnent aussi', () => {
  assert.equal(anneeEtudeDuNiveau('M1'), 1);
  assert.equal(anneeEtudeDuNiveau('E2'), 2);
  assert.equal(anneeEtudeDuNiveau('D3'), 3);
});

test('un libellé sans année rend null', () => {
  assert.equal(anneeEtudeDuNiveau('Transversal'), null);
  assert.equal(anneeEtudeDuNiveau(''), null);
  assert.equal(anneeEtudeDuNiveau(null), null);
  assert.equal(anneeEtudeDuNiveau(undefined), null);
});

test('les espaces parasites ne gênent pas', () => {
  assert.equal(anneeEtudeDuNiveau('  L3 '), 3);
  assert.equal(anneeEtudeDuNiveau('L 3'), 3);
});

test('un nombre nu est accepté', () => {
  assert.equal(anneeEtudeDuNiveau('3'), 3);
});

test('un libellé sans chiffre laisse l’appelant se rabattre sur la clé', () => {
  // D'autres instances nomment leurs niveaux « MP » / « MPSI ». `null` y est la
  // bonne réponse : c'est à l'appelant de retomber sur la clé du référentiel,
  // qui est déjà ce qu'il envoyait. Rendre 0 ou 1 inventerait une année d'étude.
  assert.equal(anneeEtudeDuNiveau('MP'), null);
  assert.equal(anneeEtudeDuNiveau('MPSI'), null);
});
