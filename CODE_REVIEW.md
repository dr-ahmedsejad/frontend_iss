# Code Review - Authentification & Gestion des Comptes

## 📋 Synthèse Exécutive
Revue complète du module d'authentification Django et du frontend React de gestion des comptes, couvrant sécurité, performance, bonnes pratiques et scalabilité.

---

## ✅ POINTS FORTS

### Backend (Django)
1. **Architecture RBAC bien pensée**
   - Système hiérarchisé : RoleDefault (permissions par rôle) → UserPermission (surcharges individuelles)
   - Distinction claire : présence de record = permission accordée
   - Permet granularité et héritage par rôle

2. **JWT avec HttpOnly Cookies (excellente pratique)**
   - `_set_auth_cookies()` : tokens stockés en HttpOnly + Secure + SameSite
   - Protège contre XSS (JavaScript ne peut pas accéder aux tokens)
   - SameSite mitigue CSRF

3. **Logging structuré**
   - Suivi des tentatives login/logout
   - Facilite l'audit et le debugging

4. **Validation des mots de passe**
   - Utilisation de `validate_password` Django
   - `ChangePasswordView` vérifie ancien password

5. **Serializers bien structurés**
   - Séparation UserCreateSerializer vs UserUpdateSerializer
   - Validation `password2` pour confirmation

### Frontend (React)
1. **State management clair**
   - Hooks modernes (useState, useCallback, useMemo)
   - Séparation des états (loading, error, data)

2. **UX pensée**
   - Loading skeletons, empty states, confirmations
   - Toast notifications pour feedback
   - Filters + pagination

3. **Optimisations React**
   - `useCallback` avec dépendances appropriées
   - `useMemo` pour dérivations coûteuses
   - Optimistic updates (permissions page)

4. **Accessibilité minimale**
   - Labels formels, placeholders clairs
   - Eye icon pour toggle password visibility

5. **Design cohérent**
   - Palette de couleurs consistante
   - Components réutilisables

---

## ⚠️ POINTS FAIBLES

### Backend (Django) - CRITIQUE

#### 1. **Gestion d'erreurs insuffisante (views.py)**

**Problème 1 - Bare except avec logging**
```python
# views.py:59-61
try:
    serializer.is_valid(raise_exception=True)
except Exception:  # ❌ TROP LARGE
    logger.warning('Login failed for username=%s', request.data.get('username'))
    raise
```
- `except Exception` attrape TOUT (même SystemExit, KeyboardInterrupt)
- Les exceptions métier (ValidationError) ne sont pas distinguées
- Pas de distinction failed login vs. erreur serveur

**Problème 2 - Silent failures**
```python
# views.py:76-81 (LogoutView)
if refresh_token:
    try:
        token.blacklist()
    except TokenError:
        pass  # ❌ Silently ignores token errors
```
- Blacklist échouée → token toujours valide
- L'utilisateur pense être déconnecté mais ne l'est pas

**Problème 3 - CookieTokenRefreshView fragile**
```python
# views.py:97-101
request.data._mutable = True if hasattr(request.data, '_mutable') else None
try:
    request.data['refresh'] = refresh
except Exception:  # ❌ TROP LARGE + pas clair
    pass
```
- Mutation directe de `request.data`
- Le check `_mutable` est opaque

#### 2. **TOCTOU (Time-of-Check Time-of-Use) dans RBACMatrixView**
```python
# views.py:194-214
modules = Module.objects.all().order_by('ordre').prefetch_related('actions__action')
roles   = [r[0] for r in CustomUser._meta.get_field('role').choices]
rd_set  = set(RoleDefault.objects.values_list('role', 'module_action_id'))  # ← Race condition possible
```
- Entre le chargement et le rendu, RoleDefault peut changer
- Données potentiellement inconsistentes
- **Pas de transaction**

#### 3. **Validation insuffisante dans les endpoints RBAC**

```python
# views.py:310-318 (UserToggleView)
user_id = request.data.get('user_id')  # ❌ Pas de validation type
ma_id   = request.data.get('ma_id')
state   = request.data.get('state')

if not (user_id and ma_id and state):  # ❌ Permissive (0, False, "" passent)
    return Response({'error': ...}, status=400)
if state not in ('on', 'off', 'role'):
    return Response({'error': ...}, status=400)
```
- `user_id` et `ma_id` doivent être INT mais pas validés
- Un `user_id` invalide passe la vérification `if not`
- Pas de serializer pour validation

#### 4. **N+1 Queries pattern**

```python
# views.py:258-303 (UsersMatrixView)
users = User.objects.all().order_by('username')  # ← NO SELECT_RELATED
for u in users:  # ← Boucle N users
    for ma in module_actions:  # ← Boucle M actions
        # up_lookup.get((u.pk, ma.pk)) ← OK optimisé
```
- Charge TOUS les users en mémoire
- Le prefetch RoleDefault/UserPermission n'est pas optimal
- Avec 500 users × 100 actions = énorme

#### 5. **Pas de rate limiting sur endpoints sensibles**

```python
# views.py:50-67 (LoginView)
throttle_classes = [AnonRateThrottle]  # ✓ Login a rate limiting
```
- ✓ Login a rate limiting (bon)
- ❌ Mais `unblock()` (ligne 172-180) n'a PAS de rate limiting
- Quelqu'un peut bruteforce déblocage (l'endpoint prend un username)

```python
# views.py:137-148 (ChangePasswordView)
permission_classes = [IsAuthenticated]  # ❌ Pas de throttle
```
- Pas de limite sur tentatives de changement password
- Possible brute-force du ancien password

#### 6. **Fuite d'information (timing attack potentiel)**

```python
# views.py:74-80 (LogoutView)
refresh_token = request.COOKIES.get(JWT_CONF.get('AUTH_COOKIE_REFRESH', 'refresh_token'))
if refresh_token:
    try:
        token.blacklist()  # ← Timing différent si token exist vs. non exist
    except TokenError:
        pass
```
- Response time différente = attaquant peut savoir si token était valide
- Mineur mais possible

#### 7. **ProfilView mutation directe d'avatar**

```python
# views.py:111-133 (ProfilView)
parser_classes = __import__('rest_framework.parsers', fromlist=...).MultiPartParser
```
- ✓ Accepte MultiPartParser (bon pour files)
- ❌ Pas de validation de taille/type d'image
- Attaque : upload 1GB image → DoS serveur

#### 8. **Role bypass possible en certains cas**

```python
# views.py:275-291 (UsersMatrixView)
if is_admin_user:
    state = 'admin'  # ✓ Admin bypass
else:
    # Sérialise même les admins
```
```python
# views.py:327-328 (UserToggleView)
if u.role == 'admin' or u.is_superuser:
    return Response({'new_state': 'admin'})  # ✓ Protégé
```
- Incohérence : UserToggleView protège, mais d'autres endpoints pas uniform
- Pas de permission mixin réutilisable

### Frontend (React) - MAJEUR

#### 1. **XSS potentiel dans l'affichage des données**

```typescript
// app/dashboard/comptes/page.tsx:172
<td className="font-mono text-xs font-semibold text-iss-dark">{item.username}</td>
```
- ✓ React échappe HTML automatiquement (safe)
- ❌ MAIS l'avatar URL vient du serveur
```typescript
// serializers.py:35
'avatar': user.avatar.url if user.avatar else None,
```
- Si serveur injecte script dans avatar.url → XSS
- Frontend ne valide PAS les URLs

#### 2. **Pas de validation des réponses API**

```typescript
// app/dashboard/comptes/ajouter/page.tsx:40-47
try {
    await apiFetch('/api/v1/auth/users/', {
        method: 'POST',
        body: { username, name, email, role, password, password2 },
    });
```
- Pas de type checking de la réponse
- Si API renvoie `{ error: "<img src=x onerror='...'>"}` → possible XSS dans error display

```typescript
// app/dashboard/comptes/page.tsx:128
{error && <div className="rounded-2xl p-4 border bg-red-50 border-red-200 text-sm text-iss-secondary">{error}</div>}
```
- `{error}` est brute-forcé dans le DOM
- Si error vient d'une réponse non fiable → XSS

#### 3. **Pas de CSRF token (bien pour HttpOnly cookies, mais incomplet)**

```typescript
// apiFetch non visible mais semble utiliser fetch
const handleDelete = async () => {
    await apiFetch(`/api/v1/auth/users/${toDelete.id}/`, { method: 'DELETE' });
```
- ✓ HttpOnly cookies autorisent les cross-origin requests (CORS safe)
- ❌ Mais FAIRE un POST/DELETE sans CSRF token = risk
- Django attended `X-CSRFToken` header (sauf pour JWT)

#### 4. **Password confirmé ne valide PAS la force**

```typescript
// ajouter/page.tsx:35-38
const handleSave = async () => {
    if (!username.trim()) { setError("Le nom d'utilisateur est requis."); return; }
    if (!password)        { setError('Le mot de passe est requis.');       return; }
    if (password !== password2) { setError('Les mots de passe ne correspondent pas.'); return; }
```
- Seule vérif : présence + match
- Backend appelle `validate_password` (bon)
- **Frontend ne donne PAS de feedback avant submit**
- User upload weak password → erreur serveur → mauvaise UX

#### 5. **API fetch error handling trop générique**

```typescript
// app/dashboard/comptes/ajouter/page.tsx:47
catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); setSaving(false); }
```
- Le message d'erreur vient du serveur brut
- Si serveur renvoie HTML (erreur 500) → affiche HTML dans l'UI

#### 6. **Race condition sur load() + search**

```typescript
// app/dashboard/comptes/page.tsx:51-61
const load = useCallback(async (p = 1) => {
    // ...
    const data = await apiFetchPaginated<User>('/api/v1/auth/users/', params);
    setItems(data.results);
}, [search, filterRole]);  // ← search est dépendance

useEffect(() => { load(1); }, [load]);
```
- Si user change search + page rapidement → 2 appels concurrents
- Response 2 peut arriver avant response 1 → données inconsistentes

Meilleure approche :
```typescript
useEffect(() => {
    const controller = new AbortController();
    load(1, controller.signal);
    return () => controller.abort();
}, [search, filterRole, load]);
```

#### 7. **Affichage d'IDs sensibles**

```typescript
// app/dashboard/comptes/permissions/page.tsx:61-62
const key = `${row.user.id}:${cell.ma_id}`;
```
- User IDs sont exposés en clé d'état client
- Attaquant peut scraper IDs potentiels pour brute-force API

#### 8. **Pas de validation de permission côté client**

```typescript
// app/dashboard/comptes/permissions/page.tsx:262
onClick={() => !isAdminRow && handleToggle(user.id, ma.maId)}
disabled={isAdminRow}
```
- ✓ UI se désactive pour admins (bon)
- ❌ JavaScript côté client → attaquant peut enable le bouton
- Backend DOIT valider (et il le fait ✓)
- Mais : pas de feedback d'erreur si attaquant force l'appel

### Backend & Frontend - Architecture

#### 1. **Pas d'audit trail complet**

```python
# views.py:246
return Response({'detail': 'Permission mise à jour.', 'allowed': d['allowed']})
```
- Logging manquant sur modifications de permissions
- Qui a changé la permission? Quand? De quoi à quoi?

#### 2. **Pas d'invalidation du JWT à la déconnexion**

```python
# views.py:78-81 (LogoutView)
token.blacklist()  # Dépend de django-rest-framework-simplejwt
```
- ✓ Appelle blacklist
- ❌ Pas d'erreur si blacklist échoue (ligne 80: `except TokenError: pass`)
- Token peut rester valide côté serveur

#### 3. **Pas d'API rate limiting uniforme**

```python
# urls.py
```
- Manque rate limiting global
- Endpoints sensibles : unblock, password change, permissions toggle
- Pas de throttle différencié (login = strict, GET = permissive)

#### 4. **Avatar upload sans limite**

```python
# models.py:20
avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
```
- Pas de `max_length` sur le fichier
- Pas de validation `clean()` override
- DoS : quelqu'un upload 100MB d'images

---

## 🔒 SÉCURITÉ

### ✓ Bien Fait
- ✅ JWT en HttpOnly cookies
- ✅ SameSite=Lax par défaut
- ✅ Password validation server-side
- ✅ Vérification ancien password dans ChangePasswordView
- ✅ RBAC granulaire avec audit (théorique)

### ❌ Mauvais
- ❌ Bare `except Exception` (masque bugs)
- ❌ Validation insuffisante des inputs (user_id, ma_id)
- ❌ Pas de rate limiting sur endpoints sensibles
- ❌ Avatar upload sans limite de taille/type
- ❌ XSS potentiel via avatar URL non validée
- ❌ Erreurs API affichées brutes au frontend
- ❌ Pas d'audit trail des permissions
- ❌ Timing attacks possibles (logout)

### Recommandations Sécurité
1. **Remplacer `except Exception`** → `except (ValidationError, TokenError):`
2. **Ajouter serializers pour UserToggleView** :
   ```python
   class UserToggleSerializer(serializers.Serializer):
       user_id = serializers.IntegerField(min_value=1)
       ma_id = serializers.IntegerField(min_value=1)
       state = serializers.ChoiceField(choices=['on', 'off', 'role'])
   ```
3. **Ajouter rate limiting** :
   ```python
   from rest_framework.throttling import UserRateThrottle
   class CustomThrottle(UserRateThrottle):
       scope = 'custom'
   ```
4. **Valider avatars** :
   ```python
   def clean(self):
       if self.avatar.size > 5*1024*1024:  # 5MB max
           raise ValidationError("Image trop grande")
   ```
5. **Ajouter audit trail** :
   ```python
   class PermissionLog(models.Model):
       user = FK(User)
       changed_by = FK(User)
       action = CharField()
       timestamp = DateTimeField(auto_now_add=True)
   ```

---

## ⚡ PERFORMANCE

### Backend
#### ❌ Problèmes
1. **N+1 queries dans UsersMatrixView** 
   - 1 query users + 1 query module_actions + 1 query RoleDefault + 1 query UserPermission = 4 base
   - Avec 500 users → ~500 lookup queries supplémentaires
   - **Estimation** : 500 users = 6 secondes de query time

   **Optimisation** :
   ```python
   users = User.objects.all().order_by('username')
   module_actions = ModuleAction.objects.select_related('module', 'action').order_by('module__ordem', 'action__code')
   
   up_dict = {
       (up.user_id, up.module_action_id): up.allowed
       for up in UserPermission.objects.filter(departement__isnull=True)
   }
   rd_set = set(RoleDefault.objects.values_list('role', 'module_action_id'))
   
   # Maintenant boucles sans queries supplémentaires
   ```

2. **RBACMatrixView charge toutes les données en mémoire**
   - Avec 1000 modules × 100 actions = 100k objets
   - Serialisation JSON coûteuse
   - **Pas de pagination**

   **Solution** : Ajouter pagination ou limiter par module

#### ✓ Points Positifs
- Utilisation de `prefetch_related` (RBACMatrixView:195)
- Serializers évitent surcharges
- Caching possible sur /rbac/matrix (données static)

### Frontend
#### ❌ Problèmes
1. **Re-renders inutiles**
   ```typescript
   const load = useCallback(async (p = 1) => { ... }, [search, filterRole]);
   // ← load change à chaque fois que search/filterRole change
   // ← useEffect re-run même si juste l'ordre des dépendances change
   ```

2. **Pas de virtualisation dans permissions matrix**
   - Avec 500 users × 100 actions = 50k DOM nodes
   - **Performance catastrophique** au scroll

   **Solution** :
   ```typescript
   import { FixedSizeList } from 'react-window';
   ```

3. **State mutation dans defaults/page.tsx**
   ```typescript
   setCells(prev => ({ ...prev, [key]: !cur }));  // optimistic
   ```
   - Créé nouvel objet à chaque toggle
   - Avec 10k cells = lenteur

#### ✓ Points Positifs
- `useMemo` sur moduleGroups/visibleMAs
- Loading skeletons (bonne UX)
- Optimistic updates (permissions)

---

## 📈 SCALABILITÉ

### Backend

#### ❌ Problèmes de Scalabilité
1. **Pas de cache**
   - /rbac/matrix() rechargé à chaque requête
   - Données = static sauf lors de changement permission
   - **Solution** : Redis cache avec invalidation

   ```python
   from django.core.cache import cache
   
   def get(self, request):
       data = cache.get('rbac_matrix')
       if not data:
           # construire data
           cache.set('rbac_matrix', data, 3600)  # 1h
       return Response(data)
   ```

2. **Blacklist JWT réside en base de données**
   - Avec 10k utilisateurs = table massive
   - Chaque token logout = 1 INSERT
   - **Meilleure approche** : Redis pour blacklist (expiration auto)

3. **Pas de pagination RBAC endpoints**
   - UsersMatrixView charge TOUS les users
   - Avec 10k users = crash mémoire
   - Frontend doit paginer côté client = mauvaise UX

4. **RoleDefault lookup : O(n)**
   ```python
   rd_set = set(RoleDefault.objects.values_list('role', 'module_action_id'))
   ```
   - Avec 7 rôles × 1000 actions = 7000 records
   - Lookup O(1) mais gestion mémoire

#### ✓ Points de Scalabilité Positifs
- CustomUser utilise Django auth (extensible)
- RBAC design permet multi-tenancy (departement FK)
- Indexes sur (user, module_action) possibles

### Frontend

#### ❌ Problèmes de Scalabilité
1. **Pas de virtualisation**
   - permissions matrix : 500 users × 100 actions = énorme
   - DOM explosion au render

2. **Pas de pagination sur permissions**
   - Charger 10k lignes = freeze UI

3. **Pas de caching client**
   - Chaque visite /permissions = requête fresh
   - React Query / SWR aide rait

#### ✓ Points de Scalabilité Positifs
- useCallback dépendances appropriées
- useMemo sur dérivations
- Structure hiérarchique modules (pas plat)

---

## 🛠️ BONNES PRATIQUES EN DÉVELOPPEMENT

### Backend - Bien Fait ✅
- Séparation models/views/serializers
- Logging structuré
- Constants centralisées (ROLE_CHOICES)
- Docstrings sur les endpoints RBAC (/* comments */)
- Utilisation de generics DRF
- ViewSet pour CRUD

### Backend - À Améliorer ❌
1. **Pas de docstrings Python**
   ```python
   def _set_auth_cookies(response, access_token, refresh_token):
       """Pose les cookies HttpOnly JWT sur la réponse."""  # ← Bon mais rare
   ```
   - Endpoints sans docstrings
   - Paramètres non documentés

2. **Magic numbers/strings**
   ```python
   max_age=int(JWT_CONF['ACCESS_TOKEN_LIFETIME'].total_seconds())
   ```
   - Devraient être des constantes

3. **Code dupliqué**
   ```python
   # RBACMatrixView:199, UsersMatrixView:272, UserToggleView:343
   # Même pattern : rd_set = set(RoleDefault.objects.values_list(...))
   ```
   - Extraire en helper function

### Frontend - Bien Fait ✅
- Components granulaires par page
- State séparation claire
- Types TypeScript correctes (interfaces)
- Constants ROLE_LABELS réutilisées
- Consistent styles

### Frontend - À Améliorer ❌
1. **Pas de JSDoc**
   ```typescript
   const load = useCallback(async (p = 1) => {
       // Qu'est-ce que p? Que retourne cette fonction?
   }, [search, filterRole]);
   ```

2. **Code dupliqué dans les trois pages permissions/defaults/ajouter**
   - Même structure de table
   - Même header pattern
   - Créer composant réutilisable

3. **Magic strings dans API URLs**
   ```typescript
   '/api/v1/auth/users/'
   '/api/v1/auth/rbac/users-matrix/'
   ```
   - Créer constantes `API_ENDPOINTS`

4. **State spread dupliqué**
   ```typescript
   setCells(prev => ({ ...prev, [key]: next }));  // 3x dans le code
   ```

### Patterns à Ajouter

**Backend**:
```python
# helper function pour éviter duplication
def _get_rbac_data():
    return {
        'modules': Module.objects.all(),
        'roles': [r[0] for r in CustomUser._meta.get_field('role').choices],
        'rd_set': set(RoleDefault.objects.values_list('role', 'module_action_id')),
    }
```

**Frontend**:
```typescript
// Centralized API endpoints
const API = {
    USERS: '/api/v1/auth/users/',
    RBAC_MATRIX: '/api/v1/auth/rbac/matrix/',
    RBAC_USERS_MATRIX: '/api/v1/auth/rbac/users-matrix/',
};

// Reusable matrix table component
<MatrixTable rows={visibleRows} cols={visibleMAs} onCellClick={handleToggle} />
```

---

## 📊 RÉSUMÉ SCORING

| Catégorie | Note | Détail |
|-----------|------|--------|
| **Sécurité** | 6/10 | Base bonne (JWT HttpOnly) mais validation insuffisante, rate limiting manquant |
| **Performance** | 5/10 | N+1 queries, pas de cache, virtualisation manquante |
| **Scalabilité** | 4/10 | Pas de pagination RBAC, charge mémoire excessive, blacklist DB non scalable |
| **Développement** | 7/10 | Structure claire mais docstrings/DRY manquants |
| **Code Quality** | 6/10 | TypeScript bon, erreurs generic, pas de linting strict |

**Global: 5.6/10** - Code fonctionnel mais problèmes sérieux à adresser avant production

---

## 🎯 PRIORITÉS D'AMÉLIORATION

### URGENT (Sécurité)
1. Valider inputs (user_id, ma_id) avec serializers
2. Ajouter rate limiting endpoints sensibles
3. Valider avatar upload (taille/type)
4. Remplacer bare except
5. Audit trail permissions

### IMPORTANT (Performance)
1. Fixer N+1 queries UsersMatrixView
2. Cacher /rbac/matrix endpoint
3. Ajouter pagination RBAC endpoints
4. Virtualiser big tables (react-window)

### SOUHAITABLE (Code Quality)
1. Ajouter docstrings Python
2. DRY : extraire helpers communs
3. Centraliser API endpoints
4. Ajouter type checking réponses API
5. Error handling > ValidationError spécifiques
