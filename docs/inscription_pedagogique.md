# Plan : Auto-création des inscriptions pédagogiques

## Contexte

Quand un étudiant est inscrit (via formulaire manuel ou import MERS), seule l'**InscriptionAdministrative** est créée. Il manque la liaison avec les semestres (InscriptionPedagogique) et les cours/EM (InscriptionElement).

L'utilisateur veut que **tout se déclenche automatiquement** à la création de l'InscriptionAdministrative.

## Données existantes (vérifiées en base)

- **Semestres** : S1 (L1), S2 (L1), S3 (L2), S4 (L2), S5 (L3) — liés à un Niveau
- **Modules LMD** : 10 modules liés à filière SEA + semestres S1/S2
- **EM** : 107 cours liés à des départements + semestres, dont 23 ont `module_lmd` renseigné
- **Chaîne de liaison prouvée** :  
  `Filière + Semestre → Module LMD → EM (via module_lmd FK)`
  - SEA + S1 → 5 Modules → 11 EM (ST11, ST12, HE31, HE32, etc.)
  - SEA + S2 → 5 Modules → 12 EM (ST61, ST62, HE81, HE101, etc.)

## Approche

### Étape 1 : Ajouter FK `em` sur InscriptionElement (backend)

**Fichier** : `siga/apps/inscriptions/models.py`

Le modèle `InscriptionElement` pointe actuellement vers `modules.ElementModule` (table vide, 0 lignes). On ajoute un FK optionnel vers `em.EM` pour lier directement aux cours réels :

```python
em = models.ForeignKey(
    'em.EM', on_delete=models.SET_NULL,
    null=True, blank=True,
    related_name='inscriptions_elements',
    help_text="Élément de module (planification) lié à cette inscription.",
)
```

→ `makemigrations` + `migrate`

**Fichier** : `siga/apps/inscriptions/serializers.py`  
Ajouter les champs `em`, `em_code`, `em_intitule` au `InscriptionElementSerializer`.

### Étape 2 : Fonction utilitaire `_creer_inscriptions_pedagogiques`

**Fichier** : `siga/apps/inscriptions/views.py`

Fonction appelée après chaque création d'InscriptionAdministrative :

```
_creer_inscriptions_pedagogiques(inscription_admin, user)
```

**Logique :**

1. `inscription_admin.niveau` (int 1→L1, 2→L2, 3→L3…) → trouver l'objet `Niveau`
2. Chercher les `Semestre` pour ce Niveau :
   - Priorité : ceux liés à `inscription_admin.filiere`
   - Complément : ceux avec `filiere=NULL` (si le code_semestre n'est pas déjà couvert)
3. Pour chaque Semestre trouvé :
   - `get_or_create` une `InscriptionPedagogique`
4. Pour chaque InscriptionPedagogique créée :
   - Trouver les `Module` LMD où `filiere = inscription_admin.filiere AND semestre = ce_semestre`
   - Pour chaque Module → trouver les `EM` où `module_lmd = ce_module`
   - Pour chaque EM → `get_or_create` un `InscriptionElement(inscription_ped, em=em)`

### Étape 3 : Appeler depuis `inscrire` et `importer_mers`

**Fichier** : `siga/apps/inscriptions/views.py`

- Dans `inscrire()` : après la création de `inscription`, appeler `_creer_inscriptions_pedagogiques(inscription, request.user)`
- Dans `importer_mers()` : dans la boucle, après création/vérification de l'InscriptionAdministrative, appeler la même fonction

## Fichiers à modifier

| Fichier | Action |
|---------|--------|
| `siga/apps/inscriptions/models.py` | Ajouter FK `em` sur InscriptionElement |
| `siga/apps/inscriptions/serializers.py` | Exposer `em`, `em_code`, `em_intitule` |
| `siga/apps/inscriptions/views.py` | Ajouter `_creer_inscriptions_pedagogiques` + l'appeler dans `inscrire` et `importer_mers` |

## Vérification

1. **Inscription manuelle** : inscrire un étudiant en L1 SEA → vérifier qu'il a 2 InscriptionPedagogique (S1, S2) et 23 InscriptionElement (11 EM S1 + 12 EM S2)
2. **Import MERS** : importer un fichier → vérifier que chaque étudiant a ses inscriptions pédagogiques auto-générées
3. **Idempotence** : ré-importer le même fichier → vérifier qu'aucun doublon n'est créé (grâce à `get_or_create`)
4. **Filière sans Module LMD** : inscrire dans une filière sans Modules configurés → seules les InscriptionPedagogique sont créées (pas d'InscriptionElement), pas d'erreur
