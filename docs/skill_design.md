# Design System — GesAFPED Frontend

Document de référence du design de l'application. Couvre identité visuelle, typographie, couleurs, espacement, composants, patterns UI, états et règles d'accessibilité. Source de vérité pour toute nouvelle page ou composant.

---

## 1. Principes

- **Clarté avant esthétique** : chaque écran doit permettre de lire, filtrer et agir sans friction.
- **Cohérence** : mêmes composants, mêmes espacements, mêmes couleurs pour la même intention.
- **Densité maîtrisée** : les pages administratives privilégient la densité d'information, pas le « hero ».
- **Français uniquement** : tous les libellés, dates et messages sont en français.
- **Feedback immédiat** : chaque action utilisateur produit une réponse visuelle (loading, toast, modale).
- **Rôles d'abord** : l'UI s'adapte au rôle de l'utilisateur (voir [lib/auth.ts](../lib/auth.ts)).

---

## 2. Identité visuelle

### Palette de couleurs

| Rôle         | Hex       | Usage                                                      |
| ------------ | --------- | ---------------------------------------------------------- |
| Primaire     | `#006633` | Boutons principaux, liens, en-têtes, états actifs          |
| Secondaire   | `#C82020` | Actions destructives, erreurs, alertes critiques           |
| Accent       | `#E5C018` | Mises en avant, badges, états en attente                   |
| Fond app     | `#f8fafc` | Arrière-plan global ([app/globals.css](../app/globals.css)) |
| Texte base   | `#0a0f1a` | Texte principal                                            |
| Texte muted  | `#64748b` | Labels de colonnes, texte secondaire                       |
| Bordures     | `#e2e8f0` | Séparateurs de tableaux, cartes                            |
| Hover row    | `#f8fafc` | Survol des lignes de tableau                               |

**Règles** :
- Ne jamais introduire de nouvelle couleur sans l'ajouter ici d'abord.
- Les actions destructives (supprimer, désactiver) utilisent **toujours** le rouge `#C82020`.
- Les statuts utilisent : vert (validé), rouge (refusé), jaune (en attente), gris (brouillon).

### Typographie

- **Famille** : `Cairo` (300–900), chargée via Google Fonts dans [app/globals.css](../app/globals.css).
- **Titres de page** : `text-2xl font-bold` (ou `text-3xl` pour les dashboards).
- **Titres de section** : `text-lg font-semibold`.
- **Corps** : `text-sm` (défaut tableau) ou `text-base`.
- **Labels de colonne** : `text-xs uppercase tracking-wider text-slate-500`.
- **Chiffres / KPI** : `font-bold tabular-nums`.

### Iconographie

- Librairie unique : **Lucide React**.
- Taille par défaut : `w-4 h-4` (inline) ou `w-5 h-5` (boutons).
- Couleur : hérite du texte ; pas de SVG custom sauf demande explicite.

---

## 3. Grille & espacement

- **Conteneur page** : `p-6` (24 px) sur desktop, `p-4` sur mobile.
- **Gap vertical entre sections** : `space-y-6`.
- **Gap dans une section** : `space-y-4` ou `gap-4` (grid/flex).
- **Padding cellule tableau** : `0.75rem 1rem` (défini dans `.data-table`).
- **Rayons** : `rounded-lg` (8 px) pour cartes et modales, `rounded-md` pour inputs/boutons.
- **Ombres** : `shadow-sm` pour cartes, `shadow-lg` pour modales ; pas d'ombre colorée.

**Breakpoints Tailwind** (par défaut) :
- `sm` 640 / `md` 768 / `lg` 1024 / `xl` 1280.
- Les tables passent en scroll horizontal sous `md`.

---

## 4. Composants standards

### Boutons

| Variante    | Classes cibles                                                       | Usage                          |
| ----------- | -------------------------------------------------------------------- | ------------------------------ |
| Primaire    | `bg-[#006633] text-white hover:bg-[#00552a] px-4 py-2 rounded-md`    | Action principale de l'écran   |
| Secondaire  | `border border-slate-300 text-slate-700 hover:bg-slate-50`           | Annulation, retour             |
| Destructif  | `bg-[#C82020] text-white hover:bg-[#a31a1a]`                         | Suppression, désactivation     |
| Ghost       | `text-[#006633] hover:bg-[#006633]/10`                               | Icônes de tableau, actions in  |

Règles :
- Un seul bouton primaire par vue.
- Les boutons destructifs sont **toujours** précédés d'une confirmation (voir [ConfirmModal](../components/ConfirmModal.tsx)).
- États `disabled` : `opacity-50 cursor-not-allowed`.

### Inputs & formulaires

- **Input texte** : `w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#006633]/40`.
- **Label** : au-dessus du champ, `text-sm font-medium text-slate-700 mb-1`.
- **Erreur de champ** : `text-xs text-[#C82020] mt-1`.
- **Champ requis** : astérisque rouge après le label.
- **Validation** : côté client minimale ; la vérité vient de l'API. Les erreurs serveur s'affichent via [flash.ts](../lib/flash.ts) et/ou sous le champ.

### Tableaux de données

Style défini dans [app/globals.css](../app/globals.css) (classe `.data-table`). Règles :
- En-têtes : fond `#f8fafc`, texte `uppercase text-xs text-slate-500`.
- Lignes : bordure basse `#f1f5f9`, survol `#f8fafc`.
- **Toujours** inclure : recherche, pagination ([Pagination](../components/Pagination.tsx)), état vide, état de chargement.
- Actions de ligne : icônes Lucide à droite, `ghost` variante.
- Colonnes numériques : `text-right tabular-nums`.

### Cartes

- `bg-white rounded-lg shadow-sm border border-slate-200 p-4`.
- En-tête carte : titre `text-base font-semibold` + actions à droite.
- Utilisées pour les KPI, formulaires et blocs de paramètres.

### Modales

- Composant de référence : [ConfirmModal](../components/ConfirmModal.tsx).
- Overlay : `bg-black/40`, centrage flex.
- Panneau : `bg-white rounded-lg shadow-lg max-w-md w-full p-6`.
- Titre `text-lg font-semibold`, corps `text-sm`, boutons alignés à droite (`flex justify-end gap-2`).
- Fermeture : clic overlay, touche Échap, bouton Annuler.

### Badges & statuts

- `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium`.
- Mapping statut → couleur cohérent dans toute l'app :
  - Validé / Actif : vert (`bg-green-100 text-green-700`).
  - En attente : jaune (`bg-yellow-100 text-yellow-700`).
  - Refusé / Inactif : rouge (`bg-red-100 text-red-700`).
  - Brouillon / Neutre : gris (`bg-slate-100 text-slate-700`).

### Toasts (flash)

- Unique source : [lib/flash.ts](../lib/flash.ts).
- Types : `success` (vert), `error` (rouge), `info` (bleu), `warning` (jaune).
- Durée par défaut : 3 s ; messages d'erreur : 5 s.
- **Interdit** : `alert()` natif, `console.log` pour le feedback utilisateur.

---

## 5. Layouts

### Page dashboard type

```
┌──────────────────────────────────────────────┐
│ Header global (logo, user, rôle, déconnexion)│
├────────┬─────────────────────────────────────┤
│        │ Titre de page                       │
│ Sidebar│ ─────────────────────────────────── │
│ (nav)  │ Barre d'actions (filtres, +)        │
│        │ ─────────────────────────────────── │
│        │ Contenu (tableau / cartes)          │
│        │ ─────────────────────────────────── │
│        │ Pagination                          │
└────────┴─────────────────────────────────────┘
```

- Sidebar : fixe à gauche sur desktop, drawer sur mobile.
- Navigation filtrée par rôle.
- Zone contenu : `max-w-7xl mx-auto` pour limiter la largeur.

### Page de formulaire

- Une carte unique, `max-w-2xl`, champs empilés verticalement.
- Boutons en bas, alignés à droite : `Annuler` (secondaire) puis `Enregistrer` (primaire).

---

## 6. États obligatoires

Chaque vue qui charge des données **doit** gérer explicitement :

1. **Loading** : skeleton ou spinner centré, jamais un écran blanc.
2. **Error** : message clair en français + bouton « Réessayer ».
3. **Empty** : illustration/texte « Aucun élément » + CTA de création si pertinent.
4. **Success** : données rendues.

Les composants consomment ces 4 états via `useState` séparés (`loading`, `error`, `data`).

---

## 7. Accessibilité

- Contraste texte / fond ≥ **4.5:1** (WCAG AA).
- Tous les champs ont un `<label>` associé (`htmlFor`).
- Navigation clavier : `tab` ordonné, `Échap` ferme modales, `Entrée` soumet formulaires.
- Icônes seules = `aria-label`.
- Ne jamais utiliser la couleur seule pour transmettre un statut (ajouter icône ou texte).
- Support RTL non requis pour l'instant (app FR).

---

## 8. Responsive

- **Mobile-first** : les classes de base visent mobile, puis `md:` / `lg:` pour desktop.
- Tables : `overflow-x-auto` dans un wrapper pour éviter les débordements.
- Sidebar : devient un drawer animé sous `lg`.
- Modales : `w-[95%]` sur mobile, `max-w-md` au-delà.
- Les tailles de police ne changent pas entre breakpoints, seul le layout s'adapte.

---

## 9. Animations & transitions

- Utiliser Tailwind : `transition-colors`, `transition-opacity`, `duration-150` à `duration-300`.
- **Interdit** : animations décoratives lourdes, parallax, confetti.
- Autorisé : fade pour modales, slide pour drawers, highlight de ligne au survol.

---

## 10. Anti-patterns à refuser

- Couleurs hors palette.
- Police autre que Cairo.
- `fetch` direct hors [lib/api.ts](../lib/api.ts).
- CSS global hors [app/globals.css](../app/globals.css).
- Libellés en anglais.
- `alert()` / `confirm()` natifs.
- Composants de classe React.
- Librairies UI lourdes (MUI, AntD, Chakra) : rester en Tailwind pur.
- Introduire un state global (Redux, Zustand) sans validation préalable.

---

## 11. Checklist avant merge

- [ ] Palette et typographie respectées.
- [ ] États loading / error / empty / success gérés.
- [ ] Rôle utilisateur vérifié pour les actions sensibles.
- [ ] Libellés 100 % en français.
- [ ] Appels API via `apiFetch` / `apiFetchPaginated`.
- [ ] Feedback via `flash.ts`, pas d'`alert`.
- [ ] Responsive testé `sm` / `md` / `lg`.
- [ ] Accessibilité clavier vérifiée.
- [ ] `npm run lint` passe.

---

## 12. Références

- [lib/api.ts](../lib/api.ts) — client HTTP unique.
- [lib/auth.ts](../lib/auth.ts) — rôles et permissions.
- [lib/flash.ts](../lib/flash.ts) — toasts.
- [components/ConfirmModal.tsx](../components/ConfirmModal.tsx) — modale de confirmation.
- [components/Pagination.tsx](../components/Pagination.tsx) — pagination standard.
- [app/globals.css](../app/globals.css) — styles globaux et `.data-table`.
- [CODE_REVIEW.md](../CODE_REVIEW.md), [REMEDIATION_AUTH.md](../REMEDIATION_AUTH.md), [SUIVI_MODULE_CONTEXT.md](../SUIVI_MODULE_CONTEXT.md).
