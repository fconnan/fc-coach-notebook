# TouchTight et FC Coach Notebook

Comparaison à partir des captures `image01.png` et `image03.png` à `image15.png`. `image02.png` est vide.

TouchTight Club est une plateforme de club : elle prépare les soirs d’entraînement, range les séances, imprime un plan, et suit les joueurs. FC Coach Notebook est un carnet local pour préparer la saison : thèmes, séances, fiches d’exercice et schémas.

## Ce que montrent les captures

| Image | Écran TouchTight |
| --- | --- |
| 01 | Schéma de séance en perspective. Joueurs numérotés, zones, flèches, ballons, coach « C », textes posés sur le terrain (« 3 passes – can switch zone », « 2 players press »). |
| 03 | Le coach reste l’auteur. Le schéma porte la consigne (« Check shoulders… ») et le titre de phase. Joueurs orange, rouges, vert (gardien). |
| 04 | Saison en trois clics : équipe, soirs, durée, éducateurs, puis le plan est créé dans le Dugout. Des PDF peuvent s’y ajouter. |
| 05 | Une semaine liste les pratiques (échauffement, thème, fin de séance), avec une vignette. À droite, la feuille imprimable : organisation, points de coaching, progressions, questions aux joueurs. |
| 06 | PDF de plusieurs pages par séance. Date, heure, durée, effectif. Schéma à gauche, texte à droite. |
| 07 | Tactique par poste. Pièges de pressing, phrases sur le terrain (« We win possession here »). |
| 08 | Le club personnalise six familles : pratiques, séances, plans de saison, thèmes de coaching, formations, tactiques. |
| 09 | Outil d’animation : dessiner, animer, partager. Joueurs nommés. Trois usages : ses pratiques, la préparation de match, l’analyse de match. |
| 10 | Dugout : bibliothèque de séances notées, avec « Quick add ». |
| 11–12 | Fiche joueur. Terrain de l’effectif, radar (passe, finition, défense, maîtrise du ballon, psycho-social, physique), écart au poste, cartons, matchs, séances, objectifs, vidéos. Vues coach, parent, joueur. |
| 13 | Équipe : système, composition, titulaires, remplaçants. |
| 14–15 | Le langage visuel des schémas : zones, rondos, appels, textes, coach et ballons. Le slogan porte sur le temps rendu aux joueurs. |

## Comparaison

| Sujet | TouchTight | FC Coach Notebook |
| --- | --- | --- |
| Promesse | Faire tourner le club et les soirs d’entraînement depuis un Dugout. | Préparer la saison d’entraînement : thèmes, séances, exercices. |
| Saison | Assistant : équipe, soirs, durée, éducateurs, puis un plan de semaines déjà rempli. | Planning de fiches : une date, une séance du répertoire, les exercices de cette séance. |
| Bibliothèque | Gros catalogue de pratiques prêtes, notées, ajoutables en un clic, souvent avec une vidéo. | Répertoire écrit par thèmes de jeu (intervalles, largeur, pressing, finition…). Chaque séance enchaîne ses exercices. |
| Fiche | Une page de séance : organisation, points clés, progressions, questions aux joueurs, effectif, horaire. | Une fiche par exercice : procédé, méthode, durée, aire, effectif, matériels, objectif, but, consignes, variables, comportements, critères. |
| Schéma | Dessin illustré, souvent en perspective, avec texte peint sur le gazon. | Schéma mesuré : terrain, zones, formes, objets, joueurs par numéro et couleur. Le texte de coaching reste dans la fiche. |
| Texte sur le terrain | Consignes, titres de phase et intentions sont dans le dessin. | Les zones ont un nom. Les consignes sont dans la fiche, pas sur le gazon. |
| Animation | Dessiner puis animer, y compris pour le match. | Phases nommées : passe, course, dribble. Lecture dans l’aperçu. |
| Édition du schéma | Toile de dessin. | YAML et terrain liés : clic pour sélectionner, curseur sur la ligne, glisser pour les coordonnées. |
| Formes | Formations et tactiques par poste, pièges, blocs. | Formes réutilisables (4-3-3, bloc bas, rondo, couloirs, finition…) posées dans un rectangle, étirables sans grossir les objets. |
| Matériel | Plots, échelles, cerceaux, buts, ballons, coach, dans le dessin. | Bibliothèque d’objets (plot, haie, échelle, mannequin, buts, corner…) posés à l’échelle du terrain. |
| Joueurs | Personnes du club : nom, photo, poste, notes, cartons, parents. | Rôles dans l’exercice : numéro, équipe (bleu, rouge, jaune, blanc). Pas de fiche individuelle. |
| Effectif | Composition, titulaires, remplaçants, système de jeu. | L’effectif est une ligne de la fiche (« 5 contre 3 »). Les formes décrivent l’organisation sur le terrain. |
| Match | Préparation et analyse, avec les noms des joueurs. | Le match à thème est un exercice de séance. Pas d’analyse de rencontre. |
| Partage | Dugout du club, vues coach / parent / joueur. | Dossier local (`data`), favoris, export. |
| Export | PDF de séance, plusieurs pages, prêt à imprimer. Ajout de PDF au plan. | Export de la séance en PDF, image, SVG, et classeur ODS de la catégorie. |
| Où vit le contenu | Compte club, en ligne. | Fichiers du carnet : `content.md`, `schema.yaml`, `schema.svg`. |

## Là où le carnet va plus loin

- La séance est découpée en exercices, et chaque exercice a sa fiche et son schéma. TouchTight montre surtout une pratique = une page.
- Le schéma est une langue (terrain, zone, forme, objet, `pos`, phases), pas un dessin libre. On le recompose, on l’étire, on le relit.
- Les formes et les terrains vivent dans l’atelier et se reposent d’un exercice à l’autre.
- Le lien fiche ↔ schéma est direct dans l’éditeur : la description d’un côté, le YAML et le terrain de l’autre.

## Là où TouchTight va plus loin

- Générer une saison entière à partir des soirs d’entraînement.
- Un catalogue prêt à l’emploi, avec notes et vidéos, et un ajout rapide dans la semaine.
- Le texte de coaching écrit sur le schéma, à côté des flèches.
- Des joueurs nommés, un effectif, des compos, un suivi (radar, objectifs, cartons) et des vues parent / joueur.
- La préparation et l’analyse de match dans le même outil que l’entraînement.
- Un PDF de séance déjà mis en page comme une feuille d’éducateur (schéma, points clés, questions).

## Hors du carnet, pour l’instant

Le Dugout joueur (fiches, notes, cartons, parents, vidéos) et l’analyse de match. Les captures 11 à 13 décrivent un logiciel de club. Le carnet prépare l’entraînement.
