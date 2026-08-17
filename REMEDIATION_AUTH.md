# Plan de remédiation — Authentification SIGA / GesAFPED

**Date :** 2026-04-12
**Auteur :** Audit automatisé (Claude)
**Périmètre :** backend `siga/` + frontend `gesafped_frontend/`

---

## Synthèse exécutive

L'audit a identifié **14 problèmes** dont **4 critiques** qui expliquent directement l'instabilité de l'authentification et la lenteur observée. Le problème le plus grave : `AXES_COOLOFF_TIME = 900` est interprété par axes comme **900 heures (37,5 jours)**, pas 900 secondes. Tout utilisateur bloqué reste bloqué plus d'un mois.

| Sévérité | Nombre |
|----------|--------|
| CRITIQUE | 4 |
| HAUTE | 5 |
| MOYENNE | 5 |

---

## CRITIQUE — Fonctionnalité cassée / faille de sécurité

### C1. `AXES_COOLOFF_TIME` interprété en heures, pas en secondes

**Fichier :** `siga/settings/base.py:192`
**Problème :** La configuration actuelle est :
```python
AXES_COOLOFF_TIME = config('AXES_COOLOFF_SECONDS', default=900, cast=int)  # 15 min ← FAUX
```
La documentation axes 8.x précise : *« Can be an integer interpreted as **hours** »*. Donc `900` = **900 heures = 37,5 jours** de blocage. C'est la cause racine du « Aucun compte actif » persistant même après attente.

**Impact :** Tout utilisateur bloqué (5 échecs) est verrouillé pendant plus d'un mois.

**Fix :**
```python
from datetime import timedelta
AXES_COOLOFF_TIME = timedelta(minutes=config('AXES_COOLOFF_MINUTES', default=15, cast=int))
```

---

### C2. `_forceLogout()` efface `sessionStorage` au lieu de `localStorage`

**Fichier :** `gesafped_frontend/lib/api.ts:39`
**Problème :** La fonction `_forceLogout` fait :
```typescript
sessionStorage.removeItem('gesafped_user');  // ← MAUVAIS
```
Mais `auth.ts` stocke l'utilisateur dans `localStorage` (clé `gesafped_user`). Le logout forcé (401 après échec refresh) ne supprime donc **pas** le user stocké. Au prochain chargement, `getStoredUser()` retourne un user fantôme → le dashboard s'affiche brièvement puis se casse.

**Impact :** Sessions zombies après expiration de token — le user voit un dashboard vide avant d'être redirigé.

**Fix :**
```typescript
localStorage.removeItem('gesafped_user');
localStorage.removeItem('gesafped_modules');
```

---

### C3. Token d'accès à 15 min dans `.env` vs inactivity timer à 20 min

**Fichier :** `siga/.env` → `JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15`
**Fichier :** `gesafped_frontend/app/dashboard/layout.tsx` → `INACTIVITY_MS = 20 * 60 * 1000`
**Problème :** Le `.env` force le token d'accès à **15 minutes**. Mais le timer d'inactivité est **20 minutes**. Le token expire **5 minutes avant** le timer d'inactivité → l'utilisateur reçoit des 401 silencieux au bout de 15 min, le refresh échoue aléatoirement, et l'app se déconnecte sans explication.

**Impact :** Déconnexions inexpliquées entre 15 et 20 minutes — l'utilisateur pense que l'app est instable.

**Fix :** Le token doit durer **plus longtemps** que le timer d'inactivité :
```env
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
```
Ou réduire l'inactivité à 10 min. Le refresh automatique (55 min) couvrira le reste.

---

### C4. Throttle global `AnonRateThrottle` bloque le endpoint des années

**Fichier :** `siga/settings/base.py:146-149`
**Problème :** `DEFAULT_THROTTLE_CLASSES` inclut `AnonRateThrottle` (20/min) appliqué **à tous les endpoints**. Le endpoint public `/api/v1/parametres/annees/all/` (utilisé par la page login sans auth) est soumis à ce throttle. Après 20 refreshes de la page login en 1 minute, le chargement des années est bloqué → le formulaire affiche « Chargement... » indéfiniment.

**Impact :** Page login inutilisable après multiples tentatives ou développement actif.

**Fix :** Retirer les throttle classes globaux et les appliquer uniquement là où nécessaire :
```python
'DEFAULT_THROTTLE_CLASSES': [],  # Pas de throttle global
```
Les endpoints sensibles ont déjà leurs propres `throttle_classes` (LoginView, ChangePasswordView, etc.).

---

## HAUTE — Performance et stabilité

### H1. `ProfilView` utilise `__import__()` à chaque requête

**Fichier :** `siga/apps/authentication/views.py:142-144`
**Problème :**
```python
parser_classes = __import__('rest_framework.parsers', ...).MultiPartParser, \
                 __import__('rest_framework.parsers', ...).FormParser, \
                 __import__('rest_framework.parsers', ...).JSONParser
```
`__import__` est appelé **3 fois à chaque requête** au lieu d'un import classique au chargement du module.

**Fix :**
```python
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
# ...
class ProfilView(generics.RetrieveUpdateAPIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]
```

---

### H2. `CookieTokenRefreshView` sans throttle

**Fichier :** `siga/apps/authentication/views.py:132`
**Problème :** L'endpoint `/api/v1/auth/token/refresh/` est `AllowAny` sans aucun throttle. Un attaquant peut spammer les refresh pour tenter un token fixation ou simplement surcharger le serveur.

**Fix :**
```python
class CookieTokenRefreshView(TokenRefreshView):
    permission_classes = [AllowAny]
    throttle_classes   = [LoginRateThrottle]  # Même limite que login
```

---

### H3. `CookieTokenRefreshView` — hack `_mutable` fragile

**Fichier :** `siga/apps/authentication/views.py:125-129`
**Problème :**
```python
request.data._mutable = True if hasattr(request.data, '_mutable') else None
try:
    request.data['refresh'] = refresh
except Exception:
    pass
```
Ce hack échoue silencieusement avec certains parsers (`JSONParser` retourne un dict standard, pas un `QueryDict`). Le `try/except Exception: pass` avale toutes les erreurs → le refresh échoue silencieusement.

**Fix :**
```python
def post(self, request, *args, **kwargs):
    refresh = request.COOKIES.get(JWT_CONF.get('AUTH_COOKIE_REFRESH', 'refresh_token'))
    if not refresh:
        return Response({'error': 'Token de refresh absent.'}, status=400)
    # Construire un nouveau request.data propre
    from rest_framework.request import Request
    request._full_data = {'refresh': refresh}
    response = super().post(request, *args, **kwargs)
    # ...
```

---

### H4. `.env` `AXES_COOLOFF_SECONDS=300` écrase le default 900

**Fichier :** `siga/.env`
**Problème :** Le `.env` contient `AXES_COOLOFF_SECONDS=300` (5 minutes). Avec le fix C1 en place (`timedelta(minutes=...)`), il faudra utiliser `AXES_COOLOFF_MINUTES=15` dans le `.env`, sinon le cooloff sera de `timedelta(minutes=300)` = 5 heures.

**Fix :** Après le fix C1, supprimer l'ancienne variable et utiliser :
```env
AXES_COOLOFF_MINUTES=15
```

---

### H5. `fetchAndStoreModules()` bloque la fin du login

**Fichier :** `gesafped_frontend/lib/auth.ts:192`
**Problème :**
```typescript
export async function login(...): Promise<AuthUser> {
  // ... login API call ...
  await fetchAndStoreModules();  // ← bloquant, ajoute 200-500ms
  return user;
}
```
L'utilisateur attend le chargement des modules RBAC avant d'être redirigé au dashboard. Si le réseau est lent, la page login semble gelée.

**Fix :** Fire-and-forget — ne pas attendre :
```typescript
fetchAndStoreModules(); // pas de await — chargé en arrière-plan
return user;
```
Le dashboard layout charge déjà les modules s'ils sont absents.

---

## MOYENNE — Robustesse et qualité

### M1. Lockout frontend hardcodé à 15 min

**Fichier :** `gesafped_frontend/app/login/page.tsx:69`
**Problème :**
```typescript
setBlockedUntil(Date.now() + 15 * 60 * 1000); // hardcodé
```
Si le backend change la durée de lockout, le frontend affiche un compte à rebours faux.

**Fix :** Parser le header `Retry-After` de la réponse 429 ou extraire la durée du message d'erreur côté backend.

---

### M2. `custom_exception_handler` perd le contexte des erreurs de validation

**Fichier :** `siga/core/exceptions.py:13-18`
**Problème :** La fonction `_flatten()` concatène tous les messages d'erreur en une seule chaîne :
```python
{'username': ['Ce champ est requis.'], 'password': ['Ce champ est requis.']}
→ 'Ce champ est requis. Ce champ est requis.'
```
Les erreurs de validation par champ sont perdues.

**Fix :** Préserver la structure pour les 400, aplatir uniquement pour les autres codes :
```python
if response.status_code == 400 and isinstance(response.data, dict):
    response.data = {'status': 400, 'errors': response.data}
else:
    response.data = {'status': response.status_code, 'error': _flatten(response.data)}
```

---

### M3. `LockedAttemptsView` fait N+1 queries

**Fichier :** `siga/apps/authentication/views.py:329-370`
**Problème :** Pour chaque `AccessAttempt`, une requête séparée `User.objects.get(username=...)` est exécutée.

**Fix :** Prefetch tous les usernames d'un coup :
```python
usernames = [a.username for a in attempts if a.username]
users_map = {u.username: u for u in User.objects.filter(username__in=usernames)}
```

---

### M4. Pas de `path='/'` explicite sur les cookies JWT

**Fichier :** `siga/apps/authentication/views.py:42-53`
**Problème :** `response.set_cookie(...)` utilise le `path` par défaut de Django (`/`), ce qui est correct. Mais en production derrière un reverse proxy avec un prefix path, les cookies pourraient ne pas être envoyés pour certaines routes.

**Fix :** Ajouter `path='/'` explicitement pour la clarté et la sécurité :
```python
response.set_cookie(..., path='/')
```

---

### M5. Cross-tab logout incomplet

**Fichier :** `gesafped_frontend/lib/auth.ts:209-210`
**Problème :** Le signal de logout inter-onglets utilise :
```typescript
localStorage.setItem('gesafped_logout', Date.now().toString());
localStorage.removeItem('gesafped_logout');
```
Mais `dashboard/layout.tsx` n'écoute pas l'événement `storage` sur cette clé. Les autres onglets ne se déconnectent pas.

**Fix :** Ajouter dans le `useEffect` du layout :
```typescript
const onStorage = (e: StorageEvent) => {
  if (e.key === 'gesafped_logout') handleLogout();
};
window.addEventListener('storage', onStorage);
```

---

## Ordre d'exécution recommandé

| Priorité | ID | Effort | Description |
|----------|----|--------|-------------|
| 1 | C1 | 5 min | Fix `AXES_COOLOFF_TIME` → `timedelta(minutes=15)` |
| 2 | C3 | 2 min | Fix `.env` → `JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60` |
| 3 | C2 | 2 min | Fix `_forceLogout` → `localStorage` |
| 4 | C4 | 3 min | Retirer throttle global, garder par-endpoint |
| 5 | H1 | 2 min | Fix `__import__` dans ProfilView |
| 6 | H3 | 5 min | Fix `CookieTokenRefreshView` — supprimer hack `_mutable` |
| 7 | H2 | 1 min | Ajouter throttle sur refresh endpoint |
| 8 | H4 | 1 min | Fix `.env` `AXES_COOLOFF_MINUTES=15` |
| 9 | H5 | 1 min | Fire-and-forget `fetchAndStoreModules()` |
| 10 | M1-M5 | 15 min | Fixes moyens (robustesse) |

**Temps total estimé : ~40 minutes**

---

## Après remédiation — Checklist de validation

- [ ] Login avec bonnes credentials → succès immédiat
- [ ] Login avec mauvaises credentials x5 → blocage 15 min avec message français
- [ ] Déblocage via `/dashboard/deblocage` → login fonctionne immédiatement
- [ ] F5 sur le dashboard → session maintenue (pas de redirect /login)
- [ ] Nouvel onglet → session maintenue
- [ ] 20 min sans activité → warning à 19 min → logout à 20 min
- [ ] Chargement des années sur /login → < 200ms (cache)
- [ ] Token refresh automatique toutes les 55 min → pas de 401
- [ ] Fermeture d'un onglet → les autres restent connectés
- [ ] Logout → tous les onglets redirigés vers /login
