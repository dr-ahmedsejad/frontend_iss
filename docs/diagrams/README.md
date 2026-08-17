# Diagrammes — Processus d'inscription & calcul des notes

Diagrammes pédagogiques du module inscription/évaluation de SIGA.
Chaque diagramme existe en deux formats :

- **`.svg`** — vectoriel et autonome (couleurs + polices intégrées). S'ouvre dans
  n'importe quel navigateur ou éditeur. À privilégier pour l'édition / le zoom.
- **`.png`** — rasterisé à 1360 px de large (≈ 2×), fond blanc. À privilégier pour
  coller dans une présentation, un document Word ou un e-mail.

| # | Diagramme | Contenu | Fichiers |
|---|---|---|---|
| 01 | **Processus d'inscription** | Les 4 portes d'entrée (préinscription, import Excel, formulaire, réinscription auto) → le dossier administratif → la cascade pédagogique → le passage d'année et ses 5 décisions. | [SVG](01_processus_inscription_flux.svg) · [PNG](01_processus_inscription_flux.png) |
| 02 | **Cascade de validation des résultats** | Comment une note devient un statut `V` / `VCI` / `VCS` par compensations successives (élément → module → semestre), et ce qui bascule en dette. | [SVG](02_cascade_resultats_validation.svg) · [PNG](02_cascade_resultats_validation.png) |
| 03 | **Pipeline calcul des notes & délibération** | Les 4 étages de calcul (note EM → module → semestre/MGS → année) puis les deux délibérations (semestrielle et annuelle). | [SVG](03_pipeline_calcul_notes_deliberation.svg) · [PNG](03_pipeline_calcul_notes_deliberation.png) |
| 04 | **Chaîne saisie → PV** | Les 3 chemins de saisie, le signal de recalcul automatique vs les endpoints manuels, la « photo » du peuplement et le piège du PV non re-peuplé. | [SVG](04_chaine_saisie_au_pv.svg) · [PNG](04_chaine_saisie_au_pv.png) |
| 05 | **Rattrapage max(SN, SR)** | La logique Art. 18 : seul l'examen est repassé, CC/TP hérités, note la plus favorable retenue, absent = note normale conservée. Exemple chiffré. | [SVG](05_rattrapage_max_sn_sr.svg) · [PNG](05_rattrapage_max_sn_sr.png) |

Documents de synthèse : [`../inscription_processus_pedagogique.md`](../inscription_processus_pedagogique.md)
· [`../calcul_notes_saisie_au_pv.md`](../calcul_notes_saisie_au_pv.md).

## Régénérer les PNG

Le rendu PNG est produit par **Chrome/Edge en mode headless** (cairosvg n'est pas
exploitable ici : proxy SSL + dépendance cairo native indisponible sous Windows).
Pour ré-exporter un SVG modifié, via un wrapper HTML qui fixe la taille et le fond :

```bash
CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
DIR="C:/react_projects/GES/gesafped_frontend/docs/diagrams"
# adapter la hauteur = hauteur du viewBox × 2 (ex. viewBox "0 0 680 700" → 1400)
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --screenshot="$DIR/NOM.png" --window-size=1360,HAUTEUR \
  "file:///$DIR/_wrapper.html"
```

où `_wrapper.html` contient :
`<img src="NOM.svg" style="display:block;width:1360px;height:HAUTEURpx">` sur fond blanc.
