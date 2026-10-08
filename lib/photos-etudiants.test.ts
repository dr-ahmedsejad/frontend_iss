import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  matriculeDuFichier, preparer, paquets, TAILLE_MAX, PAQUET_FICHIERS, PAQUET_OCTETS,
} from './photos-etudiants.ts';

const f = (name: string, size = 1000) => ({ name, size });

test('le matricule est le nom du fichier, sans extension ni espaces', () => {
  assert.deepEqual(matriculeDuFichier('24607.jpg'), { matricule: '24607', extension: '.jpg' });
  assert.deepEqual(matriculeDuFichier(' 255004 .PNG'), { matricule: '255004', extension: '.png' });
  assert.deepEqual(matriculeDuFichier('dossier/AB12.jpeg'), { matricule: 'AB12', extension: '.jpeg' });
  assert.equal(matriculeDuFichier('24607.gif').extension, null);
  assert.equal(matriculeDuFichier('24607').extension, null);
});

test('ce qui sera refusé à coup sûr n’est pas envoyé', () => {
  const { aEnvoyer, refuses } = preparer([
    f('24607.jpg'), f('24608.gif'), f('24609.jpg', TAILLE_MAX + 1),
    f('24610.jpg'), f('24610.png'),
  ]);
  assert.deepEqual(aEnvoyer.map(x => x.name), ['24607.jpg']);
  assert.deepEqual(Object.fromEntries(refuses.map(r => [r.fichier, r.statut])), {
    '24608.gif': 'invalide', '24609.jpg': 'trop_lourd', '24610.jpg': 'doublon', '24610.png': 'doublon',
  });
});

test('un doublon ne dépend pas des majuscules', () => {
  const { refuses } = preparer([f('ab12.jpg'), f('AB12.png')]);
  assert.equal(refuses.length, 2);
});

test('des paquets bornés en nombre et en taille', () => {
  const nombreux = Array.from({ length: 45 }, (_, i) => f(`${i}.jpg`));
  assert.deepEqual(paquets(nombreux).map(p => p.length), [PAQUET_FICHIERS, PAQUET_FICHIERS, 5]);
  const lourds = Array.from({ length: 5 }, (_, i) => f(`${i}.jpg`, PAQUET_OCTETS / 2));
  assert.deepEqual(paquets(lourds).map(p => p.length), [2, 2, 1]);
  assert.deepEqual(paquets([]), []);
});
