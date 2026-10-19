# Génération de sprites joueurs / équipements

Contrat pour ajouter des **postures** ou **équipements** PNG dans `static/players/`
sans dériver du style ni casser le recolor / le yaw.

Relire ce fichier **avant** toute nouvelle génération d’image.

---

## 1. Style visuel

- 2D vectoriel aplats, **contours noirs épais et nets** (pas de halo gris)
- Fond **blanc pur** `#FFFFFF` (le pack convertit en alpha ; éviter anti-alias gris)
- **Pas de texte**, pas de labels
- Visages sans traits
- Hauteur personnage **identique** sur toutes les frames d’une planche
- **Une posture = une sprite sheet** (tous les yaw sur une seule image)

## 2. Palette source (recolor)

| Zone | Hex |
|------|-----|
| Maillot | `#0048A0` |
| Short | `#C00018` |
| Chaussettes | `#F8C008` |
| Ballon | `#F87800` |
| Chaussures | anthracite |
| Peau | `#A88070` |
| Cheveux | quasi-noir |

Ne pas réutiliser ces teintes pour peau / cheveux / équipements (sauf ballon).

## 3. Morphologies

| Id | Description |
|----|-------------|
| `man` | Adulte homme, cheveux courts |
| `woman` | Poitrine/hanches accentuées, **queue de cheval** |
| `child` | ~10 ans, **tête proportionnellement plus grande** ; garder ce ratio sur **toutes** les frames |

Mêmes `postureId` et même ordre de yaw dans `man/` / `woman/` / `child/`.

## 4. Yaw — tour complet `0` … `345` (pas de miroir)

**Pas de miroir programme.** On dessine **toutes** les orientations de `0` à `(360 − 15) = 345` inclus, **par pas de 15°** (24 frames).

| Yaw | Sens (personnage qui **tourne sur sa gauche**) |
|-----|--------------------------------------------------|
| `0` | **De face** — épaules carrées vers la caméra (**obligatoire**, jamais un ¾) |
| `15` | Léger ¾ — tourné un peu à **sa gauche** |
| `30` | ¾ face gauche — **ne doit PAS ressembler à 0°** |
| `45`–`75` | Progression vers le profil gauche |
| `90` | **Profil gauche** strict |
| `105`–`165` | ¾ dos |
| `180` | **Dos** |
| `195`–`255` | ¾ dos → profil **droit** |
| `270` | **Profil droit** strict |
| `285`–`345` | retour vers la face |
| (`360` = `0`, non stocké) |

**Boucle :** frame `345°` doit avoir **les mêmes proportions** (tête, largeur, hauteur) que `0°` — seul l’angle change. Sinon pop visible en rotation continue.

**Sens :** vue de dessus, pivote vers **sa gauche**. Frame suivante = +15°.

## 5. Format sprite sheet

Une ligne horizontale, **24 cellules** `160×160` (après pack).

- Frame `i` → crop `(i * 160, 0, 160, 160)` avec `yaw = i * 15`
- Fichier : `poses/{morphology}/{postureId}.png`

Largeur sheet : `3840×160`. Pack : `npm run sprites:pack` / `python scripts/pack-player-sheets.py --from-regen`.

**Marge dans la cell source :** corps + ballon **entièrement visibles**, ~15–20 % de marge autour (surtout `kick` / `run`). Jamais de membre coupé.

## 6. Prompt type — demi-planche (12 frames)

Générer en **deux** images `*-a` (0–165) et `*-b` (180–345), même personnage, mêmes proportions.

```
Football player SPRITE SHEET, single horizontal row of EXACTLY 12 evenly spaced figures,
flat 2D vector illustration, bold thick CLEAN black outlines (crisp, no grey fringe),
minimal flat shading, PURE white #FFFFFF background, hard edges preferred,
NO text, NO numbers, NO labels, NO ground shadow.

CRITICAL framing: each figure FULLY inside its slot with ~18% empty margin on all sides —
head, hands, feet, and ball must NEVER be cropped or touch the cell edge.

CRITICAL consistency: IDENTICAL character proportions in EVERY figure
(same head size, same height head-to-toe, same shoulder width). Child: keep large child head ratio.

CRITICAL orientation: LEFTMOST figure MUST be full FRONT view — shoulders square to camera,
NOT a three-quarter. Then each next figure turns 15° to THEIR LEFT (character's left).

Yaws this half (left→right): LIST_A_OR_B

Same pose throughout: POSE_DESC.
Morphology: MORPH.
Kit EXACT flat fills: jersey #0048A0, shorts #C00018, socks #F8C008,
shoes charcoal, skin #A88070, ball #F87800 if kick. No facial features.
```

`LIST_A` = `0 front, 15, 30, 45, 60, 75, 90 left profile, 105, 120, 135, 150, 165`  
`LIST_B` = `180 full back, 195, 210, 225, 240, 255, 270 right profile, 285, 300, 315, 330, 345 almost front (same proportions as 0°)`

`POSE_DESC` exemples :
- idle : standing relaxed, arms at sides
- run : mid-stride, one knee up — **still start at full front**
- kick : kicking follow-through with orange ball at foot — wide stance, keep ball+leg inside margin

Références style : `docs/specs/gemini/`.

## 7. Prompt type — équipement

Même logique 24 frames si `oriented: true`. Cône / ballon : 1 frame.

## 8. Checklist

1. Frame 0 = face stricte ; run/kick aussi  
2. Proportions 0° ≈ 345° (surtout child)  
3. Aucun crop (tête / jambe / ballon)  
4. Pas de halo blanc sur fond noir après pack  
5. Manifest `yaws: [0,15,...,345]`  
6. Test recolor  

## 9. Équipements

- `ladder`, `hurdle` : multi-yaw  
- `cone`, `ball` : 1 frame  
