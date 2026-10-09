import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changements, filtrer, groupeAffiche, type EtudiantNiveau } from './groupes-anglais.ts';

const e = (id: number, matricule: string, groupe_anglais: number | null, groupe_habituel = 'G1'):
  EtudiantNiveau => ({ id, matricule, nom: `Etudiant ${id}`, statut: 'actif',
                       groupe_habituel, filiere: 'SEA', groupe_anglais });

const liste = [e(1, '24601', null), e(2, '24602', 10), e(3, '24603', 11, 'G2')];

test('seuls les choix qui changent quelque chose partent au serveur', () => {
  assert.deepEqual(changements(liste, { 1: 10, 2: 10, 3: null }), [
    { etudiant: 1, groupe: 10 },
    { etudiant: 3, groupe: null },
  ]);
  assert.deepEqual(changements(liste, {}), []);
});

test('le choix en cours prime sur l’enregistré, même quand il retire', () => {
  assert.equal(groupeAffiche(liste[1], { 2: null }), null);
  assert.equal(groupeAffiche(liste[1], {}), 10);
});

test('recherche et filtres', () => {
  assert.deepEqual(filtrer(liste, {}, '', 'sans').map(x => x.id), [1]);
  assert.deepEqual(filtrer(liste, { 1: 11 }, '', 11).map(x => x.id), [1, 3]);
  assert.deepEqual(filtrer(liste, {}, 'g2', 'tous').map(x => x.id), [3]);
  assert.deepEqual(filtrer(liste, {}, '24602', 'tous').map(x => x.id), [2]);
});

import { catalogueDuGroupe, estIntituleAnglais } from './groupes-anglais.ts';

test('une séance d’anglais se reconnaît à son intitulé', () => {
  assert.equal(estIntituleAnglais('Anglais'), true);
  assert.equal(estIntituleAnglais('  ANGLAIS technique'), true);
  assert.equal(estIntituleAnglais('Économie anglaise'), false);
  assert.equal(estIntituleAnglais(null), false);
});

test('le catalogue suit la nature du groupe', () => {
  const ems = [{ id: 1, intitule: 'Anglais' }, { id: 2, intitule: 'Statistique' }];
  const groupes = [{ niveau: 3, groupe_anglais: 1 }, { niveau: 3, groupe_anglais: null },
                   { niveau: 2, groupe_anglais: null }];
  assert.deepEqual(catalogueDuGroupe(ems, groupes[0], groupes).map(e => e.id), [1]);
  assert.deepEqual(catalogueDuGroupe(ems, groupes[1], groupes).map(e => e.id), [2]);
  assert.deepEqual(catalogueDuGroupe(ems, groupes[2], groupes).map(e => e.id), [1, 2]);
});

test('les accents ne comptent pas', () => {
  assert.equal(estIntituleAnglais('Ànglais'), true);
});
