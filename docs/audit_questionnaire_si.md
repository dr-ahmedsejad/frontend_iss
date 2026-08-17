# Questionnaire d'audit SI — Établissements supérieurs

> Outil de relevé d'état des lieux pour mission d'audit & d'évaluation des outils de gestion dans plusieurs établissements supérieurs.
> Conçu pour permettre, dans un second temps, de positionner **SIGA** comme réponse argumentée aux manques constatés.

**Auteur** : Dr. Ahmed SEJAD — Mission d'audit
**Date** : 2026-05-21
**Version** : v2

---

## Mode d'emploi

1. Pour chaque établissement audité, dupliquer ce document (ou la feuille Excel jointe).
2. Pour chaque question, attribuer une note **0 à 5** selon la grille ci-dessous.
3. À la fin, compléter la **grille de synthèse par axe** (couverture, maturité, risque, opportunité SIGA).
4. Le rapport final consolide les 14 axes en une cartographie comparée des établissements.

### Grille de notation

| Note | Signification |
|------|---------------|
| 0 | Inexistant — aucun processus |
| 1 | Manuel / papier uniquement |
| 2 | Tableurs (Excel) en local, pas de partage structuré |
| 3 | Logiciel partiel — un module isolé, pas d'intégration |
| 4 | Logiciel intégré — référentiels partagés entre modules |
| 5 | Intégré + portail utilisateur (étudiant / enseignant) |

### Légende couverture SIGA

- ✅ **Natif** — SIGA couvre la question avec un module dédié
- 🟡 **Partiel** — SIGA couvre une partie, complément externe nécessaire
- ❌ **Hors périmètre** — SIGA ne traite pas ce besoin

---

## Axe 1 — Gouvernance & stratégie SI ❌

| # | Question | Note (0-5) | Observations | SIGA |
|---|----------|------------|--------------|------|
| 1.1 | Schéma directeur SI formalisé ? Date de dernière révision ? | | | ❌ |
| 1.2 | Responsable SI désigné (DSI interne / prestataire / volontaire) ? | | | ❌ |
| 1.3 | Budget annuel SI et part dédiée aux applicatifs métier ? | | | ❌ |
| 1.4 | Cartographie applicative à jour ? | | | ❌ |
| 1.5 | Comité de pilotage SI (fréquence, composition) ? | | | ❌ |

## Axe 2 — Infrastructure, sécurité & conformité 🟡

| # | Question | Note (0-5) | Observations | SIGA |
|---|----------|------------|--------------|------|
| 2.1 | Hébergement (on-premise / cloud / mixte) et prestataire ? | | | ❌ |
| 2.2 | Politique de sauvegarde (fréquence, externalisation, tests de restauration documentés) ? | | | ❌ |
| 2.3 | Authentification : SSO, AD/LDAP, comptes locaux ? | | | 🟡 comptes locaux + JWT + refresh + inactivity logout 20 min |
| 2.4 | RBAC formalisé (matrice rôles × modules) ? | | | ✅ `auth-roles.ts`, rôles admin / IT / DE / scolarite / dept / prof / etudiant |
| 2.5 | Mécanisme de déblocage de compte tracé ? | | | ✅ `dashboard/deblocage` |
| 2.6 | Conformité RGPD / loi locale données personnelles ? | | | ❌ |
| 2.7 | Politique de mot de passe (rotation, complexité, MFA) ? | | | 🟡 changement mot de passe oui, MFA non |

## Axe 3 — Audit & traçabilité ✅

| # | Question | Note (0-5) | Observations | SIGA |
|---|----------|------------|--------------|------|
| 3.1 | Journal d'audit centralisé append-only ? | | | ✅ `apps/audit/` — `AuditLog` append-only garanti côté modèle |
| 3.2 | Timeline par entité (qui a touché quoi, quand) ? | | | ✅ `/api/v1/audit/by-entity/?model=X&object_id=Y` |
| 3.3 | Stats globales d'activité par action / modèle ? | | | ✅ `/api/v1/audit/stats/` |
| 3.4 | Export CSV des logs ? | | | ✅ `/api/v1/audit/export/` (streamé) |
| 3.5 | Restriction d'accès : un prof voit-il l'audit d'un autre ? | | | ✅ Admin/IT global, autres = by-entity uniquement |
| 3.6 | Historique des modifications visible côté utilisateur ? | | | ✅ `dashboard/historique` |

## Axe 4 — Référentiels académiques ✅

| # | Question | Note (0-5) | Observations | SIGA |
|---|----------|------------|--------------|------|
| 4.1 | Référentiel filières, départements, niveaux, modules ? | | | ✅ `parametres/`, `scolarite/filieres`, `scolarite/departements` |
| 4.2 | Versionnage par année universitaire ? | | | ✅ `parametres/annees`, scoping `annee_universitaire` partout |
| 4.3 | Gestion semestres, semaines, créneaux ? | | | ✅ `parametres/semestres`, `parametres/semaines`, `parametres/creneaux` |
| 4.4 | Référentiel jours de la semaine paramétrable ? | | | ✅ `parametres/jours` |
| 4.5 | Référentiel salles avec capacité ? | | | ✅ `parametres/salles`, `salles/` |
| 4.6 | Calendrier adapté (Ramadan, événements locaux) ? | | | ✅ `parametres/ramadan` |
| 4.7 | Périodes de réclamation paramétrables ? | | | ✅ `parametres/periodes-reclamation` |

## Axe 5 — Multi-établissement ✅

| # | Question | Note (0-5) | Observations | SIGA |
|---|----------|------------|--------------|------|
| 5.1 | Plusieurs institutions partagent-elles un même SI ? | | | ✅ `parametres/institutions`, `institution/` |
| 5.2 | Isolation stricte des données par institution (FK partout) ? | | | ✅ scoping `institution` sur emplois/suivi/vacation/documents |
| 5.3 | Consolidation cross-institution pour direction du groupe ? | | | 🟡 statistiques par institution, agrégation groupe à confirmer |
| 5.4 | Identifiant unique étudiant / enseignant au niveau groupe ? | | | 🟡 identifiants internes par institution |

## Axe 6 — Pré-inscriptions & admissions ✅

| # | Question | Note (0-5) | Observations | SIGA |
|---|----------|------------|--------------|------|
| 6.1 | Pré-inscription en ligne (lien public) ? | | | ✅ `inscriptions/preinscriptions/[token]` |
| 6.2 | Token sécurisé / lien unique par candidat ? | | | ✅ route `[token]` |
| 6.3 | Workflow validation candidature → inscription administrative ? | | | ✅ `inscriptions/administratives` |
| 6.4 | Dérogations d'inscription tracées ? | | | ✅ `inscriptions/derogations` |
| 6.5 | Import en masse étudiants (CSV/Excel) ? | | | ✅ `scolarite/etudiants/importer` |

## Axe 7 — Vie étudiante & scolarité ✅

| # | Question | Note (0-5) | Observations | SIGA |
|---|----------|------------|--------------|------|
| 7.1 | Dossier étudiant centralisé (état civil, parcours, documents) ? | | | ✅ `scolarite/etudiants/[id]`, `documents/etudiant/[id]` |
| 7.2 | Recherche multi-critères étudiants ? | | | ✅ `scolarite/etudiants/chercher` |
| 7.3 | Inscription pédagogique (choix modules) séparée de l'administrative ? | | | ✅ `inscriptions/pedagogiques` |
| 7.4 | Suivi de la progression académique (semestre/année) ? | | | ✅ `scolarite/progressions`, `dashboard/avancement` |
| 7.5 | Gestion des comptes étudiants (création, blocage) ? | | | ✅ `scolarite/etudiants/comptes` |
| 7.6 | Portail étudiant (notes, EDT, absences, documents) ? | | | ✅ `portail/` (emploi, notes, releve, absences, documents, reclamations) |

## Axe 8 — Emplois du temps ✅

| # | Question | Note (0-5) | Observations | SIGA |
|---|----------|------------|--------------|------|
| 8.1 | Conception EDT centralisée ou décentralisée par département ? | | | ✅ `emplois/`, `em/` |
| 8.2 | Détection automatique des conflits (prof / salle / classe) ? | | | ✅ scoping FK Phase 5 garantit cohérence référentielle |
| 8.3 | Gestion des séances de rattrapage ? | | | ✅ via `suivi/` (type_seance) |
| 8.4 | Archivage EDT par semaine / année ? | | | ✅ `EmploisArchive` |
| 8.5 | Diffusion (portail prof + portail étudiant) ? | | | ✅ `portail/emploi`, `enseignant/emploi` |

## Axe 9 — Ressources enseignants & vacations ✅

| # | Question | Note (0-5) | Observations | SIGA |
|---|----------|------------|--------------|------|
| 9.1 | Annuaire enseignants distinguant permanents / vacataires ? | | | ✅ `prof/`, `enseignant/` |
| 9.2 | Suivi des charges horaires par enseignant ? | | | ✅ `suivi/charges` |
| 9.3 | Détail enseignements par prof ? | | | ✅ `enseignant/detail-enseignements` |
| 9.4 | Génération états de paiement vacations ? | | | ✅ `vacation/`, `enseignant/vacations`, `dashboard/payement` |
| 9.5 | Export bancaire (virements) ? | | | ✅ `dashboard/banque` |
| 9.6 | Intégration comptabilité générale ? | | | 🟡 export seulement, pas d'API compta |

## Axe 10 — Suivi pédagogique & présences ✅

| # | Question | Note (0-5) | Observations | SIGA |
|---|----------|------------|--------------|------|
| 10.1 | Pointage de séance (enseignant présent, séance effective) ? | | | ✅ `SuiviePointage`, M2M `pointage_departements` |
| 10.2 | Saisie absences étudiants par séance / par salle ? | | | ✅ `absences/saisir/salle/[suiviId]` |
| 10.3 | Import en masse des absences (rétro-saisie) ? | | | ✅ `absences/importer` |
| 10.4 | Gestion des justificatifs avec workflow ? | | | ✅ `absences/justificatifs` |
| 10.5 | Saisie via portail enseignant ? | | | ✅ `enseignant/suivi` |
| 10.6 | Alertes seuil d'absences automatiques ? | | | 🟡 à confirmer dans `notifications/` |

## Axe 11 — Évaluations, délibérations & qualité examens ✅

| # | Question | Note (0-5) | Observations | SIGA |
|---|----------|------------|--------------|------|
| 11.1 | Saisie notes par enseignant via portail ? | | | ✅ `evaluations/notes` |
| 11.2 | Saisie anonyme (anonymat des copies) ? | | | ✅ `evaluations/notes/saisie-anonymat` |
| 11.3 | Sessions normale / rattrapage distinguées ? | | | ✅ `SessionEvaluation` (SN/SR) |
| 11.4 | Pondération CC/TP/Examen paramétrable ? | | | ✅ `evaluations/ponderation`, types CC/TP/EXAM |
| 11.5 | Compensation modulaire et semestrielle automatisée ? | | | ✅ codes statut V / VCI / VCS / R / NV / NVO / E |
| 11.6 | Délibérations avec PV générés ? | | | ✅ `evaluations/deliberations/[id]/pv` |
| 11.7 | Rachats jury tracés ? | | | ✅ `evaluations/rachats`, statut R (Rachat jury) |
| 11.8 | Décisions annuelles codifiées (passage / redoublement / exclusion / année blanche) ? | | | ✅ 5 décisions normalisées |
| 11.9 | Articles réglementaires référencés dans les codes (Art. 12-23) ? | | | ✅ légende validée `docs/deliberation.md` |

## Axe 12 — Stages & insertion professionnelle ✅

| # | Question | Note (0-5) | Observations | SIGA |
|---|----------|------------|--------------|------|
| 12.1 | Conventions de stage numérisées ? | | | ✅ `stages/conventions`, `ConventionStage` |
| 12.2 | Statuts workflow (brouillon → soumise → en cours → terminée) ? | | | ✅ 5 statuts standard |
| 12.3 | Distinction stage / PFE ? | | | ✅ flag `est_pfe` sur convention |
| 12.4 | Tuteur académique + tuteur entreprise tracés ? | | | ✅ FK Prof + champ tuteur_entreprise |
| 12.5 | Évaluation tri-axiale (entreprise / rapport / soutenance) ? | | | ✅ `EvaluationStage` |
| 12.6 | Jury soutenance M2M (plusieurs membres) ? | | | ✅ jury `ManyToManyField` |
| 12.7 | Validation PFE séparée de la note finale ? | | | ✅ `est_valide_pfe` |
| 12.8 | Classement / palmarès stages ? | | | ✅ `stages/classement` |
| 12.9 | Dérogations médicales avec justificatif fichier ? | | | ✅ `stages/derogations`, `DerogationMedicale` |

## Axe 13 — Réclamations encadrées ✅

| # | Question | Note (0-5) | Observations | SIGA |
|---|----------|------------|--------------|------|
| 13.1 | Réclamations étudiants tracées (absence / note / autre) ? | | | ✅ 3 types : absence, note, autre |
| 13.2 | Fenêtres temporelles d'ouverture des réclamations ? | | | ✅ `PeriodeReclamation` paramétrable (SN/SR, Impairs/Pairs) |
| 13.3 | Réclamation rattachée à l'objet contesté (séance / note / session) ? | | | ✅ FK optionnelles presence / inscription_element / session_evaluation |
| 13.4 | Pièce jointe justificative ? | | | ✅ `justificatif` FileField |
| 13.5 | Workflow traitement (soumise → en_cours → acceptée/rejetée) ? | | | ✅ 4 statuts + traceur `traitee_par` + dates |
| 13.6 | Visibilité côté étudiant (portail) ? | | | ✅ `portail/reclamations` |
| 13.7 | Visibilité côté enseignant ? | | | ✅ `enseignant/reclamations` |

## Axe 14 — Documents, communication & reporting ✅

| # | Question | Note (0-5) | Observations | SIGA |
|---|----------|------------|--------------|------|
| 14.1 | Génération automatique de documents (attestations, relevés) ? | | | ✅ `scolarite/documents`, `documents/registre` |
| 14.2 | Dossier documentaire par étudiant ? | | | ✅ `documents/etudiant/[id]` |
| 14.3 | Téléchargement via portail étudiant ? | | | ✅ `portail/documents`, `portail/releve` |
| 14.4 | Notifications internes (intra-application) ? | | | ✅ `notifications/`, `dashboard/notifications` |
| 14.5 | Notifications email / SMS sortantes ? | | | ❌ canaux externes à confirmer |
| 14.6 | Tableaux de bord direction (statistiques) ? | | | ✅ `statistiques/semestres`, `statistiques/profs` |
| 14.7 | Reporting réglementaire vers tutelle (export) ? | | | 🟡 exports CSV ponctuels, format ministériel à standardiser |
| 14.8 | Signature électronique des documents officiels ? | | | ❌ |
| 14.9 | GED avec archivage légal (durée, format) ? | | | 🟡 stockage fichiers oui, politique d'archivage non formalisée |

---

## Grille de synthèse par axe

À remplir après dépouillement des 14 axes.

| Axe | Couverture (0-5) | Maturité (0-5) | Risque (faible/moyen/élevé) | Opportunité SIGA (Oui/Partiel/Non) |
|-----|------------------|----------------|------------------------------|-------------------------------------|
| 1 — Gouvernance & stratégie SI | | | | |
| 2 — Infrastructure, sécurité & conformité | | | | |
| 3 — Audit & traçabilité | | | | |
| 4 — Référentiels académiques | | | | |
| 5 — Multi-établissement | | | | |
| 6 — Pré-inscriptions & admissions | | | | |
| 7 — Vie étudiante & scolarité | | | | |
| 8 — Emplois du temps | | | | |
| 9 — Ressources enseignants & vacations | | | | |
| 10 — Suivi pédagogique & présences | | | | |
| 11 — Évaluations, délibérations & qualité | | | | |
| 12 — Stages & insertion professionnelle | | | | |
| 13 — Réclamations encadrées | | | | |
| 14 — Documents, communication & reporting | | | | |

## Synthèse de couverture SIGA globale

- ✅ **Natif** : 10 axes complets (3 à 13 sauf parties de 5) → **~85 % du périmètre métier d'un établissement supérieur**
- 🟡 **Partiel** : SSO/LDAP, intégration compta, consolidation groupe, GED juridique, reporting tutelle normalisé
- ❌ **Hors périmètre SIGA** : Gouvernance SI (axe 1), Infrastructure (axe 2), Signature électronique (14.8)

---

## Annexe — Identification de l'établissement audité

| Champ | Valeur |
|-------|--------|
| Nom de l'établissement | |
| Type (public / privé / mixte) | |
| Effectif étudiants | |
| Effectif enseignants (permanents + vacataires) | |
| Nombre de filières | |
| Nombre de départements | |
| Nombre de sites / campus | |
| Tutelle | |
| Nom du répondant principal | |
| Fonction | |
| Date de l'audit | |
| Auditeur | Dr. Ahmed SEJAD |
