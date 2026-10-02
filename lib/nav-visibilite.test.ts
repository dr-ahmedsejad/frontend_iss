/**
 * La règle de visibilité du menu, après la refonte du 02/10/2026.
 *
 * Ce qui se joue : la refonte a réuni des entrées venues de groupes aux droits
 * différents. Une erreur ici fait apparaître un écran à qui n'y a pas droit,
 * ou disparaître celui dont quelqu'un a besoin — sans bruit dans les deux cas.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { entreesVisibles, filtrerMenu, normaliser, type Peut } from './nav-visibilite.ts';

/** Un jeu de droits RBAC : la liste des « module:action » accordés. */
const droits = (...accordes: string[]): Peut =>
  (module, action) => accordes.includes(`${module}:${action}`);

const ADMIN_ONLY = ['admin'];
const ADMIN_IT   = ['admin', 'IT'];
const MANAGE     = ['admin', 'DG', 'DA', 'DE'];

const libelles = (xs: { label: string }[]) => xs.map(x => x.label);

// ── Groupes AVEC module : le fonctionnement d'avant, inchangé ─────────────────

test('un groupe à module exige module:voir, même pour une entrée au droit propre', () => {
  const evaluations = { module: 'eval_saisie', roles: [], items: [
    { label: 'Délibérations', module: 'delib_pv', action: 'voir' },
  ] };
  // delib_pv accordé, mais pas eval_saisie : le groupe reste fermé, comme avant.
  assert.deepEqual(entreesVisibles(evaluations, 'DE', droits('delib_pv:voir')), []);
  assert.deepEqual(libelles(entreesVisibles(evaluations, 'DE', droits('delib_pv:voir', 'eval_saisie:voir'))),
                   ['Délibérations']);
});

test("une entrée sans module prend celui du groupe, à l'action demandée", () => {
  const groupes = { module: 'departements', roles: MANAGE, items: [
    { label: 'Liste des groupes' },
    { label: 'Affecter les étudiants', action: 'modifier' },
  ] };
  assert.deepEqual(libelles(entreesVisibles(groupes, 'DE', droits('departements:voir'))),
                   ['Liste des groupes']);
});

test('le rôle ne compte pas dans un groupe à module : seul le RBAC décide', () => {
  const salles = { module: 'salles', roles: MANAGE, items: [{ label: 'Liste des salles' }] };
  assert.equal(entreesVisibles(salles, 'AA', droits('salles:voir')).length, 1);
});

// ── Groupes SANS module : chaque entrée porte son droit ───────────────────────

test("« Paiements » : l'admin voit tout, le DE seulement les banques", () => {
  const paiements = { roles: MANAGE, items: [
    { label: 'Types de paiement', roles: ADMIN_ONLY },
    { label: 'Banques', module: 'banques' },
  ] };
  const tout = droits('banques:voir');
  assert.deepEqual(libelles(entreesVisibles(paiements, 'admin', tout)), ['Types de paiement', 'Banques']);
  assert.deepEqual(libelles(entreesVisibles(paiements, 'DE', tout)), ['Banques']);
  // Sans le droit banques, le DE ne voit plus le groupe du tout.
  assert.deepEqual(entreesVisibles(paiements, 'DE', droits()), []);
});

test("« Comptes et droits » : l'informaticien n'y voit que le déblocage", () => {
  const comptes = { roles: ADMIN_IT, items: [
    { label: 'Utilisateurs',        roles: ADMIN_ONLY },
    { label: 'Permissions',         roles: ADMIN_ONLY },
    { label: 'Débloquer un compte', roles: ADMIN_IT },
  ] };
  assert.deepEqual(libelles(entreesVisibles(comptes, 'IT', droits())), ['Débloquer un compte']);
  assert.equal(entreesVisibles(comptes, 'admin', droits()).length, 3);
  assert.deepEqual(entreesVisibles(comptes, 'DE', droits()), []);
});

test('une entrée sans module ni rôles prend les rôles du groupe', () => {
  const calendrier = { roles: ADMIN_ONLY, items: [{ label: 'Semaines' }] };
  assert.equal(entreesVisibles(calendrier, 'admin', droits()).length, 1);
  assert.equal(entreesVisibles(calendrier, 'DE', droits()).length, 0);
});

test('des rôles vides ouvrent à tous — le cas des anciens groupes sans filtre', () => {
  assert.equal(entreesVisibles({ roles: [], items: [{ label: 'X' }] }, 'etudiant', droits()).length, 1);
});

// ── Les entrées hors menu ─────────────────────────────────────────────────────

test("une entrée « menu: false » n'est jamais rendue, même avec tous les droits", () => {
  const formation = { roles: MANAGE, items: [
    { label: 'Éléments de module (EM)', module: 'em' },
    { label: 'Ajouter EM', module: 'em', action: 'modifier', menu: false as const },
  ] };
  assert.deepEqual(libelles(entreesVisibles(formation, 'admin', droits('em:voir', 'em:modifier'))),
                   ['Éléments de module (EM)']);
});

// ── La recherche ──────────────────────────────────────────────────────────────

const MENU = [
  { label: 'Calendrier', items: [{ label: 'Semaines' }, { label: 'Jours fériés' }, { label: 'Ramadan' }] },
  { label: 'Jury et délibérations', items: [{ label: 'Délibérations' }, { label: 'Rachats jury' }] },
  { label: 'Salles', items: [{ label: 'Liste des salles' }] },
];

test('la recherche ignore accents et majuscules', () => {
  assert.equal(normaliser('  Jours FÉRIÉS '), 'jours feries');
  const r = filtrerMenu(MENU, 'ferie');
  assert.deepEqual(r.map(g => g.label), ['Calendrier']);
  assert.deepEqual(libelles(r[0].items), ['Jours fériés']);
});

test('un groupe trouvé par son nom garde toutes ses entrées', () => {
  const r = filtrerMenu(MENU, 'jury');
  assert.deepEqual(r.map(g => g.label), ['Jury et délibérations']);
  assert.equal(r[0].items.length, 2);
});

test('une recherche vide rend le menu entier ; rien de trouvé rend un menu vide', () => {
  assert.equal(filtrerMenu(MENU, '   ').length, 3);
  assert.deepEqual(filtrerMenu(MENU, 'zzz'), []);
});
