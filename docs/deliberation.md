# Délibération Semestrielle et Annuelle — Conception selon l'Arrêté 562

## Contexte

Document de conception des **procès-verbaux (PV) de délibération** conformément à l'Arrêté n°562/MESRSTIC
du 09 juillet 2019 fixant le régime spécifique de la Licence Professionnelle LMD.
Objectif : définir précisément ce que doivent contenir les deux PV signés par le jury
(PV semestriel + PV annuel de progression), en incluant **les types de compensation**,
les seuils réglementaires, les décisions possibles et toutes les mentions obligatoires.

Ce document sert de cahier des charges pour aligner le backend SIGA
([apps/evaluations](../../../../react_projects/GES/siga/apps/evaluations))
et le frontend GesAFPED
([app/dashboard/evaluations/deliberations](../app/dashboard/evaluations/deliberations))
sur les exigences réglementaires.

---

## 1. Diagnostic — écart entre l'existant et l'Arrêté 562

### 1.1 Hiérarchie de validation imposée par l'arrêté

L'arrêté définit **quatre niveaux** successifs de validation, chacun avec sa propre règle
de compensation :

| Niveau | Règle de validation | Type de compensation | Articles |
|---|---|---|---|
| **Élément de module** | moyenne ≥ 10/20 | Entre notes CC / TP / Examen (moyenne pondérée) | Art. 12 |
| **Module** | moyenne ≥ 10/20 **ET** aucun élément < 6/20 (éliminatoire) | Entre éléments du **même module** (toujours) | Art. 13 |
| **Semestre** | moyenne ≥ 10/20 **ET** toutes moyennes modules ≥ 8/20 **ET** aucun élément éliminatoire < 6/20 | Entre modules du **même semestre** (toujours) | Art. 14-15 |
| **Année** | ≥ 65 % des crédits capitalisés (39/60) + contraintes S1/S2 pour passage en L3 | Pas de compensation — décision du jury | Art. 20 |

### 1.2 Problèmes du modèle backend actuel

Analyse de [apps/evaluations/models.py](../../../../react_projects/GES/siga/apps/evaluations/models.py)
et [services/deliberation.py](../../../../react_projects/GES/siga/apps/evaluations/services/deliberation.py) :

1. **Absence de `ResultatModule`** — le code calcule `ResultatElement` puis saute directement
   à `ResultatSemestre`. L'arrêté impose pourtant une validation **explicite au niveau module**
   (Art. 13) avec règle d'éliminatoire propre. **Chaînon manquant critique.**

2. **PV mono-niveau mal défini** — le modèle `PVDeliberation` est unique, indexé par
   `(session, filiere, niveau)`. Mais :
   - `LigneDeliberation` stocke `moyenne_annuelle` + `credits_annuels` → c'est donc un **PV annuel**.
   - Or l'Art. 15-17 exige un PV **semestriel** préalable (validation / rattrapage).
   - **Le système confond aujourd'hui semestre et année.**

3. **Compensation non tracée** — aucun champ ne distingue :
   - « Module validé directement » (tous éléments ≥ 10)
   - « Module validé par compensation intra-module » (Art. 13)
   - « Semestre validé par compensation inter-modules » (Art. 14)
   - « Semestre validé par rachat du jury » (décision exceptionnelle)

4. **Art. 15 partiellement appliqué** — `DeliberationService.calculer_decisions` vérifie moyenne ≥ 10
   mais pas la double contrainte *« toutes moyennes modules ≥ 8 »* (impossible sans `ResultatModule`).

5. **Art. 17 non matérialisé** — la liste des éléments/modules à représenter en rattrapage
   n'est pas générée (obligation pour l'étudiant / facultatif).

6. **PV de progression annuelle manquant** — aucune structure distincte ne calcule :
   - Moyennes S_impair / S_pair après rattrapage
   - Taux de capitalisation (Art. 20 — seuil 65 %)
   - Verrou S5 et verrou L3 (L1 entièrement validée obligatoire)
   - Décision : **Passage / Redoublement / Exclusion** (Art. 21)

7. **Jury non modélisé** — seul `president_jury` (FK simple) existe. L'Art. 24 impose une
   composition à **5 membres** pour le jury de passage/diplôme : chef d'établissement,
   responsable de filière, 2 enseignants permanents, 1 enseignant professionnel.
   → Table `MembreJury` manquante.

8. **Absentéisme** — l'Art. 10 prévoit l'invalidation d'un semestre pour absences répétées.
   Rien ne relie `apps/absence` à la délibération.

---

## 2. Codes de statut d'élément de module (légende validée)

L'arrêté mentionne explicitement **« il y a toujours compensation »** à deux niveaux
(Art. 13 et 14). Plus un niveau exceptionnel (rachat jury). Chaque élément de module (EM)
affiché dans le PV porte l'un des codes suivants — c'est ce qui distingue un **vrai PV
réglementaire** d'un simple tableau de moyennes.

| Code | Couleur | Signification | Déclencheur | Article |
|---|---|---|---|---|
| **V** | 🟢 Vert foncé | EM Validé directement | Moyenne EM ≥ 10 | Art. 12 |
| **VCI** | 🟡 Vert clair | EM Validé par Compensation Interne (module) | EM < 10 mais moyenne module ≥ 10 et EM ≥ 6 | Art. 13 |
| **VCS** | 🟡 Jaune | EM Validé par Compensation Semestrielle | Module entre 8 et 10, moyenne semestre ≥ 10 | Art. 14 |
| **R** | 🔵 Bleu | EM Validé par Rachat jury | Décision exceptionnelle motivée du jury | Jury souverain |
| **NV** | 🟠 Orange | EM Non Validé — rattrapage **facultatif** | Module entre 8 et 10, semestre non validé | Art. 17 al. 3 |
| **NVO** | 🔴 Rouge | EM Non Validé — rattrapage **obligatoire** | Module < 8 (non validé) | Art. 17 al. 2 |
| **E** | 🔴 Rouge foncé | Moyenne Éliminatoire — rattrapage **obligatoire** | Moyenne EM < 6 | Art. 17 al. 1 |

> **Règle NV vs NVO** : la distinction est critique pour la génération automatique des
> convocations de rattrapage. `NVO` et `E` déclenchent une **obligation** ; `NV` laisse
> le choix à l'étudiant.

Chaque `ResultatElement`, `ResultatModule` et `LigneDeliberation` doit porter un champ
`code_statut` avec ces valeurs. Le code `R` impose la création d'un enregistrement
`RachatNote` (immuable, auditée).

---

## 3. PV de délibération semestrielle — structure

### 3.1 En-tête administratif

```
RÉPUBLIQUE ISLAMIQUE DE MAURITANIE
Ministère de l'Enseignement Supérieur, de la Recherche Scientifique
et des Technologies de l'Information et de la Communication
────────────────────────────────────────────────────────────────
[Nom de l'établissement]            [Logo]
Département : ..........            Filière : ..........
Niveau : L1 / L2 / L3               Semestre : S1 / S2 / ... / S6
Année universitaire : 2025-2026     Session : Normale / Rattrapage
────────────────────────────────────────────────────────────────

PROCÈS-VERBAL DE DÉLIBÉRATION SEMESTRIELLE
Référence : Arrêté n°562/MESRSTIC du 09 juillet 2019
PV-SEM-[FILIÈRE]-[NIVEAU]-[SEMESTRE]-[SESSION]-[AAAA]-N°....
```

### 3.2 Cadre réglementaire appliqué (bloc fixe)

Bloc rappelant les **seuils utilisés**, pour transparence juridique :

| Critère | Seuil réglementaire | Seuil appliqué (dérogation jury) |
|---|---|---|
| Validation élément | 10/20 (Art. 12) | `seuil_validation_module` |
| Éliminatoire élément | 6/20 (Art. 13) | `seuil_eliminatoire` |
| Validation module (compensation intra) | 10/20 + aucun élément < 6 (Art. 13) | — |
| Validation semestre (moyenne générale) | 10/20 (Art. 15) | `seuil_validation_semestre` |
| Validation semestre (plancher par module) | 8/20 (Art. 15) | `seuil_compensation` |
| Crédits capitalisés par semestre validé | 30 (Art. 7) | — |

Si le jury déroge (via `ParametreJury`), une **justification** motivée est imprimée.

### 3.3 Tableau principal — une ligne par étudiant

Colonnes **minimales** :

| N° | Matricule | Nom & Prénom | Modules (groupés) | Moyenne sem. | Crédits | Élim. | Mode validation | Décision | Rattrapage |
|---|---|---|---|---|---|---|---|---|---|

Pour chaque **module** du semestre, afficher un sous-bloc :

```
Module « Programmation avancée » (coeff 4, 9 crédits)
┌──────────────────────┬────┬────┬──────┬────────┬───────┬─────────┐
│ Élément              │ CC │ TP │ Exam │ Final  │ Coeff │ Statut  │
├──────────────────────┼────┼────┼──────┼────────┼───────┼─────────┤
│ Algorithmique        │ 12 │ 14 │  8   │  10.40 │   2   │  V      │
│ Structures données   │ 15 │ —  │  7   │   9.80 │   2   │  VCI    │  ← Art. 13
│ Projet encadré       │ —  │ 13 │  —   │  13.00 │   1   │  V      │
└──────────────────────┴────┴────┴──────┴────────┴───────┴─────────┘
Moyenne module : 10.68/20 — Crédits acquis : 9 — Statut module : VCI
```

Puis la **synthèse semestre** :

```
Moyenne générale semestre : 11.25/20
Crédits capitalisés : 30/30
Éliminatoire non rattrapée : aucune
Statut semestre : VCS (Art. 14 — compensation semestrielle inter-modules)
Décision : SEMESTRE VALIDÉ
```

### 3.4 Décisions possibles au niveau semestre

| Décision | Critères | Conséquence |
|---|---|---|
| **Validé** (direct / compensation) | Art. 15 satisfait | +30 crédits capitalisés |
| **Ajourné avec rattrapage** | Moyenne < 10 OU module < 8 OU éliminatoire | Obligatoirement en session de rattrapage pour les éléments concernés (Art. 17) |
| **Validé par rachat du jury** | Décision exceptionnelle motivée | Trace `RachatNote` obligatoire |
| **Invalidé pour absentéisme** | Art. 10 — absences injustifiées répétées | Pas de rattrapage, motif obligatoire |

### 3.5 Annexes obligatoires au PV semestriel

1. **Liste nominative des rattrapages** — pour chaque étudiant ajourné, énumération
   des éléments à repasser, en distinguant :
   - **Obligatoire** : éléments éliminatoires + éléments non validés de modules < 8
   - **Facultatif** : éléments non validés de modules entre 8 et 10

2. **Statistiques** — taux de réussite, moyenne de promotion, distribution des mentions.

3. **Rachats** — table `RachatNote` : ancienne valeur, nouvelle valeur, motif, décideur, date.

4. **Observations individuelles** — champ libre par ligne (ex : « annulation année, Art. 23 »).

### 3.6 Bloc de signature (fin de document)

L'Art. 24 n'impose explicitement un jury à 5 membres que pour le **jury de passage/diplôme**.
Pour la délibération **semestrielle**, la pratique universitaire retient au minimum :

```
────────────────────────────────────────────────────────────────
COMPOSITION DU JURY DE DÉLIBÉRATION SEMESTRIELLE

Président        :  M./Mme ………………………          Signature : ____________
                    (Responsable de filière)

Membres          :  M./Mme ………………………          Signature : ____________
                    (Enseignant permanent)

                    M./Mme ………………………          Signature : ____________
                    (Enseignant permanent)

Secrétaire       :  M./Mme ………………………          Signature : ____________
                    (Service scolarité)

Fait à ……………, le …… / …… / 20……
────────────────────────────────────────────────────────────────
```

Chaque signature déclenche la **clôture irréversible** du PV côté système
(`PVDeliberation.est_clos = True` + horodatage).

---

## 4. PV de délibération annuelle (progression) — structure

Ce PV consolide les **deux semestres** (impair + pair) d'une même année pour prononcer
la décision de **passage / redoublement / exclusion** (Art. 20-21).

### 4.1 En-tête

```
PROCÈS-VERBAL DE DÉLIBÉRATION ANNUELLE — PASSAGE EN ANNÉE SUPÉRIEURE
Référence : Arrêté n°562/MESRSTIC, Articles 20, 21, 22
PV-ANNEE-[FILIÈRE]-[NIVEAU]-[AAAA]-N°....
Filière : ..........    Niveau écoulé : L1 / L2
Année universitaire : 2025-2026
```

### 4.2 Tableau principal

| N° | Matr. | Nom | S_impair (moy / crédits / validé) | S_pair (moy / crédits / validé) | Moy. annuelle | Crédits annuels | Taux capit. | S1+S2 validés ? | Décision | Motif |
|---|---|---|---|---|---|---|---|---|---|---|

Colonnes **spécifiques** à la délibération annuelle :

- **Taux de capitalisation** : `credits_acquis / 60 × 100` — seuil 65 % (Art. 20)
- **Verrou L3** : si niveau écoulé = L2, afficher si **tous les crédits de L1** sont validés
  (Art. 20 dernier alinéa : passage en L3 **conditionné** à la validation complète de L1).
- **Verrou S5** déjà codé dans `calculer_progression_annuelle` — cohérent avec la règle ci-dessus.
- **Mention annuelle** : Très Bien ≥ 16, Bien ≥ 14, Assez Bien ≥ 12, Passable ≥ 10 (usage).

### 4.3 Décisions possibles (Art. 20-21)

| Décision | Critères | Effet administratif |
|---|---|---|
| **Admis (passage de droit)** | ≥ 60 crédits (année complète validée) | Inscription année suivante, L1 entièrement validée requise pour L3 |
| **Admis conditionnel** | 39-59 crédits (≥ 65 %) | Passage autorisé, dettes à traîner |
| **Redoublement autorisé** | < 65 % crédits, moyenne ≥ seuil exclusion | Refaire semestre(s) non validé(s) — **1 seul redoublement par cycle** (Art. 22) |
| **Exclusion** | Moyenne très faible OU 2ᵉ redoublement | Exclu du cycle |
| **Année blanche (Art. 23)** | Absence médicale prolongée documentée | Année non comptée comme redoublement |

### 4.4 Tableau d'obligations en redoublement (Art. 21)

Pour chaque étudiant autorisé à redoubler, lister :

- Modules dont un élément a obtenu une **moyenne éliminatoire** (< 6) → contrôle obligatoire
- Modules non validés dont moyenne < 8 → contrôle obligatoire
- Modules non validés dont moyenne entre 8 et 10 → contrôle **facultatif**

### 4.5 Jury réglementaire (Art. 24) — obligatoire pour PV annuel et diplôme

```
────────────────────────────────────────────────────────────────
JURY DE PASSAGE ET DE DÉLIVRANCE DU DIPLÔME (Art. 24)

1. Chef d'établissement                     M./Mme ……………  Signature : _______
2. Responsable de filière                   M./Mme ……………  Signature : _______
3. Enseignant permanent (filière)           M./Mme ……………  Signature : _______
4. Enseignant permanent (filière)           M./Mme ……………  Signature : _______
5. Enseignant issu du milieu professionnel  M./Mme ……………  Signature : _______

Fait à …………, le …… / …… / 20……
Visa du directeur d'établissement : ____________________
────────────────────────────────────────────────────────────────
```

---

## 5. Modifications nécessaires (synthèse)

### 5.1 Backend SIGA — nouveaux modèles / champs

- `ResultatModule` (manquant) : `inscription_ped`, `module`, `session`, `moyenne`, `credits_valides`,
  `est_valide`, `est_eliminatoire`, `code_statut` (`V` / `VCI` / `R` / `NV` / `NVO` / `E`).
- `ResultatSemestre` : ajouter `code_statut` (`V` / `VCS` / `R` / `NV`).
- `ResultatElement` : ajouter `code_statut` (`V` / `VCI` / `VCS` / `R` / `NV` / `NVO` / `E`).
- `LigneDeliberation` : ajouter `code_statut`, `taux_capitalisation`, `verrou_l3` (bool).
- **Nouveau** `PVSemestriel` distinct de `PVAnnuel` (ou champ discriminant `type_pv`) :
  - `PVSemestriel` : clé `(session, filiere, niveau, semestre)` — pour Art. 15-17.
  - `PVAnnuel` : clé `(annee_univ, filiere, niveau)` — pour Art. 20-21, généré après rattrapages.
- `MembreJury` : FK `pv`, FK `user`, `role` (president / responsable_filiere / enseignant / pro / secretaire),
  `signature_at`, `signature_hash`.
- `ObligationRattrapage` : FK `ligne_deliberation`, FK `inscription_element`, `type` (obligatoire / facultatif), `motif`.

### 5.2 Services métier

- `ResultatModuleService.calculer(inscription_ped, module, session)` — applique Art. 13.
- `NoteCalculService.calculer_semestre` → revoir pour s'appuyer sur `ResultatModule` (Art. 14-15).
- `DeliberationService` à scinder en :
  - `DeliberationSemestreService` (peuple + calcule décisions semestrielles + génère obligations de rattrapage).
  - `DeliberationAnnuelleService` (agrège les 2 PV semestriels validés + applique Art. 20-21).

### 5.3 Génération PDF (pdfkit existant)

Deux templates distincts :
- `pv_semestriel.html` — sections 3.1-3.6 ci-dessus.
- `pv_annuel_progression.html` — sections 4.1-4.5 ci-dessus.

En-têtes et pieds de page identiques, palette `#006633` conforme [docs/skill_design.md](./skill_design.md).

### 5.4 Frontend GesAFPED

- Distinguer les deux flux dans [app/dashboard/evaluations/deliberations](../app/dashboard/evaluations/deliberations) :
  - Onglet « Délibérations semestrielles » (par session)
  - Onglet « Délibérations annuelles (progression) »
- Ajouter écran « Signatures du jury » avec capture séquentielle des 3-5 membres avant clôture.
- Afficher la colonne `mode_validation` dans les tableaux de résultats
  ([app/dashboard/evaluations/deliberations/[id]/page.tsx](../app/dashboard/evaluations/deliberations/%5Bid%5D/page.tsx)).
- Étendre [types/evaluations.ts](../types/evaluations.ts)
  avec `CodeStatutEM` (`'V'|'VCI'|'VCS'|'R'|'NV'|'NVO'|'E'`), `TypePV`, `MembreJury`.
- Afficher les codes avec leur couleur respective dans tous les tableaux de résultats
  (vert foncé V, vert clair VCI, jaune VCS, bleu R, orange NV, rouge NVO, rouge foncé E).

---

## 6. Questions à trancher avant d'implémenter

1. **Jury semestriel** : 3 membres suffisent-ils, ou faut-il appliquer les 5 membres de l'Art. 24
   même aux PV semestriels ? (L'arrêté n'est explicite que pour passage/diplôme.)
2. **Signature** : électronique simple (nom + timestamp + hash) ou export PDF à signer manuellement
   puis ré-import scanné ?
3. **Workflow de clôture** : faut-il un workflow en 2 étapes (validation technique scolarité → signature jury)
   ou une clôture directe après signatures ?
4. **Rétro-compatibilité** : comment migrer les `PVDeliberation` existants ? Les convertir en `PVAnnuel`
   et recréer les PV semestriels manquants depuis `ResultatSemestre` ?

---

## 7. Vérification (après implémentation future)

Pour valider le système de bout en bout :

1. Créer un jeu de données test : 1 filière, 1 niveau, 5 étudiants couvrant les 5 modes
   (DIRECTE / COMP_MODULE / COMP_SEMESTRE / RACHAT / AJOURNE).
2. Lancer `DeliberationSemestreService.calculer_decisions` sur S_impair puis S_pair.
3. Vérifier que `code_statut` est correctement attribué pour chaque étudiant et chaque EM
   (V / VCI / VCS / R / NV / NVO / E selon les cas).
4. Générer le PV semestriel PDF, contrôler visuellement le rendu des 6 sections (§3).
5. Exécuter la session de rattrapage, recalculer, vérifier que l'Art. 18 (max retenu) s'applique.
6. Lancer `DeliberationAnnuelleService` → vérifier décisions de progression et verrou L3.
7. Générer le PV annuel, contrôler verrous S5 et L1-vers-L3.
8. Simuler dérogation via `ParametreJury` avec justification → vérifier impression du bloc.
9. Signer avec 3-5 membres → vérifier que `est_clos` bascule et que l'édition est bloquée
   (`RachatNote.save` déjà immuable).
10. Tests pytest : `test_art12.py`, `test_art13_compensation_module.py`,
    `test_art14_compensation_semestre.py`, `test_art15_eliminatoire.py`,
    `test_art17_rattrapage_obligatoire.py`, `test_art20_progression.py`, `test_art22_redoublement.py`.
