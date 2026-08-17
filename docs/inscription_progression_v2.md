# Plan v2 : Corrections du pipeline `inscription_progression`

## Contexte

Le pipeline Saisie notes → Calcul moyennes → Délibération → Progression N+1 est implémenté à ~95 %. Deux corrections restent :

1. **Protection manquante** : `calculer-semestres` et `calculer` ne vérifient pas `session.est_close`
2. **Formule de pondération incorrecte** : le calcul utilise les champs `poids_cc/tp/exam` par ElementModule, mais la règle institutionnelle est fixe :
   - Avec TP : `(CC × 2 + EXAM × 3 + TP × 1) / 6`
   - Sans TP : `(CC × 2 + EXAM × 3) / 5`
   - Cette pondération est une **règle globale de l'établissement**, pas un attribut par EM
   - La présence de TP est déterminée par `EM.TP > 0` (heures TP planifiées)

---

## Correction 1 — Modèle `ParametresPonderation` dans app scolarite

### 1.1 Nouveau modèle singleton

**Fichier** : `siga/apps/scolarite/models.py`

```python
class ParametresPonderation(models.Model):
    """
    Règle institutionnelle de pondération des notes.
    Singleton — un seul enregistrement en base.
    Avec TP : (CC × coeff_cc + EXAM × coeff_exam + TP × coeff_tp) / (coeff_cc + coeff_exam + coeff_tp)
    Sans TP : (CC × coeff_cc + EXAM × coeff_exam) / (coeff_cc + coeff_exam)
    """
    coeff_cc   = models.IntegerField(default=2)
    coeff_exam = models.IntegerField(default=3)
    coeff_tp   = models.IntegerField(default=1)

    class Meta:
        db_table = 'scolarite_parametres_ponderation'
        verbose_name = 'Paramètres de pondération'
        verbose_name_plural = 'Paramètres de pondération'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
```

### 1.2 Migration

`python manage.py makemigrations scolarite`

### 1.3 Serializer + endpoint

**Fichier** : `siga/apps/scolarite/serializers.py` — ajouter `ParametresPonderationSerializer`
**Fichier** : `siga/apps/scolarite/views.py` — ajouter `ParametresPonderationViewSet` (retrieve + update, singleton)
**Fichier** : `siga/apps/scolarite/urls.py` — enregistrer la route

---

## Correction 2 — Adapter `NoteCalculService.calculer_element()`

**Fichier** : `siga/apps/evaluations/services/calcul_notes.py`

Remplacer la logique actuelle (lignes 44-64) :

```python
# AVANT — pondération par élément (incorrect)
poids_cc   = element.poids_cc
poids_tp   = element.poids_tp
poids_exam = element.poids_exam
note_finale = (note_cc * poids_cc + note_tp * poids_tp + note_exam * poids_exam)
```

Par :

```python
# APRÈS — pondération institutionnelle depuis ParametresPonderation
from apps.scolarite.models import ParametresPonderation

params = ParametresPonderation.get()

# Déterminer si l'EM a du TP via le lien InscriptionElement → EM planification
em_planif = inscription_element.em
has_tp = em_planif is not None and em_planif.TP > 0

if has_tp:
    diviseur = params.coeff_cc + params.coeff_exam + params.coeff_tp
    note_finale = (
        note_cc * params.coeff_cc
        + note_exam * params.coeff_exam
        + note_tp * params.coeff_tp
    ) / Decimal(str(diviseur))
else:
    diviseur = params.coeff_cc + params.coeff_exam
    note_finale = (
        note_cc * params.coeff_cc
        + note_exam * params.coeff_exam
    ) / Decimal(str(diviseur))

note_finale = note_finale.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
```

**Note** : Les champs `poids_cc/tp/exam` sur `ElementModule` deviennent inutilisés par le calcul. On ne les supprime pas (pas de migration destructive), mais ils ne sont plus lus par `calculer_element`.

---

## Correction 3 — Guard `est_close` sur les actions de calcul

**Fichier** : `siga/apps/evaluations/views.py`

Ajouter la vérification `session.est_close` en tête des actions `calculer` (ligne 68) et `calculer_semestres` (ligne 76) :

```python
if session.est_close:
    return Response(
        {'detail': 'Session clôturée — recalcul interdit.'},
        status=status.HTTP_400_BAD_REQUEST,
    )
```

---

## Fichiers à modifier/créer

| Fichier | Action |
|---------|--------|
| `siga/apps/scolarite/models.py` | Ajouter `ParametresPonderation` (singleton) |
| `siga/apps/scolarite/serializers.py` | Ajouter `ParametresPonderationSerializer` |
| `siga/apps/scolarite/views.py` | Ajouter `ParametresPonderationViewSet` |
| `siga/apps/scolarite/urls.py` | Enregistrer route `parametres-ponderation` |
| `siga/apps/evaluations/services/calcul_notes.py` | Remplacer la pondération par-element par la lecture du singleton |
| `siga/apps/evaluations/views.py` | Ajouter guard `est_close` sur `calculer` et `calculer_semestres` |
| Migration scolarite | `makemigrations` + `migrate` |

## Ordre d'implémentation

1. Créer `ParametresPonderation` modèle + migration
2. Créer serializer + view + route pour le CRUD singleton
3. Modifier `calculer_element()` pour utiliser le nouveau paramétrage
4. Ajouter guards `est_close` sur les endpoints
5. Compiler + tester

## Vérification

1. `python manage.py makemigrations scolarite` — génère la migration
2. `python -m py_compile` sur chaque fichier modifié
3. API : `GET /api/v1/scolarite/parametres-ponderation/` retourne `{coeff_cc: 2, coeff_exam: 3, coeff_tp: 1}`
4. API : `PUT` pour modifier les coefficients → relancer `calculer` → vérifier que la formule change
5. Tester avec un EM ayant TP > 0 et un EM ayant TP = 0 → vérifier les deux formules
6. Tester que `calculer` et `calculer-semestres` sont bloqués sur une session close
