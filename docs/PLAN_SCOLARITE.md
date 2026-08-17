# Plan — Entamer la partie Scolarité (vérification + roadmap)

## Contexte

Le plan backend décrit dans [ANALYSE_SIGA_BACKEND.md](../ANALYSE_SIGA_BACKEND.md) (sections 7.4 et 7.9) prévoit 6 nouvelles apps et l'extension de 6 modèles existants pour couvrir la Scolarité LMD. L'audit réel du dépôt `C:\react_projects\GES\siga` et du frontend `gesafped_frontend` montre que la majorité du socle est **déjà en place**, mais plusieurs zones restent à finaliser avant d'ouvrir le chantier fonctionnel « Scolarité ».

Objectif : dresser un état précis de l'existant, identifier les écarts critiques, puis proposer une séquence d'attaque courte pour pouvoir **entamer le module Scolarité** sans blocage.

---

## 1. État de l'existant

### 1.1 Backend SIGA (`C:\react_projects\GES\siga`)

| Domaine | Statut | Fichier | Notes |
|---|---|---|---|
| `apps/scolarite/` — `Filiere` | ✅ Complet | `apps/scolarite/models.py`, `views.py` | ViewSet + serializer, endpoint `/api/v1/scolarite/filieres/` |
| `apps/inscriptions/` — 4 modèles | 🟡 Partiel | `apps/inscriptions/models.py`, `serializers.py` | Modèles OK. **Serializers pollués** : 3 versions commentées d'`InscriptionAdministrativeSerializer`, double import `from rest_framework`, nettoyage obligatoire |
| `apps/evaluations/` | 🟡 Divergent du plan | `apps/evaluations/models.py`, `services/calcul_notes.py` | Implémenté en `SessionEvaluation` + `Note` + `ResultatElement` + `ResultatSemestre` + `PVDeliberation` + `LigneDeliberation`. **Absent** : `Deliberation` distincte, `ParametreJury`, `RachatNote`. Les rachats passent via `LigneDeliberation.decision='rachat'` (pas d'audit immuable) |
| `NoteCalculService` (≈ MoteurLMD) | 🟡 Partiel | `apps/evaluations/services/calcul_notes.py` | Couvre `calculer_element`, `calculer_semestre`, `calculer_tous_elements_session`. **Manque** : `appliquer_regle_maximum_rattrapage`, `calculer_progression_annuelle` (verrou S5 Art. 20), `verifier_eligibilite_diplome`, `calculer_mention` |
| `apps/stages/` | ✅ Complet | `apps/stages/models.py`, `views.py` | 3 modèles + actions `approuver`/`refuser` sur dérogations |
| `apps/documents/` | 🟡 Partiel | `apps/documents/models.py`, `views.py` | `DocumentOfficiel` + `RegistreDiplome` présents. **Absent** : `NumeroSerieConfig` (pas de thread-safety via `F()`, risque de collision de numéros de série) |
| `apps/notifications/` | ✅ Complet | `apps/notifications/models.py`, `views.py` | CRUD + `unread-count`, `lire`, `tout-lire` |
| `core/models.py` — `AuditLog` | ❌ Absent | — | Aucun audit DB. Seul `AuditMixin` fichier existe. Conséquence : pas de traçabilité durcie des notes/délibérations |
| Extensions `Institution` (bilingue, logo, signature) | ✅ Complet | `apps/parametres/models.py:147-211` | Champs FR/AR, logos, signature directeur |
| Extensions `Year`, `Semestre`, `Departement`, `EM`, `Etudiant` | ✅ Complet | voir fichiers respectifs | Tous les champs nullable ajoutés (filiere, institution, crédits, coefficient, poids, bilingue) |

### 1.2 Frontend (`gesafped_frontend`)

Toutes les pages-clés existent déjà et sont branchées sur `/api/v1/` via [lib/api.ts](../lib/api.ts). Entrée de navigation « Scolarité LMD » déjà présente dans [app/dashboard/layout.tsx](../app/dashboard/layout.tsx) (rôle `SCOLARITE`).

| Domaine | Statut | Emplacement |
|---|---|---|
| Filières (CRUD) | ✅ | [app/dashboard/scolarite/filieres/](../app/dashboard/scolarite/filieres) + [lib/api/scolarite.ts](../lib/api/scolarite.ts) |
| Préinscription publique + suivi | ✅ | [app/(public)/preinscription/](../app/(public)/preinscription), [lib/api/inscriptions.ts](../lib/api/inscriptions.ts) |
| Examen préinscriptions staff | ✅ | [app/dashboard/inscriptions/preinscriptions/](../app/dashboard/inscriptions/preinscriptions) |
| Inscriptions administratives / pédagogiques / éléments | ✅ | [app/dashboard/inscriptions/](../app/dashboard/inscriptions) |
| Évaluations : sessions / saisie / import / délibérations / rachats / PV | ✅ | [app/dashboard/evaluations/](../app/dashboard/evaluations), [components/scolarite/NotesGrid.tsx](../components/scolarite/NotesGrid.tsx), [components/scolarite/PvViewer.tsx](../components/scolarite/PvViewer.tsx) |
| Stages : conventions / évaluations / dérogations | ✅ | [app/dashboard/stages/](../app/dashboard/stages) |
| Documents officiels + vérification QR publique | ✅ | [app/dashboard/documents/](../app/dashboard/documents), [app/(public)/verifier/](../app/(public)/verifier), [components/scolarite/QrVerifyCard.tsx](../components/scolarite/QrVerifyCard.tsx) |
| Notifications | ✅ | [app/dashboard/notifications/page.tsx](../app/dashboard/notifications/page.tsx) |
| Institution bilingue (logo, signataire) | ✅ | [app/dashboard/institution/page.tsx](../app/dashboard/institution/page.tsx), [components/ui/BilingualInput.tsx](../components/ui/BilingualInput.tsx) |

**Verdict** : le frontend est à environ **85 %**. Ce qui manque côté UI découle d'écarts backend (cf. §2) — il ne sert à rien de coder des écrans rachat/progression tant que les endpoints ne sont pas fiables.

---

## 2. Écarts bloquants à combler

Classés par ordre de criticité décroissante.

1. **Nettoyage `apps/inscriptions/serializers.py`** — 3 versions commentées + double import + `from .models import InscriptionAdministrative` dupliqué. Risque de régression à chaque modification.
2. **`NumeroSerieConfig` manquant** dans `apps/documents/` — génération de numéros d'attestations/diplômes sans thread-safety. Risque de collision en production.
3. **`RachatNote` + `ParametreJury` manquants** dans `apps/evaluations/` — les rachats sont encodés par `decision='rachat'` sans historique immuable avant/après. Non conforme à l'arrêté 562.
4. **`core/models.py` + `AuditLog`** — aucune traçabilité DB des actions sensibles. Critique pour le domaine Scolarité (notes, délibérations, diplômes).
5. **`NoteCalculService` incomplet** — manque `calculer_mention`, `appliquer_regle_maximum_rattrapage`, `calculer_progression_annuelle` (verrou S5 Art. 20), `verifier_eligibilite_diplome`.
6. **Verrouillage post-clôture** — vérifier que `PATCH` sur `Note` après `SessionEvaluation.est_close=True` retourne 403.

---

## 3. Plan d'attaque (~5 jours)

### Étape 1 — Assainissement backend (1 j)

**Backend** `C:\react_projects\GES\siga\apps\inscriptions\serializers.py` :
- Supprimer les 3 blocs commentés.
- Dédupliquer les imports (un seul `from rest_framework import serializers`, une seule `from .models import InscriptionAdministrative`).
- Garder une seule définition d'`InscriptionAdministrativeSerializer` (la version active ligne 121).
- Écrire 2 tests : `POST /api/v1/inscriptions/administratives/` + `POST /api/v1/inscriptions/pedagogiques/`.

### Étape 2 — Traçabilité minimale (1 j)

**Backend** — créer `C:\react_projects\GES\siga\apps\core\models.py` :
```python
class AuditLog(models.Model):
    user        = FK(CustomUser, null=True, on_delete=SET_NULL)
    action      = CharField(10)           # CREATE, UPDATE, DELETE
    model_name  = CharField(100)
    object_id   = CharField(50)
    changes     = JSONField(default=dict) # {field: {old: x, new: y}}
    ip_address  = GenericIPAddressField(null=True)
    timestamp   = DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']
        # Append-only : override du manager pour bloquer update/delete
```
- Brancher via signals `post_save`/`post_delete` sur : `Note`, `PVDeliberation`, `LigneDeliberation`, `DocumentOfficiel`, `RegistreDiplome`.
- Manager custom : `perform_update` et `perform_destroy` retournent 405.

### Étape 3 — Numérotation documents thread-safe (0,5 j)

**Backend** `C:\react_projects\GES\siga\apps\documents\models.py` :
```python
class NumeroSerieConfig(models.Model):
    institution    = FK(Institution, on_delete=CASCADE)
    type_document  = CharField(30, choices=[...])
    prefixe        = CharField(10)         # 'AI', 'RN', 'DLP'
    dernier_numero = IntegerField(default=0)
    nb_chiffres    = IntegerField(default=5)

    class Meta:
        unique_together = ('institution', 'type_document')

    def generer_prochain(self):
        NumeroSerieConfig.objects.filter(pk=self.pk).update(
            dernier_numero=F('dernier_numero') + 1
        )
        self.refresh_from_db()
        annee = timezone.now().year
        return f"{self.prefixe}-{annee}-{str(self.dernier_numero).zfill(self.nb_chiffres)}"
```
- Migrer l'action `generer` dans `documents/views.py` pour utiliser `generer_prochain()`.
- Data migration : seeder une config par institution × type de document.

### Étape 4 — Moteur LMD complet (1,5 j)

**Backend** `C:\react_projects\GES\siga\apps\evaluations\services\calcul_notes.py` — ajouter :

| Méthode | Référence réglementaire |
|---|---|
| `calculer_mention(moyenne)` | `>= 16 TB / >= 14 B / >= 12 AB / >= 10 P` |
| `appliquer_regle_maximum_rattrapage(moy_ord, moy_ratt)` | Art. 18 : garde la note supérieure |
| `calculer_progression_annuelle(credits_annee, credits_capitalises, s1_s2_valides)` | Art. 20 : >= 65 % crédits pour passer ; verrou S5 si S1+S2 non validés |
| `verifier_eligibilite_diplome(etudiant)` | Art. 25 : 180 crédits + PFE >= 12/20 + tous semestres clos |

- Fonctions pures uniquement (pas d'accès DB direct).
- Couverture tests ≥ 90 % sur le service.
- Exposer `GET /api/v1/evaluations/calcul/{semestre_id}/` si pas déjà câblé dans `views.py`.

### Étape 5 — Audit trail des rachats (1 j)

**Backend** `C:\react_projects\GES\siga\apps\evaluations\models.py` — ajouter :
```python
class ParametreJury(models.Model):
    pv                        = FK(PVDeliberation, on_delete=CASCADE)
    seuil_validation_module   = DecimalField(4,2, default=10)
    seuil_validation_semestre = DecimalField(4,2, default=10)
    seuil_compensation        = DecimalField(4,2, default=8)
    seuil_eliminatoire        = DecimalField(4,2, default=6)
    justification             = TextField(blank=True)

class RachatNote(models.Model):
    """Immuable après création — pas d'update/delete."""
    pv              = FK(PVDeliberation, on_delete=PROTECT)
    ligne           = FK(LigneDeliberation, on_delete=PROTECT)
    ancienne_valeur = DecimalField(4,2)
    nouvelle_valeur = DecimalField(4,2)
    motif           = TextField
    decidee_par     = FK(CustomUser)
    date_decision   = DateTimeField(auto_now_add=True)
```
- Data migration rétro-compat : pour chaque `LigneDeliberation.decision='rachat'`, créer un `RachatNote` avec `ancienne_valeur=NULL`.

**Frontend** — adapter :
- [lib/api/evaluations.ts](../lib/api/evaluations.ts) : exposer `rachatsApi.list()` avec les champs `ancienne_valeur`, `nouvelle_valeur`, `motif`.
- [app/dashboard/evaluations/rachats/page.tsx](../app/dashboard/evaluations/rachats/page.tsx) : ajouter colonnes « Note avant » / « Note après » / « Motif ».

### Étape 6 — Vérification end-to-end (0,5 j)

Scénario complet :
```
Créer filière
→ Inscrire étudiant (admin + péd + éléments)
→ Ouvrir session
→ Saisir notes (individuelle + bulk)
→ Calculer (NoteCalculService)
→ Délibérer + rachat (RachatNote)
→ Clôturer PV
→ Générer attestation (NumeroSerieConfig)
→ Vérifier QR public
```
- Tenter un `PATCH` sur `Note` après clôture → attendre 403.
- Vérifier dans l'admin Django qu'`AuditLog` trace chaque action sensible.

---

## 4. Fichiers critiques à modifier

### Backend (`C:\react_projects\GES\siga`)

| Fichier | Action |
|---|---|
| `apps/inscriptions/serializers.py` | Nettoyage (supprimer commentaires, dédupliquer imports) |
| `apps/core/models.py` *(à créer)* | Créer `AuditLog` + manager append-only |
| `apps/documents/models.py` | Ajouter `NumeroSerieConfig` |
| `apps/documents/views.py` | Utiliser `generer_prochain()` dans l'action `generer` |
| `apps/evaluations/models.py` | Ajouter `RachatNote`, `ParametreJury` |
| `apps/evaluations/services/calcul_notes.py` | Compléter le moteur LMD |

### Frontend (`gesafped_frontend`)

| Fichier | Action |
|---|---|
| [lib/api/evaluations.ts](../lib/api/evaluations.ts) | Exposer endpoints rachats enrichis |
| [app/dashboard/evaluations/rachats/page.tsx](../app/dashboard/evaluations/rachats/page.tsx) | Colonnes avant/après + motif |

---

## 5. Hors périmètre (cette itération)

- Création d'écrans UI nouveaux : l'existant suffit pour valider le socle.
- Refactoring `PVDeliberation` → `Deliberation` conforme au plan papier : garder le split PV + Lignes actuel.
- Celery / génération PDF async : `pdfkit` synchrone suffit à l'échelle d'une institution.

---

## 6. Commandes de vérification

```bash
# Backend
python manage.py makemigrations --check
python manage.py test apps.evaluations apps.inscriptions apps.documents apps.core

# Frontend
npm run lint
```

Références design : [docs/skill_design.md](./skill_design.md) · [ANALYSE_SIGA_BACKEND.md](../ANALYSE_SIGA_BACKEND.md)
