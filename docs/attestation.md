# Plan : Attestation d'inscription — Corrections backend + bouton frontend

## Contexte

L'infrastructure de generation d'attestations existe deja (modeles, service, template HTML, API, client frontend) mais **3 bugs backend** empechent la generation correcte du PDF, et le **bouton frontend** pour declencher la generation n'existe pas encore.

---

## Etape 1 : Fix `_build_context_inscription` — FK `em` au lieu de `element`

**Fichier** : `siga/apps/documents/services.py` (lignes 188-218)

**Probleme** : Le code utilise `insc_elem.element` (FK vers `modules.ElementModule`, table vide 0 lignes) au lieu de `insc_elem.em` (FK vers `em.EM`, 107 cours reels). Les InscriptionElement creees par `_creer_inscriptions_pedagogiques` remplissent le champ `em`, pas `element`.

**Correction** :
```python
# Ligne 191-192 : ajouter prefetch pour em
).select_related('semestre').prefetch_related(
    'inscriptions_elements__em'  # was: 'inscriptions_elements__element'
).order_by('semestre__code_semestre')  # was: 'semestre__ordre' (ordre n'existe pas)

# Ligne 207-208 : utiliser em au lieu de element
for insc_elem in insc_ped.inscriptions_elements.all():
    em = insc_elem.em  # was: insc_elem.element
    if not em:
        continue
```

---

## Etape 2 : Fix `order_by('semestre__ordre')` — champ inexistant

**Fichier** : `siga/apps/documents/services.py` (ligne 193)

**Probleme** : `Semestre` n'a pas de champ `ordre`. La requete va echouer silencieusement ou lever une erreur.

**Correction** : Remplacer par `order_by('semestre__code_semestre')` (S1, S2, S3... tri naturel).

---

## Etape 3 : Fix template — `institution.faculte_fr` / `institution.service_fr` inexistants

**Fichier** : `siga/apps/documents/templates/documents/attestation_inscription.html` (lignes 237-238, 266)

**Probleme** : Le template reference `{{ institution.faculte_fr }}` et `{{ institution.service_fr }}` mais le modele `Institution` n'a pas ces champs. Cela affiche du vide sans erreur (Django template silencieux).

**Correction** : Remplacer par des champs existants :
- `{{ institution.faculte_fr }}` → `{{ institution.nom_complet_fr }}` (ou supprimer la ligne)
- `{{ institution.service_fr }}` → `Service de la Scolarite` (texte statique, comme le footer)
- Meme correction cote arabe : `{{ institution.faculte_ar }}` → `{{ institution.nom_complet_ar }}`

---

## Etape 4 : Bouton "Imprimer attestation" sur la page detail

**Fichier** : `gesafped_frontend/app/dashboard/inscriptions/administratives/[id]/page.tsx`

**Action** : Ajouter un bouton dans la zone d'actions (a cote de "Enregistrer le paiement") :

```
[Printer icon] Attestation d'inscription
```

**Logique** :
1. `useState` pour `generating` (loading state)
2. Au clic : appeler `documentsApi.generer({ etudiant: insc.etudiant, type_document: 'attestation_inscription', annee_universitaire: insc.annee_universitaire })`
3. Recevoir le `DocumentOfficiel` avec son `id`
4. Appeler `documentsApi.telecharger(doc.id)` → recevoir un `Blob`
5. Creer un lien temporaire `URL.createObjectURL(blob)` et declencher le telechargement
6. Toast success : "Attestation generee"
7. En cas d'erreur : Toast error avec le message

**Import a ajouter** : `Printer` depuis lucide-react, `documentsApi` depuis `@/lib/api/documents`

**Style du bouton** : Meme style gradient vert que le bouton paiement existant.

---

## Fichiers a modifier

| Fichier | Action |
|---------|--------|
| `siga/apps/documents/services.py` | Fix FK em, fix order_by |
| `siga/apps/documents/templates/documents/attestation_inscription.html` | Fix champs institution |
| `gesafped_frontend/app/dashboard/inscriptions/administratives/[id]/page.tsx` | Ajouter bouton + logique generation/telechargement |

## Verification

1. Aller sur `/dashboard/inscriptions/administratives/{id}` pour un etudiant inscrit en L1 SEA
2. Cliquer "Attestation d'inscription"
3. Verifier que le PDF se telecharge avec :
   - En-tete bilingue FR/AR avec logo institution
   - Infos etudiant (nom, NNI, date naissance, matricule, photo)
   - Niveau + filiere
   - Tableau des elements par semestre (11 EM S1 + 12 EM S2 pour SEA)
   - Annee universitaire
   - Signature du chef de scolarite
4. Verifier qu'un `DocumentOfficiel` est cree en base avec numero de serie `AI-2026-00001`
