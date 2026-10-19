# Modèles 3D joueurs

## Fichier actuel

| Fichier | URL servie | Code |
|---------|------------|------|
| [`player.glb`](player.glb) | `/models/player.glb` | [`src/lib/utils/player3dModel.ts`](../src/lib/utils/player3dModel.ts) → `PLAYER_GLB_URL` |

C’est le modèle **Xbot** (échantillon Khronos / Three.js) : rig humanoïde avec animations (`idle`, `run`, `walk`, …), mais **un seul maillage « mannequin »** (`Beta_Surface` + `Beta_Joints`). Il n’a pas de maillot et short séparés — la recoloration par équipe dans `tintPlayerMaterials()` ne peut pas distinguer maillot / short / peau correctement.

## Remplacement recommandé (CC0, maillot + short)

**Quaternius — Universal Base Characters** + **Universal Animation Library** (CC0) :

1. Télécharger [Universal Base Characters (Standard, gratuit)](https://quaternius.itch.io/universal-base-characters) — modèle **Regular Male** en `.glb`.
2. Télécharger [Universal Animation Library (Standard, gratuit)](https://quaternius.itch.io/universal-animation-library) — animations compatibles avec le rig.
3. Fusionner ou exporter un seul `player.glb` (personnage + clips `idle`, `run`, `walk`, …) avec Blender / gltf-transform, ou placer le GLB du personnage si les animations sont déjà incluses.
4. Remplacer `static/models/player.glb` (garder le même nom) ou changer `PLAYER_GLB_URL`.

Autres pistes CC0 : [Ultimate Modular Men Pack](https://quaternius.com/packs/ultimatemodularmen.html) (4 parties interchangeables par personnage), packs « Modular Outfits ».

## Nommage des matériaux / meshes

Pour que les couleurs d’équipe fonctionnent, le GLB devrait avoir des noms du type :

- maillot : `shirt`, `body`, `torso`, `jersey`
- short : `short`, `pants`
- peau : `skin`, `head`, `face`

Voir [`src/lib/utils/player3dAnimations.ts`](../src/lib/utils/player3dAnimations.ts) → `tintPlayerMaterials()`.

## Postures → animations

Mapping dans [`src/lib/utils/player3dAnimations.ts`](../src/lib/utils/player3dAnimations.ts) (`POSTURE_ANIMATION`).

Compression DRACO optionnelle via `@threlte/extras` `useDraco()`.
