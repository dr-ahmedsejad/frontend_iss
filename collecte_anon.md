# Plan — Rattrapage, Branchement Licence/Ingénieur, Fiches PDF, Anonymat

## Contexte

Trois chantiers à livrer ensemble, tous rattachés au workflow d'évaluation existant de SIGA :

1. **Prise en charge de la session de rattrapage** — aujourd'hui le modèle `SessionEvaluation.type_session='rattrapage'` existe, mais la règle Art. 18 (Licence) / Art. 22 (Ingénieur) — *« garder la note maximale entre normale et rattrapage »* — **n'est pas appliquée**. La méthode statique `NoteCalculService.appliquer_regle_maximum_rattrapage` existe mais n'est jamais appelée.

2. **Branchement réglementaire Licence vs Ingénieur** — le champ `Filiere.type_diplome` (choix `'LP'/'M'/'ING'/'Doctorat'`) est **déjà en place**. Mais `DeliberationAnnuelleService` a `SEUIL_PROGRESSION = Decimal('65')` **hardcodé**. Or le Décret 2018-070 Art. 24 exige **75 %** pour les ingénieurs, un verrou S5 distinct (S1+S2 = 60 crédits au lieu de L1 entière), un jury à 7 membres (Art. 27) au lieu de 5 (Arrêté 562 Art. 24), et la note PFE ≥ 12/20 (Art. 16) pour l'obtention du diplôme.

3. **Impression PDF + anonymat** — aucun template `emargement` ni `fiche_collecte_notes` n'existe. Aucune infrastructure d'anonymat (grep confirme 0 occurrence). Ces impressions sont obligatoires pour la saisie terrain (signature des étudiants, remontée des notes par l'enseignant) et l'intégrité des examens/rattrapages.

**Décisions utilisateur** :
- Stockage max → **1 ResultatElement par session** (2 lignes normale + rattrapage ; max calculé à la volée en délibération).
- Fiches rattrapage → **seulement les étudiants concernés** (filtrés via `ObligationRattrapage`).
- Anonymat → **granularité (étudiant × session)** — un numéro unique par étudiant pour toute la session.

---

## Partie A — Rattrapage (Art. 18 Licence / Art. 22 Ingénieur)

### A.1 Modèle : session sur `ResultatElement`

Aujourd'hui ([apps/evaluations/models.py](../siga/apps/evaluations/models.py) ligne 152) :
```python
inscription_element = OneToOneField(InscriptionElement, related_name='resultat')
```
→ **une seule ligne par (étudiant × élément)**, qui est écrasée à chaque recalcul.

**Changement** :
- Remplacer `OneToOneField` par `ForeignKey` + `session = FK(SessionEvaluation)`.
- Unique constraint : `(inscription_element, session)`.
- Migration de données : renommer la ligne existante en lui assignant la `session` courante (heuristique : session normale la plus récente rattachée à la filière).

### A.2 Service de calcul — règle du max

Modifier `NoteCalculService.calculer_tous_elements_session` dans [apps/evaluations/services/calcul_notes.py](../siga/apps/evaluations/services/calcul_notes.py) pour que, **lorsque la session en cours est une rattrapage**, le calcul crée/met à jour la ligne `ResultatElement(session=rattrapage)` SANS toucher à la ligne normale.

Ajouter une méthode :
```python
def note_retenue_art18(self, inscription_element) -> Decimal | None:
    """Retourne max(ResultatElement.normale, ResultatElement.rattrapage) si les 2 existent, sinon la seule présente."""
```
Appeler cette méthode depuis :
- `ResultatModuleService.calculer(...)` (au lieu de lire directement `resultat.note_finale`).
- `NoteCalculService.calculer_semestre(...)` idem.
- `DeliberationSemestreService.peupler_lignes` et `calculer_decisions`.

**Important** : l'existant `appliquer_regle_maximum_rattrapage` (lignes 255-263 de calcul_notes.py) devient le cœur de `note_retenue_art18` — pas de nouvelle logique, juste un câblage.

### A.3 Workflow UI (frontend)

Sur la page PV semestriel ([app/dashboard/evaluations/deliberations/[id]/page.tsx](app/dashboard/evaluations/deliberations/%5Bid%5D/page.tsx)) :
- Le bouton **« Recalculer tout »** existant (ajouté lors de la session précédente) doit maintenant itérer sur **les deux sessions** (normale + rattrapage) de la même paire `(annee_univ, type_semestre)`, puis relancer la chaîne éléments → modules → semestres → lignes → décisions.
- Afficher une colonne supplémentaire dans le tableau résultats : **« Rattrapage »** (indique si la note retenue provient de la session rattrapage).

---

## Partie B — Branchement Licence vs Ingénieur

### B.1 Service de délibération annuelle — factory

Fichier cible : [apps/evaluations/services/deliberation_annuelle.py](../siga/apps/evaluations/services/deliberation_annuelle.py) (actuellement monolithique, `SEUIL_PROGRESSION=65` en constante de classe).

**Refactor** :
1. Extraire une classe de base `DeliberationAnnuelleService` qui lit les seuils depuis une sous-classe spécialisée.
2. Créer 2 sous-classes :
   - `DeliberationAnnuelleLicence` (type_diplome='LP') : seuil 65 %, verrou L3 = L1 entièrement validée (Arrêté 562 Art. 20 al. 2).
   - `DeliberationAnnuelleIngenieur` (type_diplome='ING') : seuil 75 %, verrou S5 = 60 crédits S1+S2 (Décret Art. 25), note PFE ≥ 12/20 pour le S6 (Art. 16).
3. Factory :
```python
def get_deliberation_annuelle_service(pv):
    t = pv.filiere.type_diplome if pv.filiere else 'LP'
    return {
        'LP':  DeliberationAnnuelleLicence,
        'ING': DeliberationAnnuelleIngenieur,
    }.get(t, DeliberationAnnuelleLicence)(pv)
```
4. Remplacer l'appel direct dans `views.py::_get_service` par la factory.

### B.2 Paramètres jury — composition spécifique

Le modèle `MembreJury.role` a déjà les rôles `president`, `membre`, `secretaire`. Ajouter au niveau du schéma de validation frontend :
- Licence (Art. 24) : 5 membres = chef_etab, resp_filiere, 2 enseignants, 1 professionnel.
- Ingénieur (Art. 27) : 7 membres = chef_etab, resp_pedagogique, chef_departement, 2 enseignants, 2 professionnels.

Implémentation : ajouter un champ `role_detail` optionnel (enum) sur `MembreJury` pour tracer le rôle précis, et un validator dans `DeliberationAnnuelleXxx.valider_jury()` qui vérifie la composition avant clôture.

### B.3 Frontend — affichage conditionnel

Dans [app/dashboard/evaluations/deliberations/[id]/page.tsx](app/dashboard/evaluations/deliberations/%5Bid%5D/page.tsx), afficher un badge **« Régime : Licence (Arrêté 562) »** ou **« Régime : Ingénieur (Décret 2018-070) »** selon `delib.filiere.type_diplome` (le champ est déjà dans [types/scolarite.ts](types/scolarite.ts) `interface Filiere`). Les seuils affichés dans le bloc "Cadre réglementaire" doivent être cohérents.

---

## Partie C — Fiches d'émargement et de collecte de notes

### C.1 Endpoints backend

Nouvelle famille d'actions dans [apps/evaluations/views.py](../siga/apps/evaluations/views.py) (nouveau `ViewSet` ou actions rattachées à un viewset existant) :

| Route | Paramètres | Contenu |
|---|---|---|
| `GET /api/v1/evaluations/emargement/pdf/` | `filiere`, `niveau`, `semestre` (code), `annee_univ`, `session` (optionnel) | Liste étudiants via `InscriptionPedagogique` filtrée par filière+niveau+semestre+année. Colonnes : N° / Matricule / Nom / Prénom / Signature (vide). |
| `GET /api/v1/evaluations/collecte-notes/pdf/` | `em`, `session`, `type_note` (CC/TP/EXAM), `anonymat` (0/1) | Liste étudiants inscrits à l'EM (via `InscriptionElement`). Colonnes : N° / Matricule (ou numéro anonymat) / Nom (masqué si anonymat) / Note (vide) / Observations (vide) / Signature (en pied). **Si `type_note='TP'` et `em.has_tp=False`, erreur 400.** |
| `GET /api/v1/evaluations/collecte-rattrapage/pdf/` | `em`, `session` (doit être type_session='rattrapage'), `type_note`, `anonymat` (0/1) | Mêmes colonnes mais liste filtrée via `ObligationRattrapage.inscription_element__em=em` et `ligne__pv__session__annee_univ=session.annee_univ`. |

**Validation croisée** : pour `collecte-rattrapage`, vérifier que `session.type_session='rattrapage'` ; pour `collecte-notes`, que `session.type_session='normale'`.

### C.2 Templates HTML (3 nouveaux fichiers)

Dans `siga/templates/` :

- `fiche_emargement.html` — en-tête institution (réutilise le pattern [pv_deliberation.html](../siga/templates/pv_deliberation.html) : logo + ministère + nom_complet_fr + filière/niveau/semestre/année) + titre **« FICHE D'ÉMARGEMENT »** + tableau colonnes (N°, Matricule, Nom Prénom, Signature) + pied signature du responsable.
- `fiche_collecte_notes.html` — même en-tête + titre **« FICHE DE COLLECTE — [TYPE_NOTE] »** avec type_note dynamique (Contrôle Continu / Travaux Pratiques / Examen) + EM + enseignant + session + colonnes (N°, Matricule OU Anonymat, Nom, Note/20, Obs.) + pied signature enseignant + cachet date.
- `fiche_collecte_rattrapage.html` — variante avec bandeau jaune **« SESSION DE RATTRAPAGE »** + colonne supplémentaire **« Type obligation »** (O=obligatoire, F=facultatif) pour contextualiser.

**Styles** : charte SIGA (vert `#006633`, rouge `#C82020`) conforme [docs/skill_design.md](docs/skill_design.md).

### C.3 Chargement du logo — réutiliser `_get_logo_b64()`

La fonction existe déjà dans [apps/documents/services.py](../siga/apps/documents/services.py) (lignes 92-105). La réutiliser dans les nouveaux endpoints au lieu de recréer une logique de chargement. Éviter la duplication qui existe aujourd'hui dans `PVDeliberationViewSet.pdf`.

**Refactor conseillé** : extraire un helper partagé `core/pdf_utils.py::build_institution_context(institution)` qui renvoie `{institution, ministere, logo_url_b64}`, et l'utiliser à la fois depuis `pv_deliberation.html` (refactor) et les nouveaux templates.

### C.4 Frontend — nouvelles pages

Sidebar ([app/dashboard/layout.tsx](app/dashboard/layout.tsx) ligne 299+) — ajouter sous « Évaluations » :
- **Émargement** → `/dashboard/evaluations/emargement`
- **Fiches de collecte** → `/dashboard/evaluations/collecte-notes`

Nouvelles pages :
- `app/dashboard/evaluations/emargement/page.tsx` — formulaire : filière (via `FiliereSelect`), niveau (Select 1-6), semestre (Select), année universitaire (Select via `useYearContext`) → bouton « Télécharger PDF » (`apiFetchBlob` + pattern link.click déjà utilisé dans `emplois/filiere/page.tsx`).
- `app/dashboard/evaluations/collecte-notes/page.tsx` — formulaire : session (Select), EM (Select filtré par semestre de la session), type_note (radio CC/TP/EXAM — griser TP si `!em.has_tp`), toggle anonymat. Selon `session.type_session` (normale ou rattrapage), cible le bon endpoint.

### C.5 API frontend

Étendre [lib/api/evaluations.ts](lib/api/evaluations.ts) :
```ts
export const emargementApi = {
  pdf: (p: { filiere: number; niveau: number; semestre: string; annee_univ: number }) =>
    apiFetchBlob(`${BASE}/emargement/pdf/?${new URLSearchParams(p as any)}`),
};
export const collecteNotesApi = {
  pdfNormale: (p: { em: number; session: number; type_note: 'CC'|'TP'|'EXAM'; anonymat?: 0|1 }) =>
    apiFetchBlob(`${BASE}/collecte-notes/pdf/?${...}`),
  pdfRattrapage: (p: { em: number; session: number; type_note: 'CC'|'TP'|'EXAM'; anonymat?: 0|1 }) =>
    apiFetchBlob(`${BASE}/collecte-rattrapage/pdf/?${...}`),
};
```

---

## Partie D — Anonymat (granularité étudiant × session)

### D.1 Modèle

Nouveau modèle dans [apps/evaluations/models.py](../siga/apps/evaluations/models.py) :

```python
class AnonymatSession(models.Model):
    session           = FK(SessionEvaluation, related_name='anonymats')
    inscription_admin = FK(InscriptionAdministrative, related_name='anonymats')
    numero_anonymat   = PositiveIntegerField()
    genere_le         = DateTimeField(auto_now_add=True)
    genere_par        = FK(User, null=True, on_delete=SET_NULL)

    class Meta:
        unique_together = [
            ('session', 'inscription_admin'),   # 1 numéro par étudiant par session
            ('session', 'numero_anonymat'),     # numéro unique dans la session
        ]
```

### D.2 Service

`apps/evaluations/services/anonymat.py` (nouveau) :

```python
class AnonymatService:
    @staticmethod
    def generer(session, regenerer=False) -> int:
        """Assigne un numéro 1..N aléatoire (shuffle) à chaque étudiant inscrit au niveau/filière couvert par la session."""
        # 1. Si regenerer=False et des anonymats existent → erreur ou no-op
        # 2. Lister tous les InscriptionAdministrative concernés (via InscriptionPedagogique de la bonne paire semestre)
        # 3. random.shuffle, zip avec range(1, N+1), bulk_create
        # 4. Retourner N
    @staticmethod
    def resoudre(session, numero) -> InscriptionAdministrative: ...
```

### D.3 Endpoints

Dans `evaluations/views.py` — nouveau viewset minimal `AnonymatSessionViewSet` :
- `POST /api/v1/evaluations/anonymats/generer/?session=X[&regenerer=1]` → lance `AnonymatService.generer`.
- `GET /api/v1/evaluations/anonymats/?session=X` → liste paginée.
- `GET /api/v1/evaluations/anonymats/levee/pdf/?session=X` → **fiche de levée d'anonymat** (tableau matricule → numéro, trié par numéro, destiné à être conservé scellé).

### D.4 Intégration dans les fiches de collecte

Dans les endpoints `collecte-notes/pdf/` et `collecte-rattrapage/pdf/` (partie C.1), lorsque `anonymat=1` :
1. Récupérer `AnonymatSession` pour la session en cours.
2. Si aucun anonymat n'a été généré → erreur 400 **« Générer d'abord les anonymats de la session »**.
3. Masquer `Matricule` et `Nom/Prénom` dans le tableau, les remplacer par une colonne **« N° Anonymat »**.
4. Trier par `numero_anonymat` pour éviter que l'ordre alphabétique révèle l'identité.

### D.5 Saisie des notes en mode anonymat

Optionnel mais cohérent : étendre `notesApi.saisir` pour accepter `numero_anonymat` au lieu de `inscription_element`, le backend résolvant l'étudiant via `AnonymatService.resoudre(session, numero) → InscriptionAdministrative → InscriptionElement(em=...)`.

Dans la page de saisie ([app/dashboard/evaluations/notes/saisie/page.tsx](app/dashboard/evaluations/notes/saisie/page.tsx)), toggle **« Mode anonymat »** : affiche uniquement N° Anonymat + Note, l'enseignant saisit copie par copie sans voir les noms.

### D.6 Frontend — page anonymat

`app/dashboard/evaluations/anonymat/page.tsx` (nouvelle) :
- Liste déroulante sessions → affiche état (généré ou non, N étudiants).
- Bouton **« Générer les anonymats »** (confirm modal) + **« Régénérer »** (danger).
- Bouton **« Télécharger fiche de levée d'anonymat »** (PDF scellé).

Entrée sidebar : **Anonymat** sous « Évaluations ».

---

## Fichiers critiques

**Backend — à modifier** :
- [siga/apps/evaluations/models.py](../siga/apps/evaluations/models.py) (ResultatElement → session FK ; nouveau AnonymatSession).
- [siga/apps/evaluations/services/calcul_notes.py](../siga/apps/evaluations/services/calcul_notes.py) (note_retenue_art18 ; câbler max rule).
- [siga/apps/evaluations/services/deliberation_annuelle.py](../siga/apps/evaluations/services/deliberation_annuelle.py) (factory Licence / Ingénieur).
- `siga/apps/evaluations/services/anonymat.py` (nouveau).
- [siga/apps/evaluations/views.py](../siga/apps/evaluations/views.py) (emargement, collecte, collecte-rattrapage, anonymats + intégration note_retenue).
- [siga/apps/evaluations/serializers.py](../siga/apps/evaluations/serializers.py) (AnonymatSessionSerializer).
- [siga/apps/evaluations/urls.py](../siga/apps/evaluations/urls.py) (routes).
- `siga/core/pdf_utils.py` (nouveau helper institution/logo partagé).

**Backend — templates (nouveaux)** :
- `siga/templates/fiche_emargement.html`
- `siga/templates/fiche_collecte_notes.html`
- `siga/templates/fiche_collecte_rattrapage.html`
- `siga/templates/fiche_levee_anonymat.html`

**Backend — migrations** :
- Ajout de `session` sur ResultatElement (data migration pour lignes existantes).
- Création AnonymatSession.

**Frontend — à modifier** :
- [types/evaluations.ts](types/evaluations.ts) (TypeDiplome déjà OK ; ajouter AnonymatSession).
- [lib/api/evaluations.ts](lib/api/evaluations.ts) (emargementApi, collecteNotesApi, anonymatsApi).
- [app/dashboard/layout.tsx](app/dashboard/layout.tsx) (sidebar : Émargement, Collecte, Anonymat).
- [app/dashboard/evaluations/deliberations/[id]/page.tsx](app/dashboard/evaluations/deliberations/%5Bid%5D/page.tsx) (badge régime + affichage seuils dynamiques + colonne Rattrapage).

**Frontend — nouvelles pages** :
- `app/dashboard/evaluations/emargement/page.tsx`
- `app/dashboard/evaluations/collecte-notes/page.tsx`
- `app/dashboard/evaluations/anonymat/page.tsx`

---

## Utilitaires à réutiliser

- `apps/documents/services.py::_get_logo_b64()` ([services.py:92-105](../siga/apps/documents/services.py#L92-L105)) — logo base64 pour wkhtmltopdf.
- `apps/evaluations/services/calcul_notes.py::NoteCalculService.appliquer_regle_maximum_rattrapage()` (lignes 255-263) — **existe déjà mais n'est pas appelée** ; le câblage est tout l'enjeu de la partie A.
- `apps/evaluations/models.py::ObligationRattrapage` — déjà peuplée par `DeliberationSemestreService.generer_obligations()` ; sert de filtre pour la fiche collecte rattrapage.
- Frontend `lib/api.ts::apiFetchBlob` + pattern `URL.createObjectURL` déjà utilisé dans [app/dashboard/emplois/filiere/page.tsx](app/dashboard/emplois/filiere/page.tsx) → copier textuellement.
- Frontend [components/scolarite/FiliereSelect.tsx](components/scolarite/FiliereSelect.tsx) (utilisé dans la page deliberations) pour le sélecteur filière.

---

## Vérification

Tester **de bout en bout** avec un dataset minimal :

1. **Rattrapage max rule** :
   - Étudiant X, EM Algo : note normale = 8, note rattrapage = 14.
   - Lancer `DeliberationSemestreService.calculer_decisions` post-rattrapage.
   - Attendu : `note_retenue_art18(Algo, X) = 14` ; `ResultatModule.moyenne` reflète 14 ; `LigneDeliberation.decision='admis'` si seuils atteints.
   - Vérifier qu'en base on a **2 lignes ResultatElement** (une session normale, une rattrapage), pas d'écrasement.

2. **Branchement Ingénieur** :
   - Créer filière fictive `type_diplome='ING'`, étudiant avec 45/60 crédits.
   - Lancer délibération annuelle → décision = `passage_cond` (car 45/60 = 75%, seuil ingénieur).
   - Même étudiant à 44/60 → `redoublement` (sous seuil 75%).
   - Contrôle croisé : même étudiant en filière `type_diplome='LP'` à 44/60 → `passage_cond` (seuil 65%).

3. **Fiche émargement** :
   - Filière « Informatique » L1 S1 année 2025-2026 avec 39 inscrits.
   - `GET /emargement/pdf/?filiere=1&niveau=1&semestre=S1&annee_univ=1` → PDF 39 lignes avec colonnes N°/Matricule/Nom/Signature vide, en-tête institution avec logo chargé depuis `Institution.logo`.

4. **Fiche collecte normale** :
   - EM « Algo » has_tp=True, session normale S1.
   - Tester 3 PDFs : type_note=CC / TP / EXAM → tableaux identiques avec titre variable.
   - Tester EM avec has_tp=False + type_note=TP → erreur 400.

5. **Fiche collecte rattrapage** :
   - Session rattrapage S1, EM Algo avec 3 étudiants ayant `ObligationRattrapage` pour cet EM (2 obligatoires, 1 facultatif).
   - `GET /collecte-rattrapage/pdf/?em=1&session=2&type_note=EXAM` → PDF 3 lignes (pas 39) avec colonne « Type obligation » O/F.

6. **Anonymat** :
   - Session EXAM rattrapage, 39 étudiants inscrits.
   - `POST /anonymats/generer/?session=2` → retourne `{nb_generes: 39}`.
   - Vérifier en base : 39 lignes `AnonymatSession` avec numéros uniques 1..39, ordre aléatoire (pas alphabétique).
   - `GET /collecte-rattrapage/pdf/?em=1&session=2&type_note=EXAM&anonymat=1` → PDF sans matricule/nom, uniquement colonne « N° Anonymat ».
   - `GET /anonymats/levee/pdf/?session=2` → PDF scellé matricule → numéro, trié par numéro.

7. **Régénération anonymat** :
   - Appeler `POST /anonymats/generer/?session=2` une 2ᵉ fois sans `regenerer=1` → erreur 409 (conflit).
   - Avec `regenerer=1` → supprime les 39 anciens et recrée 39 nouveaux.

8. **Tests pytest** (nouveaux fichiers dans `apps/evaluations/tests/`) :
   - `test_art18_max_rattrapage.py` : 3 cas (normale>rattrapage, rattrapage>normale, égalité).
   - `test_seuil_ingenieur.py` : seuils 65% vs 75% par type_diplome.
   - `test_anonymat_service.py` : génération, unicité, résolution, régénération.
   - `test_emargement_pdf.py`, `test_collecte_pdf.py` : smoke tests (HTTP 200, Content-Type pdf, taille > 0).
