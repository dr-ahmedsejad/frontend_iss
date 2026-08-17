# Attestation d'Inscription — Guide d'utilisation

## Vue d'ensemble

L'attestation d'inscription est un document officiel bilingue (FR/AR) généré dynamiquement pour chaque étudiant. Elle atteste que l'étudiant est régulièrement inscrit pour une année universitaire donnée, dans une filière et un niveau spécifiques, avec la liste détaillée des éléments de module (EM) auxquels il est inscrit pédagogiquement.

### Caractéristiques

- **Bilingue** : En-tête MESRS + institution en français et arabe (RTL).
- **Dynamique** : Données de la BD (étudiant, inscription, éléments).
- **Sécurisée** : Numéro de série unique, token de vérification, QR code pointant vers `/verifier/{token}`.
- **Signée** : Signature du directeur (image depuis BD).
- **Logo** : Logo institution ou initiale par défaut.

---

## Architecture technique

### Backend — `C:\react_projects\GES\siga`

**Modèles principaux** :
- `DocumentOfficiel` — métadonnées du document (numéro série, token, type, étudiant, année).
- `NumeroSerieConfig` — numérotation thread-safe par type et institution.
- `InscriptionAdministrative` — inscription étudiant ↔ filière ↔ année.
- `InscriptionPedagogique` — inscription à un semestre spécifique.
- `InscriptionElement` — inscription à un élément de module via `InscriptionPedagogique`.

**Service de génération** — `apps/documents/services.py` :
- `generer_document(data, user)` — crée un `DocumentOfficiel` et génère le PDF.
- `_build_context_inscription()` — collecte les données pour le template (étudiant, inscription, éléments par semestre).
- `_generer_pdf()` — render template + pdfkit/wkhtmltopdf → bytes PDF.
- `_get_qr_base64()` — génère QR code en base64 pointant vers `/verifier/{token}`.

**Template HTML** — `apps/documents/templates/documents/attestation_inscription.html` :
- Hérité de `base_document.html` (en-tête, pied de page, style CSS).
- Affiche les éléments inscrits groupés par semestre dans un tableau.

**ViewSet** — `apps/documents/views.py` :
- `DocumentOfficielViewSet` :
  - `POST /api/v1/documents/generer/` — crée une attestation.
  - `GET /api/v1/documents/{id}/telecharger/` — télécharge le PDF (régénère si absent).
  - `GET /api/v1/documents/verifier/{token}/` — vérifie l'authenticité du document (publique).

### Frontend — `c:\react_projects\GES\gesafped_frontend`

**API** — `lib/api/documents.ts` (à créer si absent) :
```ts
export const documentsApi = {
  list: () => apiClient.get('/documents'),
  create: (data) => apiClient.post('/documents/generer', data),
  download: (id) => apiClient.get(`/documents/${id}/telecharger`),
  verify: (token) => apiClient.get(`/documents/verifier/${token}`),
}
```

**Pages suggérées** :
- `app/dashboard/scolarite/attestations/page.tsx` — liste des attestations générées.
- `app/dashboard/scolarite/attestations/create/page.tsx` — formulaire de création (sélection étudiant, type doc, année).
- `app/documents/verify/[token]/page.tsx` — page de vérification publique.

---

## Flux de génération

### 1. **Création d'une attestation** (action `generer`)

**Requête** :
```json
POST /api/v1/documents/generer/
{
  "etudiant": 42,
  "type_document": "attestation_inscription",
  "annee_universitaire": "2025-2026",
  "semestre": null
}
```

**Processus** :
1. Récupérer l'étudiant.
2. Trouver l'institution (via filière de l'étudiant).
3. Générer un numéro de série thread-safe (via `NumeroSerieConfig.generer_prochain()`).
4. Générer un UUID token pour la vérification.
5. Créer `DocumentOfficiel` en BD.
6. Construire le contexte du template :
   - Informations étudiant (nom, NNI, date naissance, sexe, lieu naissance).
   - Inscription administrative (filière, niveau, année, statut).
   - **Éléments inscrits par semestre** (querysets imbriqués).
7. Render template HTML.
8. Convertir HTML → PDF via **pdfkit/wkhtmltopdf**.
9. Sauvegarder le PDF dans `doc.fichier_pdf`.
10. Retourner `DocumentOfficielSerializer` avec métadonnées.

**Réponse** (201 Created) :
```json
{
  "id": 1,
  "numero_serie": "AI-2026-00001",
  "token_verification": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "type_document": "attestation_inscription",
  "etudiant": 42,
  "annee_universitaire": "2025-2026",
  "fichier_pdf": "documents/officiels/AI-2026-00001.pdf",
  "est_valide": true,
  "date_generation": "2026-04-15T10:30:00Z"
}
```

### 2. **Téléchargement du PDF** (action `telecharger`)

**Requête** :
```
GET /api/v1/documents/{id}/telecharger/
```

**Processus** :
1. Récupérer `DocumentOfficiel`.
2. Si `fichier_pdf` est vide, régénérer le PDF (en cas de perte).
3. Retourner `FileResponse` avec header `Content-Disposition: attachment`.

**Réponse** (200 OK) :
- Fichier PDF téléchargé avec le navigateur.

### 3. **Vérification publique** (action `verifier`)

**Requête** :
```
GET /api/v1/documents/verifier/{token}/
```

**Processus** :
1. Chercher `DocumentOfficiel` par `token_verification`.
2. Vérifier que `est_valide == True`.
3. Retourner les métadonnées (sans le fichier PDF).

**Réponse** (200 OK) :
```json
{
  "numero_serie": "AI-2026-00001",
  "etudiant": { "nom": "John Doe", "matricule": "C12345" },
  "annee_universitaire": "2025-2026",
  "date_generation": "2026-04-15T10:30:00Z",
  "est_valide": true
}
```

---

## Template HTML — Structure

Le template utilise le style défini dans `base_document.html` :

### Sections principales

#### En-tête (fixe, via `base_document.html`)
- Logo institution + nom FR/AR.
- Liseré vert #006633.
- Devise MESRS.

#### Titre du document
- Badge vert gradienté « Attestation d'Inscription ».
- Version arabe « شهادة التسجيل ».
- Année universitaire.

#### Informations étudiant
- **Grille 2 colonnes** :
  - Nom & Prénom (FR), Nom arabe (RTL).
  - Matricule, NNI, Date naissance, Lieu naissance, Sexe.

#### Informations inscription
- **Grille 2 colonnes** :
  - Filière, Niveau, Année, Statut.

#### Éléments inscrits (par semestre)
- **Barre grise** « Semestre 1 / Semestre 2 ».
- **Tableau** :
  - Colonnes : Code Élément, Élément (intitulé), Crédit.
  - Rangée Total : somme des crédits du semestre.
- Répété pour chaque semestre.

#### Attestation de conformité
- Texte certifiant l'inscription régulière (FR et AR).

#### Pied de page (fixe, via `base_document.html`)
- Numéro série, date de génération.
- **QR code** (lien de vérification en base64 PNG).
- **Signature** du directeur (image ou placeholder).

---

## Dépendances

### Backend

Mises à jour requises dans `requirements.txt` :
```
qrcode==8.0        # Génération QR code
pdfkit==1.0.0      # Wrapper wkhtmltopdf
```

### Système

**wkhtmltopdf** doit être installé :
```bash
# Ubuntu/Debian
sudo apt install wkhtmltopdf

# macOS
brew install wkhtmltopdf

# Windows
# Télécharger depuis https://wkhtmltopdf.org/
```

### Python/Django

- Django 4.2+
- djangorestframework 3.15+
- Pillow (pour images, déjà présent)

---

## Configuration (Django settings)

Ajouter dans `settings.py` si nécessaire :
```python
# URL de base pour les liens de vérification dans les QR codes
DOCUMENTS_BASE_URL = 'https://monuniversite.edu'

# Ou en dev :
DOCUMENTS_BASE_URL = 'http://localhost:3000'
```

Si absent, le service utilise un chemin relatif `/verifier/{token}`.

---

## Exemple d'utilisation côté frontend

### Générer une attestation

```typescript
import { documentsApi } from '@/lib/api/documents'

const handleGenerateAttestation = async (etudiantId: number) => {
  try {
    const result = await documentsApi.create({
      etudiant: etudiantId,
      type_document: 'attestation_inscription',
      annee_universitaire: '2025-2026',
    })
    console.log('Attestation créée:', result.numero_serie)
    // Afficher un toast "Généré avec succès"
  } catch (error) {
    console.error('Erreur:', error)
  }
}
```

### Télécharger le PDF

```typescript
const handleDownloadPDF = async (docId: number) => {
  try {
    const blob = await documentsApi.download(docId)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attestation-${docId}.pdf`
    a.click()
  } catch (error) {
    console.error('Erreur téléchargement:', error)
  }
}
```

---

## Dépannage

### ❌ PDF non généré

**Symptômes** : `fichier_pdf` est vide après création.

**Causes possibles** :
1. **wkhtmltopdf non installé** → `python manage.py shell` → `import pdfkit` → erreur `OSError: wkhtmltopdf not found`.
   - **Solution** : installer wkhtmltopdf (voir « Dépendances »).
2. **qrcode non installé** → log warning « Module qrcode non disponible ».
   - **Solution** : `pip install qrcode[pil]`.
3. **Template non trouvé** → log warning « Pas de template pour type_document=... ».
   - **Solution** : vérifier que `documents/attestation_inscription.html` existe.

### ❌ Erreur 404 au téléchargement

**Symptôme** : `GET /documents/{id}/telecharger/` → 404.

**Cause** : Le fichier PDF n'existe pas sur le disque.

**Solution** : L'endpoint régénère automatiquement le PDF si absent. Si la régénération échoue, vérifier les logs Django.

### ⚠ QR code manquant

**Symptôme** : Le PDF est généré mais le QR code n'apparaît pas.

**Cause** : qrcode non installé OU erreur lors de l'encoding base64.

**Solution** :
1. Vérifier que `qrcode` est installé : `pip install qrcode[pil]`.
2. Vérifier les logs pour l'erreur spécifique.
3. Le template affiche quand même le document sans QR (non bloquant).

---

## Évolutions futures

- [ ] Signature électronique (PKI/certificat).
- [ ] Génération asynchrone via Celery (pour gros volumes).
- [ ] Archivage à long terme (Cloud Storage, S3).
- [ ] Autres types de documents (relevé de notes, diplôme).
- [ ] Validations supplémentaires (vérifier que l'étudiant a effectivement des inscriptions pédagogiques).
