# Endpoints — Gestion des documents officiels

## Base URL

```
http://localhost:8000/api/v1/documents/
```

## Endpoints disponibles

### 1. **Lister les documents** 
```
GET /api/v1/documents/
Authorization: Bearer <token>

Réponse (200 OK):
{
  "count": 5,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "numero_serie": "AI-2026-00001",
      "etudiant": 42,
      "etudiant_nom": "John Doe",
      "etudiant_matricule": "C12345",
      "type_document": "attestation_inscription",
      "annee_universitaire": "2025-2026",
      "fichier_pdf": "documents/officiels/AI-2026-00001.pdf",
      "est_valide": true,
      "date_generation": "2026-04-15T10:30:00Z"
    }
  ]
}
```

### 2. **Générer un nouveau document**
```
POST /api/v1/documents/generer/
Authorization: Bearer <token>

Body:
{
  "etudiant": 42,
  "type_document": "attestation_inscription",
  "annee_universitaire": "2025-2026",
  "semestre": null
}

Réponse (201 Created):
{
  "id": 5,
  "numero_serie": "AI-2026-00005",
  "token_verification": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "etudiant": 42,
  "type_document": "attestation_inscription",
  "annee_universitaire": "2025-2026",
  "fichier_pdf": "documents/officiels/AI-2026-00005.pdf",
  "est_valide": true,
  "date_generation": "2026-04-15T10:45:00Z"
}
```

### 3. **Récupérer un document spécifique**
```
GET /api/v1/documents/{id}/
Authorization: Bearer <token>

Réponse (200 OK):
{
  "id": 5,
  "numero_serie": "AI-2026-00005",
  ...
}
```

### 4. **Télécharger le PDF**
```
GET /api/v1/documents/{id}/telecharger/
Authorization: Bearer <token>

Réponse (200 OK):
- Fichier PDF binaire
- Header: Content-Disposition: attachment; filename="AI-2026-00005.pdf"
```

### 5. **Vérifier l'authenticité d'un document** (PUBLIC)
```
GET /api/v1/documents/verifier/{token}/
(Pas d'authentification requise)

Réponse (200 OK):
{
  "id": 5,
  "numero_serie": "AI-2026-00005",
  "etudiant": 42,
  "etudiant_nom": "John Doe",
  "type_document": "attestation_inscription",
  "annee_universitaire": "2025-2026",
  "est_valide": true,
  "date_generation": "2026-04-15T10:45:00Z"
}

Réponse (404 Not Found):
{
  "detail": "Document introuvable."
}
```

### 6. **Lister les registres de diplômes**
```
GET /api/v1/documents/registre-diplomes/
Authorization: Bearer <token>
```

### 7. **Exporter les registres en Excel**
```
GET /api/v1/documents/registre-diplomes/export/
Authorization: Bearer <token>

Réponse (200 OK):
- Fichier Excel (.xlsx)
- Header: Content-Disposition: attachment; filename="registre_diplomes.xlsx"
```

---

## Filtrage et recherche

### Lister les documents d'un étudiant
```
GET /api/v1/documents/?etudiant=42
```

### Lister par type de document
```
GET /api/v1/documents/?type_document=attestation_inscription
```

### Rechercher par numéro de série
```
GET /api/v1/documents/?search=AI-2026
```

### Filtrer par validité
```
GET /api/v1/documents/?est_valide=true
```

---

## Types de documents disponibles

```typescript
type TypeDocument = 
  | 'attestation_inscription'
  | 'releve_semestre'
  | 'releve_complet'
  | 'attestation_reussite'
  | 'diplome'
```

---

## Authentification

Tous les endpoints (sauf `/verifier/`) nécessitent un token JWT dans le header :
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Codes d'erreur

| Code | Erreur | Cause |
|------|--------|-------|
| 200 | OK | Requête réussie |
| 201 | Created | Document créé avec succès |
| 400 | Bad Request | Données invalides (ex: étudiant introuvable) |
| 401 | Unauthorized | Token absent ou invalide |
| 403 | Forbidden | Permissions insuffisantes (RBAC) |
| 404 | Not Found | Document ou ressource introuvable |
| 500 | Server Error | Erreur générale (check logs) |

---

## Exemple complet (cURL)

### Générer une attestation
```bash
curl -X POST http://localhost:8000/api/v1/documents/generer/ \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "etudiant": 42,
    "type_document": "attestation_inscription",
    "annee_universitaire": "2025-2026"
  }'
```

### Télécharger le PDF
```bash
curl -X GET http://localhost:8000/api/v1/documents/5/telecharger/ \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  --output attestation.pdf
```

### Vérifier un document (public)
```bash
curl -X GET "http://localhost:8000/api/v1/documents/verifier/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/"
```

---

## Notes d'implémentation

1. **Génération PDF asynchrone** : Actuellement synchrone. Pour gros volumes, implémenter Celery.
2. **Permissions RBAC** : Contrôlées via `RBACPermission(module='documents')`.
3. **Stockage PDF** : Sur disque dans `MEDIA_ROOT/documents/officiels/`. Évolutif vers S3.
4. **Validité des documents** : Champ `est_valide` (peut être invalidé manuellement).
5. **QR codes** : Pointent vers `/verifier/{token}` — configurable via `DOCUMENTS_BASE_URL`.

---

## Changelog

| Date | Changement |
|------|-----------|
| 2026-04-15 | Endpoints corrigés — dépuisé doublon `documents/documents/` |
| 2026-04-15 | Implémentation complète attestation d'inscription |
