# Plan : Workflow fin d'année N → Inscriptions N+1

## Contexte

Après l'implémentation de l'auto-création des inscriptions pédagogiques (plan `inscription_pedagogique.md`), il manque le workflow complet de fin d'année :
- Les notes sont saisies (app evaluations existante) mais les moyennes annuelles ne sont pas calculées
- Les PV de délibération existent en modèle mais ne sont pas auto-peuplés
- Aucune logique de progression (passage/redoublement/exclusion) n'existe
- Aucune génération automatique d'InscriptionAdministrative pour N+1

**Objectif** : Implémenter le pipeline complet `Saisie notes → Calcul moyennes → Délibération → Progression N+1`.

---

## Phase 1 : Compléter le calcul des moyennes

**Fichier** : `siga/apps/evaluations/services/calcul_notes.py`

### 1.1 Bug fix : poids_cc divisé par 100 (ligne 58)

Le code actuel fait `poids_cc / 100` mais `ElementModule.poids_cc` stocke déjà une fraction décimale (0.30, pas 30). Supprimer la division par 100.

### 1.2 Ajouter `calculer_tous_semestres_session()`

Méthode d'instance sur `NoteCalculService` qui itère sur tous les `ResultatElement` de la session, les regroupe par semestre, et crée/met à jour un `ResultatSemestre` pour chaque couple (étudiant, semestre).

```python
def calculer_tous_semestres_session(self):
    """
    Pour chaque étudiant ayant des ResultatElement dans cette session,
    calculer la moyenne pondérée du semestre (par crédits module).
    Crée/met à jour ResultatSemestre.
    """
```

Logique :
- Récupérer tous les `ResultatElement` de la session, groupés par `(etudiant, semestre)`
- Pour chaque groupe : moyenne pondérée = Σ(note_finale × crédits) / Σ(crédits)
- Déterminer `est_validee` : moyenne >= 10 ET tous les modules >= seuil (ou compensation selon Art. 562)
- `get_or_create` un `ResultatSemestre`, mettre à jour `moyenne`, `est_validee`, `credits_valides`

### 1.3 Ajouter `calculer_moyenne_annuelle()` (méthode statique)

```python
@staticmethod
def calculer_moyenne_annuelle(etudiant, annee_univ, niveau):
    """
    Moyenne annuelle = moyenne des ResultatSemestre du niveau pour cet étudiant.
    Retourne (moyenne_annuelle, credits_valides, tous_semestres_valides).
    """
```

Logique :
- Trouver les semestres du niveau (L1→S1+S2, L2→S3+S4, L3→S5)
- Récupérer les `ResultatSemestre` correspondants
- Moyenne annuelle = Σ(moyenne_sem × crédits_sem) / Σ(crédits_sem)
- `tous_valides` = tous les semestres ont `est_validee=True`

---

## Phase 2 : Service de délibération

**Nouveau fichier** : `siga/apps/evaluations/services/deliberation.py`

### 2.1 Classe `DeliberationService`

```python
class DeliberationService:
    def __init__(self, pv: PVDeliberation):
        self.pv = pv
```

### 2.2 `peupler_lignes()`

Auto-peuple `LigneDeliberation` pour un PV donné.

```python
def peupler_lignes(self):
    """
    Pour chaque étudiant inscrit (InscriptionAdministrative) dans la filière/année/niveau du PV,
    créer une LigneDeliberation avec ses moyennes calculées.
    """
```

Logique :
1. Récupérer les `InscriptionAdministrative` filtrées par `pv.filiere`, `pv.annee_univ`, `pv.niveau`
2. Pour chaque inscription :
   - Appeler `NoteCalculService.calculer_moyenne_annuelle(etudiant, annee, niveau)`
   - `get_or_create` une `LigneDeliberation(pv=pv, etudiant=etudiant)` avec `moyenne_annuelle`, `credits_valides`
3. Retourner le nombre de lignes créées

### 2.3 `calculer_decisions()`

Applique les règles de délibération Art. 562 sur chaque ligne.

```python
def calculer_decisions(self):
    """
    Pour chaque LigneDeliberation du PV, calculer la décision automatique.
    """
```

Règles (configurables via `ParametreJury`) :
- **admis** : moyenne_annuelle >= `seuil_validation` (défaut 10) ET credits_valides >= crédits requis du niveau
- **ajourné (redoublant)** : moyenne_annuelle < seuil mais >= `seuil_redoublement` (défaut 7), OU crédits insuffisants mais > seuil min
- **rachat** : moyenne entre seuil_rachat et seuil_validation, soumis à validation jury
- **exclus** : moyenne < `seuil_exclusion` (défaut 5) OU nombre de redoublements > max autorisé

Chaque `LigneDeliberation.decision` est mise à jour. Le PV reste en `statut='brouillon'` jusqu'à validation manuelle par le jury.

---

## Phase 3 : Service de progression N+1

**Nouveau fichier** : `siga/apps/inscriptions/services/progression.py`

### 3.1 Classe `ProgressionService`

```python
class ProgressionService:
    def __init__(self, pv: PVDeliberation):
        self.pv = pv  # PV doit être en statut 'valide'
```

### 3.2 `generer()`

```python
def generer(self):
    """
    À partir d'un PV validé, générer les InscriptionAdministrative pour N+1.
    Retourne un dict de stats: {admis: n, redoublants: n, exclus: n, dettes: n}
    """
```

Logique par catégorie de décision :

**admis** :
1. Créer `InscriptionAdministrative(etudiant, annee=N+1, filiere, niveau=niveau+1)`
2. Appeler `_creer_inscriptions_pedagogiques()` (existant dans `views.py`, à extraire en utilitaire)
3. Mettre à jour `Etudiant.statut = 'actif'`

**ajourné (redoublant)** :
1. Créer `InscriptionAdministrative(etudiant, annee=N+1, filiere, niveau=même_niveau)`
2. Créer les `InscriptionPedagogique` pour les semestres non validés
3. Pour chaque semestre non validé → créer `InscriptionElement(est_dette=True, annee_dette=N)` uniquement pour les EM non validés
4. `est_redoublant = True` sur les InscriptionPedagogique

**exclus** :
1. Mettre à jour `Etudiant.statut = 'exclu'`
2. Pas d'InscriptionAdministrative créée

**rachat** :
1. Traité comme admis (le jury a validé le passage)

### 3.3 Extraire `_creer_inscriptions_pedagogiques` en utilitaire

**Fichier** : `siga/apps/inscriptions/utils.py` (nouveau)

Déplacer la fonction `_creer_inscriptions_pedagogiques` de `views.py` vers `utils.py` pour qu'elle soit réutilisable par `ProgressionService` et `views.py`.

---

## Phase 4 : Endpoints API

**Fichier** : `siga/apps/evaluations/views.py`

### 4.1 Endpoint calcul semestres
```
POST /api/evaluations/sessions/{id}/calculer-semestres/
```
Appelle `NoteCalculService(session).calculer_tous_semestres_session()`.

### 4.2 Endpoint peuplement PV
```
POST /api/evaluations/pvs/{id}/peupler/
```
Appelle `DeliberationService(pv).peupler_lignes()`.

### 4.3 Endpoint calcul décisions
```
POST /api/evaluations/pvs/{id}/calculer-decisions/
```
Appelle `DeliberationService(pv).calculer_decisions()`.

**Fichier** : `siga/apps/inscriptions/views.py`

### 4.4 Endpoint génération progression
```
POST /api/inscriptions/admin/generer-progression/
```
Body : `{ pv_id: int }`
Appelle `ProgressionService(pv).generer()`. Nécessite permission admin.

---

## Phase 5 : Ajustements modèles (si nécessaire)

**Fichier** : `siga/apps/evaluations/models.py`

Vérifier que `LigneDeliberation` contient :
- `moyenne_annuelle` (DecimalField)
- `credits_valides` (IntegerField)  
- `decision` (CharField avec choices admis/ajourné/rachat/exclus)
- `observation` (TextField, notes du jury)

Vérifier que `PVDeliberation` contient :
- `filiere`, `annee_univ`, `niveau` (pour filtrer les inscriptions)
- `statut` (brouillon/validé/archivé)

Ajouter les champs manquants via migration si nécessaire.

**Fichier** : `siga/apps/evaluations/models.py` — `ResultatSemestre`

Vérifier qu'il contient `etudiant`, `semestre`, `session`, `moyenne`, `est_validee`, `credits_valides`. Ajouter si manquant.

---

## Fichiers à modifier/créer

| Fichier | Action |
|---------|--------|
| `siga/apps/evaluations/services/calcul_notes.py` | Fix bug poids_cc, ajouter `calculer_tous_semestres_session()`, `calculer_moyenne_annuelle()` |
| `siga/apps/evaluations/services/deliberation.py` | **Nouveau** — `DeliberationService` avec `peupler_lignes()`, `calculer_decisions()` |
| `siga/apps/inscriptions/utils.py` | **Nouveau** — extraire `_creer_inscriptions_pedagogiques` de views.py |
| `siga/apps/inscriptions/services/progression.py` | **Nouveau** — `ProgressionService` avec `generer()` |
| `siga/apps/evaluations/views.py` | Ajouter endpoints calcul-semestres, peupler, calculer-decisions |
| `siga/apps/inscriptions/views.py` | Ajouter endpoint generer-progression, refactorer import de la fonction utilitaire |
| `siga/apps/evaluations/urls.py` | Ajouter routes pour les nouveaux endpoints |
| `siga/apps/inscriptions/urls.py` | Ajouter route pour generer-progression |
| `siga/apps/evaluations/models.py` | Ajustements champs si nécessaire (après vérification) |
| Migrations | Une migration par app si des champs sont ajoutés |

## Ordre d'implémentation

1. Fix bug `poids_cc / 100` dans `calcul_notes.py`
2. Vérifier/ajuster les modèles (`ResultatSemestre`, `LigneDeliberation`, `PVDeliberation`)
3. Implémenter `calculer_tous_semestres_session()` et `calculer_moyenne_annuelle()`
4. Extraire `_creer_inscriptions_pedagogiques` dans `utils.py`
5. Implémenter `DeliberationService`
6. Implémenter `ProgressionService`
7. Créer les endpoints API + routes
8. Tester le pipeline complet

## Vérification

1. **Calcul moyennes** : Créer une session avec notes saisies → appeler `calculer-semestres` → vérifier que les `ResultatSemestre` sont créés avec les bonnes moyennes
2. **Peuplement PV** : Créer un PV → appeler `peupler` → vérifier que chaque étudiant a une `LigneDeliberation` avec sa moyenne annuelle
3. **Décisions** : Appeler `calculer-decisions` → vérifier que les décisions sont conformes aux seuils (admis >= 10, exclus < 5, etc.)
4. **Progression** : Valider le PV → appeler `generer-progression` → vérifier :
   - Admis : InscriptionAdministrative(N+1, niveau+1) + InscriptionPedagogique + InscriptionElement
   - Redoublants : InscriptionAdministrative(N+1, même niveau) + InscriptionElement(est_dette=True) pour EM non validés
   - Exclus : Etudiant.statut='exclu', pas d'inscription
5. **Idempotence** : Relancer `generer-progression` → pas de doublons (grâce à `get_or_create`)
