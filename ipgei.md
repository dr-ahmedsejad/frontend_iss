# Plan — Site web IPGEI (Institut Préparatoire aux Grandes Écoles d'Ingénieurs)

## Contexte

L'IPGEI (créé en 2015, Nouakchott) est l'institut préparatoire du **Groupe Polytechnique** mauritanien, sous double tutelle Ministère de la Défense Nationale + Ministère de l'Enseignement Supérieur. Il prépare les meilleurs bacheliers scientifiques aux concours d'entrée des grandes écoles d'ingénieurs (programme MPSI en 1re année, MP/PSI en 2e année), et alimente principalement le cycle ingénieur de l'ESP. Résultats récents exceptionnels (100% d'admissibles à certains concours internationaux 2024).

**Besoin** : un site institutionnel **moderne, attractif, multilingue (FR/AR/EN)**, doté d'un portail d'administration éditoriale, d'espaces enseignant/étudiant, d'un **module vidéo** (upload + intégration YouTube/Facebook) et d'un **module Suivi des Sortants** avec dashboard analytique et générateur de CV.

**Stack imposé** : Django REST Framework + MySQL (backend) ; Next.js 15 (App Router) + TypeScript + Tailwind CSS (frontend) ; déploiement local (médias servis par nginx).

**Décisions structurantes validées** :
- Portail admin = **app Next.js custom** (route `/admin` protégée), pas Django Admin
- Espaces enseignant/étudiant = **intégrés** au site Next.js (routes protégées)
- Stockage médias = **local Django + nginx** (pas de cloud)
- 4 rôles : `admin`, `redacteur`, `enseignant`, `etudiant`
- Vidéos : upload local (mp4/webm) **ou** intégration via URL YouTube/Facebook
- Suivi des Sortants : profil rempli par l'étudiant devenu sortant + dashboard admin (Chart.js) + générateur CV PDF

---

## Architecture cible

### Arborescence proposée

```
C:\react_projects\IPGEI\
├── ipgei-backend\         # Django REST API
│   ├── config\            # settings (base, dev, prod), urls, wsgi
│   ├── apps\
│   │   ├── accounts\      # User custom, rôles, JWT
│   │   ├── content\       # Annonces, communiqués, catégories, sliders
│   │   ├── academic\      # Programmes, filières, calendrier, ressources
│   │   ├── people\        # Enseignants, profils étudiants
│   │   ├── media_lib\     # Upload, validation, transformation images
│   │   ├── videos\        # Vidéos (upload local + embeds YouTube/Facebook)
│   │   ├── alumni\        # Suivi des sortants, statistiques, CV
│   │   └── i18n_content\  # Traductions FR/AR/EN des contenus
│   ├── core\              # Permissions, paginations, exceptions, mixins
│   ├── tests\
│   ├── media\             # Uploads (servis par nginx en prod)
│   ├── static\
│   ├── manage.py
│   ├── requirements\      # base.txt, dev.txt, prod.txt
│   └── docker-compose.yml
└── ipgei-frontend\        # Next.js 15 App Router
    ├── src\
    │   ├── app\
    │   │   └── [locale]\
    │   │       ├── (site)\           # Pages publiques
    │   │       ├── (auth)\           # Login, mot de passe
    │   │       ├── admin\            # Portail admin (rôles admin/redacteur)
    │   │       ├── espace-enseignant\
    │   │       ├── espace-etudiant\
    │   │       └── espace-sortant\   # Profil sortant + CV builder
    │   ├── components\
    │   │   ├── ui\                   # Atomes (button, input, card)
    │   │   ├── layout\               # Header, footer, nav, language-switcher
    │   │   ├── site\                 # Hero, slider, news-card, program-card, video-player
    │   │   ├── admin\                # DataTable, MediaPicker, RichEditor, ChartCard
    │   │   ├── alumni\               # AlumniForm, CVBuilder, CVTemplate
    │   │   └── charts\               # Wrappers Chart.js (Bar, Pie, Map)
    │   ├── lib\
    │   │   ├── api\                  # Client HTTP, endpoints typés
    │   │   ├── auth\                 # Session, JWT, middleware
    │   │   ├── i18n\                 # Config next-intl, helpers RTL
    │   │   ├── pdf\                  # Génération PDF (CV)
    │   │   └── utils\
    │   ├── hooks\                    # useAuth, useApi, usePagination
    │   ├── messages\                 # fr.json, ar.json, en.json (UI strings)
    │   ├── types\                    # Types partagés (générés depuis OpenAPI)
    │   └── middleware.ts             # i18n + auth guard
    ├── public\
    └── package.json
```

### Architecture en couches (backend)

`URL → View (DRF) → Serializer → Service (logique métier) → Repository (queries) → Model`

- **Views** : minces, validation HTTP, pagination, permissions
- **Serializers** : (dé)sérialisation, validation de format
- **Services** : règles métier (publication d'une annonce, rotation slider, calcul stats sortants…)
- **Repositories** : encapsulent les querysets complexes
- **Models** : données + invariants simples

### Architecture en couches (frontend)

`Page (Server Component) → Container (logique) → Presentational (UI) ; data fetching via lib/api typé ; mutations via Server Actions ou hooks SWR.`

---

## Phase 0 — Setup, fondations, conventions (semaine 1)

### Backend
1. Créer `ipgei-backend/` avec Django 5.x + DRF, env Python 3.12, `pip-tools` pour les locks
2. Configurer **MySQL 8** (utilisateur dédié, charset utf8mb4), settings split (`base`, `dev`, `prod`)
3. Installer le socle : `djangorestframework`, `djangorestframework-simplejwt`, `django-cors-headers`, `django-filter`, `drf-spectacular` (OpenAPI), `Pillow`, `python-decouple`, `python-magic` (validation MIME), `WeasyPrint` (génération PDF CV)
4. Configurer **CORS** strict (whitelist front uniquement), **CSRF** pour cookies, headers sécurité (`SECURE_*`, `X_FRAME_OPTIONS=DENY`)
5. Logging structuré JSON, rotation, niveaux par environnement
6. Pre-commit : `ruff`, `black`, `mypy`, `bandit` (sécurité)
7. Pytest + `pytest-django` + `factory_boy`

### Frontend
1. Créer `ipgei-frontend/` avec `create-next-app@latest` (TS, Tailwind v4, App Router, ESLint)
2. Installer : `next-intl` (i18n + RTL), `@tanstack/react-query`, `zod`, `react-hook-form`, `lucide-react`, `clsx`, `tailwind-variants`, `next-themes`, `chart.js` + `react-chartjs-2`, `react-player` (lecture vidéo unifiée local/YouTube/Facebook)
3. Composants UI : **shadcn/ui** (copy-paste, contrôle total)
4. Tailwind config : palette IPGEI (vert #2e7d32, rouge #c62828, doré #fbc02d — à valider depuis le logo), polices (Inter pour FR/EN, Noto Sans Arabic pour AR)
5. ESLint + Prettier + Husky + lint-staged
6. Configuration `next.config.js` : image optimization, headers sécurité (CSP, HSTS, X-Frame-Options), redirects vers locale par défaut, autoriser embeds (`frame-src` YouTube + Facebook dans la CSP)

### Livrables Phase 0
- Repos initialisés, CI minimale qui lance lint+tests
- README setup + `.env.example` documenté
- API DRF répond `200 /api/health/`
- Front Next.js sert page d'accueil vide stylée

---

## Phase 1 — Modèle de données et authentification (semaines 2-3)

### Modèles backend (apps)

**accounts**
- `User` custom (email = identifiant, pas username), champs `role` (enum), `is_active`, `last_login_ip`
- `Role` : `admin`, `redacteur`, `enseignant`, `etudiant` (via `groups` Django ou champ enum + permissions DRF)
- `TeacherProfile`, `StudentProfile` (OneToOne avec User, infos métier)
- Statut étudiant : champ `student_status` (`actif`, `sortant`, `diplome`) → bascule automatique en `sortant` une fois fin de cycle (déclenche accès à l'espace sortant)

**content**
- `Category` (slug, nom traduit, parent pour hiérarchie : Communiqué, Annonce, Évènement, Concours…)
- `Article` (title, slug, cover_image, body riche, category FK, author FK, status: draft/scheduled/published, published_at, is_pinned)
- `Slider` (title, subtitle, image, cta_label, cta_url, order, is_active, start_date, end_date)
- `Tag` (M2M avec Article)
- `Attachment` (Article 1—N, file, label) pour les PDFs
- `Page` (statique : présentation, mot du directeur, contact… body riche traduit)

**videos**
- `Video` (title, description, slug, category FK, source_type: `local|youtube|facebook`, file (FileField, si local), external_url (si embed), thumbnail, duration_sec, published_at, is_active, view_count)
- Validation upload : taille max (configurable, ex 200 Mo), formats autorisés (mp4, webm), type MIME réel via `python-magic`
- Génération automatique de la miniature (FFmpeg si local, fetch oEmbed si YouTube/Facebook)
- Endpoint streaming via X-Accel-Redirect nginx (range requests pour seek)

**academic**
- `Program` (MPSI, MP, PSI) avec description traduite
- `Course` (ressource pédagogique, FK Program, attached_file, restriction visibilité)
- `Schedule` (calendrier scolaire / examens)

**alumni** (nouveau)
- `AlumniProfile` (OneToOne User étudiant, `graduation_year`, `gender`, `current_country`, `current_city`, `current_establishment`, `current_program`/spécialité, `degree_level` enum [licence/master/doctorat/autre], `is_employed` bool, `employer`, `position`, `linkedin_url`, `bio`, `last_updated`, `is_public` bool)
- `CV` (OneToOne AlumniProfile ou User) regroupant les sections du CV — peut être stocké en JSON pour souplesse :
  - `personal_info` (photo, nom, date naissance, contact, adresse)
  - `summary` (résumé pro)
  - `academic_cursus` (1-N entrées : établissement, diplôme, dates, mention)
  - `professional_experiences` (1-N : entreprise, poste, dates, descriptif, réalisations)
  - `languages` (1-N : langue, niveau CECRL)
  - `skills` (techniques + soft skills)
  - `hobbies` / centres d'intérêt
  - `references` (optionnel)
  - `template_choice` (template_1 / template_2 / template_3 — pour CV builder)

**i18n_content**
- Stratégie : **traductions par champ** via `django-modeltranslation` (mature, simple)

### Authentification
- **JWT (access 15min + refresh 7j)** stockés en cookies `httpOnly` + `Secure` + `SameSite=Lax`
- Endpoints : `/api/auth/login/`, `/api/auth/refresh/`, `/api/auth/logout/`, `/api/auth/me/`
- Throttling DRF sur login (anti brute-force)
- Reset password par email (lien signé, expiration 1h)
- Permissions DRF granulaires par rôle (`IsAdmin`, `IsRedacteurOrAdmin`, `IsEnseignant`, `IsEtudiant`, `IsSortant`)

### Livrables Phase 1
- Migrations MySQL appliquées (tables alumni, videos incluses)
- Schéma OpenAPI auto-généré et publié sur `/api/schema/` + Swagger UI
- Tests unitaires sur permissions et auth (couverture ≥ 80% sur accounts)
- Seed data : 1 admin, 1 redacteur, 2 catégories, 3 articles, 2 vidéos (1 locale + 1 YouTube), 5 sortants

---

## Phase 2 — Site public vitrine (semaines 4-6)

### Rubriques essentielles

1. **Accueil** : hero/slider plein écran, chiffres clés (taux d'admissibilité, nb étudiants, **nb de sortants placés**), dernières annonces, programmes en bref, CTA "Concours d'entrée"
2. **Présentation** : Histoire, mission, mot du Directeur, organigramme, tutelles
3. **Formations** : MPSI (1re année), MP / PSI (2e année), volume horaire, débouchés (ESP + grandes écoles internationales)
4. **Vie étudiante** : conditions d'admission, hébergement, restauration, santé, bourse, encadrement militaire
5. **Actualités** : annonces, communiqués (filtrables par catégorie + recherche + pagination)
6. **Concours & Résultats** : calendrier, modalités, palmarès des admissibles
7. **Galerie** : photos (lightbox) + **vidéos** (player unifié `react-player` qui lit local/YouTube/Facebook), filtres par catégorie
8. **Nos Sortants** (page publique) : carte/liste des sortants ayant accepté de figurer publiquement, mise en avant des parcours d'excellence (école, pays), témoignages
9. **Partenariats** : ESP, grandes écoles partenaires (X, Centrale, Mines…)
10. **Contact** : carte (Leaflet/OpenStreetMap, pas Google), formulaire (avec captcha), coordonnées
11. **FAQ**

### Implémentation
- **Server Components** par défaut (SSR pour SEO), Client Components uniquement pour interactivité
- Récupération données via `fetch` natif Next avec `revalidate` (ISR) — temps de cache court (60-300s) pour annonces, plus long (1h+) pour pages statiques
- Composants clés : `<Hero>`, `<Slider>` (Embla Carousel), `<NewsGrid>`, `<NewsCard>`, `<ProgramCard>`, `<StatCounter>`, `<Timeline>`, `<ContactForm>`, `<VideoPlayer>` (wrapper react-player), `<VideoCard>`, `<AlumniCard>`
- Formulaire contact → endpoint Django avec validation Zod côté front + DRF côté back, anti-spam (honeypot + rate limit)
- Player vidéo : lazy-loaded, poster image (thumbnail), contrôles natifs, support plein écran
- Dark mode optionnel (toggle dans header)

### Responsive
- Mobile-first Tailwind, breakpoints `sm/md/lg/xl/2xl`
- Test sur 320px (petit mobile) à 1920px+ (desktop)
- Menu burger mobile avec Sheet (shadcn)
- Player vidéo aspect-ratio préservé sur tous écrans (16/9 par défaut)

### Livrables Phase 2
- Toutes les pages publiques fonctionnelles en français
- Galerie vidéo avec au moins 1 vidéo locale + 1 YouTube + 1 Facebook lues correctement
- Page "Nos Sortants" affiche les profils publics
- Lighthouse ≥ 90 sur Mobile (Performance, Accessibility, Best Practices, SEO)
- Tests Playwright sur les parcours principaux

---

## Phase 3 — Internationalisation FR / AR / EN avec RTL (semaine 7)

### Stratégie
- **next-intl** avec routing `/[locale]/...`, locale par défaut `fr`, fallback `fr`
- 3 fichiers messages : `messages/fr.json`, `messages/ar.json`, `messages/en.json` (UI strings : labels, boutons, navigation)
- **Contenus dynamiques** (annonces, sliders, pages, vidéos, profils sortants) traduits côté backend via `django-modeltranslation` ; le front demande `?lang=ar` ou via header `Accept-Language`
- **RTL** : détection `dir="rtl"` quand `locale === 'ar'`, plugin Tailwind `tailwindcss-rtl` ou utilitaires logiques (`ms-*`, `me-*`)
- Police arabe : Noto Sans Arabic / Cairo (Google Fonts, self-hosted pour perf + RGPD)
- Switcher langue dans le header (3 drapeaux ou codes ISO)
- URLs traduites optionnel (`/fr/formations` vs `/ar/التكوين`) — recommandé pour SEO arabe
- CV builder : génération du PDF en FR, AR (RTL), EN avec polices embarquées (WeasyPrint supporte RTL natif)

### Backoffice
- Champ par champ par langue dans l'admin (3 onglets FR/AR/EN par formulaire)
- Indicateur visuel "traduction manquante"

### Livrables Phase 3
- Site entièrement navigable dans les 3 langues
- Tests visuels RTL (alignements, marges, icônes flèches inversées)
- Hreflang tags corrects sur toutes les pages
- CV PDF généré correctement en arabe (RTL)

---

## Phase 4 — Portail admin éditorial Next.js (semaines 8-10)

### Périmètre `/admin` (rôles `admin` + `redacteur`)

1. **Dashboard global** : KPIs (nb articles publiés, vues récentes, brouillons, sliders actifs, **nb vidéos**, **nb sortants enregistrés**)
2. **Articles** (CRUD + traduction)
   - Liste paginée, filtres (statut, catégorie, auteur, langue)
   - Éditeur riche **Tiptap** (gras, listes, liens, images, embed vidéo, tableaux)
   - Upload image cover + bibliothèque média
   - Sélecteur catégorie / tags
   - Programmation publication (date future)
   - Onglets de traduction FR/AR/EN
3. **Sliders** : drag & drop pour réordonner, preview live, dates de validité, image responsive (mobile/desktop)
4. **Vidéos** (CRUD)
   - Liste paginée, filtres (catégorie, source local/YouTube/Facebook, statut)
   - Formulaire d'ajout en 2 modes :
     - **Upload local** : drag & drop, barre de progression (upload chunké si > 50 Mo via `tus.io` ou `react-dropzone-uploader`), aperçu après upload, génération auto miniature (FFmpeg côté Django)
     - **Lien externe** : champ URL YouTube ou Facebook, parsing oEmbed pour récupérer titre/thumbnail, validation du format URL
   - Édition métadonnées (titre, description multi-langue, catégorie)
   - Preview embed dans l'admin avant publication
5. **Catégories** : arborescence, slug, traductions (incluant catégories vidéos : Conférences, Témoignages, Évènements, Présentation…)
6. **Pages statiques** : édition pages "Présentation", "Mot du directeur", etc.
7. **Médiathèque** : upload multi-fichiers, organisation par dossier, recherche, filtre par type, génération de variantes (thumb/medium/large via Pillow côté Django)
8. **Module Sortants & Statistiques** (voir Phase 6 pour le détail) : accès au dashboard analytique des sortants
9. **Utilisateurs** (admin only) : créer/désactiver, attribuer rôles, reset password, **basculer manuellement un étudiant en sortant**
10. **Audit log** : qui a fait quoi quand (modèle `ActivityLog` Django)

### Permissions par rôle

| Action | Admin | Redacteur |
|---|---|---|
| CRUD articles, sliders, médias, vidéos | ✅ | ✅ |
| Publier (vs juste brouillon) | ✅ | ✅ |
| Gérer catégories | ✅ | ❌ |
| Gérer utilisateurs | ✅ | ❌ |
| Voir dashboard sortants | ✅ | ✅ (lecture seule) |
| Exporter données sortants | ✅ | ❌ |
| Voir audit log | ✅ | ❌ |

### UX
- Layout dédié `/admin` : sidebar collapsible, breadcrumbs, toasts (sonner)
- DataTables avec tri / filtre / export CSV
- Auto-save brouillon toutes les 30s
- Confirmation avant suppression (dialog)
- Pour vidéos volumineuses : indicateur de progression upload + reprise sur erreur réseau

### Livrables Phase 4
- Portail admin pleinement fonctionnel, testé avec compte redacteur réel
- Upload vidéo local de 100 Mo réussi, embed YouTube et Facebook fonctionnels
- Documentation utilisateur (PDF court, FR + AR) pour les rédacteurs

---

## Phase 5 — Espaces enseignant et étudiant (semaines 11-12)

### Espace Enseignant (`/espace-enseignant`)
- Tableau de bord : mes cours, mes classes
- Dépôt de ressources pédagogiques (cours, TD, corrigés, **vidéos pédagogiques**) avec visibilité ciblée (MPSI / MP / PSI)
- Annonces internes (visibles uniquement par étudiants concernés)
- Mon profil (bio, photo, matières)
- Calendrier examens / surveillances

### Espace Étudiant (`/espace-etudiant`)
- Tableau de bord personnel
- Ressources pédagogiques de mes matières (téléchargement + lecture vidéo)
- Emploi du temps + calendrier examens
- Annonces internes ciblées (par classe / filière)
- Mon profil + changement mot de passe
- (Optionnel phase ultérieure : notes, absences si SI académique en place)

### Sécurité
- Routes serveur Next.js gardées par middleware (vérification cookie JWT + rôle)
- Endpoints DRF avec permissions strictes
- Téléchargement fichiers via URLs signées (X-Accel-Redirect nginx) pour éviter accès direct
- Vidéos pédagogiques privées : streaming avec token signé + expiration

### Livrables Phase 5
- Login → redirection automatique vers le bon espace selon rôle
- Tests E2E pour chaque rôle (enseignant ne voit pas espace étudiant et inversement)

---

## Phase 6 — Module Suivi des Sortants & Générateur de CV (semaines 13-15) — NOUVEAU

### Objectifs
1. Permettre à chaque étudiant **devenu sortant** de remplir et tenir à jour son profil post-IPGEI
2. Fournir à l'administration un **dashboard analytique** (Chart.js) sur la diaspora académique des sortants
3. Offrir au sortant un **générateur de CV PDF élégant** prêt à télécharger, conforme aux standards internationaux

### 6.1 Workflow de bascule en "sortant"
- Bascule automatique : à la fin du cycle (date de sortie configurée par admin) → `student_status = sortant` → l'utilisateur reçoit un email lui demandant de compléter son profil
- Bascule manuelle : un admin peut basculer ponctuellement un étudiant
- Une fois sortant, l'utilisateur perd l'accès à `/espace-etudiant` et gagne l'accès à `/espace-sortant`

### 6.2 Espace Sortant (`/espace-sortant`)

**Section "Mon parcours actuel"** (formulaire AlumniProfile)
- Genre, année de sortie IPGEI
- Pays actuel (combobox avec liste ISO + drapeau)
- Ville actuelle
- Établissement actuel (école d'ingénieur, université…)
- Spécialité / filière suivie
- Niveau (Licence / Master / Doctorat / Autre)
- Statut professionnel (étudiant / employé / les deux)
- Si employé : entreprise, poste
- LinkedIn / site personnel
- Bio courte (paragraphe)
- Case "rendre mon profil public sur le site IPGEI"
- Validation Zod côté front + DRF côté back, sauvegarde automatique brouillon

**Section "Mon CV"** (CV Builder)
- Photo de profil (crop carré, recommandé)
- Informations personnelles (nom, date de naissance, contact, adresse)
- Résumé professionnel (texte court)
- **Cursus académique** (ajout/suppression dynamique d'entrées) : établissement, diplôme, dates, mention
- **Expériences professionnelles** (ajout/suppression) : entreprise, poste, dates, description, réalisations (bullet points)
- **Langues** (ajout) : langue + niveau CECRL (A1-C2) ou descriptif
- **Compétences** : techniques (tags) + soft skills
- **Centres d'intérêt** (loisirs)
- **Références** (optionnel)
- Auto-save toutes les 30s
- Choix du **template** parmi 3 modèles élégants (modern, classic, executive)
- Bouton "Prévisualiser" → ouvre le PDF dans un nouvel onglet
- Bouton "Télécharger CV" → génère le PDF via WeasyPrint côté Django (templates HTML/CSS dédiés) ou via un service Node si on préfère côté Next (alternative : `@react-pdf/renderer`)
- Possibilité de générer le CV en FR / AR (RTL) / EN (chaque template doit supporter les 3)

**Stack PDF recommandé** : WeasyPrint (Python) côté Django — meilleur support RTL et polices arabes que les solutions JS, génération côté serveur pour cohérence.

### 6.3 Dashboard Admin "Sortants" (`/admin/sortants`)

**KPIs en haut**
- Nombre total de sortants
- Nombre ayant complété leur profil (taux de complétion)
- Nombre de pays représentés
- Nombre de spécialités représentées

**Graphiques (Chart.js via react-chartjs-2)**
- **Pie chart** : répartition par genre
- **Bar chart horizontal** : top 10 pays d'études
- **Bar chart vertical** : répartition par année de sortie
- **Pie/Doughnut** : répartition par spécialité
- **Bar chart** : répartition par niveau (Licence/Master/Doctorat)
- **Bar chart** : top 15 établissements d'accueil
- **Pie chart** : statut professionnel (étudiant/employé/les deux)
- **Carte interactive** (Leaflet + cluster markers) : géolocalisation des sortants par ville (anonymisée si profil non public)

**Filtres globaux** (s'appliquent à tous les graphiques)
- Année de sortie (multi-select)
- Pays (multi-select)
- Genre
- Programme IPGEI suivi (MPSI/MP/PSI)

**Liste détaillée**
- Tableau paginé de tous les sortants avec colonnes : nom, année sortie, pays, établissement, spécialité, dernière mise à jour
- Recherche full-text
- Export CSV / Excel
- Vue détail d'un sortant (profil complet + CV téléchargeable par admin)

### 6.4 Page publique "Nos Sortants" (`/nos-sortants`)
- Affiche uniquement les sortants ayant coché "rendre public"
- Carte mondiale interactive avec marqueurs (cluster)
- Liste filtrable par pays, école, année
- Carte profil (photo, nom, école actuelle, pays, année IPGEI)
- Génère du contenu attractif (preuve sociale de l'excellence IPGEI)

### 6.5 Sécurité & confidentialité
- Profil sortant privé par défaut → opt-in pour la version publique
- Données sensibles (date de naissance, contact, CV complet) jamais exposées sur la page publique
- Export admin protégé (audit log)
- Conformité minimale RGPD : droit à l'oubli (suppression compte → anonymisation profil)

### Livrables Phase 6
- Workflow bascule étudiant → sortant fonctionnel
- Profil sortant remplissable + statistiques temps réel sur le dashboard admin
- CV PDF téléchargeable dans les 3 langues, 3 templates visuellement professionnels
- Page publique "Nos Sortants" avec carte interactive
- Tests E2E : sortant remplit profil → dashboard admin reflète le changement → sortant télécharge CV PDF

---

## Phase 7 — SEO, performance, sécurité, accessibilité (semaine 16)

### SEO
- `app/sitemap.ts` dynamique (toutes les pages publiques + articles + vidéos + sortants publics, multi-locale)
- `app/robots.ts` (autorise public, bloque `/admin`, `/api`, espaces privés, `/espace-sortant`)
- Metadata dynamique par page (title, description, OG image, Twitter Card)
- **Hreflang** entre les 3 versions linguistiques
- JSON-LD `EducationalOrganization` sur l'accueil, `NewsArticle` sur les annonces, `VideoObject` sur les pages vidéo
- URLs propres (slug), canonical correct
- Soumission Google Search Console + Bing Webmaster
- Open Graph image générée dynamiquement (`opengraph-image.tsx`)

### Performance
- Images via `next/image` (AVIF/WebP), `priority` sur hero seulement
- Vidéos lazy-loaded (poster image, lecture après clic)
- Code splitting automatique App Router, pas de "use client" superflu
- Lazy loading des composants lourds (carrousels, éditeur Tiptap admin, CV Builder, Chart.js)
- Preconnect aux fonts, font-display swap
- Cache nginx agressif sur `/media/` et `/_next/static/`
- Compression Brotli/Gzip
- Bundle analyzer pour traquer les régressions
- Cible : **LCP < 2.5s, CLS < 0.1, INP < 200ms** sur 4G mobile

### Sécurité
- Headers : CSP stricte (avec `frame-src` autorisant uniquement YouTube + Facebook), HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Rate limiting DRF (login, contact, recherche, upload vidéo)
- Validation upload : type MIME réel (`python-magic`), taille max, scan basique, extensions autorisées strictes
- Cookies httpOnly + Secure + SameSite=Lax (Strict pour /admin)
- Protection CSRF sur mutations
- Hash mots de passe : Argon2 (config Django)
- Dépendances : `safety check` + `npm audit` en CI
- Logs des tentatives d'auth échouées + alerte si seuil dépassé
- Backup MySQL quotidien (mysqldump + rotation 30j)
- Données personnelles sortants : chiffrement au repos pour champs sensibles (option, via `django-cryptography`)

### Accessibilité (WCAG 2.1 AA)
- Contraste suffisant (vérifié sur palette IPGEI)
- Navigation clavier complète
- Attributs ARIA appropriés
- Alt textes sur toutes les images (champ obligatoire dans admin)
- Sous-titres / transcript pour les vidéos importantes
- Focus visible
- `lang` attribut correct par locale

### Livrables Phase 7
- Audit Lighthouse ≥ 95 sur les 4 axes
- Audit `axe-core` sans erreur critique
- Rapport sécurité (checklist OWASP Top 10 cochée)

---

## Phase 8 — Tests, CI/CD, déploiement (semaines 17-18)

### Tests
- **Backend** : pytest, couverture ≥ 80%, tests unitaires (services) + intégration (endpoints DRF) + permissions, tests spécifiques upload vidéo, génération CV PDF
- **Frontend** : Vitest pour utilitaires + composants ; Playwright pour E2E (parcours critiques : navigation publique 3 langues, login chaque rôle, création article, upload vidéo, lecture vidéo YouTube embed, profil sortant + CV PDF)

### CI (GitHub Actions ou GitLab CI)
- Lint + tests à chaque push
- Build frontend + backend
- Audit sécurité (`safety`, `npm audit`, `bandit`)
- Tests Lighthouse CI sur preview

### Déploiement
- Serveur Linux (Ubuntu 22.04 LTS) dédié IPGEI
- **Backend** : Gunicorn + nginx en reverse proxy, MySQL local, médias servis par nginx (range requests pour vidéos)
- **Frontend** : `next build` + `pm2` (ou `next start` derrière nginx)
- HTTPS obligatoire (Let's Encrypt + renouvellement auto)
- Sous-domaines : `www.ipgei.mr` (front), `api.ipgei.mr` (backend), `admin.ipgei.mr` (optionnel)
- Variables d'environnement via systemd / fichier `.env` chmod 600
- Backup automatique MySQL + `media/` (rsync vers serveur secondaire ou stockage externe)
- Monitoring : Uptime Kuma (gratuit), Sentry (free tier) pour erreurs front et back
- Logs centralisés (journald + rotation)
- Quotas disque pour uploads vidéo (alerte à 80% utilisation)

### Documentation
- README complet (setup local, déploiement)
- Doc API (Swagger UI déjà auto-générée)
- Guide rédacteur (PDF, FR + AR) incluant ajout vidéo
- Guide sortant (PDF, FR + AR + EN) : comment remplir profil et générer CV
- Runbook ops (backup/restore, redémarrage, mise à jour, ré-encodage vidéo)

### Livrables Phase 8
- Site en production sur `www.ipgei.mr`
- Pipeline CI vert
- Documentation complète

---

## Vérification end-to-end

Pour valider chaque phase :

1. **Phase 0** : `python manage.py runserver` et `npm run dev` démarrent sans erreur, page d'accueil s'affiche.
2. **Phase 1** : `curl -X POST /api/auth/login/` retourne JWT, `/api/auth/me/` renvoie le bon user/rôle. Tests pytest verts.
3. **Phase 2** : Navigation manuelle sur toutes les rubriques mobile + desktop, vidéo locale + YouTube + Facebook lues, page "Nos Sortants" affichée, test Lighthouse ≥ 90.
4. **Phase 3** : Switcher de langue change l'UI ET les contenus. Inspecter `dir="rtl"` en arabe. Vérifier hreflang dans le HTML.
5. **Phase 4** : Login en redacteur → créer article (3 langues) → publier → uploader une vidéo locale 100 Mo → ajouter une vidéo YouTube → vérifier affichage public.
6. **Phase 5** : Login enseignant → upload ressource → login étudiant correspondant → télécharger. Étudiant ne voit pas espace enseignant (403).
7. **Phase 6** : Bascule étudiant → sortant déclenche email + accès `/espace-sortant`. Sortant remplit profil → admin voit le profil dans le dashboard et les graphiques se mettent à jour. Sortant remplit son CV, le télécharge en PDF (FR, AR, EN), affichage propre des 3 templates.
8. **Phase 7** : Lighthouse, axe-core, scan OWASP ZAP basique.
9. **Phase 8** : Pipeline CI vert, déploiement reproductible, restauration backup testée.

---

## Estimation globale

**~18 semaines** pour livrer toutes les phases, MVP public exploitable dès la fin de Phase 3 (~7 semaines), module Sortants livré en semaine 15.

## Risques et points d'attention

- **Police arabe + RTL** : tester très tôt, l'arabe casse souvent les layouts conçus en LTR (vrai aussi pour le CV PDF arabe)
- **Modeltranslation** ajoute des colonnes par langue → plan de migration soigneux
- **Médias locaux** = pas de CDN ; prévoir cache nginx agressif et compression d'images systématique
- **Vidéos locales volumineuses** : prévoir quota disque, possibilité de ré-encodage automatique en h264 (FFmpeg) pour standardiser, et streaming HLS si besoin de qualité adaptative (phase ultérieure)
- **Embeds YouTube/Facebook** : CSP `frame-src` doit lister explicitement ces domaines, attention aux changements futurs des règles d'embed Facebook (parfois cassées)
- **CV PDF multi-langue avec RTL** : WeasyPrint gère bien mais tester avec textes longs en arabe (débordement)
- **Statistiques sortants** : prévoir matérialisation/cache des agrégats si volume important (Redis ou table de stats pré-calculée)
- **Vie privée sortants** : opt-in explicite obligatoire avant exposition publique, double confirmation pour suppression
- **Charte graphique** : valider tôt avec les responsables IPGEI (couleurs exactes, logos haute définition, photos officielles)
- **Données initiales** : prévoir une session de saisie / migration depuis l'ancien site `ipgei.mr`, et import éventuel d'une liste de sortants connus (CSV) pour amorcer le module

---

**Sources** :
- [IPGEI – site officiel](http://www.ipgei.mr/) (cert expiré)
- [ESP Nouakchott – Wikipédia](https://fr.wikipedia.org/wiki/%C3%89cole_sup%C3%A9rieure_polytechnique_de_Nouakchott)
- [AMI – Rôle de l'ESP en Mauritanie](https://ami.mr/fr/Depeche-37075.html)
- [Cridem – Résultats IPGEI 2024](https://cridem.org/C_Info.php?article=775513)
