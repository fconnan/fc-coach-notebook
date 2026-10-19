# Modèles 3D

- `player.glb` — rig Xbot (Three.js sample, CC0-like usage for dev). Remplacez par un modèle foot CC0 si besoin.
- Format recommandé : GLB + animations nommées (`idle`, `run`, `walk`, …).
- Compression DRACO optionnelle via `@threlte/extras` `useDraco()`.

Les postures de l'app (`element.posture`) sont mappées aux clips dans `src/lib/utils/player3dAnimations.ts`.
