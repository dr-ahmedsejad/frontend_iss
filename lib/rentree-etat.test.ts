/**
 * L'état d'une cohorte, et ce que l'écran en dit.
 *
 * Ce qui se joue : une cohorte mal classée, c'est un groupe qu'on oublie de
 * créer et 47 étudiants qui arrivent à la rentrée sans classe. Et un bandeau
 * qui reste allumé après coup apprend à l'ignorer.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  actionCohorte, etatCohorte, ORDRE_ETATS, phraseBandeau, restants,
  resumeCohorte, type CohorteLike,
} from './rentree-etat.ts';

const G = (n: string) => ({ id: 1, nom: n });
const c = (effectif: number, affectes: number, groupes: string[] = []): CohorteLike =>
  ({ effectif, affectes, groupes: groupes.map(G) });

// ── Les quatre états ────────────────────────────────────────────────────────

test('sans groupe, rien n’est possible', () => {
  assert.equal(etatCohorte(c(47, 0)), 'sans_groupe');
});

test('un groupe qui existe mais que personne n’occupe', () => {
  assert.equal(etatCohorte(c(10, 0, ['G1', 'G2'])), 'a_affecter');
});

test('une affectation commencée', () => {
  assert.equal(etatCohorte(c(10, 4, ['G1'])), 'partiel');
});

test('tout le monde est rattaché', () => {
  assert.equal(etatCohorte(c(3, 3, ['SEA'])), 'complet');
});

test('sans groupe l’emporte, même si des étudiants sont déjà rattachés ailleurs', () => {
  // Cas limite : quelqu'un a été affecté à la main puis le groupe a disparu.
  // L'état doit rester bloquant — il n'y a nulle part où mettre les autres.
  assert.equal(etatCohorte(c(10, 4, [])), 'sans_groupe');
});

test('une cohorte vide est considérée comme complète', () => {
  assert.equal(etatCohorte(c(0, 0, ['G1'])), 'complet');
});

// ── L'ordre de lecture ──────────────────────────────────────────────────────

test('les bloquantes se lisent avant les terminées', () => {
  const liste = [c(3, 3, ['A']), c(5, 0), c(5, 2, ['B']), c(5, 0, ['C'])];
  const tri = [...liste].sort(
    (a, b) => ORDRE_ETATS[etatCohorte(a)] - ORDRE_ETATS[etatCohorte(b)]);
  assert.deepEqual(tri.map(etatCohorte),
    ['sans_groupe', 'a_affecter', 'partiel', 'complet']);
});

// ── Une seule action par ligne ──────────────────────────────────────────────

test('l’action nomme ce qui reste à faire, pas l’effectif total', () => {
  assert.equal(actionCohorte(c(47, 0)),          'Créer le groupe');
  assert.equal(actionCohorte(c(10, 0, ['G1'])),  'Affecter les 10');
  assert.equal(actionCohorte(c(10, 4, ['G1'])),  'Affecter les 6 restants');
});

test('une cohorte terminée n’offre aucun bouton', () => {
  // Pas de bouton grisé : ça se lit comme un droit manquant, pas comme un
  // travail achevé.
  assert.equal(actionCohorte(c(3, 3, ['SEA'])), null);
});

test('restants ne descend jamais sous zéro', () => {
  assert.equal(restants(c(3, 5, ['A'])), 0);
});

// ── Le résumé ───────────────────────────────────────────────────────────────

test('le résumé dit l’année quand il n’y a aucun groupe', () => {
  assert.equal(resumeCohorte(c(47, 0), '2026-2027'),
    '47 étudiants — aucun groupe pour 2026-2027');
});

test('le résumé nomme les groupes : ça change la façon d’affecter', () => {
  assert.equal(resumeCohorte(c(10, 0, ['G1', 'G2']), '2026-2027'),
    '10 étudiants — groupes G1, G2');
});

test('le résumé d’une affectation partielle donne les deux nombres', () => {
  assert.equal(resumeCohorte(c(10, 4, ['G1']), '2026-2027'),
    '4 affectés sur 10 — groupe G1');
});

test('le singulier est respecté', () => {
  assert.equal(resumeCohorte(c(1, 0, ['SDID']), '2026-2027'),
    '1 étudiant — groupe SDID');
});

// ── Le bandeau ──────────────────────────────────────────────────────────────

test('le bandeau compte les bloqués à part', () => {
  const phrase = phraseBandeau('2026-2027', 100, 0,
    [c(47, 0), c(39, 0), c(10, 0, ['G1']), c(3, 0, ['SEA']), c(1, 0, ['SDID'])]);
  assert.equal(phrase,
    'Rentrée 2026-2027 — 100 étudiants réinscrits restent à affecter à un '
    + "groupe. 86 n'ont pas encore de groupe où aller.");
});

test('sans cohorte bloquée, le bandeau ne parle que de l’affectation', () => {
  const phrase = phraseBandeau('2026-2027', 10, 4, [c(10, 4, ['G1'])]);
  assert.equal(phrase,
    'Rentrée 2026-2027 — 6 étudiants réinscrits restent à affecter à un groupe.');
});

test('le bandeau s’éteint quand tout est affecté', () => {
  assert.equal(phraseBandeau('2026-2027', 100, 100, [c(100, 100, ['G1'])]), null);
});

test('le bandeau ne parle pas d’une année sans inscrit', () => {
  assert.equal(phraseBandeau('2027-2028', 0, 0, []), null);
});

test('un seul étudiant restant se dit au singulier', () => {
  assert.equal(phraseBandeau('2026-2027', 10, 9, [c(10, 9, ['G1'])]),
    'Rentrée 2026-2027 — 1 étudiant réinscrit reste à affecter à un groupe.');
});
