# Conformité réglementaire — Arrêté 562 (LP) & Décret 2018-070 (Ingénieur)

> Audit de conformité du moteur SIGA face aux deux textes de référence,
> réalisé le 2026-06-11 sur la base d'une lecture intégrale des textes
> (versions françaises) et du code source vérifié ligne par ligne.
>
> Textes sources : `C:\react_projects\Scolarite\ARRETE 562 Régime Licence
> Professionnelle LMD version frse.pdf` · `Decret 2018-070 Diplome
> d_ingenieur (1).pdf`.
>
> Voir aussi : [`calcul_notes_saisie_au_pv.md`](calcul_notes_saisie_au_pv.md)
> · [`inscription_processus_pedagogique.md`](inscription_processus_pedagogique.md).

## Verdict global

**SIGA est très largement conforme.** Le moteur de calcul (seuils 6/8/10,
compensations, max SN/SR), la progression (65 %/75 %, verrous, redoublement
unique, année blanche) et la diplomation transcrivent fidèlement les articles.
Un écart de fond a été identifié et **corrigé le 2026-06-11** (voir §Correctifs).

## Matrice — Arrêté 562 (Licence Professionnelle)

| Art. | Exigence | Implémentation SIGA | Verdict |
|---|---|---|---|
| 7 | 30 crédits par semestre | `Semestre.credits` défaut 30 | ✅ |
| 8 | Structure maquettes (3-5 modules/sem., ≤ 3 EM/module, crédits entiers) | **Contrôlé depuis le 2026-06-11** : audit (warnings peupler + `verifier_maquettes`) + blocage API du 4ᵉ élément ; crédits entiers garantis par les types de champs | ✅ après outillage |
| 10 | Assiduité ; absences répétées → invalidation/exclusion | module absences + décision manuelle du jury | △ manuel |
| 12 | EM validé si ≥ 10 ; min. 2 notes ; moyenne pondérée CC + examen | `est_valide = note ≥ 10 et non élim.` ; « 2 notes min. » **contrôlé depuis le 2026-06-11** (warnings au peuplement) ; TP = note à part entière, couvert par l'Art. 17 du Décret (« moyenne pondérée des notes ») — pour LP, à inscrire comme modalité du CC au règlement intérieur (Art. 10) | ✅ |
| 13 | Module : moyenne pondérée des EM ; compensation interne ; validé si ≥ 10 et aucun EM < 6 ; crédits de tous les EM | `calcul_module.py` + code `VCI` | ✅ exact |
| 14 | MGS = moyenne pondérée **des modules** | MGS calculée **sur les EM** — équivalent ssi coeff(module) = Σ coeff(EM). Convention désormais **contrôlée** : warnings au peuplement du PV + `manage.py verifier_maquettes [--fix]` | ✅ après outillage 2026-06-11 |
| 15 | Semestre : MGS ≥ 10 ET tous modules ≥ 8 ET aucun élim. < 6 → 30 crédits | `est_admis` — les 3 conditions littérales | ✅ |
| 16 | Session de rattrapage par semestre (possible fin d'année) | sessions SR par parité, dates libres | ✅ |
| 17 | Rattrapage : élim. → obligatoire ; module < 8 → obligatoire ; module < 10 → facultatif ; validés exclus | `generer_obligations` — les 3 alinéas au mot près | ✅ |
| 18 | Garde la note supérieure SN/rattrapage | `max(me_sn, me_rat)`, CC/TP hérités | ✅ |
| 19 | Poursuite au semestre suivant même non validé | inscription automatique aux 2 semestres | ✅ |
| 20 | Passage ≥ 65 % (39 crédits) ; L3 conditionnée par totalité L1 | `taux ≥ 65` + verrou `credits_L1 < 60` | ✅ |
| 21 | Redoublement/exclusion par jury ; jury peut adapter | décision auto modifiable, `ParametreJury`, `rachat` préservé | ✅ |
| 22 | Un seul redoublement par cycle | `consomme_droit_redoublement` → exclusion au 2ᵉ | ✅ |
| 23 | Année blanche médicale ≠ redoublement | `Derogation annee_blanche` + justificatif obligatoire + droit préservé | ✅ |
| 24 | Composition du jury | — | ⬜ hors périmètre (consigne projet) |
| 25 | Diplôme : 180 crédits **+ moyenne ≥ 12 au S6** | 180 crédits ✅ ; condition S6 **corrigée 2026-06-11** (était non bloquante en LP) | ✅ après correctif |
| 26 | Diplôme sur la base du PV | diplomation après PV annuel clos uniquement | ✅ |

## Matrice — Décret 2018-070 (Ingénieur)

| Art. | Exigence | Implémentation SIGA | Verdict |
|---|---|---|---|
| 12 | 30 crédits/semestre | idem LP | ✅ |
| 13-14 | Structure (3-5 modules ; S6 = 1 module PFE à 3 EM) | **Contrôlé depuis le 2026-06-11** : audit régime-aware (le PFE S6 doit avoir exactement 3 éléments) + blocage API du 4ᵉ élément | ✅ après outillage |
| 16 | PFE : note de validation ≥ 12/20 pour le diplôme | blocage auto au dernier niveau (lit le S6 consolidé depuis le correctif) | ✅ |
| 17-20 | EM/module/semestre : mêmes règles que LP (Art. 12-15) | moteur commun | ✅ (Art. 19 : même réserve MGS que Art. 14 LP) |
| 21 | Rattrapage : **seul l'éliminatoire est obligatoire** ; le reste facultatif | `generer_obligations` **différencié par régime depuis le 2026-06-11** : ING → E obligatoire, NV facultatif (quelle que soit la moyenne du module) ; LP conserve les 3 alinéas de l'Art. 17 | ✅ après correctif |
| 22 | max SN/rattrapage | `max()` | ✅ |
| 23 | Poursuite au semestre suivant | idem LP | ✅ |
| 24 | Passage ≥ **75 %** (45 crédits) | `SEUIL_PROGRESSION = 75` (sous-classe ING) | ✅ |
| 25 | Verrou S5 : 60 crédits S1+S2 | `_calculer_verrou` ING | ✅ |
| 26 | Redoublement ou **réorientation** par jury | réorientation via `ModificationProgressionService` | ✅ |
| 27 | Composition du jury | — | ⬜ hors périmètre |
| 28 | Un seul redoublement | idem LP | ✅ |
| 29 | Dérogation médicale ≠ redoublement | idem LP | ✅ |
| 30 | Diplôme sur PV ; porte la mention | PV clos + `calculer_mention` | ✅ |

Légende : ✅ conforme · ⚠️ écart conditionnel · △ nuance/non contrôlé · ⬜ hors périmètre.

---

## Correctifs appliqués le 2026-06-11

### 1. Blocage diplôme LP (Art. 25, al. 2) — écart de fond corrigé

**Avant** : seule la branche ingénieur (`DeliberationAnnuelleIngenieur`)
bloquait la diplomation si PFE < 12. Un étudiant **LP** avec 60 crédits en L3
était diplômé même avec une moyenne S6 < 12 — contraire à l'Art. 25.

**Après** (`siga/apps/evaluations/services/deliberation_annuelle.py`) :
- la boucle de blocage est factorisée dans la classe de base
  (`_bloquer_admis_sans_note_finale`, message par régime via
  `MSG_BLOCAGE_DIPLOME`) ;
- `DeliberationAnnuelleLicence` surcharge désormais `calculer_decisions()` et
  applique le blocage : un « admis » du dernier niveau (`filiere.niveau_fin`)
  avec S6 < 12 est rebasculé en redoublement avec observation
  `[Auto] Diplôme refusé : moyenne du 6e semestre (stage…) < 12/20 (Art. 25 Arrêté 562)` ;
- le comportement ingénieur est inchangé (délégation au même code partagé).

### 2. Lecture de la note S6 réelle (et non la moyenne annuelle)

**Avant** : `verifier_eligibilite_diplome` testait
`LigneDeliberation.moyenne_annuelle ≥ 12` du PV niveau 3 — c'est-à-dire la
moyenne **S5+S6**, alors que les textes visent le 6ᵉ semestre seul.

**Après** (`siga/apps/evaluations/services/calcul_notes.py`) : la fonction lit
le **`ResultatSemestre` consolidé du S6** (rattrapage clôturé prioritaire,
sinon normale — même règle que partout ailleurs), avec la moyenne annuelle en
dernier recours si aucun résultat S6 n'existe. Nouveau champ `note_s6` dans le
retour pour traçabilité.

### 3. Contrôle de la convention MGS (Art. 14 LP / Art. 19 ING) — ajouté le 2026-06-11

**Problème** : la MGS de SIGA (calculée sur les EM, identique au relevé officiel)
n'égale la « moyenne pondérée des modules » exigée par les textes que si
`coefficient(module) = Σ coefficients(EM)`. Cette convention n'était contrôlée
nulle part (`Module.coefficient` n'est utilisé que dans l'export Excel).

**Implémentation** :
- `siga/apps/evaluations/services/coherence_maquette.py` —
  `verifier_coherence_coefficients(filiere, semestre_code)` détecte les modules
  violant la convention (coefficient EM effectif = même fallback que le moteur :
  `em.coefficient` sinon 1 ; fallback `ElementModule` si pas d'EM).
- **Warnings au peuplement du PV** : `POST /pvs/{id}/peupler/` retourne les
  anomalies de la filière/semestre dans `warnings` (non bloquant, plafonné à 5
  + résumé). Frontend : bandeau ambre « Avertissements du peuplement » sur la
  page délibération + compteur dans le toast.
- **Commande batch** : `python manage.py verifier_maquettes [--filiere X] [--fix]`
  — audit lecture seule, `--fix` aligne `Module.coefficient = Σ coeff EM`.

**Premier audit sur la base réelle (2026-06-11)** : 1 anomalie détectée —
module `LPSTAT15` (LPSTAT, S2) : coefficient déclaré 2.00, somme EM = 3 (3 EM).
→ À corriger par `--fix` après validation métier.

### 4. Rattrapage différencié par régime (Art. 21 Décret 2018-070) — 2026-06-11

**Problème** : SIGA appliquait la règle LP à 3 alinéas (Art. 17 Arrêté 562) aux
deux régimes. Or le Décret ingénieur (Art. 21) ne rend obligatoire **que
l'éliminatoire** ; tout EM non validé d'un module non validé est « peut se
présenter » (facultatif), quelle que soit la moyenne du module.

**Implémentation** (`siga/apps/evaluations/services/deliberation_semestre.py`,
`generer_obligations`) : détection du régime via `pv.filiere.type_diplome` —
- **LP** : E → obligatoire (al. 1) ; NV + module < 8 → obligatoire (al. 2) ;
  NV + module ≥ 8 → facultatif (al. 3) — inchangé ;
- **ING** : E → obligatoire ; NV → facultatif, motifs citant l'Art. 21 du Décret.

Les feuilles de saisie du rattrapage incluent toujours les facultatifs
(le filtre porte sur l'existence d'une obligation, pas son type).

### 5. Contrôle « minimum deux notes » (Art. 12 Arrêté 562 / Art. 17 Décret) — 2026-06-11

**Position TP** : le Décret définit la moyenne d'un EM comme « moyenne pondérée
**des notes** de l'élément » sans restreindre les composantes → le TP est une
note légitime, **aucun changement de formule** (qui aurait d'ailleurs altéré
rétroactivement les notes). Pour la LP, le TP est à assumer comme modalité du
contrôle continu dans le règlement intérieur (Art. 10).

**Ce qui manquait** : le « minimum de deux notes par élément » n'était contrôlé
nulle part. Ajout de `verifier_minimum_deux_notes(session, filiere, semestre_code)`
(`coherence_maquette.py`) : au peuplement d'un PV semestriel (session normale),
signale les EM dont **une seule composante** a été saisie sur toute la cohorte.
Session de rattrapage exclue (seul l'examen y est repassé — Art. 11/16).
Non bloquant, plafonné, affiché dans le bandeau « Avertissements du peuplement ».

### 6. Validateurs de structure des maquettes (Art. 8 LP / Art. 13-14 ING) — 2026-06-11

**Deux couches**, car les règles de cohorte (« 3 à 5 modules par semestre »)
ne peuvent pas être bloquantes pendant une saisie incrémentale :

**Audit non bloquant** — `verifier_structure_maquette(filiere, semestre_code)`
(`coherence_maquette.py`), régime-aware :
- nombre de modules actifs par semestre : LP → 3-5 (S1/S2/S3/S5), **2 en S4**
  (1 enseignement + 1 stage), **1 en S6** (stage) ; ING → 3-5 (S1-S5), 1 en S6 ;
- **3 éléments maximum par module** (EM planification OU ElementModule) ;
- ING S6 : le module PFE doit être décomposé en **exactement 3 éléments** (Art. 14) ;
- crédits entiers : garantis par construction (`IntegerField`).
Les semestres sans aucun module sont ignorés (maquette non commencée).
Branché dans les warnings de `peupler` (plafonné à 6) et dans la commande
`verifier_maquettes` (section « Structure »).

**Blocage à la création (API)** — `ElementModuleSerializer.validate` et
`EMSerializer.validate` refusent l'**ajout** d'un 4ᵉ élément à un module
(création ou rattachement à un autre module). L'édition d'un élément existant
d'un module legacy déjà surchargé reste possible (pas de blocage rétroactif).
**Exception admin** : un utilisateur `is_superuser` ou `role='admin'` peut
dépasser le plafond (helper `user_peut_depasser_max_elements`) ; les autres
rôles (scolarité, DE, enseignant) restent bloqués. Hors requête (shell, import)
le plafond s'applique. Garde-fou *applicatif* (serializer), pas *modèle* :
l'admin Django et les scripts d'import contournent par conception.

**Audit de la base réelle (2026-06-11)** — 2 anomalies de structure :
- `LPSTAT S4` : 3 modules actifs, attendu 2 (Art. 8 — S4 = enseignement + stage) ;
- module `LPSTAT21` (LPSTAT S3) : 4 éléments, maximum 3.
→ Décisions de maquette à arbitrer par l'équipe pédagogique (pas de `--fix`
automatique possible : fusionner/désactiver relève du métier).

### Tests

- `apps/evaluations/test_coherence_maquette.py` : +9 tests structure/blocage
  (bornes par semestre LP, S6 unique, 4 éléments signalés, PFE ING = 3 EM,
  semestre vide ignoré, refus serializer du 4ᵉ EM/élément, update legacy autorisé).
- `tests/test_deliberation_semestre.py` : +3 tests régime (LP NV module < 8 →
  obligatoire ; ING même cas → facultatif ; ING éliminatoire → obligatoire).
- `tests/test_controles_saisie.py` : 5 tests (1 composante → warning,
  CC+EXAM ok, **TP+EXAM = deux notes ok**, rattrapage exclu, EM sans note ignoré).
- `apps/evaluations/test_coherence_maquette.py` : 6 tests (anomalie détectée,
  module cohérent, EM sans coefficient → 1, module vide ignoré, fallback
  ElementModule, formatage/plafonnement des warnings).
- `apps/evaluations/test_eligibilite_diplome.py` : 2 tests ajoutés
  (`test_D_s6_insuffisant_bloque_pfe` : 11,50 → refus + motif ;
  `test_D_s6_suffisant_valide_pfe` : 13,00 → accepté).
- Suite complète relancée : **58 passed, 1 xfailed** (xfail préexistant,
  seuil DNI hors périmètre) — aucune régression sur
  `tests/test_deliberation_annuelle.py` ni `tests/test_calcul_notes.py`.
- Runner : `python -m pytest tests/ apps/evaluations/test_eligibilite_diplome.py`
  (settings `siga.settings.test`, `--no-migrations`).

### Scénario de test manuel (zone sensible — CLAUDE.md)

1. Filière LP, étudiant en L3 avec 60 crédits annuels (S5 et S6 validés) mais
   **moyenne S6 entre 10 et 12** (ex. 11,50).
2. PV annuel niveau 3 → « Peupler + calculer décisions ».
3. **Attendu** : décision = redoublement (pas passage/diplomation), observation
   `[Auto] Diplôme refusé : moyenne du 6e semestre … (Art. 25 Arrêté 562)`.
4. Corriger la note S6 à ≥ 12, recalculer la session paire, « Recalculer tout »
   sur le PV → **attendu** : décision repasse à admis/passage_droit.
5. Contre-épreuve ingénieur : même scénario sur une filière ING → message
   `PFE < 12/20 (Art. 16 Décret 2018-070)` (comportement inchangé).

---

## Points restants (assumés ou à arbitrer)

| # | Sujet | Position recommandée |
|---|---|---|
| 1 | ~~**MGS sur les EM** (Art. 14/19)~~ — **traité le 2026-06-11** : convention contrôlée (warnings peupler + `verifier_maquettes --fix`) | Lancer `verifier_maquettes --fix` après validation métier de l'anomalie LPSTAT15, puis intégrer l'audit au rituel de rentrée. |
| 2 | ~~**Rattrapage ING plus strict**~~ — **traité le 2026-06-11** : `generer_obligations` différencié par régime (Art. 21 Décret pour ING : E obligatoire, NV facultatif) | Rien — informer les scolarités ING que les NV passent en « facultatif ». |
| 3 | ~~**« Minimum 2 notes » par EM** (Art. 12/17)~~ — **contrôlé depuis le 2026-06-11** (warnings au peuplement). **TP** : conforme au Décret (Art. 17 — « moyenne pondérée des notes », sans restriction de composantes) | Pour LP : inscrire le TP comme modalité du contrôle continu au règlement intérieur (Art. 10) — action documentaire, pas de code. |
| 4 | ~~**Contraintes de structure des maquettes**~~ — **traité le 2026-06-11** : audit + blocage API du 4ᵉ élément | Arbitrer les 2 anomalies réelles détectées (`LPSTAT S4` : 3 modules ; `LPSTAT21` : 4 éléments) — décisions de maquette, pas de fix automatique. |
| 5 | **Composition du jury** (Art. 24/27) | Hors périmètre de l'audit, par consigne projet. |
