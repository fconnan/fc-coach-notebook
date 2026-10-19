# Spécifications — Évolution vers un Tactics Manager professionnel

> **Objectif** : faire évoluer FC Tactics (éditeur tactique SvelteKit actuel) vers un tableau tactique de
> niveau professionnel, à l'image de **SoccerTutor Tactics Manager** (cf. captures `docs/specs/tactics-manager/`).
>
> Ce document décrit **uniquement les fonctionnalités à ajouter** par rapport au produit existant, ainsi que
> l'impact sur le modèle de données et l'architecture. Il sert de feuille de route.

---

## 1. Contexte

### 1.1 État actuel (résumé)

FC Tactics est aujourd'hui une SPA SvelteKit 5 (runes) mono-page :

- **Rendu** : terrain en **SVG 2D** (105×68m, échelle 10px/m), vue verticale, 3 gabarits (`Complet`, `Demi`, `DemiBas`).
- **Éléments** : joueurs (jetons ronds numérotés + 2 équipes + gardien), ballon, flèches/tracés (droits, `Q`, `C`),
  avec liaison flèche↔joueur (`linkedStartId` / `linkedEndId`).
- **Interactions** : drag depuis la librairie, déplacement, sélection, édition des propriétés (couleur, taille,
  numéro, rotation, posture des jambes), édition des points de flèche.
- **Notes** : éditeur Markdown WYSIWYG (Milkdown Crepe) dans le panneau gauche.
- **Persistance** : fichiers locaux `{nom}.json` + `{nom}.md` via File System Access API ; reconnexion auto du
  répertoire (IndexedDB) ; dernier fichier (localStorage).
- **Export** : impression navigateur (`window.print()`) uniquement.

Toutes les types/stores/mutations sont centralisés dans `src/lib/stores/workspace.ts`.

### 1.2 Écarts par rapport à la cible (captures SoccerTutor)

| Capture | Fonctionnalité cible | État actuel |
|---|---|---|
| 01 | Vue terrain pseudo-3D, annotations, zones, animation multi-frames | 2D plat, pas d'animation |
| 02 | Export « fiche de séance » PDF multi-drills (date, durée, niveau, objectifs, coaching points) | Impression brute |
| 03 | Personnalisation joueur avancée (peau, maillot, motif, nom) | Couleur + numéro seulement |
| 04 | Palette d'outils complète (flèches variées, formes, texte, bulles, zones) | Flèches seulement |
| 05 | Librairie d'équipement (cônes, plots, mini-buts, piquets, échelles, mannequins, cerceaux) + types de pelouse / fond | Ballon seul, pelouse fixe |
| 07 | Contre-attaque, contrôle d'épaisseur de trait, frames | Partiel |
| 08 | Menu export « Save to PDF / Save Image », bulles d'annotation | Impression seule |
| 09 | Export JPEG (résolutions HD/Med/Low, recadrage) | Absent |

---

## 2. Principes directeurs

1. **Itératif** : chaque lot (cf. §9) est livrable indépendamment et n'introduit pas de régression.
2. **Rétro-compatibilité** : les tactiques `.json` existantes doivent rester ouvrables (versionnage du schéma + migration).
3. **Rester SVG** : conserver le rendu SVG comme socle ; la « 3D » est une **projection visuelle** (perspective), pas un moteur 3D (cf. §3.7). Pas de dépendance Three.js dans un premier temps.
4. **Modèle extensible** : étendre `ComponentElement` plutôt que multiplier les types disjoints.

---

## 3. Spécifications fonctionnelles

### 3.1 Librairie d'équipement (capture 05)

**Besoin** : pouvoir glisser-déposer du matériel d'entraînement sur le terrain, comme les joueurs/ballon.

Nouveaux types d'éléments (`ElementType`) :

| Type | Description | Propriétés spécifiques |
|---|---|---|
| `cone` | Cône / plot bas (disque) | `color`, `size` |
| `coneTall` | Cône haut (marqueur) | `color`, `size` |
| `miniGoal` | Mini-but | `color`, `width`, `angle` |
| `fullGoal` | But complet (déplaçable) | `color`, `width`, `angle` |
| `pole` | Piquet vertical | `color`, `height` |
| `ladder` | Échelle d'agilité | `color`, `length`, `angle` |
| `hurdle` | Haie | `color`, `width`, `angle` |
| `mannequin` | Mannequin/cible | `color`, `angle` |
| `ring` | Cerceau / anneau | `color`, `size` |

**Exigences**
- E-1 : chaque équipement est un composant SVG dédié dans `src/lib/components/shapes/`.
- E-2 : drag-drop depuis `RightSidebar` (section **EQUIPMENT**) → `CanvasArea.onDrop`, comme les joueurs.
- E-3 : sélectionnable, déplaçable, supprimable, avec rotation (`angle`) pour les éléments orientables.
- E-4 : couleur configurable via le panneau de propriétés.
- E-5 : retirer le stub `cone` actuel (rendu vide) et le remplacer par un vrai composant.

### 3.2 Palette d'outils de dessin (captures 01, 04)

**Besoin** : une vraie palette d'outils (panneau **TOOLS**) couvrant tous les tracés et annotations.

**Flèches & tracés** — étendre l'existant :
- T-1 : types de **ligne** : pleine, pointillée, fine-pointillée (déjà partiel via `strokeDasharray`).
- T-2 : types de **tête** : aucune, simple, double, barre (passe / déplacement / conduite / tir).
- T-3 : tracé **sinusoïdal/zigzag** (conduite de balle, dribble) — nouveau `curveType` ou flag `wavy`.
- T-4 : exposer dans l'UI les courbes `S`/`T` déjà gérées par le générateur de path.
- T-5 : sélecteur d'**épaisseur de trait** (cf. capture 07, sélecteur 3 épaisseurs).

**Formes** :
- T-6 : `rect` (rectangle/carré), `ellipse` (cercle/ellipse) — contour ou rempli, opacité réglable.
- T-7 : **zone** mise en évidence (rectangle/ellipse semi-transparent vert) pour matérialiser un espace (cf. « Space » capture 01, zone verte capture 04).

**Texte & annotations** :
- T-8 : outil **texte libre** posé sur le terrain (police, taille, gras/italique/souligné) — cf. « 6 +GK v 5 Overload », « 3 v 1 ».
- T-9 : outil **bulle / cartouche** (callout) avec pointe directionnelle et texte multi-lignes (cf. « Leave space free... », « A decides whether to lay-off to B or C »).

Nouveaux types : `text`, `callout`, `rect`, `ellipse`, `zone`.

Propriétés associées à ajouter à `ComponentElement` :
```ts
text?: string;
fontSize?: number;
fontWeight?: 'normal' | 'bold';
fontStyle?: 'normal' | 'italic';
textDecoration?: 'none' | 'underline';
fillColor?: string;
fillOpacity?: number;
width?: number;   // rect / zone / équipement
height?: number;  // rect / zone / équipement
calloutAnchor?: Position; // pointe de la bulle
```

### 3.3 Personnalisation avancée des joueurs (capture 03)

**Besoin** : éditeur de joueur riche (panneau **PLAYERS** déplié).

- P-1 : **couleur de peau** (palette).
- P-2 : **couleur de maillot** + **motif** (uni, rayures verticales, bandes horizontales).
- P-3 : **couleur de short**.
- P-4 : **nom** du joueur (champ texte distinct du numéro) — affiché sous le jeton (cf. « Rene », « Pep G. »).
- P-5 : modèles prédéfinis : joueur de champ / gardien.
- P-6 : aperçu en direct dans le panneau.

Nouvelles propriétés `ComponentElement` :
```ts
name?: string;
skinColor?: string;
shirtColor?: string;
shortColor?: string;
shirtPattern?: 'solid' | 'stripes' | 'hoops';
role?: 'outfield' | 'goalkeeper';
```

### 3.4 Personnalisation du terrain & du fond (capture 05)

**Besoin** : popup de réglages terrain.

- F-1 : **type de pelouse** (≥ 6 variantes : nuances/tontes/textures) — sélection par vignettes.
- F-2 : **couleur/texture de fond** (bleu, gris, …).
- F-3 : bascule **masquer les buts**.
- F-4 : bascule **masquer les lignes du terrain**.
- F-5 : conserver la bascule **rayures** existante (`showFieldStripes`).

Nouvelles propriétés `Page` :
```ts
grassType: string;          // identifiant de preset (ex. 'stripes-diag', 'solid', ...)
backgroundColor: string;
hideGoals: boolean;
hidePitchLines: boolean;
```

### 3.5 Animation multi-frames (captures 01, 07)

**Besoin** : décomposer une tactique en **frames** successives et les jouer comme une animation (les éléments se déplacent en interpolant leur position entre frames).

- A-1 : modèle de **frames** (états) au sein d'une même tactique ; barre de frames en bas (1, 2, 3, 4… cf. capture 01).
- A-2 : ajout / duplication / suppression / réordonnancement de frames.
- A-3 : un élément conserve son **identité** (`id`) entre frames ; sa **position/angle** peut changer par frame.
- A-4 : **lecture animée** : interpolation des positions entre frames (boutons play / pause / vitesse — cf. contrôles « Animation » capture 01).
- A-5 : éléments **présents/absents** par frame (apparition/disparition).
- A-6 : réglage de la **durée** par transition.

> **Décision de modélisation** : aujourd'hui `Page` mélange « contenu visuel » et « réglages ».
> On distingue désormais :
> - **Tactic** (le fichier) : métadonnées + réglages globaux + notes Markdown + tableau de **frames**.
> - **Frame** : `elements[]` + éventuels overrides locaux.
>
> Cela remplace l'usage actuel de `pages`/`BottomTabs` (stub non câblé) et clarifie la sémantique « page = frame d'animation ».

### 3.6 Séances / Drills & export fiche PDF (captures 02, 08, 09)

**Besoin** : produire une **fiche de séance** professionnelle et exporter en PDF/JPEG.

**Modèle de séance** (capture 02) :
- S-1 : métadonnées séance : **date**, **durée**, **niveau** (ex. U11–U18), **objectif**, **titre**.
- S-2 : une séance regroupe plusieurs **drills**, chacun avec : titre, diagramme (rendu de la tactique/frame), **description**, **coaching points**.
- S-3 : mise en page multi-pages (en-tête + grille diagramme/texte + pied de page).

**Export** (captures 08, 09) :
- X-1 : menu **Export** : « Save to PDF », « Save Image (JPEG/PNG) ».
- X-2 : export **JPEG** avec choix de résolution : **Haute** (~2364×1773), **Moyenne** (~1576×1182), **Basse** (~788×592).
- X-3 : option **recadrage** (oui/non) — recadrer sur la zone utile vs terrain complet.
- X-4 : export **PDF** de la fiche de séance (mise en page S-3).
- X-5 : remplacer l'impression brute actuelle par ce pipeline (conserver `@media print` comme fallback).

> **Note technique** : l'export image se fait par sérialisation du `<svg>` → rasterisation `<canvas>` →
> `toBlob('image/jpeg'|'image/png')`. Le PDF via une lib type `jspdf`/`pdf-lib` (à ajouter). `PrintableSheet.svelte`
> (prototype orphelin) peut être réutilisé comme base de la fiche.

### 3.7 Vue « 3D » / perspective (captures 01, 03, 05, 07)

**Besoin** : rendu en perspective (terrain incliné) plutôt que vue de dessus plate.

- D-1 : bascule **vue 2D (dessus) ↔ vue perspective** (transform CSS/SVG `perspective` + inclinaison).
- D-2 : la perspective est **purement visuelle** : les coordonnées logiques restent en 2D (105×68m) ; on applique une projection à l'affichage. Pas de moteur 3D.
- D-3 : les jetons joueurs/équipements restent lisibles (taille compensée, pas déformés par la perspective).

> **Priorité basse** : à traiter en dernier (lot 5), car c'est le plus risqué et le moins indispensable au workflow.

### 3.8 Barre d'outils & édition (capture 01, barre basse)

**Besoin** : câbler la barre d'outils aujourd'hui en stub.

- U-1 : **Undo / Redo** (utiliser `historyStack`/`historyIndex` aujourd'hui placeholder).
- U-2 : **Copier / Coller / Couper / Dupliquer** un ou plusieurs éléments.
- U-3 : **Zoom** (+/–, %, ajuster) et **panoramique**.
- U-4 : **Ordre des calques** (avant/arrière) — `z-index` logique des éléments.
- U-5 : **Verrouillage** d'éléments (non déplaçables).
- U-6 : **Transparence** globale (slider, cf. barre basse).
- U-7 : **Sélection multiple** (rectangle de sélection / shift-clic) et déplacement groupé.

---

## 4. Impacts sur le modèle de données

### 4.1 Versionnage & migration

- Ajouter `schemaVersion: number` au fichier tactique.
- `tacticFileService` : à l'ouverture, détecter l'absence de version → **migration v0 → v1** (envelopper la page actuelle dans une `Tactic` à une seule `Frame`).

### 4.2 Schéma cible (esquisse)

```ts
interface Tactic {
  schemaVersion: number;
  id: string;
  name: string;
  // réglages globaux (terrain, fond)
  fieldTemplate: 'Complet' | 'Demi' | 'DemiBas';
  grassType: string;
  backgroundColor: string;
  showFieldStripes: boolean;
  hideGoals: boolean;
  hidePitchLines: boolean;
  view: '2d' | 'perspective';
  // styles d'équipe par défaut
  team1: TeamStyle;
  team2: TeamStyle;
  ball: { color: string; size: number };
  // notes (reste dans le .md séparé)
  // animation
  frames: Frame[];
  // séance (optionnel)
  session?: SessionMeta;
}

interface Frame {
  id: string;
  name: string;
  durationMs?: number;
  elements: ComponentElement[];
}

interface SessionMeta {
  date?: string;
  durationMin?: number;
  level?: string;
  objective?: string;
  drills?: DrillMeta[];
}
```

`ComponentElement` est étendu avec les propriétés des §3.2 et §3.3.

### 4.3 Compatibilité fichiers

- Conserver le couple `{nom}.json` + `{nom}.md`.
- Le `.json` contient désormais la `Tactic` (frames incluses) ; le `.md` reste les notes.

---

## 5. Impacts sur l'architecture / composants

| Zone | Action |
|---|---|
| `stores/workspace.ts` | Refondre autour de `Tactic`/`Frame` ; ajouter stores `currentFrameId`, `frames`, `isPlaying`, `clipboard`, history réelle. |
| `components/shapes/` | Ajouter composants équipement (§3.1), `TextLabel`, `Callout`, `Shape`, `Zone`. |
| `components/canvas/CanvasArea.svelte` | Gérer nouveaux types, sélection multiple, zoom/pan, projection perspective. |
| `components/layout/RightSidebar.svelte` | Sections **PLAYERS / EQUIPMENT / TOOLS** dépliables (cf. captures) + éditeur joueur avancé. |
| `components/layout/Toolbar.svelte` | Câbler undo/redo/zoom/calques/lock/transparence. |
| `components/layout/BottomTabs.svelte` | Devenir la **barre de frames** (animation), connectée au store. |
| `components/layout/` (nouveau) | `AnimationControls.svelte`, `FieldSettingsPopup.svelte`, `ExportDialog.svelte`, `SessionSheet.svelte`. |
| `services/` (nouveau) | `exportService.ts` (SVG→PNG/JPEG, PDF), migration de schéma. |
| `package.json` | Ajouter lib PDF (ex. `jspdf`). |

---

## 6. Exigences non-fonctionnelles

- **Performance** : animation fluide (≥ 30 fps) jusqu'à ~50 éléments ; rendu SVG optimisé (pas de re-mount inutile).
- **Accessibilité** : raccourcis clavier (Suppr, Ctrl+Z/Y, Ctrl+C/V, Ctrl+S déjà présent).
- **Robustesse** : ouverture sans perte des tactiques v0.
- **Offline-first** : conserver le fonctionnement 100% local (pas de backend requis).

---

## 7. Hors périmètre (pour l'instant)

- Moteur 3D réel (WebGL/Three.js).
- Collaboration temps réel / multi-utilisateurs.
- Backend / comptes / cloud.
- Bibliothèque de drills préchargés (contenu).

---

## 8. Décisions actées

1. **Formations préréglées** (4-4-2, 4-3-3…) : **OUI** — placement automatique d'une équipe via presets. → ajouté en **Lot 3 bis**.
2. **Vue perspective** (§3.7) : **OUI**, traitée en dernier (Lot 6).
3. **Watermark** sur export : **NON** (aucun filigrane).
4. Lib PDF : **`pdf-lib`** (la plus moderne et activement maintenue, génération côté client).

---

## 9. Feuille de route proposée (lots)

| Lot | Contenu | Valeur | Risque |
|---|---|---|---|
| **0 — Socle** | Versionnage schéma + migration v0→v1 ; refonte `Tactic`/`Frame` ; câblage undo/redo/copier-coller/sélection multiple/zoom | Fondations | Moyen |
| **1 — Outils de dessin** | Palette TOOLS complète : flèches étendues, épaisseur, formes, zones, texte, bulles (§3.2) | Élevée | Faible |
| **2 — Équipement & terrain** | Librairie matériel (§3.1) + popup réglages terrain/fond (§3.4) | Élevée | Faible |
| **3 — Joueurs** | Éditeur joueur avancé : peau, maillot, motif, short, nom (§3.3) + **formations préréglées** | Moyenne | Faible |
| **4 — Animation** | Frames + lecture animée + barre de frames (§3.5) | Élevée | Moyen |
| **5 — Séance & export** | Fiche de séance + export PDF/JPEG (§3.6) | Élevée | Moyen |
| **6 — Perspective** | Vue pseudo-3D (§3.7) | Confort | Élevé |

---

*Références visuelles : `docs/specs/tactics-manager/01.jpg` … `09.jpg` (SoccerTutor Tactics Manager).*
