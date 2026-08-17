# Plan — Enrichissement BD avec années 2023-2024 et 2024-2025 + recréation 2025-2026

## Contexte

Le système SIGA a été démarré en production avec uniquement l'année universitaire **2025-2026**. L'utilisateur souhaite désormais :

1. **Reconstituer rétroactivement** les années 2023-2024 et 2024-2025 (filières, semestres, étudiants, inscriptions, notes, PV, progressions) afin que la chaîne de progression N+1 soit historiquement complète.
2. **Purger** les données opérationnelles actuelles de 2025-2026 (étudiants, inscriptions, notes, sessions, PV, progressions) car les inscriptions actuelles présentent un décalage à corriger — **mais conserver l'objet `Year(2025-2026)`** car les modules `emplois`, `suivi`, `vacation`, `documents` y dépendent (CharField, sans FK).
3. **Recréer** les inscriptions 2025-2026 via le pipeline de progression (depuis le PV annuel 2024-2025 reconstitué) + import des nouveaux entrants.
4. Gérer les **formats de matricule différents** par année :
   - 2023-2024 : 5 chiffres `23{6}{2}` (ex `23603`)
   - 2024-2025 : 5 chiffres `24{6}{2}` (ex `24601`)
   - 2025-2026 : 6 chiffres `25{code_inst}{3}` (ex `255001`)
   - Sauts de numéros tolérés (saisie manuelle dans l'Excel d'import).

L'objectif est de **ne rien casser** sur les modules dépendants de 2025-2026 (emplois, suivi, vacations) et de respecter la chaîne de FK PROTECT/CASCADE existante.

## Environnement technique

- **Base de données : MySQL**. Outils d'exploitation : `mysqldump` / `mysql` (pas `pg_dump` / `pg_restore`). Les DDL ne sont pas transactionnelles — prévoir une stratégie de rollback manuel pour les migrations de schéma.
- Les migrations Django qui touchent plusieurs tables en CASCADE/PROTECT doivent être testées sur une copie restaurée de la prod avant d'être jouées en prod.

## Décisions validées

- **Source des données historiques** : Import Excel (adapter `importer-mers`).
- **Recréation 2025-2026** : pipeline Progression depuis le PV 2024-2025 + import des nouveaux entrants.
- **Matricule** : colonne explicite dans l'Excel fait foi ; endpoint admin PATCH pour corrections.
- **Purge 2025-2026** : suppression totale des données opérationnelles, conservation de l'objet `Year`.
- **Institution** : mono-institution (l'institution principale actuelle) — toutes les entités historiques sont rattachées à cette institution, aucune modification de schéma multi-institution dans ce plan.

## Dimensions structurantes à respecter

Toute entité créée par ce plan doit être cohérente sur **toutes** les dimensions suivantes, pas uniquement l'année universitaire :

| # | Dimension | Où elle se matérialise | Impact sur le plan |
|---|-----------|------------------------|---------------------|
| 1 | **Année universitaire** (`Year`) | FK sur Inscription, Session, PV, Progression, Semestre ; CharField sur emplois/suivi/vacation/documents | Fil rouge du plan — cf. Sections 2 à 10 |
| 2 | **Institution principale** | FK sur `Filiere`, `DepartementAcademique`, `Departement`, `NumeroSerieConfig`, `ChargeInstitution` déjà ; **à AJOUTER** sur `Emploi`, `EmploisArchive`, `Suivie`, `SuiviePointage`, `Surveillance`, `Vacation`, `DocumentOfficiel`, `RegistreDiplome` (cf. **Section 1bis**). Matricule + PDF via `Institution.est_principale=True` (1 seule). Les imports Excel forcent `institution=principale` ; refus si `filiere.institution` ≠ institution. |
| 3 | **Type de session** (normale / rattrapage) | `SessionEvaluation.type_session` | Historique : créer SN et SR par parité uniquement si rattrapage a eu lieu. Calcul "max retenu" (Art. 18) s'applique seulement si SR active. Cf. Section 5 |
| 4 | **Parité de semestre** (Impairs / Pairs) | `SessionEvaluation.type_semestre` ∈ {Impairs, Pairs} | Une session couvre S1/S3/S5 OU S2/S4/S6 pour toute l'institution. Créer 2 ou 4 sessions par année (pas 4 × niveaux). Cf. Section 2.4 |
| 5 | **Type de diplôme** (LP / M / ING / Doctorat) | `Filiere.type_diplome` | Règles réglementaires différentes (Arrêté 562 pour LP, Décret 2018-070 pour ING). Préfixe niveau L/M/E/D visible dans rapport progression. Respecter `niveau_debut`/`niveau_fin` par filière lors de l'import |
| 5bis | **Reconduction de filière** | `Filiere.est_active` + `Module.actif` | Une filière reconduite reste `est_active=True` d'une année à l'autre. **Aucune création de Filiere/Module/EM** dans le plan historique — on réutilise telles quelles. Une filière abandonnée passe `est_active=False` |
| 6 | **Filière parent** (réorientation) | `Filiere.filiere_parent` | `ModificationProgressionService` restreint à filières filles d'une même mère. Pour tronc commun L1 → spécialisation L2 : modifier `Progression.filiere_cible` AVANT `ReinscriptionService.executer()` |
| 7 | **Classe pédagogique annuelle** (`Departement`) | `Departement(filiere, niveau, groupe, annee_universitaire, institution)` — CharField annee | Cloner un Departement par tuple (filière × niveau × groupe × année × institution). `Etudiant.departement` CASCADE → suppression d'un Departement supprime l'étudiant |
| 8 | **Groupe / section** | `Departement.groupe`, `Departement.decalage` | Un niveau peut avoir plusieurs groupes (A, B, …). Préserver la distribution dans le clonage |
| 9 | **Portail CustomUser** | `Etudiant.user` OneToOne SET_NULL | Supprimer un Etudiant laisse son CustomUser orphelin (role='etudiant'). Flag `--purger-comptes-orphelins` à la purge |
| 10 | **Préinscription** | `apps/inscriptions/models.py::Preinscription` | Court-circuité pour l'import historique (création directe `InscriptionAdministrative` validée) |
| 11 | **Dérogations** | `apps/inscriptions/models.py::Derogation` (FK Etudiant + Year) | Recréer si historique existe. FK PROTECT sur Etudiant et Year → inclure dans la purge |
| 12 | **Statut administratif & paiement** | `InscriptionAdministrative.statut`, `est_payee`, `date_paiement`, `validee_par` | Import historique : forcer `statut='validee'`, `est_payee=True`, `validee_par=user_admin_courant` |
| 13 | **Dettes & redoublement** | `InscriptionPedagogique.est_redoublant/est_dette`, `InscriptionElement.est_dette/annee_dette` | Posés auto par `ReinscriptionService` pour les progressions. Pour imports directs (nouveaux entrants) : tous False |
| 14 | **Statut étudiant** | `Etudiant.statut ∈ {actif, suspendu, diplome, exclu, transfere}` | Import par défaut = `actif`. Progression `decision=exclusion` → `ReinscriptionService` passe à `exclu` |

## Principe "reconduction annuelle" (validé par l'utilisateur)

**`Filiere`, `Module`, `EM` sont des entités stables d'une année à l'autre.** Il n'y a **aucune duplication** de ces entités lors du passage d'une année à une autre. Une filière "reconduite" garde son code, ses modules et ses EMs identiques ; la seule chose qui change est son statut :
- `Filiere.est_active = True` pour une filière reconduite pour l'année en cours
- `Filiere.est_active = False` pour une filière abandonnée ou suspendue

Le lien à l'année se fait via :
- `Departement` (classe pédagogique annuelle = filière × niveau × groupe × **année** × institution)
- `InscriptionAdministrative` qui porte `(etudiant, annee_univ, filiere, niveau, departement)`
- `Semestre` (générique après Section 1)

### Audit actuel des modèles stables

| Modèle | FK | Stable ? | Remarque |
|--------|----|----------|----------|
| `Filiere` | `institution` (SET_NULL), `filiere_parent` (self), **pas de Year** | ✅ Oui | `est_active` existe déjà |
| `Module` | `filiere` (PROTECT), `semestre` (PROTECT), **pas de Year** | ✅ Oui | `actif` existe déjà |
| `EM` | `semestre` (CASCADE), `module_lmd` (SET_NULL), `departement` (CASCADE) | ⚠️ **Faux-problème** | La FK `departement` CASCADE couple EM à un Departement annuel — EM serait détruit si on supprimait le Departement 24-25. |

### Correction à apporter : découpler `EM` de `Departement`

**Décision** : `EM.departement` doit devenir `SET_NULL` (ou être supprimée complètement).

Option retenue : **passer `EM.departement` en `SET_NULL, null=True, blank=True`**. L'information de classe pédagogique est déjà portée par `InscriptionElement.inscription_ped.inscription_admin.departement` — redondante sur `EM`.

À intégrer dans Section 1bis comme modification de schéma supplémentaire :
```python
migrations.AlterField(
    model_name='em',
    name='departement',
    field=models.ForeignKey(
        'departement.Departement',
        on_delete=models.SET_NULL,
        null=True, blank=True,
    ),
)
```

Bénéfice : la purge d'un Departement annuel (Section 4) ne peut plus détruire les EMs stables. Les EMs d'une filière reconduite survivent à la suppression de la classe 2025-2026.

---

## Simplification majeure du modèle Semestre (décidée après audit)

**Constat** : [`apps/parametres/models.py:32`](c:/react_projects/GES/siga/apps/parametres/models.py#L32) `Semestre` porte actuellement deux FK inutiles : `filiere` (SET_NULL nullable) et `annee_univ` (SET_NULL nullable). Un grep exhaustif montre que :
- Le seul filtre qui utilise ces champs est [`apps/evaluations/services/deliberation.py:134-142`](c:/react_projects/GES/siga/apps/evaluations/services/deliberation.py#L134) — et il a **un fallback naturel** sur les Semestres sans `filiere` ni `annee_univ`.
- Les crédits (`credits=30` par défaut) ne varient **pas** par année.
- La vraie source de vérité de la tuple (année, filière, semestre) est déjà portée par `InscriptionPedagogique.inscription_admin` (qui porte `annee_univ` + `filiere`) et par `PVDeliberation.annee_univ + filiere`.

**Décision** : `Semestre` devient **purement générique** (S1…S6). On supprime `annee_univ` et `filiere` du modèle. Bénéfices en cascade :
- Plus besoin de cloner les Semestres par année (retrait Section 2.2).
- Plus besoin du patch filtrant sur `annee_univ` dans `creer_inscriptions_pedagogiques` — il suffit de sélectionner par `niveau_semestre` + `type_semestre`.
- Le service `_credits_requis_niveau` est simplifié (plus de fallback).
- Aucune source de vérité doublonnée → zéro risque de désynchronisation.

## Contrainte d'intégrité transversale : (année, institution)

Toute requête qui crée/lit des entités historiques **doit** filtrer simultanément sur :
- `annee_univ=<Year>` (ou `annee_universitaire='<str>'` pour les CharField)
- `institution=<Institution principale>` (pour les modèles qui la portent)

**Garde-fous à coder** :
- Dans `importer-historique` (Section 3.3) : refuser si `filiere.institution_id ≠ institution_principale_id`.
- Dans `inserer_annee_historique` (Section 2) : clonage force `institution=institution_principale` sur Departement + DepartementAcademique.
- Dans `purger_annee` (Section 4) : filtres scopés à la fois sur `annee_univ` et sur les FK institution via `etudiant__departement__institution=principale` (protection multi-institution future).
- Dans `_generer_matricule(annee_obj, institution_obj)` : signature étendue pour recevoir l'institution explicitement et éviter le `filter(est_principale=True).first()` non-déterministe.

## Ordre d'exécution recommandé

```
0.    Pré-requis (backup mysqldump + audit + vérif unicité institution principale)
1.    MIGRATION SCHÉMA : simplifier Semestre (retirer annee_univ et filiere)
      + consolidation des doublons + adaptation utils et deliberation  ← critique
1bis. MIGRATION SCHÉMA :
        a) ajouter FK institution (NOT NULL après backfill) sur :
           - Groupe 1 CharField : Emploi, EmploisArchive, Suivie, SuiviePointage,
             Surveillance, Vacation, DocumentOfficiel, RegistreDiplome, Departement
           - Groupe 2 FK Year : SessionEvaluation, Preinscription, InscriptionAdministrative,
             Derogation, PVDeliberation, Progression
        b) ajustement unique_together de SessionEvaluation
        c) Groupe 4 : EM.departement CASCADE → SET_NULL (stabilité EM vs Departement annuel)
      ← critique avant nouvelles Years
2.    Création des Year 2023-2024 et 2024-2025 + Departements clonés + Sessions (PAS de Semestres)
3.    Endpoints/services nouveaux (importer-historique, changer-matricule)
4.    Purge sélective 2025-2026 (scope institution, scope year)
5.    Import historique 2023-2024 (étudiants + inscriptions + notes)
6.    Calcul + PV semestriels + PV annuel 2023-2024 + clôture
7.    Generer Progressions 23-24→24-25 + ReinscriptionService.executer
8.    Import nouveaux entrants 2024-2025 (bac 2024)
9.    Import notes 2024-2025 + PV + clôture
10.   Generer Progressions 24-25→25-26 + ReinscriptionService.executer
11.   Import nouveaux entrants 2025-2026 (bac 2025) avec matricules `255xxx`
12.   Tests E2E + non-régression emplois/suivi/vacations (par institution)
```

---

## Section 0 — Pré-requis

**Avant tout** :
- `mysqldump -u <user> -p --single-transaction --routines --triggers <db> > siga_backup_AVANT_REFONTE_<timestamp>.sql` + dossier `media/`. L'option `--single-transaction` assure un snapshot cohérent sur InnoDB sans verrouiller les tables.
- Vérifier que la restauration fonctionne sur une base staging (`mysql <db_staging> < siga_backup...sql`).
- Audit volumétrique 2025-2026 (script lecture seule) : compter `Etudiant`, `InscriptionAdministrative/Pedagogique/Element`, `Note`, `ResultatElement/Module/Semestre`, `SessionEvaluation`, `PVDeliberation`, `LigneDeliberation`, `Progression`, `Derogation`, `DocumentOfficiel`, `RegistreDiplome`, `Emploi`, `EmploisArchive`, `Suivie`, `SuiviePointage`, `Surveillance`, `Vacation`. **Bloquer le plan si `RegistreDiplome` 2025-2026 existe** (modèle immuable, [`apps/documents/models.py:108`](c:/react_projects/GES/siga/apps/documents/models.py#L108)).
- **Unicité institution principale** : `Institution.objects.filter(est_principale=True).count() == 1`. Si 0 → bloquer ; si >1 → bloquer et demander correction à l'utilisateur (toutes les migrations Section 1bis et 2 dépendent de l'identification non-ambiguë).
- **Intégrité institution sur filières et départements** : `Filiere.objects.filter(institution__isnull=True).count() == 0`, idem `Departement` et `DepartementAcademique`. Corriger sinon.
- Geler les saisies : `Year(est_active=False)` pour 2025-2026 et toutes `SessionEvaluation.est_close=True`.
- Vérifier volumétrie `emplois`/`suivi`/`vacation`/`documents` — ces comptes serviront de référence pour valider la non-régression après la migration Section 1bis.

---

## Section 1 — Simplification de `Semestre` + adaptation des consommateurs

### Objectif
Retirer `filiere` et `annee_univ` de `Semestre`, consolider les Semestres en doublons génériques S1…S6, et adapter les 2 fichiers qui les utilisaient.

### Étapes concrètes

**1.1 — Migration schéma** (Django migration `parametres/0XXX_semestre_simplification.py`) en 3 étapes MySQL-safe :

**Migration A — Consolider les Semestres doublonnés** (RunPython) :
Avant de dropper les FK, il faut qu'un seul `Semestre(code_semestre, niveau_semestre, type_semestre)` existe. Pour chaque doublon (par exemple plusieurs S1 L1 avec différentes `filiere`/`annee_univ`), choisir un canonique (celui avec `filiere=NULL, annee_univ=NULL` en priorité, sinon le plus ancien par `id`), puis **rediriger** toutes les `InscriptionPedagogique.semestre_id` pointant vers un doublon vers le canonique :
```python
def consolider_semestres(apps, schema_editor):
    Semestre = apps.get_model('parametres', 'Semestre')
    InscriptionPedagogique = apps.get_model('inscriptions', 'InscriptionPedagogique')
    groupes = Semestre.objects.values('code_semestre', 'niveau_semestre_id', 'type_semestre').annotate(c=Count('id')).filter(c__gt=1)
    for g in groupes:
        qs = Semestre.objects.filter(code_semestre=g['code_semestre'], niveau_semestre_id=g['niveau_semestre_id'], type_semestre=g['type_semestre']).order_by('filiere_id', 'annee_univ_id', 'id')
        # Priorité : filiere=NULL, annee_univ=NULL, sinon plus ancien
        canonique = qs.filter(filiere__isnull=True, annee_univ__isnull=True).first() or qs.first()
        doublons_ids = list(qs.exclude(id=canonique.id).values_list('id', flat=True))
        InscriptionPedagogique.objects.filter(semestre_id__in=doublons_ids).update(semestre_id=canonique.id)
        Semestre.objects.filter(id__in=doublons_ids).delete()
```

**Migration B — Drop des colonnes** (AlterField → puis RemoveField) :
```python
migrations.RemoveField(model_name='semestre', name='filiere')
migrations.RemoveField(model_name='semestre', name='annee_univ')
```

**Migration C — Contrainte d'unicité** :
```python
migrations.AddConstraint(
    model_name='semestre',
    constraint=models.UniqueConstraint(
        fields=['code_semestre', 'niveau_semestre', 'type_semestre'],
        name='uniq_semestre_code_niveau_type',
    ),
)
```

**1.2 — Adapter `creer_inscriptions_pedagogiques`** ([`apps/inscriptions/utils.py:30`](c:/react_projects/GES/siga/apps/inscriptions/utils.py#L30))
```python
qs_niveau = Semestre.objects.filter(
    niveau_semestre__niveau__icontains=f'L{niveau_int}',
)
# plus de fallback par filiere/annee_univ — c'est LA liste canonique
```

**1.3 — Adapter `_credits_requis_niveau`** ([`apps/evaluations/services/deliberation.py:134`](c:/react_projects/GES/siga/apps/evaluations/services/deliberation.py#L134))
```python
def _credits_requis_niveau(self) -> int:
    semestres = Semestre.objects.filter(
        niveau_semestre__niveau__icontains=f'L{self.pv.niveau}',
    )
    total = sum(s.credits for s in semestres)
    return total if total > 0 else 60
```

### Validation
- Pour chaque niveau, exactement 2 Semestres en base (1 Impair + 1 Pair).
- Pour tout `InscriptionPedagogique` existant, le `semestre` pointé existe toujours (0 FK cassée).
- `DeliberationAnnuelleService` renvoie le même nombre de crédits requis avant/après migration (test E2E).

### Rollback
Restaurer le dump mysqldump (MySQL ne rollback pas les DDL automatiquement).

---

## Section 1bis — Migration schéma : FK `institution` partout où il y a `Year`

### Objectif
**Règle architecturale** (validée par l'utilisateur) : **toute table qui porte une référence à `Year` (FK ou CharField) doit aussi porter une FK `institution`**. Sans cela, deux institutions se chevauchent : une session d'évaluation 2024-2025 d'une institution A serait indiscernable de celle d'une institution B.

**Obligatoire avant la Section 2** : si on crée les Year 2023-2024 et les structures associées sans ces FK, les sessions/PV/inscriptions historiques seront ambigus.

### Modèles concernés (audit exhaustif)

**Groupe 1 — CharField `annee_universitaire`/`annee_univ` (actuellement sans FK institution)** :

| Modèle | Fichier | Champ actuel | Action |
|--------|---------|--------------|-------|
| `Emploi` | [`apps/emplois/models.py`](c:/react_projects/GES/siga/apps/emplois/models.py) | `annee_universitaire` CharField | FK `institution` |
| `EmploisArchive` | `apps/emplois/models.py` | `annee_universitaire` CharField | FK `institution` |
| `Suivie` | [`apps/suivi/models.py`](c:/react_projects/GES/siga/apps/suivi/models.py) | `annee_universitaire` CharField | FK `institution` |
| `SuiviePointage` | `apps/suivi/models.py` | `annee_universitaire` CharField | FK `institution` |
| `Surveillance` | [`apps/vacation/models.py`](c:/react_projects/GES/siga/apps/vacation/models.py) | `annee_univ` CharField | FK `institution` |
| `Vacation` | `apps/vacation/models.py` | `annee_univ` CharField | FK `institution` |
| `DocumentOfficiel` | [`apps/documents/models.py`](c:/react_projects/GES/siga/apps/documents/models.py) | `annee_universitaire` CharField | FK `institution` |
| `RegistreDiplome` | `apps/documents/models.py` | `annee_universitaire` CharField | FK `institution` |
| `Departement` | [`apps/departement/models.py`](c:/react_projects/GES/siga/apps/departement/models.py) | `annee_universitaire` CharField + `institution` FK SET_NULL nullable | Passer FK `institution` en NOT NULL (et garder CharField Year ou le migrer plus tard) |

**Groupe 2 — FK `Year` (actuellement sans FK institution directe)** :

| Modèle | Fichier | Pourquoi FK institution | Action |
|--------|---------|------------------------|-------|
| `SessionEvaluation` | [`apps/evaluations/models.py:66`](c:/react_projects/GES/siga/apps/evaluations/models.py#L66) | **CRITIQUE** — aucun chemin alternatif. Une session n'a pas de filière. Sans FK institution, les sessions de 2 institutions sur la même année se confondent (contrainte `unique_together=(annee_univ, type_session, type_semestre)` les fusionnerait). | **FK obligatoire** + élargir `unique_together` à `(institution, annee_univ, type_session, type_semestre)` |
| `Preinscription` | [`apps/inscriptions/models.py:22`](c:/react_projects/GES/siga/apps/inscriptions/models.py#L22) | Données publiques pré-auth ; filière peut être NULL (en attente d'orientation) — pas de dérivation fiable | FK obligatoire |
| `InscriptionAdministrative` | [`apps/inscriptions/models.py:90`](c:/react_projects/GES/siga/apps/inscriptions/models.py#L90) | Table cœur. Dérivable via `filiere.institution` mais requêtes constantes bénéficient d'une FK directe (scoping, indexes) | FK obligatoire (redondante avec filiere.institution mais directe) |
| `Derogation` | [`apps/inscriptions/models.py:207`](c:/react_projects/GES/siga/apps/inscriptions/models.py#L207) | Contrôle d'accès administratif sensible | FK obligatoire |
| `PVDeliberation` | [`apps/evaluations/models.py:207`](c:/react_projects/GES/siga/apps/evaluations/models.py#L207) | Dérivable via `filiere.institution` mais FK directe simplifie les filtres de liste | FK obligatoire |
| `Progression` | [`apps/inscriptions/models.py:277`](c:/react_projects/GES/siga/apps/inscriptions/models.py#L277) | 2 FK Year (source/cible) + pipeline ReinscriptionService à scoper | FK obligatoire |

**Groupe 3 — FK `Year` indirecte, dérivation OK après Groupes 1+2** :

Les modèles suivants dérivent `institution` sans problème après que les Groupes 1-2 soient fixes (donc **aucune migration FK nécessaire**) :
- `InscriptionPedagogique` (via `inscription_admin.institution` directement)
- `InscriptionElement` (via `inscription_ped.inscription_admin.institution`)
- `LigneDeliberation` (via `pv.institution`)
- `Note` (via `session.institution` ou `inscription_element.inscription_ped.inscription_admin.institution`)
- `ResultatElement/Module/Semestre` (via `session.institution`)
- `RachatNote`, `MembreJury`, `ParametreJury`, `ObligationRattrapage`, `JustificatifAnneeBlanche` (via `pv.institution`)
- `AnonymatSession` (via `session.institution`)

**Aucune action** pour le Groupe 3 — l'isolation est garantie par la chaîne FK.

**Groupe 4 — Découplage EM/Departement** (correction indépendante, voir bloc "Reconduction annuelle" plus haut) :

| Modèle | Modification |
|--------|--------------|
| `EM.departement` | Passer de `on_delete=CASCADE` à `on_delete=SET_NULL, null=True, blank=True` |

Migration simple (une seule `AlterField`) — pas de backfill nécessaire car l'information reste dans la colonne tant qu'on ne supprime pas de Departement.

### Stratégie de migration (MySQL — DDL non-transactionnelle)

Pour **chaque** modèle des Groupes 1 et 2, une migration Django en 3 étapes séparées :

**Migration A — Ajout du champ nullable** :
```python
institution = models.ForeignKey(
    'parametres.Institution',
    on_delete=models.PROTECT,
    null=True, blank=True,
    related_name='%(class)s_set',
)
```
Safe sur MySQL InnoDB récent (ALTER TABLE en ligne pour colonne NULL).

**Migration B — Data migration (RunPython)** : backfill avec l'institution principale.
```python
def backfill_institution(apps, schema_editor):
    Institution = apps.get_model('parametres', 'Institution')
    principale = Institution.objects.filter(est_principale=True).first()
    if not principale:
        raise RuntimeError("Aucune institution principale — migration impossible.")
    # Refus si ambiguïté
    nb_principales = Institution.objects.filter(est_principale=True).count()
    if nb_principales > 1:
        raise RuntimeError(f"{nb_principales} institutions principales — corriger avant migration.")
    Model = apps.get_model(app, model_name)
    Model.objects.filter(institution__isnull=True).update(institution=principale)
```
Pour `SessionEvaluation` : backfill avant de modifier la contrainte `unique_together`.

**Migration C — Passage en NOT NULL** + ajustements d'index/contraintes :
```python
institution = models.ForeignKey(
    'parametres.Institution',
    on_delete=models.PROTECT,
    null=False, blank=False,
    related_name='%(class)s_set',
)
```

**Cas particuliers** :
- `SessionEvaluation.unique_together` actuel `(annee_univ, type_session, type_semestre)` doit devenir `(institution, annee_univ, type_session, type_semestre)` via `migrations.AlterUniqueTogether` — à faire **avant** la Migration C sinon conflit potentiel si 2 institutions fictives existent.
- `Departement.institution` est déjà FK SET_NULL nullable — **remplacer** par PROTECT NOT NULL (même procédure A/B/C, avec un backfill qui refuse si un Departement a un `nom` contenant le code d'une institution ≠ principale).
- `Progression` a deux FK Year (`annee_source`, `annee_cible`). La FK institution est **unique** (même institution source et cible — un étudiant ne change pas d'institution), pas besoin de deux FK.

⚠️ Sur MySQL, Migration C verrouille la table pendant la conversion. Tables volumineuses connues : `SuiviePointage`, `Note` (si >1M lignes à terme). Prévoir fenêtre de maintenance ou `pt-online-schema-change` (Percona Toolkit).

### Étapes concrètes

1. **Pré-flight** : vérifier `Institution.objects.filter(est_principale=True).count() == 1`. Si 0 ou >1 → bloquer, l'utilisateur doit corriger.
2. Dry-run en environnement de test (copie mysqldump → restore sur base staging).
3. Jouer Migration A sur prod (rapide).
4. Jouer Migration B (RunPython, délai variable selon volume).
5. Vérifier `Model.objects.filter(institution__isnull=True).count() == 0` pour chaque modèle.
6. Jouer Migration C (fenêtre maintenance si tables grosses).

### Scoping des vues

**Fichiers à adapter** :
- [`apps/emplois/views.py`](c:/react_projects/GES/siga/apps/emplois/views.py), `apps/suivi/views.py`, `apps/vacation/views.py`, `apps/documents/views.py` : ajouter un filtrage par institution dans `get_queryset()`.

Stratégie (phase 1, mono-institution) :
```python
def get_queryset(self):
    qs = super().get_queryset()
    inst = Institution.objects.filter(est_principale=True).first()
    return qs.filter(institution=inst) if inst else qs.none()
```

Phase 2 (préparée mais non activée) : lire `request.user.institution_id` depuis le token JWT. **Hors périmètre de ce plan** — noter pour refactor futur.

### Validation

- Pour chaque modèle : `Model.objects.filter(institution__isnull=True).count() == 0`
- `Emploi.objects.all().count()` avant et après = identique (juste le champ rempli en plus)
- Les vues frontend affichent toujours les données après migration (aucune régression)
- Les PDF générés (emplois filière, vacations) continuent de fonctionner

### Rollback

Si Migration C échoue → rester en Migration B (nullable) sans dégradation fonctionnelle.
Si besoin d'annuler complètement : `migrate app zéro à la migration précédente` puis `mysql` DDL manuel pour dropper la colonne. Prévoir le backup de la Section 0.

---

## Section 2 — Création des structures pour 2023-2024 et 2024-2025

### Objectif
Créer les `Year`, `Departement` annuels et `SessionEvaluation` pour les 2 années historiques. **Pas de création de `Filiere`, `Module`, `EM`, `Semestre`** — ils sont stables et déjà en base (principe de reconduction annuelle). Si une filière existe dans la base actuelle et doit être reconduite sur 2023-2024 : rien à faire, elle est utilisée telle quelle. Si une filière est abandonnée : `est_active=False`.

**Nouveau management command** : `apps/inscriptions/management/commands/inserer_annee_historique.py`

Args : `--annee 2023-2024 --source-annee 2025-2026 --institution <id|acronyme>` (optionnel, default = institution principale)

Étapes en `@transaction.atomic` :

0. **Résoudre l'institution cible** : `inst = Institution.objects.get(id=opts['institution'])` ou `Institution.objects.filter(est_principale=True).first()`. Refus si introuvable ou si > 1 `est_principale=True` sans `--institution` explicite.
1. **Year** : `get_or_create(annee=opts['annee'], defaults={'est_active': False, 'est_cloturee': True, 'date_debut': date(an, 9, 1), 'date_fin': date(an+1, 7, 31)})`. **Pas de FK institution sur Year** — Year est partagé, la séparation par institution se fait au niveau des FK aval.
2. ~~**Semestres annualisés**~~ — **supprimé** : depuis la Section 1, `Semestre` est générique (S1…S6 sans `annee_univ` ni `filiere`). Rien à cloner.
3. **Departement** (classe pédagogique, [`apps/departement/models.py`](c:/react_projects/GES/siga/apps/departement/models.py)) : cloner ceux de 2025-2026 dont `institution=inst` en remplaçant `annee_universitaire` et en **préservant** `(filiere, niveau, groupe, decalage, institution)`. Un Departement par (filière × niveau × groupe × année × institution).
4. **SessionEvaluation** : créer avec `institution=inst` + `annee_univ=annee` (contrainte `unique_together(institution, annee_univ, type_session, type_semestre)` après Section 1bis). Par défaut : sessions **normales** (2 par année : `SN-I` + `SN-P`). Option `--avec-rattrapage` pour créer aussi `SR-I` + `SR-P`. Toutes créées `est_close=True`, `cloturee_par=user_admin`.

**Validation** :
- `Year.objects.count() == 3`
- `SessionEvaluation.objects.filter(institution=inst, annee_univ__annee='2023-2024').count() ∈ {2, 4}` selon `--avec-rattrapage`
- `Departement.objects.filter(annee_universitaire='2023-2024', institution=inst).count() ==` même nombre que 2025-2026 pour la même institution
- Aucun `Departement` créé avec `institution=None` ni `institution≠inst`

**Rollback** : suppression manuelle des Departements + SessionEvaluation créés pour la nouvelle année, puis `Year.objects.filter(annee__in=[...]).delete()`.

---

## Section 3 — Endpoints / services nouveaux

### 3.1 — `_generer_matricule(annee_obj=None, institution_obj=None)` paramétrable

**Fichier** : [`apps/inscriptions/views.py:31`](c:/react_projects/GES/siga/apps/inscriptions/views.py#L31)

Refactoriser pour accepter une `Year` ET une `Institution` explicites. Si `None`, fallback :
- `annee_obj` = `Year.objects.filter(est_active=True).first()`
- `institution_obj` = `Institution.objects.filter(est_principale=True).first()` ; refus (ValueError) si `> 1` résultat (ambiguïté multi-institution).

Le `code_etablissement` vient de `institution_obj`, pas plus d'un lookup global indéterministe. Format final : `f'{annee_bac:02d}{code_inst}{seq:0Nd}'` avec N paramétrable (`format='historic5'` → N=2, `format='current6'` → N=3).

Scoper la séquence par institution : `Etudiant.objects.filter(departement__institution=institution_obj).count() + 1` (au lieu du count global), pour éviter les collisions cross-institution à terme.

### 3.2 — Service d'import historique

**Nouveau fichier** : `apps/inscriptions/services/import_historique.py`

Extrait la logique de [`apps/inscriptions/views.py:317-478`](c:/react_projects/GES/siga/apps/inscriptions/views.py#L317) (`importer-mers`) en un service réutilisable.

### 3.3 — Endpoint `importer-historique`

**Action sur** `InscriptionAdministrativeViewSet` :

```
POST /api/v1/inscriptions/admin/importer-historique/
multipart : fichier, filiere, niveau, departement, annee (id Year), institution (id, optionnel)
```

**Garde-fous institution** (en tête d'action) :
- Résoudre `institution` explicite ou principale (cf. Section 3.1).
- Refus si `filiere.institution_id is not None and filiere.institution_id != institution.id`.
- Refus si `departement.institution_id is not None and departement.institution_id != institution.id`.
- Refus si `departement.annee_universitaire ≠ annee.annee` (incohérence classe/année).

Colonnes Excel :
- **Obligatoires** : `NNI` (CNI), `NOMFR`, `MATRICULE` (peut être vide → fallback générateur)
- Optionnelles : `NOMAR, PRENOMFR, PRENOMAR, LIEUNFR, LIEUNAR, NATIOFR, NATIOAR, GENRE, DATN, NBAC, SERIE, MOYG, EMAIL, TEL`

Logique :
```python
matricule_excel = (row['MATRICULE'] or '').strip()
matricule_final = matricule_excel or _generer_matricule(annee_obj=annee, institution_obj=institution)

# Lookup : matricule explicite Excel d'abord, puis CNI
# Scope au perimètre de l'institution pour éviter collisions cross-institution futures
etu = Etudiant.objects.filter(matricule=matricule_excel).first() if matricule_excel else None
etu = etu or Etudiant.objects.filter(cni=nni, departement__institution=institution).first()

if etu:
    # Update progressif (ne pas écraser le matricule)
    for k, v in defaults.items(): setattr(etu, k, v)
    etu.save()
else:
    etu = Etudiant.objects.create(matricule=matricule_final, **defaults)

InscriptionAdministrative.objects.get_or_create(
    etudiant=etu, annee_univ=annee,
    defaults={'filiere': filiere, 'niveau': niveau,
              'numero_inscription': f'INS-{annee.annee}-{uuid4().hex[:6].upper()}',
              'statut': 'validee', 'validee_par': request.user},
)
creer_inscriptions_pedagogiques(insc_admin, request.user)  # version patchée Section 1
```

### 3.4 — Endpoint `changer-matricule`

**Action sur** `InscriptionAdministrativeViewSet` (ou nouveau `EtudiantViewSet`) :

```
PATCH /api/v1/inscriptions/admin/etudiant/<id>/changer-matricule/
body : {"nouveau_matricule": "23512", "motif": "min 10 caractères"}
```

Garde-fous :
- Permission admin (RBACPermission, role admin/superadmin)
- Refuse si `nouveau == ancien`
- Refuse si unicité violée (autre Etudiant avec ce matricule)
- Refuse (409) si `Progression.objects.filter(etudiant=etu).exclude(matricule=ancien).exists()` (incohérence historique)
- Sinon : update `Etudiant.matricule` + propagation `Progression.objects.filter(etudiant=etu).update(matricule=nouveau)` + `AuditLog` ([`core/models.py:22`](c:/react_projects/GES/siga/core/models.py#L22))

**Test** : changer un matricule, vérifier `AuditLog.objects.last()`, vérifier que les Progressions rattachées ont le nouveau matricule.

---

## Section 4 — Purge sélective 2025-2026

**Nouveau management command** : `apps/inscriptions/management/commands/purger_annee.py`

Args : `--annee 2025-2026`, `--dry-run` (default), `--confirm-token`, `--purger-etudiants-orphelins` (default True), `--purger-comptes-orphelins` (default False).

**Pré-conditions** :
- `Year.est_active = False` (refus sinon)
- Aucun `RegistreDiplome` lié à l'année (refus sinon)
- Résoudre l'institution cible (`--institution <id>` ou principale). Tous les filtres de purge sont **doublement scopés** `(annee, institution)` pour ne purger que les entités de l'institution visée (protection multi-institution future).

**Ordre EXACT en `@transaction.atomic`** (du bas de la chaîne FK PROTECT vers le haut). Tous les filtres ajoutent systématiquement la condition `filiere__institution=inst` ou équivalent pour rester scopé sur l'institution cible :

1. `RachatNote.objects.filter((Q(pv__annee_univ=annee) | Q(pv__session__annee_univ=annee)) & Q(pv__filiere__institution=inst)).delete()`
2. `ObligationRattrapage` (via `ligne__pv__annee_univ=annee` + `ligne__pv__filiere__institution=inst`)
3. `JustificatifAnneeBlanche` (via `ligne_deliberation__pv__annee_univ=annee` + `ligne_deliberation__pv__filiere__institution=inst`)
4. `AnonymatSession` (via `session__annee_univ=annee` + `inscription_admin__filiere__institution=inst`)
5. `Note` (via `session__annee_univ=annee` + `inscription_element__inscription_ped__inscription_admin__filiere__institution=inst`)
6. `ResultatElement`, `ResultatModule`, `ResultatSemestre` (via session ou inscription_ped, scope institution idem)
7. `Progression.objects.filter((Q(annee_source=annee) | Q(annee_cible=annee)) & Q(filiere_source__institution=inst)).delete()`
8. `LigneDeliberation` (via `pv__annee_univ=annee` + `pv__filiere__institution=inst`)
9. `PVDeliberation.objects.filter((Q(annee_univ=annee) | Q(session__annee_univ=annee)) & Q(filiere__institution=inst)).delete()`
10. `InscriptionElement` (via `inscription_ped__inscription_admin__annee_univ=annee` + `inscription_ped__inscription_admin__filiere__institution=inst`)
11. `InscriptionPedagogique` (via `inscription_admin__annee_univ=annee` + `inscription_admin__filiere__institution=inst`)
12. `InscriptionAdministrative.objects.filter(annee_univ=annee, filiere__institution=inst).delete()`
13. `SessionEvaluation` : plus délicat (FK Year mais pas d'institution directe). Filtrer par `Q(pvs__filiere__institution=inst)` distinct, ou conserver les Sessions sans PV (rien à purger). À documenter dans l'output.
14. `Derogation.objects.filter(annee_univ=annee, etudiant__departement__institution=inst).delete()`
15. `DocumentOfficiel.objects.filter(annee_universitaire=annee.annee, etudiant__departement__institution=inst).delete()` (CharField)
16. **Etudiants orphelins** (aucune `InscriptionAdministrative` restante et `departement__institution=inst`) si flag actif. ⚠️ Cascade `Presence` (FK `Etudiant` CASCADE, [`apps/absence/models.py:91`](c:/react_projects/GES/siga/apps/absence/models.py#L91)) : avertissement explicite — exporter `Presence` 2025-2026 en CSV avant si historique nécessaire.
17. **CustomUser** orphelins (`role=etudiant` sans `etudiant_profile`) si flag actif.

**Ne PAS toucher** :
- `Year(2025-2026)` elle-même
- `Semestre.objects.filter(annee_univ=2025-2026)` (gardés pour la Phase 5+10 qui crée les inscriptions 25-26 via progression)
- `Departement` 2025-2026
- `apps/emplois`, `apps/suivi`, `apps/vacation` (CharField, non bloquants)

**Garde-fous** :
- `--dry-run` par défaut, exécution réelle avec token cohérent type `PURGE-{annee}-{nb_etudiants}-{secret}`.
- Logs par étape (`logs/purge_<annee>_<timestamp>.log`)
- Tout en `@transaction.atomic` → rollback auto en cas d'erreur

**Validation** :
- Compte avant/après par table
- `InscriptionAdministrative.objects.filter(annee_univ=annee, filiere__institution=inst).count() == 0`
- `Year.objects.filter(annee='2025-2026').exists() == True`
- Compte `Emploi`, `EmploisArchive`, `Suivie`, `SuiviePointage`, `Surveillance`, `Vacation`, `DocumentOfficiel`, `RegistreDiplome` **pour l'institution cible** inchangé (maintenant scopé par FK après Section 1bis)

**Rollback** : `mysql -u <user> -p <db> < siga_backup_AVANT_REFONTE_<timestamp>.sql` (dump restauré intégralement).

---

## Section 5 — Import et clôture 2023-2024

1. **Import étudiants + inscriptions** : `POST /admin/importer-historique/` avec Excel des étudiants 2023-2024 (matricules `23xxx`).
2. **Notes** : pour chaque session (SN-I, SR-I, SN-P, SR-P) :
   - Ouvrir session : `POST /sessions/<pk>/ouvrir/`
   - Importer notes via [`POST /api/v1/evaluations/notes/importer/`](c:/react_projects/GES/siga/apps/evaluations/views.py#L238) (existant) — par EM
   - Fermer : `POST /sessions/<pk>/cloturer/`
   - Calculer : `calculer/` → `calculer-modules/` → `calculer-semestres/`
3. **PV semestriels** par filière × niveau : `POST /pvs/` → `peupler/` → `calculer-decisions/` → `clore/`
4. **PV annuel** par filière × niveau : `type_pv='annuel'` → `peupler/` (`DeliberationAnnuelleService`) → `calculer-decisions/` (Art. 20-21) → `clore/`

**Recommandation** : créer un command helper `apps/evaluations/management/commands/importer_notes_historiques.py` qui boucle sur un dossier organisé `<annee>/<session_code>/<em_code>.xlsx`.

---

## Section 6 — Pipeline Progression 23-24 → 24-25

1. Pour chaque PV annuel 2023-2024 clos : `POST /api/v1/inscriptions/progressions/generer/` avec `pv_id`. (Ou réutiliser le management command existant [`apps/inscriptions/management/commands/backfill_progressions.py`](c:/react_projects/GES/siga/apps/inscriptions/management/commands/backfill_progressions.py).)
2. Optionnel : `PATCH /progressions/<pk>/` pour ajuster `filiere_cible/niveau_cible` (réorientations).
3. `POST /api/v1/inscriptions/progressions/executer/` avec `annee_cible_id=Year('2024-2025').id` → matérialise les `InscriptionAdministrative` 2024-2025 (avec `creer_inscriptions_pedagogiques` patché → cible bien les Semestres `annee_univ=2024-2025`).

**Validation** :
- `Progression.objects.filter(annee_cible__annee='2024-2025', statut='executee').count() ≈ progressions+redoublements`
- `InscriptionAdministrative.objects.filter(annee_univ__annee='2024-2025').count()` = progressions exécutées

---

## Section 7 — Nouveaux entrants 2024-2025 + cycle complet 24-25

1. Import nouveaux L1 2024-2025 (bac 2024, matricules `24xxx`) via `importer-historique`. ⚠️ **Après** la Section 6 pour éviter conflits matricule/CNI.
2. Répéter Section 5 pour 2024-2025 (notes, PV semestriels, PV annuel, clôture).

---

## Section 8 — Pipeline Progression 24-25 → 25-26 + nouveaux entrants 25-26

1. `progressions/generer/` sur chaque PV annuel 2024-2025 clos.
2. `progressions/executer/` avec `annee_cible=Year('2025-2026')` → matérialise les inscriptions 2025-2026 (les Semestres 2025-2026 préservés en Section 4 sont retrouvés par le `creer_inscriptions_pedagogiques` patché).
3. Import nouveaux L1 2025-2026 (bac 2025, matricules `255xxx`) via `importer-historique`.
4. Réactiver `Year('2025-2026').est_active=True`.

---

## Section 9 — Vérification end-to-end

### Tests pytest à créer (`apps/inscriptions/tests/`)

- `test_purger_annee.py` : fixture mini-univers 2025-2026 → dry-run → 0 changement ; exécution réelle → toutes tables visées purgées, `Year` conservée, `emplois`/`suivi`/`vacation` mockés inchangés.
- `test_inserer_annee_historique.py` : création Year + clonage Semestres + Departements + Sessions.
- `test_import_historique.py` : matricule explicite vs fallback générateur ; même CNI deux années → un seul Etudiant, deux InscriptionAdministrative.
- `test_changer_matricule.py` : nominal + AuditLog ; conflit unicité 409 ; Progression incohérente 409 ; propagation Progression OK.
- `test_pipeline_e2e.py` (intégration) :
  - Étudiant L1 2023 → notes → PV → progression → L2 2024 → … → L3 2025 (matricule constant `23xxx`)
  - Étudiant qui redouble (PV décide redoublement) → `est_redoublant=True` + dettes seulement
  - Nouveau entrant 2024-2025
  - Matricule modifié a posteriori → propagation Progression
- `test_creer_inscriptions_pedagogiques_filtre_annee.py` : avec 2 années en DB, vérifier qu'aucun cross-année ne se produit.

### Tests de non-régression

- **Section 1bis** : pour chaque table migrée, `count()` avant Section 1bis = `count()` après Migration C. Zéro ligne avec `institution__isnull=True`.
- Charger 5 enregistrements `emplois.Emploi(annee_universitaire='2025-2026', institution=principale)` avant Section 4 (purge) → vérifier `count` inchangé après la purge.
- Idem `suivi.Suivie`, `vacation.HeuresVacation`, `DocumentOfficiel` (les FK institution sont désormais en place).
- **Test multi-institution mock** : créer une 2ème institution fictive en base de test avec ses propres emplois → vérifier que la purge 2025-2026 de l'institution principale ne touche pas les emplois de la 2ème institution.
- **Test vues scopées** : avec 2 institutions en base de test, `GET /api/v1/emplois/` connecté comme user `institution principale` ne renvoie que les emplois de la principale.

### Tests manuels

- UI : ouvrir l'onglet emplois 2025-2026 après purge → contenu intact.
- UI : `/dashboard/evaluations/deliberations` → voir les 3 années + PV historiques clos.
- UI : générer un rapport de progression 2024-2025 → vérifier décisions cohérentes.

---

## Section 10 — Risques résiduels

1. **`Presence` 2025-2026 perdues** lors de la suppression des Etudiants (FK CASCADE). Export CSV préalable si historique d'absence requis.
2. **`CustomUser` étudiants orphelins** (FK `Etudiant.user` SET_NULL) — flag dédié `--purger-comptes-orphelins`.
3. **`creer_inscriptions_pedagogiques`** : le patch Section 1 est critique. Bug latent si oublié.
4. **`RegistreDiplome` immuable** : si présent en 2025-2026 → blocage purge. Audit Section 0.
5. **Idempotence des imports Excel** : pas de colonne `id`, dédoublonnage via matricule + CNI. Validation préalable Excel obligatoire (script anti-doublons NNI/MATRICULE) avant import.
6. **Performance imports notes** : sur volume réel, exécuter par session en arrière-plan ; pas d'asynchrone dispo (pas de Celery détecté). Tester sur volume représentatif.
7. **`Progression.matricule` snapshot** : déjà couvert par la propagation dans `changer-matricule` (Section 3.4).
8. **`_generer_matricule` actuel** lit la `Year` active. Tant que `2025-2026.est_active=False` (Section 0), pas de risque de production de matricule 25xxx parasite. Toujours passer `annee_obj` et `institution_obj` explicitement dans les imports historiques.
9. **Plusieurs `Institution.est_principale=True`** : aucun `unique` ni `UniqueConstraint` sur ce booléen ([`apps/parametres/models.py:147`](c:/react_projects/GES/siga/apps/parametres/models.py#L147)). En pré-requis (Section 0), vérifier qu'il n'en existe qu'**une seule** ; sinon, désambiguïser avec `--institution <id>` sur tous les management commands du plan.
10. **`Filiere.code unique=True` global** : bloque toute évolution multi-institution future (deux institutions ne peuvent partager un code). Noter pour refactor ultérieur (hors périmètre de ce plan) — `unique_together=(code, institution)`.
11. **Filières sans institution** (`Filiere.institution IS NULL`) : l'import historique doit **refuser** toute filière orpheline pour éviter de créer des étudiants non rattachés. Pré-requis Section 0 : lister les `Filiere.objects.filter(institution__isnull=True)` et les corriger avant d'avancer.
12. **Departement sans institution** : même risque. Corriger en Section 0.
13. **Cohérence Filiere/Departement/Etudiant** : garantir que `inscription_admin.filiere.institution == inscription_admin.etudiant.departement.institution`. À vérifier à la création et à l'import (assert en fin de transaction).
14. **Parité de session** : si un import historique contient des étudiants avec dettes sur S1 (impair), le rattrapage doit être ouvert sur SR-I, pas SR-P. Le service `NoteCalculService` distingue via `type_semestre` — vérifier que l'import cible la bonne session.
15. **Filières commençant à L2** : certaines filières (spécialisation après tronc commun) ont `niveau_debut=2`. L'import historique L1 doit refuser ces filières pour niveau=1.
16. **Bug `ReinscriptionService` cross-institution** : le service ne filtre pas par institution ([`apps/inscriptions/services/reinscription.py`](c:/react_projects/GES/siga/apps/inscriptions/services/reinscription.py)). Tant qu'on reste mono-institution, pas de risque ; à noter pour le refactor multi-institution futur.
17. **MySQL DDL verrouillant** : la Migration C (Section 1bis — passage en NOT NULL) peut verrouiller les grosses tables (`SuiviePointage`, `Vacation`) pendant la conversion. Prévoir fenêtre de maintenance ou `pt-online-schema-change`. Pour les tables petites (<100k lignes), passage direct OK.
18. **MySQL rollback partiel** : si la Migration A ou B échoue en cours, DDL MySQL ne se rollback pas automatiquement comme en PostgreSQL. Le backup `mysqldump` de la Section 0 est le seul filet. Tester la restauration sur staging AVANT de jouer les migrations en prod.
19. **Charset/Collation MySQL** : vérifier que la BD utilise `utf8mb4` (pas `utf8`) pour supporter l'arabe et emojis éventuels. `SHOW VARIABLES LIKE 'character_set_database';` avant les migrations.
20. **Clients existants des endpoints `emplois/suivi/vacation`** : après scoping des vues (Section 1bis), un client authentifié par un user dont l'institution diffère de principale verra ses données filtrées. En phase 1 (mono-institution), aucun impact. En phase 2 multi-institution (hors périmètre), prévoir un mapping `user.institution`.

---

## Fichiers critiques

### À créer
- `apps/inscriptions/management/commands/purger_annee.py`
- `apps/inscriptions/management/commands/inserer_annee_historique.py`
- `apps/inscriptions/services/import_historique.py`
- `apps/evaluations/management/commands/importer_notes_historiques.py` (helper)
- Tests : `apps/inscriptions/tests/test_*.py` (cf. Section 9)

### À modifier
- [`apps/parametres/models.py`](c:/react_projects/GES/siga/apps/parametres/models.py) — simplifier `Semestre` (retirer `filiere`, `annee_univ`) + migrations associées (Section 1)
- [`apps/inscriptions/utils.py`](c:/react_projects/GES/siga/apps/inscriptions/utils.py) — simplifier `creer_inscriptions_pedagogiques` (plus de filtre year/filiere sur Semestre) (Section 1.2)
- [`apps/evaluations/services/deliberation.py`](c:/react_projects/GES/siga/apps/evaluations/services/deliberation.py) — simplifier `_credits_requis_niveau` (Section 1.3)
- [`apps/inscriptions/views.py`](c:/react_projects/GES/siga/apps/inscriptions/views.py) — refacto `_generer_matricule` + actions `importer-historique`, `changer-matricule`
- Modèles Groupes 1 + 2 (Section 1bis) — ajout FK `institution` : `apps/emplois/models.py`, `apps/suivi/models.py`, `apps/vacation/models.py`, `apps/documents/models.py`, `apps/departement/models.py`, `apps/evaluations/models.py` (SessionEvaluation, PVDeliberation), `apps/inscriptions/models.py` (Preinscription, InscriptionAdministrative, Derogation, Progression)
- [`apps/em/models.py`](c:/react_projects/GES/siga/apps/em/models.py) — passer `EM.departement` en `SET_NULL` nullable (Groupe 4 Section 1bis) pour découpler EM des Departement annuels
- ViewSets concernés : ajouter filtrage `get_queryset` par institution principale (`apps/emplois/views.py`, `apps/suivi/views.py`, `apps/vacation/views.py`, `apps/documents/views.py`, `apps/evaluations/views.py`, `apps/inscriptions/views.py`)

### À consulter (sans modification)
- [`apps/inscriptions/services/progression.py`](c:/react_projects/GES/siga/apps/inscriptions/services/progression.py)
- [`apps/inscriptions/services/reinscription.py`](c:/react_projects/GES/siga/apps/inscriptions/services/reinscription.py)
- [`apps/inscriptions/management/commands/backfill_progressions.py`](c:/react_projects/GES/siga/apps/inscriptions/management/commands/backfill_progressions.py)
- [`apps/evaluations/views.py`](c:/react_projects/GES/siga/apps/evaluations/views.py) (`notes/importer/` ligne 238)
- [`core/models.py`](c:/react_projects/GES/siga/core/models.py) (`AuditLog`)

---

## Vérification finale

Après exécution complète, doit être vrai :
- `Year.objects.values_list('annee', flat=True) == ['2023-2024', '2024-2025', '2025-2026']`
- `Institution.objects.filter(est_principale=True).count() == 1` (unicité garantie après pré-requis)
- **Semestre** : pour chaque niveau en base, exactement 2 Semestres génériques (S impair + S pair) sans `filiere` ni `annee_univ`
- **Groupes 1+2 FK institution** : 0 ligne avec `institution__isnull=True` sur toutes les tables migrées Section 1bis
- Toutes les `Filiere` et `Departement` utilisés par les inscriptions historiques ont `institution=<principale>`
- Pour un étudiant L3 2025-2026 issu de progression : `etudiant.inscriptions_admin.count() == 3`, matricule constant (ex `23603`), `etudiant.inscriptions_admin.first().institution == principale`
- Pour chaque inscription : `inscription.institution == inscription.filiere.institution == inscription.etudiant.departement.institution`
- `Progression` snapshots cohérents avec `Etudiant.matricule` actuel, `Progression.institution == Progression.filiere_source.institution`
- `emplois`, `suivi`, `vacation`, `documents` 2025-2026 inchangés (count avant = count après purge) et tous rattachés à l'institution principale via FK
- `/dashboard/evaluations/deliberations` affiche PV des 3 années, chacun clos
- `/dashboard/evaluations/deliberations/<id-2024-2025>` permet de générer le rapport de progression vers L2/L3 2025-2026
- Endpoint `PATCH /admin/etudiant/<id>/changer-matricule/` corrige un matricule + propage dans Progression + AuditLog
- Test mock multi-institution : créer une 2ème institution en staging + insertions ; vérifier zéro chevauchement (emplois/sessions/PV/inscriptions strictement isolés par institution)
- Tests pytest passent
- PDF PV et attestations chargent le logo et les coordonnées de l'institution principale correctement
