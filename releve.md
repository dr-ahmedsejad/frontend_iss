# Plan : Génération du relevé de notes par semestre

## Contexte

L'utilisateur veut générer un PDF de relevé de notes semestriel pour un étudiant, identique au modèle fourni (bilingual FR/AR, groupé par module, colonnes CC/EX/RAT/ME/Crédit/Décision). L'infrastructure existe (pdfkit, base template, wizard frontend, endpoints documents) mais le service `_build_context_releve` et le template `releve_notes.html` sont cassés — ils référencent un ancien schéma (sessions avaient un FK semestre, Note avait des champs note_cc/tp/exam directs, etc.).

**Aucune modification frontend requise** — le wizard `documents/generer/` fonctionne déjà.

---

## Fichiers à modifier

| Fichier | Changement |
|---------|-----------|
| `siga/apps/documents/services.py` | Réécrire `_build_context_releve`, extraire helpers partagés |
| `siga/apps/documents/templates/documents/releve_notes.html` | Réécrire entièrement (groupement par module, colonnes RAT/ME) |
| `siga/apps/documents/templates/documents/base_document.html` | Support `logo_b64` en fallback |

---

## Étape 1 — Extraire les helpers partagés de `_build_context_inscription`

Extraire 3 fonctions privées (lignes 189-236 de `services.py`) pour éviter la duplication :

- `_format_date_naissance(etudiant) -> str` — formatage date naissance (lignes 189-208)
- `_get_photo_b64(etudiant) -> str|None` — photo en base64 (lignes 211-222)  
- `_get_logo_b64(institution) -> str|None` — logo en base64 (lignes 224-236)

Mettre à jour `_build_context_inscription` pour appeler ces helpers au lieu du code inline.

---

## Étape 2 — Ajouter les constantes de labels semestres

Après les `NIVEAU_LABELS` existants (ligne ~41), ajouter :

```python
SEMESTRE_FR_LABELS = {
    'S1': 'Premier Semestre',  'S2': 'Deuxième Semestre',
    'S3': 'Troisième Semestre','S4': 'Quatrième Semestre',
    'S5': 'Cinquième Semestre','S6': 'Sixième Semestre',
}
SEMESTRE_AR_LABELS = {
    'S1': 'السداسي الأول',  'S2': 'السداسي الثاني',
    'S3': 'السداسي الثالث', 'S4': 'السداسي الرابع',
    'S5': 'السداسي الخامس', 'S6': 'السداسي السادس',
}
```

---

## Étape 3 — Réécrire `_build_context_releve` (lignes 316-401)

### Bugs actuels à corriger :

1. `annee_univ__icontains` → `annee_univ__annee__icontains` (FK vs champ texte)
2. `SessionEvaluation.objects.filter(semestre_id=...)` → sessions sont globales, filtrer par `(annee_univ, type_session, type_semestre)` + déduire la parité du semestre
3. `Note.objects.filter(etudiant=etudiant)` → Note n'a pas de FK etudiant, passe par `inscription_element`
4. `ResultatSemestre.objects.filter(etudiant=..., semestre_id=...)` → filtrer par `inscription_ped`
5. `n.note_cc, n.note_tp, n.note_exam` → Note a `type_note` + `valeur` (1 ligne par type)
6. Pas de groupement par module
7. Pas de colonne rattrapage

### Flux de requêtes correct :

```
1. InscriptionAdministrative(etudiant, annee_univ)
2. InscriptionPedagogique(inscription_admin, semestre_id)
3. InscriptionElement.filter(inscription_ped=insc_ped)
   → select_related('element', 'element__module', 'em')
4. Semestre.type_semestre ('I'/'P') → parity ('Impairs'/'Pairs')
5. session_normale = SessionEvaluation(annee_univ, 'normale', parity)
   session_rat    = SessionEvaluation(annee_univ, 'rattrapage', parity)
6. Pour chaque InscriptionElement :
   - Notes session normale : Note.filter(inscription_element=ie, session=sn)
   - Notes session rattrapage : Note.filter(inscription_element=ie, session=sr)
   - ResultatElement : ie.resultat (OneToOne)
   - Grouper par element.module
7. Calculer moyenne module = Σ(note_finale × coeff) / Σ(coeff)
8. ResultatSemestre.filter(inscription_ped=insc_ped) → moyenne, credits_valides, est_admis
```

### Structure de contexte retournée :

```python
{
    'modules': [
        {
            'code': 'LIAA11', 'intitule_fr': 'Introduction à l\'IA',
            'note_module': 10.04, 'decision': 'Validé',
            'elements': [
                {'code': 'LIAA111', 'intitule_fr': '...', 'cc': 10.26, 'exam': 13.17,
                 'rat': None, 'has_rattrapage_session': True, 'me': 12.01,
                 'credits': 2, 'decision': 'Validé'},
            ]
        },
    ],
    'semestre_label': 'Premier Semestre',
    'semestre_label_ar': 'السداسي الأول',
    'filiere_nom': '...', 'filiere_ar': '...',
    'niveau_label': '...', 'niveau_ar': '...',
    'date_naissance': '12/06/2003',
    'photo_b64': 'data:image/jpeg;base64,...',
    'logo_b64': 'data:image/png;base64,...',
    'moyenne_semestre': 10.75,
    'credits_valides': 30, 'credits_total': 30,
    'decision_semestre': 'Semestre validé',
    'mention': 'Passable', 'mention_code': 'P',
}
```

---

## Étape 4 — Réécrire `releve_notes.html`

Template complet avec :

**Titre bilingual** : "RELEVÉ DES NOTES DU {{ semestre_label|upper }} / كشف درجات {{ semestre_label_ar }}"

**Info étudiant** : photo, nom FR/AR, matricule, filière FR/AR, né(e) le/à, niveau

**Tableau groupé par module** :
- Colonnes : Élément | Module/الوحدة | CC | EX | RAT | ME | Crédit | Note | Décision/القرار
- Lignes module (header vert) : code + intitulé, note_module, décision
- Lignes éléments (sous le module) : code, intitulé, CC, EX, RAT (N/A si pas pris), ME, crédits, décision

**Résumé bas de page** :
- Total crédits capitalisés : X / Y
- Moyenne du semestre : X.XX
- Décision : Semestre validé / non validé
- NB : Relevé valable après signature...

**CSS** : `.module-row` (fond vert clair, bold), `.summary-box` (bordure, fond gris clair)

---

## Étape 5 — Support `logo_b64` dans `base_document.html`

Ligne 205, ajouter fallback :
```html
{% if logo_b64 %}
  <img src="{{ logo_b64 }}" alt="Logo">
{% elif institution.logo %}
  <img src="{{ institution.logo.path }}" alt="Logo">
{% else %}
  <!-- fallback cercle -->
{% endif %}
```

---

## Vérification

1. S'assurer qu'un étudiant a des `ResultatElement` et `ResultatSemestre` (lancer `calculer` sur la session)
2. Depuis le wizard frontend (`/dashboard/documents/generer`), sélectionner l'étudiant, type "Relevé semestre", année + semestre
3. Télécharger le PDF et vérifier :
   - Groupement par module correct
   - Notes CC, EX, ME affichées
   - Colonne RAT = "N/A" si pas de rattrapage pris
   - Moyenne module calculée correctement
   - Crédits et moyenne semestre dans le résumé
   - Mise en page bilingual FR/AR
4. Vérifier que l'attestation d'inscription fonctionne toujours (pas de régression après extraction des helpers)
