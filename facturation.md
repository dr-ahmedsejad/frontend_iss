# Plan — Module Facturation Étudiants SIGA

## Context

SIGA est aujourd'hui un **SIS pur** déployé pour Polytechnique (établissement public mauritanien) où le paiement étudiant se limite à 4 champs basiques sur `InscriptionAdministrative` (`montant_frais`, `est_payee`, `date_paiement`, `recu_paiement`) — score 0/18 sur les fonctionnalités attendues d'un module de facturation privée.

L'objectif est d'ajouter une **brique ERP de facturation** activable par institution pour vendre SIGA à des établissements privés mauritaniens qui ont besoin d'échéanciers trimestriels/mensuels, recouvrement, blocages, rapports financiers.

**Décisions structurantes validées :**
- **Stratégie** : 1 codebase, module activable par config (Polytechnique reste sur l'ancien système, écoles privées activent le module)
- **Timeline** : MVP en 6 mois (24 semaines, ~110 j-h solo dev)
- **Déploiement** : on-premise, Mauritanie d'abord, archi préparée pour expansion
- **Out of scope MVP** : online payment gateway, pénalités de retard, multi-devise, export Sage spécifique, migration des données existantes, validation 2 niveaux

**Risque majeur identifié** : aucun pilote privé encore signé. Checkpoint formel imposé au Sprint 4 (cf. §9).

---

## 1. Architecture cible

### 1.1 Nouvelle app Django `apps/facturation/`

Tous les modèles vivent dans une app dédiée — désactivation propre, isolation forte, FK explicite vers `Institution` partout.

### 1.2 Modèles à créer (8 tables)

#### `ParametreFacturation` (singleton par institution — flag maître)
- `institution` : OneToOne `Institution` CASCADE
- `actif` : bool default False  ← **flag d'activation du module**
- `jour_echeance_mensuel` : PositiveSmallInt default 5
- `mois_debut_annee` : PositiveSmallInt default 10
- `seuil_blocage_alerte_jours` : default 7
- `seuil_blocage_notes_jours` : default 30
- `seuil_blocage_examens_jours` : default 60
- `seuil_blocage_cours_jours` : default 90
- `pourcentage_min_pour_inscription` : Decimal(5,2) default 0
- `devise` : CharField default 'MRU' (préparation multi-devise)

#### `GrilleTarifaire` (catalogue tarifaire)
- `institution`, `annee_univ`, `filiere` (FK), `niveau` (Int)
- `montant_annuel` : Decimal(12,2)
- `frequence_defaut` : `mensuel|trimestriel`
- `nb_echeances` : PositiveSmallInt
- `actif` : bool default True
- Contrainte : `unique(institution, annee_univ, filiere, niveau)`

#### `EcheancierEtudiant` (1-1 avec inscription)
- `institution`, `inscription_admin` (OneToOne PROTECT)
- `grille` (FK PROTECT)  ← snapshot
- `frequence` (overridable par étudiant)
- `montant_brut`, `montant_remise`, `montant_net`, `montant_paye`, `solde` (Decimal 12,2)
- `statut` : `actif|annule|solde|en_retard`
- Recalculs déclenchés par signaux

#### `Echeance` (ligne unitaire)
- `echeancier` (FK CASCADE), `numero` (1..N)
- `libelle` (ex "T1 2026-2027" ou "Octobre 2026")
- `montant_du`, `montant_paye` (Decimal)
- `date_echeance` (Date)
- `statut` : `a_venir|du|partiellement_paye|paye|en_retard`
- Index `(date_echeance, statut)` pour rapports arriérés

#### `Remise` (réduction % uniquement, MVP)
- `echeancier` (FK CASCADE)
- `type_remise` : `bourse|fratrie|merite|social|autre`
- `pourcentage` : Decimal(5,2)
- `motif` (TextField), `justificatif` (FileField nullable)
- `actif` : bool (désactivation au lieu de suppression)
- `accordee_par` (FK CustomUser)
- Validation : somme % actifs ≤ 100

#### `Encaissement` (versement)
- `institution`, `echeancier` (FK PROTECT)
- `numero_recu` : CharField unique — format **continu `RC-00001`** (pas de reset annuel)
- `montant` (CHECK > 0)
- `mode_paiement` : `especes|bankily|masrvi|sedad|virement|cheque`
- `reference_externe` (n° transaction / chèque)
- `date_encaissement`, `notes`, `cree_par`
- `quittance_pdf` (FileField)
- `est_annule` : bool, `motif_annulation` (obligatoire si annulé)
- Index `(date_encaissement, institution)`, `(echeancier, est_annule)`

#### `AffectationEncaissement` (table N-N) ← validé par utilisateur
- `encaissement` (FK CASCADE)
- `echeance` (FK PROTECT)
- `montant` (Decimal)
- Permet : paiement partiel, paiement groupé sur N échéances
- Validation : `SUM(affectations.montant) == encaissement.montant`

#### `BlocageEtudiant` (matérialisation pour perf)
- `etudiant`, `institution`, `annee_univ`
- `niveau_blocage` : `ALERTE|NOTES|EXAMENS|COURS`
- `motif`, `montant_du` (snapshot), `est_actif`
- `date_debut`, `date_fin`, `leve_par`
- Recalculé par cron nocturne + après chaque encaissement

### 1.3 Migration strategy — **additive uniquement**

1. **Migration 0001** : création des 8 tables, aucun touch sur l'existant
2. **Migration 0002** : seed des modules RBAC (`factu_config`, `factu_grille`, `factu_echeancier`, `factu_remise`, `factu_encaissement`, `factu_rapport`) — pattern de `apps/authentication/migrations/0008_split_granular_modules.py`
3. **Migration 0003 (data)** : pour chaque institution existante, créer `ParametreFacturation(actif=False)` → Polytechnique inchangée

---

## 2. Découpage en 12 sprints (24 semaines)

| Sprint | Semaines | Contenu | Jours |
|---|---|---|---|
| **S1** | 1-2 | Modèles + migrations + admin Django | 9 |
| **S2** | 3-4 | Serializers + ViewSets `ParametreFacturation` + `GrilleTarifaire` + frontend config/grilles | 9 |
| **S3** | 5-6 | Service échéancier + signal `post_save InscriptionAdministrative` + pages liste/détail étudiant | 10 |
| **S4** | 7-8 | Remises + recalculs + modal frontend → **CHECKPOINT PILOTE** | 7 |
| **S5** | 9-10 | Encaissements + AffectationEncaissement (cœur) + page saisie caissier | 11 |
| **S6** | 11-12 | Quittance PDF + template bilingue FR/AR + QR vérification | 9 |
| **S7** | 13-14 | Blocages 4 niveaux + insertions dans evaluations/inscriptions/absence | 10 |
| **S8** | 15-16 | 4 rapports + cache + filtres | 10 |
| **S9** | 17-18 | Export CSV/Excel + relances in-app via `apps/notifications` | 7 |
| **S10** | 19-20 | Tests pytest backend (>80% coverage sur services) | 9 |
| **S11** | 21-22 | Tests vitest frontend + polish UX + Sentry breadcrumbs | 8 |
| **S12** | 23-24 | Recette pilote + corrections + déploiement on-premise + doc utilisateur | 10 |

**Total : 109 j-h ≈ 110 j ouvrables théoriques. Pas de marge.**

---

## 3. Endpoints API (sous `/api/facturation/`)

Tous via `RBACPermission` avec module dédié.

| Méthode | URL | Module RBAC |
|---|---|---|
| GET/PUT | `/config/{id}/` | `factu_config` |
| CRUD | `/grilles/` + `/grilles/all/` | `factu_grille` |
| GET | `/echeanciers/`, `/echeanciers/{id}/` | `factu_echeancier` |
| POST | `/echeanciers/{id}/regenerer/` | `factu_echeancier` |
| CRUD | `/remises/` | `factu_remise` |
| GET/POST | `/encaissements/`, `/encaissements/{id}/` | `factu_encaissement` |
| POST | `/encaissements/{id}/annuler/` | `factu_encaissement` |
| GET | `/encaissements/{id}/quittance/` | `factu_encaissement` |
| GET | `/blocages/`, `/blocages/{id}/lever/` | `factu_echeancier` |
| GET | `/rapports/{arrieres\|recouvrement\|journal\|creances}/` | `factu_rapport` |
| GET | `/rapports/{type}/export/` | `factu_rapport` (action `exporter`) |
| GET | `/feature-flag/` | (ouvert authentifié) — pour boot frontend |

---

## 4. Pages frontend `app/dashboard/facturation/`

| Page | Rôle |
|---|---|
| `page.tsx` (index) | Dashboard KPI cards |
| `config/page.tsx` | Admin — activation + seuils |
| `grilles/page.tsx` + `[id]/` | CRUD grilles tarifaires |
| `etudiants/page.tsx` + `[id]/` | Liste échéanciers + fiche étudiant complète |
| `encaissements/page.tsx` | Journal du jour |
| `encaissements/saisir/page.tsx` | **Page caissier** (recherche + saisie rapide) |
| `encaissements/[id]/page.tsx` | Détail + lien quittance |
| `remises/page.tsx` | Liste remises actives |
| `blocages/page.tsx` | Liste blocages + levée |
| `rapports/{arrieres,recouvrement,journal,creances}/page.tsx` | 4 rapports |

---

## 5. Activation par institution

### Backend
- `ParametreFacturation.actif` est le **flag maître**
- Helper `core/facturation_checks.py` :
  - `facturation_active(institution=None) -> bool`
  - `get_parametre_facturation(institution=None) -> ParametreFacturation | None`
- Chaque ViewSet du module appelle ce helper dans `get_queryset()` et renvoie `qs.none()` si `actif=False`
- Endpoint `GET /api/facturation/feature-flag/` (ouvert authentifié) consommé au boot frontend

### Frontend
- Hook `useFacturationActive()` dans `lib/api/facturation-hooks.ts` (staleTime 1h)
- `lib/nav-config.ts` : nouvelle propriété `featureFlag?: 'facturation'` sur les groupes
- `lib/nav-filter.ts` : étendre `canSee()` pour consulter le flag

### Polytechnique reste intacte
- `actif=False` → aucune route facturation accessible, aucun menu visible, aucun signal déclenché
- Les inscriptions continuent d'utiliser `montant_frais`/`est_payee`/`recu_paiement` existants
- En mode facturation activée : le service met à jour `montant_frais = echeancier.montant_net` et `est_payee = (solde == 0)` pour rétro-compat des pages existantes

---

## 6. Intégrations

### 6.1 Création échéancier auto
Signal `post_save InscriptionAdministrative` (avec `if created`) → `EcheancierService.creer_echeancier_pour_inscription(instance)`. Idempotent (`get_or_create`). Si pas de grille → log warning, ne pas planter l'inscription.

### 6.2 Blocages 4 niveaux — points d'insertion

| Niveau | Fichier à modifier | Comportement |
|---|---|---|
| **ALERTE** | Frontend uniquement (bannière) | Affichage |
| **NOTES** | `apps/evaluations/views.py` (notes) + `apps/portail/views.py` (portail étudiant) | 403 |
| **EXAMENS** | `apps/inscriptions/views.py` (création InscriptionPedagogique) | Refus inscription semestre |
| **COURS** | `apps/absence/views.py` (présence) ou `apps/portail/views.py` | Bloque accès |

Helper `@require_no_blocage(level='NOTES')` décorateur réutilisable.

### 6.3 Quittance PDF
Dans `apps/facturation/` (pas dans `apps/documents/`) pour autonomie modulaire. Réutilise `core/pdf_utils.py` + pattern `NumeroSerieConfig` (cf. `apps/documents/models.py:18-50`).

### 6.4 Notifications
Création de blocage → notification in-app via `apps/notifications`. Relance J-3 échéance via commande management `python manage.py envoyer_relances_facturation` (cron OS on-premise).

### 6.5 Audit trail
- ViewSets héritent `AuditMixin` (`core/mixins.py:9`) → log INFO automatique
- Annulation encaissement : log explicite dans `AuditLog` (DB) via helper

---

## 7. Tests

### Backend pytest
- `test_echeancier_service.py` : génération trimestriel/mensuel, idempotence, ne crée pas si `actif=False`
- `test_encaissement_flow.py` : répartition auto, multiple échéances, annulation, race conditions (`select_for_update`)
- `test_blocages.py` : seuils, levée, recalcul après paiement
- `test_remises.py` : somme % ≤ 100, désactivation
- `test_rapports.py` : agrégats + cache + filtres
- `test_quittance_pdf.py` : numérotation thread-safe, QR code
- `test_rbac.py` : 6 modules × 3 rôles
- `test_institution_scoping.py` : 2 institutions ne se voient pas

**Cible** : coverage > 80% sur `apps/facturation/services/`

### Frontend vitest
- `useFacturationActive()` : false par défaut, true après config
- Saisie encaissement : validation montant, somme affectations
- Filtres rapports : invalidation cache à changement
- Affichage conditionnel menu selon flag

---

## 8. Risques & checkpoint pilote

### Risques techniques

| Risque | Mitigation |
|---|---|
| Double-encaissement (clic double) | Idempotency-key + bouton désactivé front |
| wkhtmltopdf instable on-premise | Pas d'async, fallback à la demande, log Sentry |
| Cron blocages non fiable on-premise | Recalcul aussi à chaque encaissement |
| Concurrence numérotation reçu | `F()` expression (pattern `NumeroSerieConfig`) |
| Race condition affectation/remise | `select_for_update` dans service |
| Volumétrie rapports | Index DB + cache 5min + pagination |

### Points à valider avec le pilote (avant Sprint 5)

1. **Format quittance** : disposition, mentions légales mauritaniennes, FR-only ou bilingue FR/AR, signature électronique ?
2. **Nombre d'échéances mensuelles** : 8, 9 ou 10 ?
3. **% min pour valider inscription** : faut-il un paiement initial obligatoire ?
4. **Changement de filière en cours d'année** : crédit du déjà-payé ? Remboursement ?
5. **Paiement en avance** : affectation aux échéances futures dans l'ordre ?
6. **Mobile money** : juste saisie référence ou intégration consultative API ?

### ⚠ CHECKPOINT SPRINT 4 (semaine 8)

Si **aucun pilote privé n'est signé/LOI** à la fin du Sprint 4 :
- **Stop dev technique** — architecture S1-S4 (modèles + grilles + échéancier + remises) reste utilisable
- Reprise quand pilote identifié, points 1-6 ci-dessus à clarifier avant S5
- Alternative à arbitrer alors : démo commercial (S5-S6 condensés pour pitch) vs pause complète

Cette décision n'est pas prise aujourd'hui — à trancher au moment du checkpoint avec le contexte commercial réel.

---

## 9. Definition of Done MVP

Conditions cumulatives pour livrer :

1. Migrations 0001/0002/0003 passent sur MySQL `gesafped26` sans erreur
2. `ParametreFacturation.actif=False` Polytechnique → **comportement existant inchangé** (test régression sur inscription + paiement legacy)
3. 1 institution test : activation OK, grille 4 filières × 3 niveaux saisie
4. Création inscription → échéancier généré automatiquement (trimestriel ET mensuel testés)
5. Remise % visible et impactant le `montant_net`
6. Saisie encaissement (espèces + Bankily + virement + chèque) → solde MAJ + quittance PDF téléchargeable
7. Annulation encaissement avec motif → solde reverse correctement
8. Blocages ALERTE/NOTES/EXAMENS/COURS effectifs aux 4 points d'insertion
9. 4 rapports avec filtres + export CSV et Excel
10. RBAC : 6 modules `factu_*` testés pour admin/scolarite/comptable
11. Tests pytest > 80% sur services
12. Tests vitest sur hooks et composants critiques
13. Sentry capture backend + frontend en prod
14. Documentation utilisateur PDF disponible (manuel caissier ≥ 10 pages)
15. Recette pilote validée par écrit
16. Déploiement on-premise + premier encaissement réel saisi

---

## 10. Critical files

### Fichiers à créer
- `siga/apps/facturation/` (nouvelle app entière) : `models.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `apps.py`, `signals.py`
- `siga/apps/facturation/services/` : `echeancier_service.py`, `encaissement_service.py`, `blocage_service.py`, `quittance_service.py`, `relance_service.py`, `rapport_service.py`
- `siga/apps/facturation/migrations/` : `0001_initial.py`, `0002_seed_rbac_modules.py`, `0003_init_parametres_institutions.py`
- `siga/apps/facturation/management/commands/` : `setup_facturation_institution.py`, `recalculer_blocages_facturation.py`, `envoyer_relances_facturation.py`
- `siga/apps/facturation/templates/facturation/quittance.html`
- `siga/apps/facturation/tests/` : 7 fichiers test_*
- `siga/core/facturation_checks.py` (helper feature-flag + décorateur `@require_no_blocage`)
- `gesafped_frontend/lib/api/facturation.ts`
- `gesafped_frontend/lib/api/facturation-hooks.ts`
- `gesafped_frontend/app/dashboard/facturation/` (15 pages — cf. §4)

### Fichiers existants à modifier (intégration)
- [siga/siga/settings/base.py](c:/react_projects/GES/siga/siga/settings/base.py) — ajouter `'apps.facturation'` dans `INSTALLED_APPS`
- [siga/siga/urls.py](c:/react_projects/GES/siga/siga/urls.py) — include `apps.facturation.urls`
- [siga/apps/inscriptions/models.py](c:/react_projects/GES/siga/apps/inscriptions/models.py) — aucun changement de schéma ; signal connecté via `apps/facturation/signals.py`
- [siga/apps/evaluations/views.py](c:/react_projects/GES/siga/apps/evaluations/views.py) — décorateur `@require_no_blocage('NOTES')` sur viewsets sensibles
- [siga/apps/inscriptions/views.py](c:/react_projects/GES/siga/apps/inscriptions/views.py) — `@require_no_blocage('EXAMENS')` sur création InscriptionPedagogique
- [siga/apps/absence/views.py](c:/react_projects/GES/siga/apps/absence/views.py) — `@require_no_blocage('COURS')` sur PresenceViewSet
- [siga/apps/portail/views.py](c:/react_projects/GES/siga/apps/portail/views.py) — checks notes/cours pour portail étudiant
- [gesafped_frontend/lib/nav-config.ts](lib/nav-config.ts) — ajout groupe `facturation` avec `featureFlag: 'facturation'`
- [gesafped_frontend/lib/nav-filter.ts](lib/nav-filter.ts) — `canSee()` consulte le flag

### Patterns à réutiliser (existants)
- [siga/core/mixins.py:9](c:/react_projects/GES/siga/core/mixins.py#L9) — `AuditMixin`
- [siga/core/mixins.py:31](c:/react_projects/GES/siga/core/mixins.py#L31) — `SelectAllMixin`
- [siga/core/mixins.py:44](c:/react_projects/GES/siga/core/mixins.py#L44) — `InstitutionScopedMixin`
- [siga/core/permissions.py:24](c:/react_projects/GES/siga/core/permissions.py#L24) — `RBACPermission`
- [siga/apps/documents/models.py](c:/react_projects/GES/siga/apps/documents/models.py) — pattern `NumeroSerieConfig` thread-safe pour numérotation reçus
- [gesafped_frontend/lib/api/_template-hooks.ts](lib/api/_template-hooks.ts) — squelette canonique factory queryKey

---

## 11. Verification end-to-end

Tests manuels à exécuter au Sprint 12 pour valider la DoD :

### Test régression Polytechnique (CRITIQUE)
```bash
# Avec ParametreFacturation.actif=False
1. Créer une nouvelle InscriptionAdministrative pour étudiant Polytechnique
2. Vérifier : aucun EcheancierEtudiant créé, aucun signal facturation déclenché
3. Saisir paiement via l'UI existante /dashboard/inscriptions/administratives/[id]
4. Vérifier : montant_frais/est_payee/date_paiement/recu_paiement mis à jour comme avant
5. Vérifier : menu facturation absent du sidebar
```

### Test bout-en-bout facturation activée
```bash
# Sur institution test avec actif=True
1. Saisir grille tarifaire : Master Info N1 = 360 000 MRU mensuel 9 échéances
2. Créer inscription étudiant Master Info N1
3. Vérifier : echeancier créé, 9 échéances de 40 000 MRU dates oct→juin
4. Accorder remise 20% bourse mérite → montant_net = 288 000 MRU
5. Saisir encaissement 100 000 MRU espèces → affecté T1 + T2 + partiel T3
6. Télécharger quittance PDF → numéro RC-00001, QR code OK
7. Avancer date système à J+35 → blocage NOTES s'active
8. Connexion étudiant → tentative consultation notes → 403 attendu
9. Saisir encaissement de solde → blocage levé automatiquement
10. Lancer rapport arriérés / recouvrement / journal / créances → données cohérentes
11. Export Excel → fichier ouvrable Microsoft Office
```

### Validation RBAC
```bash
1. Créer 3 utilisateurs : admin / scolarite / comptable
2. Toggle permissions par module dans matrice RBAC
3. Vérifier 403 sur endpoints non autorisés
4. Vérifier menu filtré côté frontend
```

### Tests automatisés
```bash
cd c:/react_projects/GES/siga
pytest apps/facturation/ --cov=apps.facturation --cov-report=term-missing
# Cible : coverage > 80% sur services/

cd c:/react_projects/GES/gesafped_frontend
npm test -- facturation
npx tsc --noEmit  # doit rester à 0 erreur
```

### Validation déploiement on-premise
```bash
1. Backup MySQL avant migration
2. Déploiement : migrations + collectstatic + restart Gunicorn + nginx reload
3. Vérification fonctionnelle : login admin école, activation module, saisie 1 grille + 1 inscription + 1 encaissement
4. Vérification Sentry : event de test envoyé reçu
5. Vérification cron : commande `recalculer_blocages_facturation` planifiée
```

---

## 12. Choix architecturaux validés (récap)

| # | Choix | Décision |
|---|---|---|
| 1 | Flag activation | Table dédiée `ParametreFacturation` |
| 2 | Lien encaissement ↔ échéance | Table `AffectationEncaissement` N-N |
| 3 | Numérotation reçus | Continue `RC-00001` (pas de reset annuel) |
| 4 | Quittance PDF | Dans `apps/facturation/`, pas `apps/documents/` |
| 5 | BlocageEtudiant | Matérialisé (table) + recalcul cron + post-encaissement |
| 6 | Pénalités | **OUT MVP** — pas de modèle préparé (YAGNI) |
| 7 | Online payment | OUT MVP — saisie manuelle uniquement |
| 8 | Migration Polytechnique | Aucune — rétro-compat via champs existants |
| 9 | Pilote stop Sprint 4 | À arbitrer au checkpoint, pas maintenant |
