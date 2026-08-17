# Plan d'implémentation — Conformité progression SIGA

## Contexte

Le moteur de progression SIGA existe et est globalement conforme à l'**Arrêté 562** (Licence Professionnelle) et au **Décret 2018-070** (Ingénieur), mais 6 écarts ont été identifiés lors de l'audit. Ce plan décrit les étapes ordonnées pour les corriger, en remplaçant au passage le mécanisme de progression directe par une table `Progression` qui sert de buffer entre la délibération et la réinscription effective N+1.

### Problèmes à résoudre

| # | Gravité | Problème |
|---|---|---|
| P1 | 🔴 Critique | PFE non bloquant pour le diplôme d'ingénieur (Art. 16 Décret 2018-070) |
| P2 | 🟠 Important | `verrou_l3` réutilisé pour S5 ingénieur — sémantique trompeuse |
| P3 | 🟠 Important | Changement de filière entre N et N+1 non géré |
| P4 | 🟠 Important | Compteur de redoublement faux en présence d'année blanche |
| P5 | 🟡 Mineur | Workflow année blanche non outillé |
| P6 | 🟡 Mineur | Seuils 65/75 codés en dur |

**Hors périmètre** (décisions utilisateur) : composition du jury, décision `reorientation` Art. 26, tronc commun automatique, mention au diplôme.

### Approche structurelle

Toutes les corrections s'articulent autour d'une nouvelle table `Progression` qui résout simultanément P3, P4 et améliore P5 :

```
PV clos → ProgressionService.generer_progressions()
       → table Progression (en_attente)
       → [admin peut modifier filiere_cible / niveau_cible / ouvrir année blanche]
       → ReinscriptionService.executer()
       → InscriptionAdministrative N+1 (avec la bonne filière)
```

---

## Phase 0 — Préparation

### Étape 0.1 — Branche git dédiée
```bash
cd C:/react_projects/GES/siga
git checkout -b feature/progression-conformite
```

### Étape 0.2 — Snapshot base de données (rollback en cas de problème)
```bash
# PostgreSQL : pg_dump avant migrations
pg_dump -U <user> -d siga > backup_avant_progression_$(date +%Y%m%d).sql
```

### Étape 0.3 — Fichiers cibles à lire avant de commencer
- `siga/apps/evaluations/services/deliberation_annuelle.py` — factory + sous-classes Licence/Ingénieur
- `siga/apps/inscriptions/services/progression.py` — ancien `ProgressionService` (sera scindé)
- `siga/apps/evaluations/models.py` lignes 207-291 — `PVDeliberation`, `LigneDeliberation`
- `siga/apps/inscriptions/models.py` lignes 90-204 — `InscriptionAdministrative`, etc.
- `siga/apps/scolarite/models.py` — `Filiere.type_diplome`
- `siga/apps/inscriptions/utils.py` — `creer_inscriptions_pedagogiques()` (sera réutilisé)

---

## Phase 1 — Schéma de données

### Étape 1.1 — Ajouter `Filiere.filiere_parent` (résout P3)

**Fichier** : `siga/apps/scolarite/models.py` (après ligne 80)

```python
filiere_parent = models.ForeignKey(
    'self', on_delete=models.SET_NULL,
    null=True, blank=True, related_name='filieres_filles',
    help_text="Filière parente — restreint les changements administratifs aux filles de la même parente.",
)
```

```bash
python manage.py makemigrations scolarite -n add_filiere_parent
python manage.py migrate scolarite
```

### Étape 1.2 — Créer le modèle `Progression` (résout P3, P4, P5)

**Fichier** : `siga/apps/inscriptions/models.py` (à la fin du fichier)

```python
class Progression(models.Model):
    """
    Buffer entre délibération annuelle et réinscription effective N+1.
    Couvre les 4 décisions PV : progression, redoublement, année blanche, exclusion.
    Permet de modifier filière/niveau cible avant exécution (changement administratif).
    """
    DECISION_CHOICES = [
        ('progression',    'Passage au niveau supérieur'),
        ('redoublement',   'Redoublement (consomme le droit Art. 22/28)'),
        ('annee_blanche',  'Année blanche médicale (Art. 23/29)'),
        ('exclusion',      'Exclusion définitive du cycle'),
    ]
    STATUT_CHOICES = [
        ('en_attente', 'En attente de réinscription'),
        ('modifiee',   "Modifiée par l'administration"),
        ('executee',   'Inscription N+1 créée'),
        ('annulee',    'Annulée'),
    ]

    ligne_deliberation = models.OneToOneField(
        'evaluations.LigneDeliberation', on_delete=models.PROTECT,
        related_name='progression', null=True, blank=True,
    )
    etudiant  = models.ForeignKey(
        'absence.Etudiant', on_delete=models.PROTECT,
        related_name='progressions',
    )
    matricule = models.CharField(max_length=50)

    annee_source = models.ForeignKey(
        'parametres.Year', on_delete=models.PROTECT,
        related_name='progressions_source',
    )
    annee_cible  = models.ForeignKey(
        'parametres.Year', on_delete=models.PROTECT,
        related_name='progressions_cible',
    )

    filiere_source = models.ForeignKey(
        'scolarite.Filiere', on_delete=models.PROTECT, related_name='+',
    )
    niveau_source  = models.IntegerField()
    filiere_cible  = models.ForeignKey(
        'scolarite.Filiere', on_delete=models.PROTECT,
        related_name='progressions_cible',
        null=True, blank=True,
    )
    niveau_cible   = models.IntegerField(null=True, blank=True)

    decision = models.CharField(max_length=20, choices=DECISION_CHOICES)
    consomme_droit_redoublement = models.BooleanField(default=False)

    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='en_attente')
    inscription_admin_creee = models.OneToOneField(
        'inscriptions.InscriptionAdministrative', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='progression_source',
    )

    motif_modification = models.TextField(blank=True, default='')
    modifiee_par       = models.ForeignKey(
        'authentication.CustomUser', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='progressions_modifiees',
    )
    date_creation     = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        db_table        = 'inscriptions_progression'
        unique_together = ('etudiant', 'annee_cible')
        indexes = [
            models.Index(fields=['statut', 'annee_cible']),
            models.Index(fields=['matricule']),
        ]

    def __str__(self):
        return f'{self.matricule} {self.annee_source}→{self.annee_cible} : {self.get_decision_display()}'
```

### Étape 1.3 — Renommer `verrou_l3` → `verrou_passage` (résout P2)

**Fichier** : `siga/apps/evaluations/models.py` lignes 276-279

```python
verrou_passage = models.BooleanField(
    default=False,
    help_text="True si passage bloqué : Licence (L3 nécessite L1 complète Art. 20) "
              "ou Ingénieur (S5 nécessite S1+S2 complets Art. 25).",
)
```

```bash
python manage.py makemigrations evaluations -n rename_verrou_l3_to_verrou_passage
# Vérifier : Django doit détecter un RenameField (sinon add+remove → perte de données)
python manage.py migrate evaluations
```

**Mise à jour des références** — grep `verrou_l3` dans `apps/` et remplacer par `verrou_passage` :
- `siga/apps/evaluations/services/deliberation_annuelle.py` lignes 82, 84, 86, 97, 104, 107, 153, 269, 272, 283, 290, 293

### Étape 1.4 — Migrations consolidées

```bash
python manage.py makemigrations inscriptions -n add_progression_table
python manage.py migrate
```

**Critère de validation Phase 1** :
```bash
python manage.py shell -c "from apps.inscriptions.models import Progression; print(Progression._meta.db_table)"
# Attendu : inscriptions_progression
```

---

## Phase 2 — Services backend

### Étape 2.1 — Réécrire `ProgressionService` (résout P3, P4)

**Fichier** : `siga/apps/inscriptions/services/progression.py` — réécriture complète

```python
from django.db import transaction
from apps.evaluations.models import PVDeliberation


class ProgressionService:
    def __init__(self, pv: PVDeliberation):
        if not pv.est_clos:
            raise ValueError('Le PV doit être clos avant de générer les progressions.')
        if pv.type_pv != 'annuel':
            raise ValueError('Seuls les PV annuels génèrent des progressions.')
        self.pv = pv

    @transaction.atomic
    def generer_progressions(self) -> dict:
        """
        Crée une Progression par LigneDeliberation. Idempotent.
        Retourne {'progression': n, 'redoublement': n, 'annee_blanche': n, 'exclusion': n}.
        """
        from apps.inscriptions.models import Progression

        annee_cible = self._annee_suivante()
        if annee_cible is None:
            raise ValueError("Impossible de déterminer l'année universitaire N+1.")

        stats = {'progression': 0, 'redoublement': 0, 'annee_blanche': 0, 'exclusion': 0}

        for ligne in self.pv.lignes.select_related(
            'inscription_admin__etudiant',
            'inscription_admin__filiere',
            'inscription_admin__annee_univ',
        ):
            decision = self._mapper_decision(ligne.decision_annuelle)
            niveau_cible = self._calculer_niveau_cible(decision, ligne.inscription_admin.niveau)
            filiere_cible = ligne.inscription_admin.filiere if decision != 'exclusion' else None

            Progression.objects.update_or_create(
                etudiant=ligne.inscription_admin.etudiant,
                annee_cible=annee_cible,
                defaults={
                    'ligne_deliberation': ligne,
                    'matricule':          ligne.inscription_admin.etudiant.numero_dossier,
                    'annee_source':       ligne.inscription_admin.annee_univ,
                    'filiere_source':     ligne.inscription_admin.filiere,
                    'niveau_source':      ligne.inscription_admin.niveau,
                    'filiere_cible':      filiere_cible,
                    'niveau_cible':       niveau_cible,
                    'decision':           decision,
                    'consomme_droit_redoublement': (decision == 'redoublement'),
                    'statut':             'en_attente',
                },
            )
            stats[decision] += 1

        return stats

    @staticmethod
    def _mapper_decision(decision_annuelle: str) -> str:
        return {
            'passage_droit': 'progression',
            'passage_cond':  'progression',
            'redoublement':  'redoublement',
            'annee_blanche': 'annee_blanche',
            'exclusion':     'exclusion',
        }.get(decision_annuelle, 'redoublement')

    @staticmethod
    def _calculer_niveau_cible(decision: str, niveau_source: int):
        if decision == 'progression': return niveau_source + 1
        if decision == 'exclusion':   return None
        return niveau_source  # redoublement, annee_blanche

    def _annee_suivante(self):
        # Reprendre la logique existante de l'ancien _annee_suivante()
        from apps.parametres.models import Year
        annee_courante = self.pv.annee_univ or (self.pv.session.annee_univ if self.pv.session else None)
        if annee_courante and '-' in annee_courante.annee:
            parts = annee_courante.annee.split('-')
            try:
                label = f'{int(parts[0])+1}-{int(parts[1])+1}'
                return Year.objects.filter(annee=label).first()
            except (ValueError, IndexError):
                pass
        return Year.objects.filter(annee__gt=annee_courante.annee).order_by('annee').first()
```

### Étape 2.2 — Ajouter `ModificationProgressionService` (résout P3)

**Fichier** : `siga/apps/inscriptions/services/progression.py` (ajout à la suite)

```python
class ModificationProgressionService:
    @staticmethod
    @transaction.atomic
    def modifier(progression_id: int, nouvelle_filiere_id, nouveau_niveau, motif: str, user):
        from apps.inscriptions.models import Progression
        from apps.scolarite.models import Filiere

        prog = Progression.objects.select_for_update().get(pk=progression_id)
        if prog.statut in ('executee', 'annulee'):
            raise ValueError(f'Progression {prog.pk} non modifiable (statut={prog.statut}).')

        if nouvelle_filiere_id:
            nouvelle_filiere = Filiere.objects.get(pk=nouvelle_filiere_id)
            ModificationProgressionService._verifier_compatibilite(prog.filiere_source, nouvelle_filiere)
            prog.filiere_cible = nouvelle_filiere

        if nouveau_niveau is not None:
            prog.niveau_cible = nouveau_niveau

        prog.motif_modification = motif
        prog.modifiee_par = user
        prog.statut = 'modifiee'
        prog.save()
        return prog

    @staticmethod
    def _verifier_compatibilite(source, cible):
        if source.pk == cible.pk:
            return
        if source.filiere_parent_id and source.filiere_parent_id == cible.filiere_parent_id:
            return
        if source.filiere_parent_id == cible.pk or cible.filiere_parent_id == source.pk:
            return
        raise ValueError(
            f"Filière {cible.code} incompatible avec {source.code} (pas de filiere_parent commune)."
        )
```

### Étape 2.3 — Créer `ReinscriptionService`

**Fichier** : nouveau `siga/apps/inscriptions/services/reinscription.py`

```python
import uuid
from django.db import transaction


class ReinscriptionService:
    @staticmethod
    @transaction.atomic
    def executer(annee_cible) -> dict:
        from apps.inscriptions.models import (
            Progression, InscriptionAdministrative,
            InscriptionPedagogique, InscriptionElement,
        )
        from apps.inscriptions.utils import creer_inscriptions_pedagogiques
        from apps.evaluations.models import ResultatSemestre

        progressions = Progression.objects.filter(
            annee_cible=annee_cible,
            statut__in=('en_attente', 'modifiee'),
        ).select_related('etudiant', 'filiere_cible', 'filiere_source')

        stats = {'progression': 0, 'redoublement': 0, 'annee_blanche': 0, 'exclusion': 0}

        for prog in progressions:
            if prog.decision == 'exclusion':
                prog.etudiant.statut = 'exclu'
                prog.etudiant.save(update_fields=['statut'])
                prog.statut = 'executee'
                prog.save(update_fields=['statut'])
                stats['exclusion'] += 1
                continue

            num_insc = f'INS-{annee_cible.annee}-{uuid.uuid4().hex[:6].upper()}'
            insc, _ = InscriptionAdministrative.objects.get_or_create(
                etudiant=prog.etudiant,
                annee_univ=annee_cible,
                defaults={
                    'filiere':            prog.filiere_cible,
                    'niveau':             prog.niveau_cible,
                    'numero_inscription': num_insc,
                    'statut':             'en_cours',
                },
            )

            if prog.decision == 'progression':
                creer_inscriptions_pedagogiques(insc, user=prog.modifiee_par)
            else:
                ReinscriptionService._reinscrire_dettes(insc, prog)

            if prog.etudiant.statut != 'actif':
                prog.etudiant.statut = 'actif'
                prog.etudiant.save(update_fields=['statut'])

            prog.inscription_admin_creee = insc
            prog.statut = 'executee'
            prog.save(update_fields=['inscription_admin_creee', 'statut'])
            stats[prog.decision] += 1

        return stats

    @staticmethod
    def _reinscrire_dettes(insc_nouvelle, prog):
        from apps.inscriptions.models import (
            InscriptionAdministrative, InscriptionPedagogique, InscriptionElement,
        )
        from apps.evaluations.models import ResultatSemestre

        insc_old = InscriptionAdministrative.objects.get(
            etudiant=prog.etudiant, annee_univ=prog.annee_source,
        )
        for ip_old in InscriptionPedagogique.objects.filter(inscription_admin=insc_old):
            valide = ResultatSemestre.objects.filter(inscription_ped=ip_old, est_admis=True).exists()
            if valide:
                continue
            ip_new, _ = InscriptionPedagogique.objects.get_or_create(
                inscription_admin=insc_nouvelle,
                semestre=ip_old.semestre,
                defaults={'est_redoublant': True, 'est_dette': True},
            )
            for ie_old in ip_old.inscriptions_elements.select_related('element', 'em'):
                element_valide = ie_old.resultats.filter(est_valide=True).exists()
                if not element_valide:
                    InscriptionElement.objects.get_or_create(
                        inscription_ped=ip_new,
                        element=ie_old.element,
                        defaults={
                            'em':          ie_old.em,
                            'est_dette':   True,
                            'annee_dette': prog.annee_source,
                        },
                    )
```

### Étape 2.4 — Corriger `_est_deja_redoublant` (résout P4)

**Fichier** : `siga/apps/evaluations/services/deliberation_annuelle.py` lignes 210-220

```python
@staticmethod
def _est_deja_redoublant(inscription_admin) -> bool:
    """
    Art. 22/28 : un seul vrai redoublement autorisé dans le cycle.
    Compte les Progression avec consomme_droit_redoublement=True.
    Les années blanches (Art. 23/29) ne consomment pas le droit → exclues.
    """
    from apps.inscriptions.models import Progression
    return Progression.objects.filter(
        etudiant=inscription_admin.etudiant,
        consomme_droit_redoublement=True,
    ).exists()
```

### Étape 2.5 — Bloquer PFE < 12/20 en délibération S6 ingénieur (résout P1)

**Fichier** : `siga/apps/evaluations/services/deliberation_annuelle.py`

Surcharger `calculer_decisions()` dans `DeliberationAnnuelleIngenieur` :

```python
@transaction.atomic
def calculer_decisions(self) -> int:
    from apps.evaluations.services.calcul_notes import NoteCalculService

    count = super().calculer_decisions()

    # Blocage PFE Art. 16 Décret 2018-070 — niveau 3 (S6) uniquement
    if self.pv.niveau != 3:
        return count

    for ligne in self.pv.lignes.all():
        if ligne.decision != 'admis':
            continue
        eligibilite = NoteCalculService.verifier_eligibilite_diplome(
            etudiant=ligne.inscription_admin.etudiant,
            annee_univ=ligne.inscription_admin.annee_univ,
        )
        if not eligibilite.get('pfe_valide', False):
            ligne.decision_annuelle = 'redoublement'
            ligne.decision = 'ajourned'
            ligne.observations = (
                (ligne.observations or '') +
                '\n[Auto] Diplôme refusé : PFE < 12/20 (Art. 16 Décret 2018-070).'
            )
            ligne.save(update_fields=['decision_annuelle', 'decision', 'observations'])

    return count
```

### Étape 2.6 — Ajouter `JustificatifAnneeBlanche` (résout P5)

**Fichier** : `siga/apps/evaluations/models.py` (à la fin)

```python
class JustificatifAnneeBlanche(models.Model):
    """Justificatif médical pour une année blanche (Art. 23 Arrêté 562 / Art. 29 Décret 2018-070)."""
    ligne_deliberation = models.OneToOneField(
        LigneDeliberation, on_delete=models.PROTECT,
        related_name='justificatif_annee_blanche',
    )
    document      = models.FileField(upload_to='justificatifs_annee_blanche/%Y/')
    motif         = models.TextField()
    decide_par    = models.ForeignKey(
        'authentication.CustomUser', on_delete=models.PROTECT,
        related_name='annees_blanches_decidees',
    )
    date_decision = models.DateField()
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'evaluations_justificatif_annee_blanche'
```

```bash
python manage.py makemigrations evaluations -n add_justificatif_annee_blanche
python manage.py migrate evaluations
```

### Étape 2.7 — Externaliser les seuils 65/75 (résout P6)

**Fichier** : `siga/apps/evaluations/models.py` — ajouter sur `ParametreJury`

```python
seuil_progression = models.DecimalField(
    max_digits=5, decimal_places=2, null=True, blank=True,
    help_text="Override seuil de progression annuelle (% crédits). NULL = défaut (65 LP / 75 ING).",
)
```

**Fichier** : `siga/apps/evaluations/services/deliberation_annuelle.py` lignes 128-132

```python
try:
    params = self.pv.parametre_jury
    seuil_excl     = params.seuil_eliminatoire
    seuil_progress = params.seuil_progression or self.SEUIL_PROGRESSION
except ParametreJury.DoesNotExist:
    seuil_excl     = SEUIL_EXCLUSION
    seuil_progress = self.SEUIL_PROGRESSION
# Remplacer self.SEUIL_PROGRESSION par seuil_progress dans : if taux >= ...
```

**Critère de validation Phase 2** :
```bash
python manage.py shell -c "
from apps.inscriptions.services.progression import ProgressionService
from apps.evaluations.models import PVDeliberation
pv = PVDeliberation.objects.filter(est_clos=True, type_pv='annuel').first()
print(ProgressionService(pv).generer_progressions())
"
```

---

## Phase 3 — API REST

### Étape 3.1 — Vues `Progression`

**Fichier** : nouveau `siga/apps/inscriptions/views_progression.py`

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import RBACPermission
from apps.inscriptions.models import Progression
from apps.inscriptions.services.progression import ProgressionService, ModificationProgressionService
from apps.inscriptions.services.reinscription import ReinscriptionService
from apps.evaluations.models import PVDeliberation


class GenererProgressionsView(APIView):
    permission_classes = [RBACPermission]
    required_module    = 'inscriptions'

    def post(self, request):
        pv = PVDeliberation.objects.get(pk=request.data['pv_id'])
        return Response(ProgressionService(pv).generer_progressions())


class ListeProgressionsView(APIView):
    permission_classes = [RBACPermission]
    required_module    = 'inscriptions'

    def get(self, request):
        annee_id = request.query_params.get('annee_cible')
        qs = Progression.objects.filter(annee_cible_id=annee_id).select_related(
            'etudiant', 'filiere_source', 'filiere_cible',
        )
        return Response([{
            'id':             p.pk,
            'matricule':      p.matricule,
            'etudiant':       str(p.etudiant),
            'filiere_source': p.filiere_source.code,
            'filiere_cible':  p.filiere_cible.code if p.filiere_cible else None,
            'niveau_source':  p.niveau_source,
            'niveau_cible':   p.niveau_cible,
            'decision':       p.decision,
            'statut':         p.statut,
        } for p in qs])


class ModifierProgressionView(APIView):
    permission_classes = [RBACPermission]
    required_module    = 'inscriptions'

    def patch(self, request, pk):
        prog = ModificationProgressionService.modifier(
            progression_id=pk,
            nouvelle_filiere_id=request.data.get('filiere_cible_id'),
            nouveau_niveau=request.data.get('niveau_cible'),
            motif=request.data.get('motif', ''),
            user=request.user,
        )
        return Response({'id': prog.pk, 'statut': prog.statut})


class ExecuterReinscriptionsView(APIView):
    permission_classes = [RBACPermission]
    required_module    = 'inscriptions'

    def post(self, request):
        from apps.parametres.models import Year
        annee = Year.objects.get(pk=request.data['annee_cible_id'])
        return Response(ReinscriptionService.executer(annee))
```

### Étape 3.2 — Enregistrer les URLs

**Fichier** : `siga/apps/inscriptions/urls.py`

```python
from .views_progression import (
    GenererProgressionsView, ListeProgressionsView,
    ModifierProgressionView, ExecuterReinscriptionsView,
)

urlpatterns += [
    path('admin/generer-progressions/',    GenererProgressionsView.as_view()),
    path('admin/progressions/',            ListeProgressionsView.as_view()),
    path('admin/progressions/<int:pk>/',   ModifierProgressionView.as_view()),
    path('admin/executer-reinscriptions/', ExecuterReinscriptionsView.as_view()),
]
```

---

## Phase 4 — Backfill des données existantes

### Étape 4.1 — Commande `backfill_progressions`

**Fichier** : nouveau `siga/apps/inscriptions/management/commands/backfill_progressions.py`

```python
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Crée rétroactivement les Progression à partir des PV annuels clos historiques."

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')

    @transaction.atomic
    def handle(self, *args, **options):
        from apps.evaluations.models import PVDeliberation
        from apps.inscriptions.models import Progression, InscriptionAdministrative
        from apps.inscriptions.services.progression import ProgressionService

        total = 0
        for pv in PVDeliberation.objects.filter(est_clos=True, type_pv='annuel'):
            stats = ProgressionService(pv).generer_progressions()
            self.stdout.write(f'PV {pv.pk} → {stats}')
            total += sum(stats.values())

            for prog in Progression.objects.filter(ligne_deliberation__pv=pv):
                insc = InscriptionAdministrative.objects.filter(
                    etudiant=prog.etudiant, annee_univ=prog.annee_cible,
                ).first()
                if insc:
                    prog.inscription_admin_creee = insc
                    prog.statut = 'executee'
                    if insc.filiere_id != prog.filiere_cible_id:
                        prog.filiere_cible = insc.filiere
                        prog.motif_modification = '[Migration] Changement de filière historique détecté'
                    prog.save()

        if options['dry_run']:
            transaction.set_rollback(True)
        self.stdout.write(self.style.SUCCESS(f'Total : {total} progressions traitées.'))
```

### Étape 4.2 — Commande `detecter_redoublements_faux`

**Fichier** : nouveau `siga/apps/evaluations/management/commands/detecter_redoublements_faux.py`

```python
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Liste les étudiants exclus à tort à cause d'années blanches mal comptabilisées."

    def handle(self, *args, **options):
        from apps.absence.models import Etudiant
        from apps.inscriptions.models import Progression

        for etu in Etudiant.objects.filter(statut='exclu'):
            vrais = Progression.objects.filter(
                etudiant=etu, consomme_droit_redoublement=True,
            ).count()
            if vrais < 2:
                self.stdout.write(f'{etu.numero_dossier} : {vrais} vrai(s) redoublement(s) — exclusion à réviser')
```

### Étape 4.3 — Exécution

```bash
python manage.py backfill_progressions --dry-run   # vérifier sans modifier
python manage.py backfill_progressions             # exécuter
python manage.py detecter_redoublements_faux       # auditer les exclusions douteuses
```

---

## Phase 5 — Frontend admin (gesafped_frontend)

### Étape 5.1 — Page de gestion des progressions

**Fichier** : `app/dashboard/scolarite/progressions/[anneeId]/page.tsx`

Contenu :
- Tableau `.data-table` — colonnes : Matricule, Étudiant, Filière source → cible, Niveau, Décision (badge), Statut, Actions
- Bouton ligne « Modifier filière » → `ChangerFiliereModal`
- Bouton global « Exécuter réinscriptions » (primaire, avec `ConfirmModal`)
- Filtres : décision, statut
- 4 états obligatoires : loading / error / empty / success

### Étape 5.2 — Page PV avec bouton unique « Délibérer »

**Fichier** : `app/dashboard/scolarite/deliberations/[pvId]/page.tsx`

Workflow frontend :
1. Bouton primaire **« Délibérer »** → appelle séquentiellement :
   - `POST /api/v1/evaluations/pv/<id>/peupler-lignes/`
   - `POST /api/v1/evaluations/pv/<id>/calculer-decisions/`
   - Affiche tableau des décisions (éditable : année blanche)
2. Bouton secondaire **« Clôturer »** → `PATCH pv/<id>/` avec `est_clos=true`
3. Bouton tertiaire **« Générer progressions »** → `POST /admin/generer-progressions/`
4. Boutons désactivés selon l'état (clôture requise avant génération)

### Étape 5.3 — Composant `ChangerFiliereModal`

**Fichier** : `components/ChangerFiliereModal.tsx`

- Select filières filtrées par `filiere_parent` : `apiFetch('/scolarite/filieres/?parent=<id>')`
- Textarea motif obligatoire
- Avertissement : « Les inscriptions pédagogiques seront remplacées »
- `PATCH /admin/progressions/<id>/` + feedback `flash.ts`

---

## Phase 6 — Frontend étudiant (lecture passive)

### Étape 6.1 — Page relevé annuel

**Fichier** : `app/dashboard/etudiant/releve/page.tsx`

- Sélecteur d'année universitaire
- Tableau `ResultatSemestre` : moyenne, crédits, statut admis/non admis par semestre
- Tableau par module et par EM
- Masqué si PV non clos : « Résultats non encore publiés »

### Étape 6.2 — Page progression

**Fichier** : `app/dashboard/etudiant/progression/page.tsx`

Carte avec :
- Badge décision : `progression` (vert), `redoublement` (jaune), `annee_blanche` (bleu), `exclusion` (rouge)
- Filière prévue (`filiere_cible.intitule_fr`)
- Niveau prévu (`niveau_cible`)
- Seuil appliqué (65 % LP / 75 % ING)
- Barre de progression crédits capitalisés / 60
- Lecture seule, visible dès `Progression.statut != 'en_attente'`

### Étape 6.3 — Navigation sidebar

Ajouter dans la sidebar étudiant (filtré `role='etudiant'`) :
- « Mon relevé » → `/dashboard/etudiant/releve`
- « Ma progression » → `/dashboard/etudiant/progression`

---

## Phase 7 — Tests et validation

### Étape 7.1 — Tests unitaires backend

**Fichier** : `siga/apps/inscriptions/tests/test_progression.py`

```
test_generer_progressions_idempotent
test_generer_progressions_4_decisions
test_modifier_progression_filiere_compatible
test_modifier_progression_filiere_incompatible
test_modifier_progression_executee_refuse
test_executer_reinscriptions_progression_cree_inscriptions_pedagogiques
test_executer_reinscriptions_redoublement_propage_dettes
test_executer_reinscriptions_exclusion_change_statut_etudiant
test_compteur_redoublement_ignore_annee_blanche   ← vérifie P4
test_pfe_bloque_diplome_ingenieur_si_inferieur_12 ← vérifie P1
```

```bash
python manage.py test apps.inscriptions.tests.test_progression
```

### Étape 7.2 — Tests dynamiques sur la base existante

```python
# T1 — Toutes les filières ont un type_diplome
from apps.scolarite.models import Filiere
assert Filiere.objects.filter(type_diplome__in=['', None]).count() == 0

# T2 — Bon seuil appliqué (LP=65, ING=75)
from apps.evaluations.models import PVDeliberation
from apps.evaluations.services.deliberation_annuelle import get_deliberation_annuelle_service
for pv in PVDeliberation.objects.filter(type_pv='annuel'):
    svc = get_deliberation_annuelle_service(pv)
    attendu = 65 if pv.filiere.type_diplome == 'LP' else 75
    assert svc.SEUIL_PROGRESSION == attendu

# T3 — Aucune anomalie verrou_passage + passage_cond
from apps.evaluations.models import LigneDeliberation
assert LigneDeliberation.objects.filter(verrou_passage=True, decision_annuelle='passage_cond').count() == 0

# T4 — Exclusions sans vrai redoublement préalable (P4)
from apps.inscriptions.models import Progression
suspects = Progression.objects.filter(decision='exclusion').exclude(
    etudiant__progressions__consomme_droit_redoublement=True,
)
print(f'{suspects.count()} exclusions à vérifier')

# T5 — Idempotence ProgressionService
from apps.inscriptions.services.progression import ProgressionService
pv = PVDeliberation.objects.filter(est_clos=True, type_pv='annuel').first()
assert ProgressionService(pv).generer_progressions() == ProgressionService(pv).generer_progressions()

# T6 — Années blanches outillées (P5)
from apps.evaluations.models import LigneDeliberation
ab_sans_doc = LigneDeliberation.objects.filter(
    decision_annuelle='annee_blanche',
    justificatif_annee_blanche__isnull=True,
).count()
print(f'{ab_sans_doc} années blanches sans justificatif')
```

### Étape 7.3 — Scénario manuel complet

1. Créer PV annuel SEA L1 2025-2026 → cliquer « Délibérer »
2. Vérifier les décisions calculées
3. Clôturer le PV
4. Cliquer « Générer progressions » → vérifier liste
5. Modifier filière cible d'un étudiant (SEA → SEA-Finance) avec motif
6. Cliquer « Exécuter réinscriptions »
7. Vérifier `InscriptionAdministrative` 2026-2027 dans la bonne filière
8. Se connecter étudiant → vérifier `/dashboard/etudiant/progression`

---

## Phase 8 — Déploiement

### Étape 8.1 — PR & review

```bash
git add -A
git commit -m "feat: table Progression + 6 correctifs conformité Arrêté 562 / Décret 2018-070"
git push -u origin feature/progression-conformite
gh pr create --title "Progression : table buffer + correctifs conformité"
```

### Étape 8.2 — Rollout

1. Staging : `backfill_progressions --dry-run` puis exécution réelle
2. Tests manuels (scénario 7.3)
3. Validation scolarité
4. Production : maintenance 5 min pour la migration
5. Monitoring premier PV post-déploiement

---

## Récapitulatif fichiers

### Backend (siga)

| Action | Fichier |
|---|---|
| Modifier | `siga/apps/scolarite/models.py` — `filiere_parent` |
| Modifier | `siga/apps/inscriptions/models.py` — modèle `Progression` |
| Modifier | `siga/apps/evaluations/models.py` — `verrou_passage`, `JustificatifAnneeBlanche`, `seuil_progression` |
| Modifier | `siga/apps/evaluations/services/deliberation_annuelle.py` — `verrou_passage`, `_est_deja_redoublant`, PFE, seuil paramétrable |
| Réécrire | `siga/apps/inscriptions/services/progression.py` |
| Créer | `siga/apps/inscriptions/services/reinscription.py` |
| Créer | `siga/apps/inscriptions/views_progression.py` |
| Modifier | `siga/apps/inscriptions/urls.py` |
| Créer | `siga/apps/inscriptions/management/commands/backfill_progressions.py` |
| Créer | `siga/apps/evaluations/management/commands/detecter_redoublements_faux.py` |
| Créer | `siga/apps/inscriptions/tests/test_progression.py` |

### Frontend (gesafped_frontend)

| Action | Fichier |
|---|---|
| Créer | `app/dashboard/scolarite/progressions/[anneeId]/page.tsx` |
| Créer | `app/dashboard/scolarite/deliberations/[pvId]/page.tsx` |
| Créer | `components/ChangerFiliereModal.tsx` |
| Créer | `app/dashboard/etudiant/releve/page.tsx` |
| Créer | `app/dashboard/etudiant/progression/page.tsx` |
| Modifier | Sidebar étudiant (2 entrées) |

### Migrations

1. `scolarite/migrations/00XX_add_filiere_parent.py`
2. `evaluations/migrations/00XX_rename_verrou_l3_to_verrou_passage.py`
3. `evaluations/migrations/00XX_add_justificatif_annee_blanche.py`
4. `evaluations/migrations/00XX_add_seuil_progression_parametre_jury.py`
5. `inscriptions/migrations/00XX_add_progression_table.py`

---

## Ordre des dépendances

```
Phase 0 (préparation)
   └─→ Phase 1 (schéma)
          └─→ Phase 2 (services backend)
                 ├─→ Phase 3 (API REST)
                 │      ├─→ Phase 5 (frontend admin)   ─┐ en parallèle
                 │      └─→ Phase 6 (frontend étudiant) ─┘
                 └─→ Phase 4 (backfill données)
                        └─→ Phase 7 (tests base réelle)
                               └─→ Phase 8 (déploiement)
```

## Estimation effort

| Phase | Effort |
|---|---|
| 0 — Préparation | 0.5 j |
| 1 — Schéma | 0.5 j |
| 2 — Services backend | 2 j |
| 3 — API REST | 1 j |
| 4 — Backfill | 1 j |
| 5 — Frontend admin | 2 j |
| 6 — Frontend étudiant | 1.5 j |
| 7 — Tests | 1.5 j |
| 8 — Déploiement | 0.5 j |
| **Total** | **10.5 j** |
