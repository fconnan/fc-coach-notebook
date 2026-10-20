import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('data/categories/U14G');

const PAGE = {
  schemaVersion: 2,
  nextTeam1Number: 1,
  nextTeam2Number: 1,
  showPlayerDetails: false,
  morphology: 'man',
  team1Color: '#5e6ad2',
  team2Color: '#d25e5e',
  team1Size: 14,
  team2Size: 14,
  ballColor: '#ffffff',
  ballSize: 8,
  showFieldStripes: true,
  grassType: 'stripes',
  backgroundColor: '#2b6b39',
  hideGoals: false,
  goalNetOpacity: 0.25,
  hidePitchLines: false,
  view: '2d',
  perspectiveTilt: 34,
  perspectiveIntensity: 62,
  perspectiveScale: 0.86,
  frames: [],
  activeFrameIndex: 0,
  elements: []
};

function md(cells) {
  const order = [
    ['objectif', 'Objectif'],
    ['but', 'But'],
    ['consignes', 'Consignes'],
    ['variables', 'Variables'],
    ['collectifs', 'Comportements collectifs'],
    ['individuels', 'Comportements individuels'],
    ['criteres', 'Critères']
  ];
  return order
    .filter(([key]) => cells[key] && cells[key].trim())
    .map(([key, title]) => `## ${title}\n\n${cells[key].trim()}`)
    .join('\n\n');
}

function trainingDates() {
  const start = new Date(2026, 8, 1);
  const end = new Date(2027, 5, 30);
  const breaks = [
    [new Date(2026, 9, 17), new Date(2026, 10, 1)],
    [new Date(2026, 11, 19), new Date(2027, 0, 3)],
    [new Date(2027, 1, 20), new Date(2027, 2, 7)],
    [new Date(2027, 3, 17), new Date(2027, 4, 2)]
  ];
  const ascension = new Date(2027, 4, 6).getTime();
  const dates = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 2 && d.getDay() !== 4) continue;
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (breaks.some(([a, b]) => t >= a && t <= b)) continue;
    if (t.getTime() === ascension) continue;
    dates.push(t);
  }
  return dates;
}

const formatDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

function level(step, focus, shared, blocks) {
  return { step, focus, ...shared, blocks };
}

function b(kind, duration, area, headcount, equipment, fieldTemplate, but, consignes, variable) {
  return { kind, duration, area, headcount, equipment, fieldTemplate, but, consignes, variable };
}

const ballons = 'ballons, chasubles, plots';
const buts = 'ballons, chasubles, plots, petits buts';
const grands = 'ballons, chasubles, 2 grands buts, plots';

const themes = [
  {
    id: 'espaces',
    name: 'Créer et utiliser des espaces',
    phase: 'Conserver-progresser',
    principle: 'Créer et utiliser des espaces',
    means: 'Jeux en supériorité puis à égalité, occupation de la largeur et de la profondeur',
    eval: true,
    levels: [
      level('Repérer l\'espace libre', 'En supériorité, voir l\'espace vide avant de transmettre.', {
        collectifs: 'Rester éloignés du porteur pour garder le terrain grand. Au moins un joueur occupe le côté opposé au ballon.',
        individuels: 'Tête haute avant la passe. Contrôle orienté vers l\'espace visé. Passe à la bonne vitesse, dans la course du partenaire.',
        criteres: 'Le ballon quitte la zone du porteur vers un espace vide. Les attaquants ne se regroupent pas autour du ballon. L\'action aboutit parce que l\'espace a été vu, pas parce que la défense a été battue en duel.'
      }, [
        b('Mise en train', '15 min', '30 × 30 m', '8 contre 2, rotations sur 18 joueurs', ballons, 'Demi',
          'Après 6 passes, trouver un partenaire dans un coin laissé vide.',
          'Carré de 30 m, quatre plots aux coins. Conservation à 8 contre 2. Les deux défenseurs changent dès qu\'ils touchent le ballon. Un point si, après 6 passes, le ballon est transmis dans un coin où aucun attaquant ne se trouvait au départ de la passe. Le receveur doit y arriver en course.',
          'Pressing autorisé dès la première passe. Puis réduire le carré à 25 m.'),
        b('Situation', '25 min', '40 × 30 m', '6 contre 4', buts, 'Demi',
          'Marquer dans un petit but après une passe dans le couloir le moins occupé.',
          'Terrain coupé en trois couloirs. Deux petits buts, un dans chaque couloir latéral. 6 contre 4, les quatre autres joueurs relancent derrière les buts et entrent à chaque but. On ne peut marquer que si le dernier passeur est dans un couloir et le receveur dans un autre. La défense ne peut défendre que dans deux couloirs à la fois.',
          'La défense peut occuper les trois couloirs. Puis passer à 6 contre 5.'),
        b('Jeu', '20 min', '50 × 40 m', '7 contre 5', buts, 'Demi',
          'But = 1 point. But après utilisation du couloir faible = 3 points.',
          'Même découpage en trois couloirs, sans joker. Le couloir faible est celui où se trouvent le moins de défenseurs au moment de la passe. L\'éducateur annonce « faible » seulement si les joueurs ne le voient pas, puis se tait. Les joueurs au repos comptent les points et entrent toutes les 3 minutes.',
          'Imposer deux touches dans le couloir central pour obliger à sortir le ballon.'),
        b('Jeu', '25 min', '1/2 terrain', '8 contre 6 + gardiens', grands, 'Demi',
          'Marquer dans le grand but. Le but vaut double s\'il est précédé d\'un changement de couloir.',
          'Demi-terrain, hors-jeu en vigueur. L\'équipe en infériorité défend le grand but et ne peut monter que jusqu\'à la ligne médiane. L\'équipe en possession doit faire vivre les deux ailes avant de centrer ou de frapper. Relance du gardien à la main vers un côté, pour créer tout de suite un côté fort et un côté faible.',
          'Passer à 8 contre 7. Puis autoriser la défense à suivre sur tout le demi-terrain.')
      ]),
      level('Créer la largeur', 'Écarter le jeu avant de progresser, sans joker inattaquable.', {
        collectifs: 'Les deux ailiers restent hauts et larges, même quand le ballon est à l\'opposé. Le bloc attaquant occupe toute la largeur avant la passe en profondeur.',
        individuels: 'L\'ailier se montre de profil, pied d\'appui ouvert. Le porteur fixe un défenseur puis donne dans la course, pas dans les pieds.',
        criteres: 'Les deux couloirs latéraux sont occupés avant la progression. Le ballon change de côté au moins une fois par action. Les duels en 1 contre 1 restent rares.'
      }, [
        b('Mise en train', '15 min', '1/2 terrain', '3 groupes de 6', ballons, 'Demi',
          'Le ballon traverse les deux couloirs latéraux avant de revenir au milieu.',
          'Trois couloirs. Chaque groupe joue dans un couloir, passes à la main puis au pied. Toutes les 4 passes, le ballon doit changer de couloir. Personne ne défend : le thème est l\'écart. Les joueurs du couloir qui reçoit décrochent pour offrir la passe.',
          'Ajouter un défenseur par couloir, qui ne peut pas sortir de son couloir.'),
        b('Situation', '25 min', '45 × 35 m', '7 contre 6', buts, 'Demi',
          'Marquer seulement après avoir touché les deux couloirs latéraux.',
          'Plus de jokers. Deux petits buts latéraux et un but central plus petit. Pour valider le but, le ballon doit être passé dans les deux couloirs latéraux pendant l\'action. La défense coulisse librement. Si le ballon sort, la défense relance.',
          'Limiter à trois touches. Puis interdire la passe en retrait dans le couloir central.'),
        b('Jeu', '20 min', '60 × 40 m', '8 contre 7', buts, 'Complet',
          'Un point par but. Un point bonus si les deux ailes ont touché le ballon.',
          'Grand rectangle, trois couloirs tracés. Les ailiers peuvent rentrer dans l\'axe seulement après avoir reçu dans leur couloir. Défense libre. Rotations toutes les 4 minutes, les gardiens jouent aux pieds dans les petits buts.',
          'Réduire la largeur de 5 m pour forcer des écarts plus justes.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '9 contre 9', grands, 'Complet',
          'But uniquement si l\'action a utilisé les deux ailes.',
          'Terrain complet, hors-jeu. Deux équipes de 9, les autres remplaçants entrent à la touche. Consigne unique : un but n\'est pas validé si une aile n\'a pas touché le ballon dans l\'action. L\'éducateur laisse jouer et questionne à l\'arrêt de la boisson : « où était l\'espace ? ».',
          'Valider aussi un but direct si la défense est déjà écartée. Puis revenir à la règle stricte.')
      ]),
      level('Largeur puis profondeur', 'Face à un bloc qui coulisse, alterner l\'espace proche et l\'espace lointain.', {
        collectifs: 'Attirer le bloc d\'un côté, puis jouer vite dans le dos du côté faible. Ne pas rester à jouer devant le bloc.',
        individuels: 'Le porteur attire par la conduite. Le partenaire opposé part au moment de la frappe de balle, pas avant.',
        criteres: 'Le bloc défensif est déplacé avant la passe en profondeur. La passe casse une ligne. Le côté faible est pris en course, pas à l\'arrêt.'
      }, [
        b('Mise en train', '15 min', '40 × 30 m', 'Par vagues de 4', ballons, 'Demi',
          'Conduire d\'un côté, passer de l\'autre dans la course.',
          'Plots en zigzag. Vague de 4 : le premier conduit vers le plot de droite, les trois autres partent à gauche au signal de la frappe. Passe dans la course, contrôle orienté, centre court vers le second plot. Pas d\'opposition. Deux files pour que les 18 joueurs restent actifs.',
          'Ajouter un défenseur léger sur le côté de la passe.'),
        b('Situation', '25 min', '1/2 terrain', '8 contre 8', grands, 'Demi',
          'Marquer après un changement de côté suivi d\'une passe dans la profondeur.',
          'Égalité. La défense doit coulisser ensemble : si un défenseur reste côté faible, l\'action est arrêtée et questionnée. L\'attaque n\'a pas de joker. Pour marquer, il faut une passe latérale qui change de couloir puis une passe qui casse la ligne, dans les 4 secondes. Sinon le bloc a le temps de se replacer et le but ne vaut rien.',
          'Ramener le délai à 3 secondes. Ou autoriser le défenseur côté faible à suivre le ballon.'),
        b('Jeu', '20 min', '2/3 de terrain', '8 contre 8 + gardiens', grands, 'Complet',
          'But = 1. But après largeur puis profondeur = 3.',
          'Le gardien relance toujours du côté où se trouve le plus de monde, pour créer le problème. Défense en bloc médian, consigne de coulisser. L\'attaque choisit le moment du changement. Remplaçants prêts à entrer sur coup de sifflet toutes les 5 minutes.',
          'La défense peut laisser un joueur côté faible. L\'attaque doit le voir et jouer ailleurs.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match à thème. Le but après enchaînement largeur-profondeur vaut double.',
          'Hors-jeu, deux gardiens. Thème annoncé avant le coup d\'envoi, puis plus de consignes pendant le jeu. À la mi-temps de 12 minutes, les joueurs disent eux-mêmes où l\'espace a été créé. Les comportements justes sont renforcés, les autres sont questionnés sans donner la solution.',
          'Interdire le centre sans passe préalable dans le dos. Puis lever l\'interdiction.')
      ]),
      level('Attirer pour libérer le côté faible', 'Rétrécir l\'axe pour obliger à attirer, puis utiliser le côté qui se vide.', {
        collectifs: 'Surcharger un côté pour faire basculer le bloc, puis basculer vite. Le côté faible ne se remplit qu\'au moment de la bascule.',
        individuels: 'Jouer à une ou deux touches côté fort. Prendre de la vitesse à la réception du renversement. Ne pas regarder le côté faible trop tôt.',
        criteres: 'Le bloc adverse se déplace vers le côté fort. Le premier ballon côté faible est joué dans un espace, devant le partenaire. Le temps entre la dernière passe côté fort et la passe opposée est court.'
      }, [
        b('Mise en train', '15 min', '40 × 20 m', 'Deux groupes de 9', ballons, 'Demi',
          'Faire basculer le ballon d\'un couloir étroit à l\'autre en moins de 4 passes.',
          'Couloir central de 8 m seulement, deux couloirs larges. Conservation par équipe dans sa moitié, puis obligation de changer de couloir large. Le couloir central ne sert que de zone de passage, personne ne stationne dedans. Opposition légère : un chasseur dans le couloir visé.',
          'Deux chasseurs. Puis une seule touche dans le couloir d\'arrivée.'),
        b('Situation', '25 min', '1/2 terrain', '9 contre 9', grands, 'Demi',
          'Marquer côté faible après avoir fixé au moins 4 joueurs côté fort.',
          'Axe tracé plus étroit que les couloirs. Pas de joker. L\'éducateur valide la fixation si au moins quatre défenseurs sont dans le couloir du ballon au moment de la passe opposée. Sinon le but est refusé et le ballon revient à la défense. Questionner : « qui avez-vous attiré ? ».',
          'Descendre à 3 défenseurs attirés, puis remonter à 4. Réduire le temps de conservation côté fort.'),
        b('Jeu', '20 min', '70 × 50 m', '9 contre 9', grands, 'Complet',
          'But côté faible = 2 points. But côté fort = 1 point, seulement s\'il est évident.',
          'La règle pousse à ne pas finir là où le bloc est compact. Défense libre de son organisation. Si elle ne coulisse pas, l\'attaque n\'a pas de problème à résoudre : élargir alors la défense d\'un joueur plutôt que d\'ajouter une consigne.',
          'But côté fort ramené à 0 pour forcer le côté faible. Puis réouvrir le but côté fort.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match. But dans les 10 secondes après un changement de côté = double.',
          'Les 10 secondes rendent le côté faible utile seulement s\'il est pris tout de suite. Hors-jeu. Les remplaçants entrent à la pause d\'eau, pas pendant l\'action. L\'éducateur note deux actions réussies et une ratée pour le retour au calme.',
          'Ramener le délai à 6 secondes. Ou obliger le centre côté faible plutôt que la frappe lointaine.')
      ]),
      level('Enchaîner deux espaces', 'Sous pression de match, utiliser un espace proche puis un espace lointain.', {
        collectifs: 'Créer un premier appel qui fixe, puis un second appel dans un autre espace. Ne pas jouer les deux ballons au même joueur.',
        individuels: 'Le premier receveur remet en une touche. Le second attaque l\'espace sans ralentir. Le porteur a déjà le troisième joueur dans le regard.',
        criteres: 'Deux espaces différents sont utilisés avant la frappe. La défense est déséquilibrée sur le second mouvement. Le but ou la frappe cadrée arrive sans reprise d\'appui inutile.'
      }, [
        b('Mise en train', '15 min', '1/2 terrain', 'Ateliers de 6', ballons, 'Demi',
          'Enchaîner une passe courte dans l\'intervalle et une passe longue dans le dos.',
          'Trois mannequins ou plots figent une ligne. Par 6 : passe dans l\'intervalle proche, remise, passe dans le dos du dernier plot. Course chronométrée légère, qualité avant la vitesse. Les groupes tournent pour garder 18 joueurs en mouvement.',
          'Remplacer un plot par un défenseur qui peut intervenir sur la seconde passe.'),
        b('Situation', '25 min', '2/3 de terrain', '9 contre 9 + gardiens', grands, 'Complet',
          'Marquer après deux espaces distincts : un devant la ligne, un dans le dos.',
          'Défense en ligne médiane, qui a le droit de monter. L\'attaque n\'a pas de supériorité. Le but n\'est validé que si l\'éducateur a vu une passe devant la ligne puis une passe dans le dos, ou l\'inverse. En cas de doute, le but est validé : on ne coupe pas le jeu pour une hésitation.',
          'La défense peut défendre haut avec hors-jeu. Puis ajouter un pressing au porteur.'),
        b('Jeu', '20 min', 'Terrain foot à 11', '10 contre 10', grands, 'Complet',
          'Frappe cadrée après double utilisation d\'espace = 1. But = 2.',
          'Presque l\'effectif réel. Une seule consigne, rappelée avant le coup d\'envoi. Les joueurs qui restent hors jeu tiennent les ballons de relance pour que le jeu ne s\'arrête pas. L\'éducateur n\'intervient qu\'entre les actions.',
          'Retirer le point de frappe cadrée pour ne garder que le but. Le thème doit survivre sans le bonus.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match libre avec observation. Le but reste le but. Le thème est le critère d\'évaluation, pas une règle qui bloque le score.',
          'On ne refuse plus le but. L\'équipe est évaluée sur sa capacité à enchaîner deux espaces dans les actions qui mènent à une occasion. Feuille d\'observation simple : espace proche, espace lointain, occasion. C\'est la séance la plus proche du match du week-end.',
          'Annoncer à la mi-temps le nombre d\'actions où un seul espace a été utilisé. Laisser les joueurs proposer la correction.')
      ])
    ]
  },
  {
    id: 'opposer',
    name: 'S\'opposer à la progression',
    phase: 'S\'opposer à la progression',
    principle: 'S\'opposer à la progression',
    means: 'Cadrage, coulissage, couverture et densité dans le couloir du ballon',
    eval: true,
    levels: [
      level('Cadrer et orienter', 'Le premier défenseur oriente le porteur vers l\'extérieur, sans plonger.', {
        collectifs: 'Un joueur cadre, les autres restent sur leur ligne et ferment l\'intérieur. Le bloc ne suit pas le premier défenseur s\'il est éliminé.',
        individuels: 'Attitude basse, distance d\'un bras, pas croisés. Regarder le ballon et le prochain soutien. Tacle seulement si le ballon est à portée sans se déséquilibrer.',
        criteres: 'Le porteur est orienté vers la touche. Les progressions dans l\'axe sont rares. Le premier défenseur n\'est pas éliminé de face.'
      }, [
        b('Mise en train', '15 min', '20 × 15 m', '1 contre 1, files de 9', ballons, 'Demi',
          'Empêcher le porteur d\'atteindre la ligne de fond intérieure.',
          'Couloir étroit. L\'attaquant part de face, le défenseur cadre et pousse vers la ligne extérieure. S\'il gagne sa ligne intérieure, l\'attaquant marque le point. Pas de tacle au sol au début : l\'opposition est le placement. Changement de rôle à chaque passage. Les deux files tournent.',
          'Autoriser le tacle. Puis élargir le couloir de 3 m.'),
        b('Situation', '25 min', '30 × 25 m', '4 contre 3', buts, 'Demi',
          'La défense empêche la progression dans l\'axe. Un dégagement orienté vers l\'extérieur est une réussite défensive.',
          'Trois défenseurs et un gardien de but réduit, quatre attaquants. But unique centré. La défense marque 1 point si le ballon sort en touche latérale après un cadrage, 2 points si elle récupère. L\'attaque marque dans le petit but. Les autres joueurs forment une seconde vague qui entre dès que le ballon est mort.',
          'Passer à 4 contre 4. Puis autoriser l\'attaque à dribbler dès la première touche.'),
        b('Jeu', '20 min', '40 × 30 m', '6 contre 5', buts, 'Demi',
          'Point défensif à chaque progression stoppée avant la ligne des 20 m.',
          'Ligne tracée à 20 m du but défendu. Si l\'attaque la franchit avec le ballon, elle garde l\'action. Si la défense l\'arrête avant, elle marque le point et relance. Consigne unique aux défenseurs : premier joueur cadre vers l\'extérieur, pas de deux sur le ballon.',
          'Autoriser le deux contre un si le porteur est déjà orienté dehors.'),
        b('Jeu', '25 min', '1/2 terrain', '8 contre 8', grands, 'Demi',
          'Match. L\'équipe est observée sur le premier défenseur, pas sur le score seul.',
          'Deux équipes égales, grand but et gardien. Thème rappelé : on ne plonge pas, on oriente. L\'éducateur fige deux fois dans le quart d\'heure, pas plus, pour demander « vers où est le porteur ? ». Le reste du temps, le jeu continue.',
          'Retirer le gardien pour augmenter la responsabilité du cadrage. Puis le remettre.')
      ]),
      level('Coulisser en bloc', 'Garder les distances pendant le déplacement latéral.', {
        collectifs: 'Le bloc se déplace ensemble vers le ballon. Les distances entre défenseurs restent stables. Le côté faible flotte sans décrocher.',
        individuels: 'Pas chassés, épaules parallèles. Parler : « je coulisse », « je cadre ». Ne pas regarder seulement son vis-à-vis si le ballon change de côté.',
        criteres: 'Aucun trou ne s\'ouvre dans le dos du bloc au moment du changement de côté. Les défenseurs arrivent ensemble, pas en file indienne.'
      }, [
        b('Mise en train', '15 min', '30 × 20 m', 'Ligne de 4, deux groupes', ballons, 'Demi',
          'La ligne se déplace sans se déformer pendant que le ballon change de plot.',
          'Quatre défenseurs face à un éducateur ou un joueur qui tient le ballon et se déplace. La ligne coulisse. Un plot derrière chaque défenseur : si un défenseur perd son alignement, il touche son plot et revient. Puis le ballon est passé entre deux joueurs offensifs lents, sans droit de dribbler. Second groupe en miroir pour que tout le monde joue.',
          'Le porteur peut accélérer. Puis un attaquant appelle dans le dos.'),
        b('Situation', '25 min', '40 × 30 m', '6 contre 5', buts, 'Demi',
          'Empêcher le changement de côté de trouver un joueur libre dans le dos.',
          'Cinq défenseurs en ligne, six attaquants qui ont obligation de changer de côté toutes les 5 passes. La défense ne marque pas de but : elle marque quand elle récupère ou quand elle force la touche. Interdiction de sauter à deux sur le porteur. Le sixième attaquant joue gardien de l\'autre vague en alternance.',
          'L\'attaque peut jouer long dès la troisième passe. La ligne doit reculer ensemble, pas seulement coulisser.'),
        b('Jeu', '20 min', '1/2 terrain', '7 contre 7', grands, 'Demi',
          'But adverse = 1 pour l\'attaque. Récupération dans le camp de l\'attaque = 1 pour la défense.',
          'Égalité, grand but. La défense travaillée est celle qui défend le but du bas du terrain pendant 10 minutes, puis on inverse. Consigne : coulisser avant de presser. Si deux joueurs plongent ensemble, l\'éducateur rend le ballon à l\'attaque.',
          'Autoriser le pressing haut après une mauvaise relance, tout en gardant la ligne derrière.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '9 contre 9', grands, 'Complet',
          'Match à thème. Observation du bloc sur les changements de côté.',
          'Terrain large pour que le coulissage soit nécessaire. Hors-jeu. Pas de point bonus : le score du match suffit, l\'évaluation porte sur les trous dans le dos. Deux remplaçants par équipe entrent à la 12e minute.',
          'Réduire la largeur si le bloc se perd. L\'élargir de nouveau dès que les distances tiennent.')
      ]),
      level('Couvrir celui qui cadre', 'Le second défenseur assure le premier, sans abandonner l\'axe.', {
        collectifs: 'Couverture en diagonale dans le dos du joueur qui cadre. Le reste du bloc ferme la ligne de passe intérieure.',
        individuels: 'Le second est plus bas et plus intérieur que le premier. Il ne fixe pas le même adversaire. Repli immédiat si le premier est passé.',
        criteres: 'Une élimination du premier défenseur ne donne pas une ligne droite vers le but. Le second est déjà en place. L\'axe ballon-but reste occupé.'
      }, [
        b('Mise en train', '15 min', '25 × 20 m', '2 contre 1, rotations', ballons, 'Demi',
          'Si le premier est éliminé, le second empêche la ligne droite.',
          'Couloirs de 2 contre 1. Le défenseur avant cadre, le second couvre en dedans. L\'attaquant marque s\'il atteint le plot central. Les défenseurs marquent s\'ils orientent vers le plot extérieur. Changement toutes les 8 actions. Quatre couloirs pour occuper le groupe.',
          'L\'attaquant part déjà lancé. Puis ajouter un second attaquant en soutien.'),
        b('Situation', '25 min', 'Surface élargie', '5 contre 4 + gardien', grands, 'Demi',
          'Aucun attaquant ne frappe de l\'axe sans avoir été gêné par la couverture.',
          'Quatre défenseurs dont le gardien participe à la couverture haute quand le ballon est sur l\'aile. Cinq attaquants, jeu libre vers le grand but. Point défensif si la frappe vient d\'un angle fermé ou si le ballon est récupéré. Arrêt uniquement quand la couverture est absente, pour la montrer, pas pour la sermonner.',
          'Retirer le gardien de la sortie. La couverture repose alors seulement sur les joueurs de champ.'),
        b('Jeu', '20 min', '1/2 terrain', '7 contre 6', grands, 'Demi',
          'L\'équipe en infériorité protège le but. Chaque duel couvert vaut autant qu\'un but évité.',
          '6 défenseurs + gardien contre 7. L\'attaque a 20 secondes pour frapper après l\'entrée dans la moitié. La défense travaille la couverture, pas le temps. Si le premier plonge et que le second n\'est pas là, l\'action est rejouée une fois.',
          'Passer à 7 contre 7. Le thème doit tenir à égalité.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match. Critère : pas de frappe de face après un simple dribble extérieur.',
          'Organisation libre, proche du système de l\'équipe. L\'éducateur observe les côtés. À la pause, il demande aux défenseurs centraux comment ils ont couvert les latéraux. On ne change pas de système en cours de séance.',
          'Demander au latéral de monter : la couverture doit être reprise par le milieu axial.')
      ]),
      level('Densifier le couloir du ballon', 'Être nombreux près du ballon, sans vider le côté faible.', {
        collectifs: 'Trois joueurs concernés par le couloir du ballon : celui qui cadre, la couverture, le joueur qui ferme la passe latérale. Le côté faible reste à distance de passe.',
        individuels: 'Course vers le ballon à l\'intérieur, pas en ligne droite dans le dos. Intercepter la passe plutôt que suivre son adversaire.',
        criteres: 'Le porteur a peu de solutions vers l\'intérieur. Le côté faible n\'est pas pris dans le dos sur le premier ballon long. La densité ne devient pas un paquet.'
      }, [
        b('Mise en train', '15 min', '30 × 20 m', '4 contre 4 + 2 jokers', ballons, 'Demi',
          'Récupérer dans le couloir du ballon avant la huitième passe.',
          'Terrain étroit. Les jokers jouent avec l\'équipe en possession mais seulement sur les côtés, à une touche. La défense marque si elle récupère dans le couloir central. Elle ne défend pas les jokers. Rotation des jokers toutes les 2 minutes.',
          'Les jokers deviennent attaquables. La densité doit alors inclure le côté.'),
        b('Situation', '25 min', '1/2 terrain', '8 contre 8', grands, 'Demi',
          'Forcer l\'attaque à revenir en arrière ou à jouer vers la touche.',
          'Égalité, grand but. Consigne défensive : au moins trois joueurs dans le couloir du ballon dès que l\'attaque entre dans la moitié. L\'éducateur compte à voix haute seulement les premières actions, puis les joueurs se comptent eux-mêmes. But refusé à l\'attaque s\'il vient d\'une passe intérieure non pressée : on rejoue.',
          'Exiger la densité aussi dans son propre camp, plus bas. Puis seulement au-dessus de la ligne des 30 m.'),
        b('Jeu', '20 min', '2/3 de terrain', '8 contre 8 + gardiens', grands, 'Complet',
          'Récupération haute dans le couloir du ballon = 2 points. But = 1.',
          'Les deux équipes défendent le même thème à tour de rôle selon la possession. Le point de récupération vaut plus que le but pour que le comportement soit choisi, pas seulement le résultat. Gardien qui joue au pied et peut être pressé.',
          'Ramener la récupération à 1 point pour voir si le comportement reste sans le bonus.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match. La densité est observée sur les entrées de côté et les relances adverses.',
          'Match libre. Grille d\'observation : couloir du ballon occupé par 3, côté faible encore en place, passe intérieure empêchée. On ne fige pas le jeu. Les remplaçants notent avec l\'éducateur, puis disent ce qu\'ils ont vu en rentrant.',
          'Annoncer que le prochain but ne comptera que s\'il suit une récupération dans le bon couloir.')
      ]),
      level('Freiner puis replier', 'S\'opposer haut, puis revenir sans casser les lignes quand le ballon nous passe.', {
        collectifs: 'Si le pressing est sauté, le bloc recule ensemble au lieu de continuer à courir vers l\'avant. Les lignes restent à distance de passe.',
        individuels: 'Le joueur éliminé court dans le but, pas vers le ballon déjà parti. Le gardien commande la hauteur de la ligne.',
        criteres: 'Après une passe dans le dos, l\'équipe est replacée avant la frappe. Il n\'y a pas de joueur qui reste campé pendant que les autres reculent. Les occasions de face diminuent en fin de séance.'
      }, [
        b('Mise en train', '15 min', '40 × 30 m', 'Lignes de 4 contre vagues de 3', ballons, 'Demi',
          'Freiner la vague, puis reculer si le ballon est joué dans le dos.',
          'Une ligne de 4 défend une zone. Une vague de 3 attaque. Si la ligne gagne le duel d\'entrée, elle marque. Si le ballon est joué dans le dos, la ligne doit reformer avant la ligne de but réduite. La vague suivante part dès que la première a fini. Trois lignes tournent.',
          'La vague a le droit de jouer en une touche dans le dos, plus vite.'),
        b('Situation', '25 min', '2/3 de terrain', '8 contre 7 + gardien', grands, 'Complet',
          'Ne pas prendre de but de face après un ballon dans le dos de la ligne.',
          'La défense joue haut au départ. L\'attaque, en supériorité, cherche le ballon dans le dos. Dès que la ligne est passée, le thème devient le repli. Point défensif si la frappe est prise de loin ou contrée. L\'attaque marque normalement. Le gardien a le droit de sortir pour couper la passe, pas pour remplacer la ligne.',
          'Interdire la sortie du gardien. Puis donner l\'égalité numérique.'),
        b('Jeu', '20 min', 'Terrain foot à 11', '9 contre 9', grands, 'Complet',
          'But = 1. But après un repli manqué = 2 pour l\'attaque, pour rendre l\'erreur visible.',
          'Le double pénalise le bloc qui continue de presser alors que le ballon est déjà dans le dos. L\'éducateur annonce « repli » une ou deux fois au début, puis plus. Hors-jeu en vigueur pour que la ligne ait une hauteur à tenir.',
          'Retirer le but double. Observer si le repli reste.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match de fin de cycle. L\'équipe défend son but réel et son organisation de championnat.',
          'Proche des conditions du dimanche. Thème conservé en observation, sans règle qui déforme le score. L\'éducateur relève trois séquences : pressing réussi, repli réussi, ligne cassée. Le retour se fait sur ces images décrites, avec les joueurs concernés.',
          'Demander aux leaders de commander la hauteur. Si la parole manque, la ligne ne tiendra pas en match.')
      ])
    ]
  },
  {
    id: 'fixer',
    name: 'Fixer pour renverser',
    phase: 'Déséquilibrer-finir',
    principle: 'Fixer pour renverser',
    means: 'Fixation collective, appuis latéraux, jeu à l\'opposé puis finition',
    eval: true,
    levels: [
      level('Fixer avec des appuis', 'Utiliser un appui latéral pour tenir un côté, puis marquer à l\'opposé.', {
        collectifs: 'Occuper les trois zones. Rester sur le côté fort assez longtemps pour attirer, sans y finir.',
        individuels: 'L\'appui joue en deux touches et remet vers l\'intérieur ou vers l\'opposé. Le renversement est frappé, pas glissé.',
        criteres: 'Le but arrive de l\'autre côté de la fixation. L\'appui a été utilisé. La défense a coulissé avant le renversement.'
      }, [
        b('Mise en train', '15 min', '30 × 20 m', 'Groupes de 6', ballons, 'Demi',
          'Donner à l\'appui, recevoir au milieu, envoyer à l\'opposé.',
          'Trois zones. Deux appuis, un dans chaque bande, inattaquables. Les quatre autres se passent le ballon et doivent toucher un appui avant de changer de zone. Pas de but encore : la réussite est le changement de zone en trois passes. Deux terrains en parallèle.',
          'Les appuis n\'ont plus qu\'une touche. Puis un défenseur entre dans la zone centrale.'),
        b('Situation', '25 min', '35 × 25 m', '4 contre 4 + 2 appuis', buts, 'Demi',
          'Marquer dans un petit but après une passe à un appui et un renversement.',
          'Deux petits buts, un de chaque côté. 4 contre 4 au milieu, un appui dans chaque bande, inattaquable, deux touches. On marque seulement après avoir joué avec un appui. La défense coulisse côté ballon et n\'a pas le droit d\'entrer dans les bandes. Rotations : l\'appui entre sur le terrain au bout de 3 minutes.',
          'Rendre les appuis attaquables. Ou n\'autoriser qu\'un seul appui, qui change de côté.'),
        b('Jeu', '20 min', '40 × 30 m', '5 contre 5 + 2 appuis', buts, 'Demi',
          'But après renversement = 2. But sans renversement = 0.',
          'Même logique, espace plus grand, défense plus libre de coulisser. Les appuis restent à deux touches. Si une équipe marque sans être passée par l\'appui, le but est annulé et le ballon donné à l\'autre. Les joueurs au repos remplacent les appuis.',
          'Autoriser le but direct si la défense a déjà les deux côtés occupés, pour ne pas jouer lentement pour rien.'),
        b('Jeu', '25 min', '1/2 terrain', '8 contre 8', grands, 'Demi',
          'Le grand but ne compte qu\'après un jeu sur un côté puis une frappe de l\'autre.',
          'Les appuis disparaissent. Les ailiers de l\'équipe les remplacent, et ils sont attaquables. C\'est le passage du joker au joueur réel. Gardien dans le grand but. L\'équipe qui défend peut marquer en contre dans deux petits buts placés à mi-terrain.',
          'Retirer les petits buts de contre. La fixation doit rester utile même sans menace dans le dos.')
      ]),
      level('Fixer par le redoublement', 'Enchaîner les passes d\'un même côté pour attirer, sans appui extérieur.', {
        collectifs: 'Redoubler sur un côté à trois joueurs au moins. Le joueur opposé reste large et ne rentre pas trop tôt.',
        individuels: 'Passes serrées, une ou deux touches. Le troisième homme côté fort décroche. Le joueur qui renverse regarde avant de recevoir.',
        criteres: 'Au moins trois passes ont lieu dans la même zone avant le renversement. Le côté faible n\'est pas occupé par un défenseur au moment de la passe.'
      }, [
        b('Mise en train', '15 min', 'Carré 25 m + deux côtés', '8 contre 2', ballons, 'Demi',
          'Cinq passes d\'un côté, puis envoi à l\'opposé.',
          'Le carré est collé à une bande. L\'équipe en possession doit jouer ses cinq passes dans cette bande avant d\'envoyer dans l\'espace opposé, où deux partenaires attendent. Les deux défenseurs pressent seulement la bande. Changement de bande après chaque réussite.',
          'Les défenseurs peuvent suivre le renversement sur les cinq derniers mètres.'),
        b('Situation', '25 min', '45 × 30 m', '5 contre 5', buts, 'Demi',
          'Marquer à l\'opposé après au moins trois passes dans la même moitié de terrain.',
          'Terrain coupé en deux dans la longueur. Pas d\'appui. Petit but de chaque côté de la ligne de fond. La règle des trois passes crée la fixation. Si le ballon change de moitié avant, le compteur repart. Défense libre. Effectif complet par vagues de 5, les autres tiennent les ballons.',
          'Passer à quatre passes obligatoires. Puis à deux seulement, pour comparer ce qui attire vraiment.'),
        b('Jeu', '20 min', '1/2 terrain', '7 contre 6', grands, 'Demi',
          'But = 1. But après redoublement visible = 3.',
          'L\'infériorité défensive permet au thème d\'apparaître. L\'éducateur ne compte les passes à voix haute que si le jeu est brouillon. Sinon les joueurs se parlent. Grand but plus deux petits buts de délestage qui ne rapportent rien : ils servent à fixer, pas à marquer.',
          'Les petits buts latéraux rapportent 1 s\'ils sont utilisés comme fixation puis que le vrai but suit dans la même action.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '9 contre 9', grands, 'Complet',
          'Match. Le renversement n\'est plus obligatoire, il est valorisé.',
          'But normal = 1, but après fixation d\'un côté = 2. Assez de liberté pour que les joueurs choisissent le moment. Hors-jeu. Observation : est-ce que le redoublement attire, ou est-ce que l\'on passe à l\'opposé trop tôt ?',
          'Annoncer le score des points thème à la 15e minute pour relancer l\'attention.')
      ]),
      level('Renverser en mouvement', 'Le joueur qui reçoit à l\'opposé est déjà en course.', {
        collectifs: 'L\'appel côté faible part au moment de la dernière passe côté fort. Personne n\'attend le ballon à l\'arrêt.',
        individuels: 'Passe devant le partenaire, dans l\'espace. Départ sec, sans télégraphier trop tôt. Première touche vers l\'avant.',
        criteres: 'Le receveur du renversement est lancé. Le ballon ne revient pas en arrière après le changement de côté. La défense arrive en retard sur ce joueur.'
      }, [
        b('Mise en train', '15 min', '1/2 terrain', 'Par 3, plusieurs ateliers', ballons, 'Demi',
          'Passe en profondeur dans la course après une fixation simulée.',
          'Plot qui représente le défenseur attiré. Le porteur joue avec un partenaire proche, puis le troisième part de l\'autre côté. La passe doit arriver devant lui. On recommence de l\'autre côté. Chrono léger, qualité de la passe devant. Quatre ateliers pour les 18.',
          'Le plot est remplacé par un joueur qui peut intercepter la passe en profondeur.'),
        b('Situation', '25 min', '50 × 40 m', '6 contre 5', buts, 'Demi',
          'Le but ne compte que si le buteur a reçu en course côté faible.',
          'Cinq défenseurs alignés, qui ont consigne de suivre le ballon. Six attaquants. Petit but de chaque côté plus un central. Le but central ne compte pas : il sert de leurre. Seul le but du côté opposé à la dernière zone de possession compte, et seulement si le buteur n\'a pas contrôlé le ballon à l\'arrêt. L\'éducateur est généreux au début.',
          'Exiger une frappe sans contrôle, puis réautoriser une touche si le ballon est dans la course.'),
        b('Jeu', '20 min', '2/3 de terrain', '8 contre 7 + gardien', grands, 'Complet',
          'Occasion créée dans la course côté faible = 1, but = 2.',
          'Le gardien donne le côté de la relance. L\'attaque doit finir de l\'autre côté, en mouvement. La défense n\'a pas d\'autre consigne que de défendre le but. On évite d\'empiler les règles : une seule, le mouvement.',
          'La défense a le droit de laisser un joueur côté faible. L\'attaque doit fixer assez pour l\'attirer lui aussi.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match. On note les renversements reçus en course qui mènent à une frappe.',
          'Aucune annulation de but. Le thème devient un critère d\'observation pour le cycle BFM : combien de renversements trouvent un joueur lancé. Les joueurs le savent avant de jouer. Remplacements à la 12e minute.',
          'Demander aux milieux de retarder d\'une seconde le départ du côté faible, pour qu\'il coïncide avec la frappe de balle.')
      ]),
      level('Choisir le renversement', 'Parfois le renversement est court, dans un intervalle. Parfois il est long. Il faut choisir.', {
        collectifs: 'Lire le bloc : s\'il est compact d\'un côté, le ballon long est possible. S\'il est déjà écarté, le renversement court dans un intervalle suffit.',
        individuels: 'Le porteur lève la tête deux fois. Il ne joue pas le long par habitude. Le partenaire proche se propose quand même, pour garder les deux solutions.',
        criteres: 'Les deux types de renversement apparaissent. Le choix correspond à la position du bloc. Il y a peu de ballons longs joués dans les pieds d\'un défenseur.'
      }, [
        b('Mise en train', '15 min', '40 × 30 m', 'Deux couleurs, 9 contre 0 puis 9 contre 2', ballons, 'Demi',
          'Annoncer « court » ou « long » avant de changer de côté, et réussir la passe.',
          'D\'abord sans défense : le porteur dit le choix puis exécute. Ensuite deux défenseurs flottent. Le choix doit être visible dans le geste, pas crié, dès que les joueurs sont à l\'aise. On cherche la justesse, pas la puissance du long ballon.',
          'Interdire l\'annonce orale. Le partenaire doit lire le geste.'),
        b('Situation', '25 min', '1/2 terrain', '7 contre 7', grands, 'Demi',
          'Marquer après un renversement adapté : court si le bloc est haut, long s\'il est bas d\'un côté.',
          'L\'éducateur peut, une fois par action, montrer la hauteur du bloc d\'un geste, puis il arrête. Sept contre sept, grand but et deux petits buts latéraux. Les deux valent le but. La discussion se fait à l\'arrêt naturel, une question : « pourquoi celui-là ? ».',
          'Un défenseur side-back a le droit de sortir très haut. Le long ballon dans son dos devient la solution.'),
        b('Jeu', '20 min', '2/3 de terrain', '8 contre 8 + gardiens', grands, 'Complet',
          'But = 1. Mauvais choix évident = le ballon revient, sans discours.',
          'Si le ballon long est joué alors que le côté faible est déjà occupé par deux défenseurs, on rend la balle. Si le choix est discutable, on laisse le but. Les joueurs doivent sentir la différence entre l\'erreur claire et le risque normal.',
          'Ne plus rendre le ballon. Noter les choix faux et les dire à la pause.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match. Liberté totale, observation du choix de renversement.',
          'Système habituel de l\'équipe. L\'éducateur se place sur la ligne de touche médiane pour voir les deux côtés. Il n\'intervient pas. Le débriefing oppose deux actions : un court juste, un long inutile.',
          'Demander au gardien de relancer main côté fort pour provoquer le choix dans les 8 secondes.')
      ]),
      level('Fixer le bloc et finir', 'La fixation n\'est utile que si elle débouche sur une finition côté faible.', {
        collectifs: 'Le côté fort attire le bloc et les milieux. Le côté faible a un joueur dans la surface au moment du centre ou de la passe.',
        individuels: 'Centre dévié de l\'extérieur du pied ou passe rasante dans la course. Le finisseur attaque le premier poteau ou le point de penalty selon le ballon, pas les deux.',
        criteres: 'La finition suit le renversement dans la même action. Il y a un joueur dans la surface au moment du centre. Les centres sans fixation devant le bloc diminuent.'
      }, [
        b('Mise en train', '15 min', 'Surface et couloir', 'Vagues de 4', ballons, 'Demi',
          'Fixer le plot-défenseur, centrer, finir du premier geste.',
          'Un couloir droit, un couloir gauche. Vague de 4 : deux fixent par une passe, le troisième centre, le quatrième finit. On change de côté à chaque vague. Gardiens dans le but à tour de rôle. Cadence élevée, gestes simples.',
          'Un défenseur réel sur le centreur. Puis un second sur le finisseur.'),
        b('Situation', '25 min', '1/2 terrain', '7 contre 6 + gardien', grands, 'Demi',
          'Marquer dans les 8 secondes après le renversement.',
          'La limite de temps empêche de recontrôler et de rejouer devant le but. Six défenseurs + gardien, sept attaquants. Le renversement peut venir des deux ailes. Si le temps est dépassé, le gardien relance et la défense marque le point. Rotations toutes les 4 minutes.',
          'Ramener à 6 secondes. Ou ajouter un défenseur pour passer à égalité.'),
        b('Jeu', '20 min', '2/3 de terrain', '8 contre 8 + gardiens', grands, 'Complet',
          'But après centre ou passe côté faible = 2. Autre but = 1.',
          'Les deux équipes jouent le thème. On laisse le but « normal » valoir 1 pour ne pas tuer les autres solutions de finition, déjà travaillées ailleurs dans l\'année. Le bonus maintient l\'attention sur la fixation.',
          'Annoncer les deux minutes finales sans bonus, pour voir le transfert.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match de synthèse du thème. Score réel, observation des finitions côté faible.',
          'C\'est la séance évaluable la plus complète du cycle : fixer, choisir, finir. Pas de règle supplémentaire. L\'éducateur relève si la chaîne tient face à une défense qui connaît maintenant le thème, puisque le cycle a été vu toute l\'année.',
          'Demander à l\'équipe observée de commencer chaque temps fort par une attaque placée côté fort.')
      ])
    ]
  },
  {
    id: 'conserver',
    name: 'Conserver pour progresser',
    phase: 'Conserver-progresser',
    principle: 'Conserver pour progresser',
    means: 'Conservation orientée, passes vers l\'avant, construction depuis le gardien',
    eval: false,
    levels: [
      level('Conserver puis sortir', 'En grande supériorité, garder le ballon et choisir le moment de jouer vers l\'avant.', {
        collectifs: 'S\'écarter pour offrir deux solutions au porteur. Ne pas jouer en retrait par confort si une passe avant est ouverte.',
        individuels: 'Première touche qui protège le ballon. Passe à la bonne main. Appel en se montrant de profil.',
        criteres: 'L\'équipe garde le ballon sous le pressing léger. Au moins une passe vers l\'avant précède la sortie. Les pertes dans les pieds sont rares.'
      }, [
        b('Mise en train', '15 min', '20 × 20 m', '5 contre 2, quatre carrés', ballons, 'Demi',
          'Dix passes, puis une passe qui sort du carré vers un partenaire qui décroche.',
          'Quatre carrés pour les 18 joueurs. Dans chaque carré, 5 contre 2. À la dixième passe, un joueur extérieur se propose et reçoit hors du carré. Les défenseurs changent quand ils touchent le ballon. Le thème est la sécurité, pas la vitesse.',
          'Descendre à 4 contre 2. Puis obliger la sortie avant la huitième passe.'),
        b('Situation', '25 min', '35 × 25 m', '6 contre 3', buts, 'Demi',
          'Conserver dans la zone, puis marquer dans un petit but cible en une passe vers l\'avant.',
          'Zone de conservation et, dix mètres devant, deux petits buts cibles. Les 6 ne peuvent marquer qu\'après 5 passes. Les 3 pressent. Si la défense récupère, elle tente de sortir par une ligne de fond : elle aussi doit progresser. Les joueurs au repos entrent chez les défenseurs toutes les 2 minutes.',
          'Passer à 6 contre 4. Puis limiter les 6 à deux touches.'),
        b('Jeu', '20 min', '40 × 30 m', '7 contre 4', buts, 'Demi',
          'Un point toutes les 8 passes, deux points pour le but qui suit la conservation.',
          'Le point de passes évite de garder le ballon pour rien : le but reste le vrai objectif. La défense en infériorité presse le porteur et coupe la passe avant. Rotations pour que chacun passe en infériorité.',
          'Le point de passes disparaît après 10 minutes. On voit si la conservation sert encore à marquer.'),
        b('Jeu', '25 min', '1/2 terrain', '8 contre 5 + gardien', grands, 'Demi',
          'Marquer dans le grand but après une construction d\'au moins six passes.',
          'Le gardien compte dans les six. Il relance à la main vers un pied, pas en dégagement. L\'équipe en infériorité défend le but et peut marquer en contre dans un petit but : la conservation a donc un risque. C\'est déjà le sens du thème.',
          'Réduire à cinq passes. Puis laisser l\'équipe en infériorité monter d\'un joueur.')
      ]),
      level('Imposer la passe avant', 'La conservation n\'est validée que si elle avance.', {
        collectifs: 'Un joueur se propose toujours devant le porteur. Les autres assurent le soutien derrière, pour recommencer si la passe avant n\'est pas là.',
        individuels: 'Oser la passe verticale quand elle est ouverte. Contrôle vers l\'avant. Ne pas se retourner dos au but si l\'on peut jouer de face.',
        criteres: 'Chaque action contient une passe qui gagne du terrain. Les passes en retrait servent à recommencer, pas à occuper. Le ballon entre dans le camp adverse.'
      }, [
        b('Mise en train', '15 min', '30 × 20 m', 'Deux équipes de 8', ballons, 'Demi',
          'Avancer d\'une zone à chaque série de trois passes.',
          'Trois bandes dans la longueur. On ne change de bande vers l\'avant qu\'après trois passes dans la bande actuelle. On peut revenir en arrière, mais le compteur de la bande repart. Pas de défenseur au début, puis deux chasseurs qui évoluent dans toutes les bandes.',
          'Deux passes seulement pour changer de bande. Puis une seule.'),
        b('Situation', '25 min', '40 × 30 m', '6 contre 4', buts, 'Demi',
          'Marquer dans le but du haut. Une passe vers l\'avant est obligatoire avant la frappe.',
          'Sens unique. Les 4 défendent le but et relancent depuis leur gardien de but réduit s\'ils récupèrent. Les 6 perdent le ballon s\'ils jouent trois passes en retrait de suite. La règle est simple à arbitrer. Vagues toutes les 4 minutes.',
          'Interdire deux passes en retrait de suite. Puis ajouter un cinquième défenseur.'),
        b('Jeu', '20 min', '1/2 terrain', '7 contre 6 + gardien', grands, 'Demi',
          'But = 1. But précédé d\'une passe verticale dans la course = 2.',
          'Presque l\'égalité, pour que la passe avant ait un risque. Le bonus récompense la passe qui progresse, pas la conservation stérile. Le gardien joue au pied avec son équipe.',
          'Annoncer que le bonus tombe dans les 5 dernières minutes.'),
        b('Jeu', '25 min', '2/3 de terrain', '9 contre 8', grands, 'Complet',
          'Match à sens majoritaire. Progresser depuis son gardien.',
          'L\'équipe observée a un joueur de plus et le gardien. Elle doit construire. L\'autre équipe presse à deux et se replie ensuite. On ne bloque pas le score. Observation : est-ce que la première passe avant est trop tardive ?',
          'Le pressing adverse passe à trois joueurs. La conservation doit rester orientée.')
      ]),
      level('Jeu court, jeu long', 'Alterner la passe courte qui fixe et la passe longue qui progresse.', {
        collectifs: 'Se proposer près et loin en même temps. Le bloc s\'étire en profondeur. Le joueur cible du jeu long est annoncé par son placement, pas par un cri permanent.',
        individuels: 'Passe longue à la bonne hauteur, devant le partenaire. Passe courte assez forte pour ne pas être interceptée. Tête relevée pour voir les deux.',
        criteres: 'Les deux distances de passe apparaissent dans la même action. Le jeu long n\'est pas un dégagement. Il trouve un partenaire ou un espace utile.'
      }, [
        b('Mise en train', '15 min', '1/2 terrain', 'Groupes de 6', ballons, 'Demi',
          'Enchaîner trois passes courtes et une passe longue devant un partenaire.',
          'Triangle proche, un joueur cible à 25 m. La quatrième passe est longue, dans la course. Le receveur remet en retrait et le groupe recommence de l\'autre côté. Deux groupes, gardiens intégrés aux passes longues à la main puis au pied.',
          'Un défenseur sur le receveur long. La passe doit le battre par la hauteur ou le timing.'),
        b('Situation', '25 min', '50 × 40 m', '7 contre 6', buts, 'Demi',
          'Marquer après une séquence qui contient au moins une passe courte et une passe de plus de 20 m.',
          'Plots à 20 m pour que la règle soit visible. Sept attaquants, six défenseurs. Petit but plus grand but gardienné en alternance. Si l\'équipe marque seulement en jeu court, le but vaut 1. S\'il y a eu les deux distances, il vaut 3. On laisse les deux possibles.',
          'Le but seulement court ne vaut plus rien pendant 8 minutes, puis on le réautorise.'),
        b('Jeu', '20 min', '2/3 de terrain', '8 contre 8', grands, 'Complet',
          'But = 1. Séquence court-long-court avant le but = 3.',
          'Égalité. La séquence demande de ne pas finir sur le premier ballon long : quelqu\'un doit être là pour remettre et continuer. C\'est le lien avec la progression, pas le dégagement. Hors-jeu appliqué.',
          'Autoriser la frappe directe sur le jeu long, qui vaut alors 2, pour ne pas stéréotyper.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match. Observation des relances : courte pour attirer, longue pour dépasser une ligne.',
          'Système habituel. Le gardien a deux solutions annoncées avant le match : latéral bas, ou attaquant qui décroche. Il choisit. L\'éducateur note les relances jouées vers un partenaire et celles subies.',
          'Demander une relance courte obligatoire sur les six mètres, puis liberté.')
      ]),
      level('Progresser dans le temps', 'Garder le ballon, mais avancer avant que le bloc adverse ne se replace.', {
        collectifs: 'Jouer vite vers l\'avant dès que la ligne de passe s\'ouvre. Ralentir seulement pour attirer, pas par manque d\'idée.',
        individuels: 'Prise de décision en deux secondes. Passe à une touche quand le partenaire est déjà parti. Conduite seulement si elle fait avancer.',
        criteres: 'Les actions qui mènent à la surface durent moins longtemps qu\'en début de séance. Le ballon ne circule pas dix passes devant un bloc déjà placé.'
      }, [
        b('Mise en train', '15 min', '30 × 20 m', '4 contre 2 puis sortie', ballons, 'Demi',
          'Sortir du carré vers l\'avant en moins de 8 secondes.',
          'Rondo 4 contre 2. Dès que l\'éducateur lève la main, l\'équipe a 8 secondes pour trouver un partenaire dans une zone avant. Si elle dépasse, les défenseurs deviennent l\'équipe en possession. Rythme élevé, beaucoup de ballons.',
          'Descendre à 6 secondes. Puis le signal part dès la première passe.'),
        b('Situation', '25 min', '1/2 terrain', '7 contre 6 + gardien', grands, 'Demi',
          'Frapper ou centrer avant 12 secondes après la récupération. Sinon reposer et recommencer.',
          'Le chronomètre crée l\'urgence de progresser. La conservation reste permise, mais elle ne peut pas durer. Six défenseurs + gardien. Si le temps est dépassé, le gardien adverse relance : l\'attaque a « trop gardé ». Question : « où était la passe avant ? ».',
          '10 secondes. Puis 15 si le jeu devient seulement des ballons longs subis.'),
        b('Jeu', '20 min', '2/3 de terrain', '8 contre 8 + gardiens', grands, 'Complet',
          'But dans le temps = 2. But hors temps = 1.',
          'Le but hors temps reste valable pour ne pas arrêter les belles actions lentes qui ont un sens. Le bonus pousse à progresser plus tôt. Les deux équipes sont concernées.',
          'Afficher le temps à voix haute seulement la première moitié du jeu.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '10 contre 10', grands, 'Complet',
          'Match. L\'équipe doit entrer dans le camp adverse rapidement après la récupération dans son camp.',
          'Pas de chronomètre visible. L\'éducateur compte en silence et donne le bilan à la mi-temps : récupérations suivies d\'une passe avant dans les 5 secondes. Les joueurs proposent ce qui les retardait.',
          'Ajouter un pressing adverse à trois pour que le temps devienne un vrai problème.')
      ]),
      level('Construire face au pressing', 'Depuis le gardien, progresser malgré une équipe qui monte.', {
        collectifs: 'Largeur dès la relance. Un milieu décroche. Si le pressing est sauté, jouer vite dans le dos. Si ce n\'est pas possible, garder et changer de côté.',
        individuels: 'Le gardien joue à la main ou au pied vers un partenaire démarqué, jamais dans l\'axe sans solution. Le latéral se montre de profil. Le milieu axial protège son contrôle.',
        criteres: 'La relance trouve un partenaire. L\'équipe sort de sa moitié avec le ballon. Les dégagements subis diminuent entre le début et la fin de la séance.'
      }, [
        b('Mise en train', '15 min', '1/2 terrain', 'Gardiens + lignes de 4', ballons, 'Demi',
          'Relancer vers un latéral malgré un presseur, puis passer un milieu qui décroche.',
          'Le gardien a le ballon. Un presseur arrive. Le latéral se montre, le milieu décroche en soutien. Passe, remise, ouverture. L\'autre vague part dès que la première a franchi la ligne des 30 m. Les deux gardiens tournent.',
          'Deux presseurs. Puis le latéral est suivi et il faut changer de côté.'),
        b('Situation', '25 min', '2/3 de terrain', '8 contre 7 + gardien', grands, 'Complet',
          'Franchir la ligne médiane avec le ballon après une relance du gardien.',
          'Sept presseurs ont le droit de monter jusqu\'au gardien. Huit joueurs + gardien construisent. La réussite est de passer la médiane en maîtrise, puis ils peuvent finir. S\'ils dégagent, la défense marque le point. S\'ils se font presser et perdent dans leur surface, on en parle tout de suite, brièvement.',
          'Les presseurs passent à 8. Égalité. Le gardien peut jouer long seulement si les pieds sont fermés.'),
        b('Jeu', '20 min', 'Terrain foot à 11', '9 contre 9', grands, 'Complet',
          'Sortie de pressing réussie = 1. But qui suit = 2 de plus.',
          'Les deux gardiens relancent au pied. Un joueur adverse peut presser le gardien. Le point valorise la construction, le but reste le football. Hors-jeu. Remplacements fréquents pour garder de la lucidité.',
          'Interdire le dégagement haut pendant 8 minutes. Le réautoriser ensuite et comparer.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match. La construction est observée sur chaque relance de gardien et chaque six mètres.',
          'Conditions de championnat. Thème connu de l\'équipe. Pas de règle de points. Grille : relance jouée, ligne franchie, occasion. C\'est le transfert du cycle avant les matches de printemps.',
          'Annoncer à l\'équipe adverse de presser haut le premier quart d\'heure, puis de choisir.')
      ])
    ]
  },
  {
    id: 'intervalles',
    name: 'Jouer dans les intervalles',
    phase: 'Déséquilibrer-finir',
    principle: 'Jouer dans les intervalles',
    means: 'Passes entre les joueurs et entre les lignes, appels en rupture',
    eval: false,
    levels: [
      level('L\'intervalle proche', 'Trouver le trou juste devant la ligne, en supériorité.', {
        collectifs: 'Un joueur se place entre deux défenseurs, pas dans leur dos lointain. Les autres écartent la ligne pour agrandir l\'intervalle.',
        individuels: 'Appel en retrait du défenseur, main vers le ballon. Passe à l\'intérieur du pied, rasante. Contrôle qui protège du retour du défenseur.',
        criteres: 'La passe passe entre deux défenseurs. Le receveur est orienté vers l\'avant. La ligne adverse est contournée sans jeu long.'
      }, [
        b('Mise en train', '15 min', '30 × 20 m', 'Lignes de 4 et groupes de 6', ballons, 'Demi',
          'Glisser une passe entre deux plots-défenseurs vers un partenaire qui se montre.',
          'Deux plots figent une paire de défenseurs. Le porteur doit passer entre eux. Le receveur part de derrière et se montre dans l\'intervalle au moment de la frappe. Plusieurs portes de plots. Tout le groupe tourne. Ensuite un vrai défenseur remplace un plot, en marchant.',
          'Les deux défenseurs peuvent bouger les bras et les pieds, sans se déplacer au début.'),
        b('Situation', '25 min', '35 × 25 m', '5 contre 3 en ligne', buts, 'Demi',
          'Marquer après une passe qui traverse l\'intervalle de la ligne.',
          'Trois défenseurs tiennent une ligne, ils n\'ont pas le droit de la casser vers l\'avant au début. Cinq attaquants. Deux petits buts derrière la ligne. Le but ne compte que si le ballon est passé entre deux défenseurs, pas au-dessus. Vagues. Les défenseurs changent toutes les 3 minutes.',
          'La ligne peut monter d\'un pas. Puis un défenseur a le droit de suivre dans l\'intervalle.'),
        b('Jeu', '20 min', '40 × 30 m', '6 contre 5', buts, 'Demi',
          'But = 1. But après passe dans un intervalle = 3.',
          'La ligne n\'est plus interdite de se déplacer. L\'intervalle doit être créé par les écarts. Cinq défenseurs, six attaquants. L\'éducateur valide l\'intervalle généreusement au début : entre deux joueurs, devant eux.',
          'Ne valider que les passes qui cassent vraiment la ligne, pas celles qui passent à côté.'),
        b('Jeu', '25 min', '1/2 terrain', '8 contre 7 + gardien', grands, 'Demi',
          'Match réduit. Le grand but compte double s\'il vient d\'une passe entre deux défenseurs.',
          'Hors-jeu léger : la ligne a une hauteur. L\'attaque n\'a qu\'un joueur de plus. Le gardien relance sur son défenseur le plus libre pour recommencer le problème. Observation du premier contrôle dans l\'intervalle.',
          'Égalité 8 contre 8. L\'intervalle se rétrécit.')
      ]),
      level('Entre les lignes', 'Se placer entre la ligne défensive et la ligne de milieux, puis remettre.', {
        collectifs: 'Le joueur entre les lignes ne reste pas. Il reçoit, remet, et se replace. Un second joueur le remplace dans l\'intervalle.',
        individuels: 'Se retourner vite ou remettre en une touche si l\'on est dos au but. Appeler au bon moment, quand le porteur peut voir.',
        criteres: 'Le ballon est reçu entre les lignes, pas dans les pieds d\'un milieu. La remise trouve un troisième joueur en mouvement. Le receveur n\'est pas isolé.'
      }, [
        b('Mise en train', '15 min', '40 × 25 m', 'Par 4', ballons, 'Demi',
          'Recevoir entre deux lignes de plots, remettre en une touche, repartir.',
          'Deux lignes de plots à 8 m. Le joueur part de la ligne arrière, reçoit entre les deux, remet latéralement, et le quatrième enchaîne. Geste propre, puis vitesse. Quatre ateliers.',
          'Un défenseur entre les lignes, qui touche le ballon = l\'atelier recommence.'),
        b('Situation', '25 min', '1/2 terrain', '6 contre 5 + gardien', grands, 'Demi',
          'Marquer après une remise du joueur situé entre les deux lignes.',
          'Trois défenseurs et deux milieux, plus le gardien. Six attaquants dont un consigne de vivre entre les lignes. Il n\'a pas le droit de finir lui-même au début : il remet. Le but vient du troisième homme. Ainsi le rôle est clair. Au bout de 12 minutes, il peut finir aussi.',
          'Ajouter un second joueur entre les lignes. Ils ne doivent pas se tenir l\'un à côté de l\'autre.'),
        b('Jeu', '20 min', '2/3 de terrain', '8 contre 8', grands, 'Complet',
          'But après remise d\'entre les lignes = 2. Autre but = 1.',
          'Deux lignes défensives libres. L\'attaque n\'a plus de joueur désigné : n\'importe qui peut décrocher entre les lignes. C\'est le passage du rôle fixé au placement compris. Hors-jeu.',
          'La défense a le droit de suivre le joueur qui décroche. L\'intervalle doit être repris par un autre.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '9 contre 9', grands, 'Complet',
          'Match. Observer qui se propose entre les lignes et s\'il remet ou s\'il s\'isole.',
          'Milieu en losange ou en ligne, au choix de l\'équipe, annoncé avant. On ne change pas en cours de jeu. Le thème est le placement, pas le système. Bilan à la pause : nombre de ballons reçus entre les lignes.',
          'Demander au défenseur axial adverse de suivre le milieu offensif. Un autre attaquant doit occuper l\'intervalle.')
      ]),
      level('Passer une ligne qui monte', 'Jouer dans l\'intervalle au moment où la défense avance, sans tomber hors-jeu.', {
        collectifs: 'Tenir la ligne adverse intéressée par le ballon devant, puis punir l\'intervalle qui s\'ouvre dans son dos proche. Rester à hauteur.',
        individuels: 'Départ au moment où le défenseur pose le pied avant. Passe tendue. Rester en jeu : le dernier défenseur est le repère.',
        criteres: 'Les passes dans le dos proche arrivent sur un joueur encore en jeu. Les hors-jeu diminuent. La ligne adverse est punie quand elle monte sans pression sur le porteur.'
      }, [
        b('Mise en train', '15 min', '30 × 20 m', 'Attaquants par 3, une ligne de 3', ballons, 'Demi',
          'La ligne monte, la passe part dans l\'intervalle, le receveur reste en jeu.',
          'La ligne de 3 monte au signal. Le porteur joue dans l\'espace juste derrière le défenseur qui est monté le plus haut, devant le dernier. On marque un plot, pas un but. L\'éducateur dit « en jeu » ou « hors-jeu » tout de suite. Les rôles tournent.',
          'La ligne monte sans signal, au moment qu\'elle choisit.'),
        b('Situation', '25 min', '1/2 terrain', '6 contre 6 + gardien', grands, 'Demi',
          'Marquer en jouant dans l\'intervalle d\'une ligne qui a le droit de monter. Le hors-jeu est sifflé.',
          'Égalité, hors-jeu strict. C\'est nouveau par rapport aux niveaux précédents : l\'intervalle trop profond est puni. L\'intervalle juste est récompensé par le but normal. Pas de point bonus, la règle du hors-jeu suffit à trier les appels.',
          'La défense gagne un point à chaque hors-jeu. L\'attaque devient plus attentive.'),
        b('Jeu', '20 min', '2/3 de terrain', '8 contre 8 + gardiens', grands, 'Complet',
          'Match réduit avec hors-jeu. Le thème est la passe qui casse la ligne au bon moment.',
          'Les gardiens commandent la hauteur. L\'éducateur siffle le hors-jeu sans discuter, comme en match. Il questionne seulement à la pause d\'eau : « tu partais trop tôt ou la passe était tardive ? ».',
          'Autoriser un joueur en retrait défensif libre de rester bas. L\'intervalle se situe alors entre lui et les autres.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match. Hors-jeu réel. Observation des appels dans les intervalles.',
          'Arbitrage simple par l\'éducateur. On cherche des appels à l\'intérieur, entre latéral et axial, et entre les milieux. Pas de consigne chiffrée. Le débriefing montre un hors-jeu évitable et un intervalle réussi.',
          'Demander aux attaquants de rester un mètre plus bas que d\'habitude pendant 10 minutes.')
      ]),
      level('Le troisième homme', 'Le ballon ne va pas au joueur qui appelle, mais au joueur qui surgit dans l\'intervalle suivant.', {
        collectifs: 'Le premier appel fixe un défenseur. Le deuxième joueur occupe l\'intervalle libéré. La passe est décalée, pas directe dans le premier appel.',
        individuels: 'Ne pas suivre sa propre passe. Le troisième part en retard, au moment de la remise. Passe qui contourne le défenseur attiré.',
        criteres: 'Le défenseur est fixé par le premier appel. Le but ou la passe clé vient du troisième homme. Les deux joueurs ne se retrouvent pas dans le même intervalle.'
      }, [
        b('Mise en train', '15 min', '40 × 30 m', 'Par 3 contre 1', ballons, 'Demi',
          'Appeler, remettre, trouver le troisième dans l\'autre intervalle.',
          'Un défenseur. Trois attaquants. L\'un appelle face à lui, remet en retrait, le troisième est déjà dans l\'intervalle latéral. On marque dans un petit but. Le défenseur change à chaque but. Plusieurs terrains.',
          'Le défenseur peut choisir de ne pas suivre le premier appel. Les trois doivent lire et changer de solution.'),
        b('Situation', '25 min', '1/2 terrain', '7 contre 6', grands, 'Demi',
          'Le but ne compte que s\'il vient du troisième homme, pas du joueur qui a fait le premier appel.',
          'Règle claire pour forcer le décalage. Six défenseurs peuvent suivre qui ils veulent. Sept attaquants. Grand but. Si le premier appelant finit, le but est refusé une fois, puis on laisse pour ne pas bloquer le plaisir de marquer : la règle stricte dure 15 minutes, ensuite le but normal revient.',
          'Deux défenseurs ont consigne de suivre le premier appelant. L\'intervalle du troisième s\'ouvre.'),
        b('Jeu', '20 min', '2/3 de terrain', '8 contre 8 + gardiens', grands, 'Complet',
          'But du troisième homme = 3. Autre but = 1.',
          'Plus de refus de but. Le bonus suffit. Les joueurs doivent reconnaître eux-mêmes le troisième homme. L\'éducateur le nomme seulement si personne ne le voit, et pas à chaque action.',
          'Demander que la remise soit en une touche. Le timing du troisième devient plus juste.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match. Repérer les troisième homme entre les lignes et sur les côtés.',
          'Observation ciblée : côté gauche, axe, côté droit. Un joueur au repos note les troisième homme avec l\'éducateur. On en choisit deux à décrire au calme, une réussie, une où les deux joueurs ont appelé au même endroit.',
          'Changer le joueur noteur à la mi-temps pour que l\'observation fasse partie de l\'apprentissage.')
      ]),
      level('De l\'intervalle à la finition', 'Recevoir entre les lignes et enchaîner vers le but, ou remettre pour la frappe.', {
        collectifs: 'Le joueur entre les lignes a deux solutions : se retourner pour frapper, ou remettre si le couloir de frappe est fermé. La surface est attaquée au même moment.',
        individuels: 'Contrôle orienté vers le but si l\'intervalle de frappe est ouvert. Sinon une touche vers le partenaire qui rentre. Ne pas s\'arrêter dos au jeu dans la zone décisive.',
        criteres: 'Les ballons reçus entre les lignes produisent une frappe ou une dernière passe. Le joueur n\'est plus seulement un relais. Les occasions viennent de l\'intérieur, pas seulement des centres.'
      }, [
        b('Mise en train', '15 min', 'Entrée de surface', 'Vagues de 3', ballons, 'Demi',
          'Recevoir entre deux défenseurs-plots, puis frapper ou remettre.',
          'Le receveur a un plot de chaque côté. S\'il a de l\'espace devant, il frappe au premier geste. S\'il est clos, il remet sur le côté pour un centre court. Gardiens dans le but. Cadence de vague. Choix simple, répété.',
          'Un défenseur réel ferme tantôt l\'espace de frappe, tantôt le côté de la remise.'),
        b('Situation', '25 min', '1/2 terrain', '7 contre 6 + gardien', grands, 'Demi',
          'Toute action qui passe par l\'intervalle central doit finir par une frappe.',
          'Si le ballon est reçu entre les lignes et que l\'équipe ressort sans frapper, l\'action est arrêtée et le ballon donné au gardien. La règle pousse à ne pas rejouer en arrière une fois l\'intervalle pris. Six défenseurs + gardien. On accepte la frappe non cadrée : le critère est d\'avoir conclu, pas de marquer à chaque fois.',
          'La frappe doit être cadrée pour valider. Puis revenir à toute frappe, si les joueurs ne tentent plus.'),
        b('Jeu', '20 min', '2/3 de terrain', '9 contre 8', grands, 'Complet',
          'Frappe après intervalle = 1. But = 2. Action sans passage par l\'intervalle = 0 même en cas de but, pendant 10 minutes.',
          'La règle dure la première mi-temps du jeu seulement, pour installer le thème, puis le but normal revient. Les joueurs sentent la différence. Hors-jeu.',
          'Garder le but normal pendant toute la durée si le jeu se stérilise.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match de synthèse. Les occasions créées depuis l\'intervalle sont comptées.',
          'Score réel. L\'éducateur compte les réceptions entre les lignes et ce qu\'elles deviennent : perte, remise, frappe, but. Le chiffre est donné à la fin, sans interrompre. C\'est le bilan du cycle.',
          'Demander aux deux milieux offensifs d\'alterner : l\'un décroche, l\'autre attaque la surface.')
      ])
    ]
  },
  {
    id: 'finir',
    name: 'Finir les actions',
    phase: 'Déséquilibrer-finir',
    principle: 'Finir les actions',
    means: 'Finition, centres, une-deux et dernière passe',
    eval: false,
    levels: [
      level('Le geste de finition', 'Répéter la frappe dans des conditions simples, avec un peu d\'opposition.', {
        collectifs: 'Le passeur donne la finition avant de penser à une autre passe. La surface est occupée par deux coureurs, pas par un paquet.',
        individuels: 'Pied d\'appui à côté du ballon, tête stable, frappe vers la cible. Reprendre sa course après la frappe. Le gardien se replace entre les actions.',
        criteres: 'Les frappes sont cadrées plus souvent en fin de séance. Le geste reste le même quand un défenseur approche. On ne tire pas de trop loin sans raison.'
      }, [
        b('Mise en train', '15 min', 'Surface de réparation', 'Vagues de 4, deux buts si possible', ballons, 'Demi',
          'Cinq frappes cadrées de suite par vague, puis on change de zone.',
          'Ballon servi latéralement, frappe du premier geste. Puis service dans la course. Puis ballon qui rebondit. Les gardiens tournent toutes les 4 minutes. Les joueurs qui ne frappent pas servent ou récupèrent les ballons pour garder le rythme. Deux files.',
          'Un défenseur ferme l\'angle sans tacler. Le finisseur doit choisir l\'autre côté.'),
        b('Situation', '25 min', '30 × 25 m', '4 contre 2 + gardien', grands, 'Demi',
          'Marquer en moins de 8 secondes après l\'entrée du ballon.',
          'Quatre attaquants partent de la ligne des 25 m, deux défenseurs et le gardien. Le but est la réussite. Si le temps passe, on recommence. Beaucoup de répétitions. Les défenseurs ont consigne de retarder, pas de dégager loin : le thème est la frappe, pas la récupération.',
          'Un troisième défenseur. Puis service depuis le côté, pour une frappe après centre court.'),
        b('Jeu', '20 min', '40 × 30 m', '5 contre 5 + gardiens', grands, 'Demi',
          'But = 1. Frappe cadrée non marquée = 1 aussi, pour oser finir.',
          'Petit match. La frappe cadrée qui ne fait pas but rapporte autant, pendant 12 minutes, pour débloquer les joueurs qui rejouent trop. Ensuite seul le but compte, et on compare le nombre de tentatives.',
          'Interdire la passe en retrait dans la surface. Il faut frapper ou centrer.'),
        b('Jeu', '25 min', '1/2 terrain', '8 contre 8', grands, 'Demi',
          'Match. On compte les frappes cadrées et les buts, rien d\'autre.',
          'Égalité, hors-jeu. L\'éducateur annonce le total de frappes à la 12e minute. Si une équipe ne tente rien, la question est « où pouvais-tu frapper ? », pas une consigne de tirer de partout.',
          'Réduire la zone à l\'entrée de surface : tout ballon qui y entre doit être frappé ou donné pour une frappe immédiate.')
      ]),
      level('Centre : frapper ou repasser', 'À la réception du centre, choisir la frappe ou la passe selon le gardien et le défenseur.', {
        collectifs: 'Deux attaquants dans la surface, un au point de penalty, un qui attaque le premier poteau. Le centreur lève la tête avant de centrer.',
        individuels: 'Centre tendu si le partenaire est proche, lobé seulement s\'il attaque le second poteau. Le finisseur ne s\'arrête pas sous le ballon. Reprise de volée ou à une touche.',
        criteres: 'Le centre trouve une zone, pas le gardien. Le choix frappe ou passe est visible. Il y a un joueur au premier poteau.'
      }, [
        b('Mise en train', '15 min', 'Surface de réparation', 'Groupes de 5', ballons, 'Demi',
          'Centre rasant, le partenaire frappe ou remet en retrait si le gardien sort.',
          'Le gardien sort une fois sur deux, annoncé. Les finisseurs doivent lire. Centre à ras de terre d\'abord, puis mi-hauteur. Deux groupes, un de chaque côté du but si le terrain le permet, sinon en alternance.',
          'Le gardien choisit lui-même de sortir ou de rester. Plus personne n\'annonce.'),
        b('Situation', '25 min', '1/2 terrain', '5 contre 3 + gardien', grands, 'Demi',
          'Marquer sur centre. Si le gardien est sorti, la remise en retrait est la solution valorisée.',
          'Trois défenseurs + gardien, cinq attaquants dont deux partent du couloir. Le but sur centre direct = 1, le but après remise parce que le gardien était sorti = 2. On apprend le choix, pas seulement le geste. Rotations des défenseurs.',
          'Ajouter un défenseur dans la surface. Le centre doit être plus précis.'),
        b('Jeu', '20 min', '1/2 terrain', '7 contre 6 + gardien', grands, 'Demi',
          'But sur centre ou sur sa remise = 2. Autre but = 1.',
          'Le jeu n\'oblige pas à centrer à chaque fois, mais le valorise. Les ailiers ont de l\'espace. La défense peut sortir sur l\'ailier. Si elle sort trop, la remise intérieure devient la finition.',
          'Interdire le centre aérien pendant 6 minutes : seulement le centre rasant ou la passe arrière de la ligne de fond.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match. Les centres sont observés : zone visée, nombre de joueurs dans la surface, choix du finisseur.',
          'Match libre. L\'éducateur se met derrière le but pour voir la zone du centre. Débriefing sur deux centres : un gardien gêné, un centre sans attaquant. Pas de règle de score.',
          'Demander au moins trois joueurs dans la surface au moment du centre, comme variable, puis laisser.')
      ]),
      level('La dernière passe', 'Deux solutions de finition. Le passeur choisit celle qui est libre.', {
        collectifs: 'Proposer deux appuis de finition en même temps : un en profondeur, un en retrait ou à l\'opposé. Ne pas arriver à trois sur le même ballon.',
        individuels: 'Le dernier passeur fixe le défenseur ou le gardien du regard, puis donne de l\'autre côté. Passe qui donne le but, pas une passe à reprendre.',
        criteres: 'La passe décisive précède la frappe. Le finisseur est seul ou en avantage. Les frappes sans passe, de loin et sans angle, diminuent quand une passe était possible.'
      }, [
        b('Mise en train', '15 min', 'Entrée de surface', 'Par 3', ballons, 'Demi',
          'Le porteur a deux partenaires. Il donne à celui que le défenseur ne regarde pas.',
          'Un défenseur au milieu. Deux finisseurs, un à gauche un à droite. Le porteur joue celui qui est libre. On recommence en changeant le défenseur. Gardiens derrière. Quatre groupes.',
          'Le défenseur peut se déplacer au dernier moment. Le passeur doit avoir déjà choisi.'),
        b('Situation', '25 min', '35 × 30 m', '4 contre 3 + gardien', grands, 'Demi',
          'Marquer par une dernière passe, pas par une frappe lointaine du porteur.',
          'Le porteur n\'a pas le droit de frapper avant d\'avoir attiré le défenseur. S\'il frappe de loin sans passe, le but ne compte pas. Trois défenseurs + gardien, quatre attaquants. La règle dure toute la situation : ici on apprend la passe, la frappe a déjà eu sa séance.',
          'Autoriser la frappe du porteur si les deux partenaires sont couverts. C\'est déjà le choix.'),
        b('Jeu', '20 min', '1/2 terrain', '6 contre 6 + gardiens', grands, 'Demi',
          'Passe décisive puis but = 2. But individuel = 1.',
          'Les deux restent justes. Le bonus va à la dernière passe. Égalité, pour que le choix soit difficile. L\'éducateur nomme la passe décisive à voix haute de temps en temps, pour que le groupe l\'entende.',
          'Le but individuel ne vaut plus rien si un partenaire était seul dans la surface.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '9 contre 9', grands, 'Complet',
          'Match. On note les dernières passes qui donnent une occasion franche.',
          'Terrain complet, effectif réduit pour multiplier les situations de dernier passeur. Hors-jeu. Pas de bonus. Le bilan chiffré est donné à la fin : occasions créées par une passe / occasions tentées seul.',
          'Resserrer le terrain en largeur pour rapprocher les deux solutions de finition.')
      ]),
      level('Finir malgré le retour défensif', 'La défense revient. Il faut finir avant qu\'elle se replace, par une-deux ou par un centre.', {
        collectifs: 'Jouer vite à l\'entrée de la surface. Une-deux pour fixer le retour, ou centre si le couloir est libre. Un joueur reste en soutien si le premier ballon est manqué.',
        individuels: 'Une-deux en une touche. Frappe dès que l\'angle s\'ouvre, sans contrôle de plus. Le centreur ne ralentit pas en arrivant sur la ligne.',
        criteres: 'La finition a lieu avant que le dernier défenseur ne se soit replacé. Le une-deux crée l\'avantage. Les actions ralenties à l\'entrée de la surface sont questionnées.'
      }, [
        b('Mise en train', '15 min', '30 × 20 m', 'Par 2, un défenseur qui revient', ballons, 'Demi',
          'Une-deux et frappe avant que le défenseur ne coupe la ligne.',
          'Le défenseur part deux mètres derrière la paire. Une-deux, frappe au but réduit. S\'il rattrape la ligne de passe, l\'action s\'arrête. Répétitions des deux côtés. Gardiens en place.',
          'Le défenseur part à hauteur. Le une-deux doit être plus tôt.'),
        b('Situation', '25 min', '1/2 terrain', '5 contre 4 + gardien, un défenseur en retard', grands, 'Demi',
          'Marquer avant le retour du quatrième défenseur.',
          'L\'action commence à 4 contre 3 + gardien. Le quatrième défenseur part de la médiane au coup de sifflet. Les attaquants ont le temps d\'un une-deux ou d\'un centre. S\'il est de retour et que l\'on n\'a pas frappé, l\'action est morte. Rotations. Le défenseur en retard change à chaque fois.',
          'Le défenseur part plus près. Puis deux défenseurs sont en retard.'),
        b('Jeu', '20 min', '2/3 de terrain', '8 contre 7 + gardien', grands, 'Complet',
          'But dans les 6 secondes après l\'entrée dans le dernier tiers = 2.',
          'Le temps remplace le défenseur désigné : toute la défense peut revenir. L\'attaque choisit une-deux ou centre. But plus tardif = 1, il compte encore.',
          'Ramener à 4 secondes sur une période de 5 minutes.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match. Les entrées de surface sont le critère : est-ce que l\'on finit avant le replacement.',
          'Match réel. L\'éducateur note le temps perçu entre l\'entrée dans le dernier tiers et la frappe. Il n\'annonce pas un chrono aux joueurs. Débriefing sur une action finie à temps et une action où l\'on a attendu le soutien de trop.',
          'Demander aux milieux de proposer le une-deux dès la ligne des 30 m, pas seulement dans la surface.')
      ]),
      level('Convertir l\'entrée de surface', 'En match, une entrée de surface doit devenir une frappe cadrée ou un but.', {
        collectifs: 'Dès que le ballon entre dans la surface ou sur son seuil, deux solutions de frappe existent. Le troisième joueur est prêt pour le ballon repoussé.',
        individuels: 'Frapper cadré plutôt que fort. Reprendre le ballon s\'il reste dans la surface. Le gardien adverse est visé dans ses angles, pas au milieu sans raison.',
        criteres: 'Le rapport frappes cadrées / entrées de surface augmente. Les ballons qui ressortent sans frappe diminuent. Les buts viennent de ces entrées, pas de frappes lointaines isolées.'
      }, [
        b('Mise en train', '15 min', 'Surface de réparation', '6 contre 4 + gardien', grands, 'Demi',
          'Chaque entrée de surface se termine par une frappe.',
          'Le jeu est déjà dans la zone. 6 contre 4. Si le ballon sort de la surface sans frappe, il revient à l\'attaque sur le côté. Les défenseurs protègent le but. Cadence continue, 4 séries de 3 minutes. Les autres joueurs jouent le même jeu de l\'autre côté du terrain, vers un second but si l\'on en a un, sinon en alternance.',
          'Égalité 5 contre 5 dans la surface. Le thème doit tenir.'),
        b('Situation', '25 min', '1/2 terrain', '8 contre 6 + gardien', grands, 'Demi',
          'Transformer l\'approche en frappe cadrée. Le but = 3, la frappe cadrée = 1.',
          'L\'équipe en supériorité construit depuis la médiane et doit finir. La défense basse protège la surface. On compte les entrées et les cadrés à voix haute, pour que le groupe entende le rapport. Pas d\'arrêt pédagogique pendant l\'action.',
          'La défense peut monter à 7. Puis à 8.'),
        b('Jeu', '20 min', '2/3 de terrain', '9 contre 9', grands, 'Complet',
          'Match. Frappe cadrée = 1, but = 2. Le ballon qui ressort sans frappe ne rapporte rien.',
          'Les deux équipes finissent. La règle est la même. Hors-jeu. On veut des tentatives cadrées, pas un tir de partout : l\'éducateur retire le point si la frappe part de très loin sans pressing. Il le dit une fois, puis les joueurs le savent.',
          'Supprimer les points de frappe et ne garder que le but, les 5 dernières minutes.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match de synthèse. Grille : entrées de surface, frappes, cadrés, buts.',
          'Score du football seulement. La grille est tenue par l\'éducateur. Elle servira au bilan du cycle et, si cette séance est montrée, à l\'entretien BFM. Les joueurs connaissent la grille avant de jouer.',
          'Donner la grille à un joueur remplaçant. Il la commente au retour au calme.')
      ])
    ]
  },
  {
    id: 'perte',
    name: 'Réagir à la perte du ballon',
    phase: 'S\'opposer à la progression',
    principle: 'Réagir à la perte du ballon',
    means: 'Transition défensive, pressing immédiat ou repli selon la situation',
    eval: false,
    levels: [
      level('Les plus proches pressent', 'À la perte, les deux joueurs les plus proches du ballon pressent. Les autres assurent.', {
        collectifs: 'Pas tout le monde au ballon. Deux pressent, le reste coupe les passes proches. Le pressing dure quelques secondes, pas une course sans fin.',
        individuels: 'Course vers le porteur par l\'intérieur. Empêcher le contrôle orienté. Si l\'on n\'est pas des deux plus proches, ne pas quitter sa zone.',
        criteres: 'La perte est suivie d\'une pression immédiate. L\'équipe ne se regarde pas. Le ballon est souvent récupéré dans les environs, ou la progression adverse est gênée.'
      }, [
        b('Mise en train', '15 min', '20 × 15 m', '5 contre 5', ballons, 'Demi',
          'À la perte, toucher le ballon dans les 3 secondes.',
          'Petit terrain, beaucoup de pertes. L\'équipe qui perd a 3 secondes pour retoucher le ballon. Si elle y arrive, elle le garde. Sinon l\'autre équipe marque le point et sort. Règle facile à vivre. Tout le groupe joue, deux terrains.',
          'Ramener à 2 secondes. Puis désigner à l\'avance les deux joueurs qui devront presser.'),
        b('Situation', '25 min', '30 × 25 m', '5 contre 5', buts, 'Demi',
          'Récupérer dans les 4 secondes après la perte. Sinon l\'adversaire peut aller au but.',
          'Tant que les 4 secondes ne sont pas passées, l\'équipe qui a récupéré ne peut pas progresser : elle doit conserver sous le pressing. Après 4 secondes, elle peut attaquer les petits buts. Ainsi le pressing a un enjeu clair. Égalité. Rotations par deux.',
          'L\'équipe qui récupère peut progresser tout de suite. Le pressing doit alors être plus juste, pas seulement gêner.'),
        b('Jeu', '20 min', '40 × 30 m', '6 contre 6', buts, 'Demi',
          'Récupération dans les 5 secondes = 2 points. But = 1.',
          'Le bonus apprend à réagir, le but rappelle que l\'on joue au football. Les deux équipes sont au thème en même temps, puisque chacune perd le ballon à son tour. L\'éducateur compte les secondes à voix haute les premières minutes seulement.',
          'Ne plus compter à voix haute. Les joueurs doivent sentir le temps.'),
        b('Jeu', '25 min', '1/2 terrain', '8 contre 8', grands, 'Demi',
          'Match. Observation : qui presse à la perte, et est-ce bien les plus proches.',
          'Grand but, gardiens. Pas de points bonus. L\'éducateur note trois pertes : pressing juste, paquet au ballon, personne ne presse. On les décrit au calme avec les joueurs concernés.',
          'Annoncer que le but encaissé dans les 5 secondes après une perte compte double. Le rendre simple ensuite.')
      ]),
      level('Presser ou replier', 'Si l\'on ne récupère pas tout de suite, on se replace. On ne court pas derrière le ballon.', {
        collectifs: 'Décision collective rapide : les proches pressent, et si le porteur est déjà lancé vers le but, tout le monde replie. Une seule des deux réponses, pas les deux en même temps.',
        individuels: 'Le joueur qui a perdu le ballon harcèle le porteur s\'il est encore près. S\'il est déjà éliminé, il court vers son but. Parole courte : « presse » ou « repli ».',
        criteres: 'L\'équipe ne reste pas à moitié pressante et à moitié repliée. Après une perte lointaine, le bloc est reformé. Après une perte proche, le ballon est disputé tout de suite.'
      }, [
        b('Mise en train', '15 min', '40 × 20 m', '4 contre 4, deux zones', ballons, 'Demi',
          'Perte dans la zone avant : presser. Perte dans la zone arrière : replier derrière le plot.',
          'Le terrain est coupé en deux. La règle dépend de la zone de la perte, pour que le choix soit objectif. Les joueurs n\'ont pas à deviner. Deux groupes. On inverse les zones à mi-temps de l\'exercice.',
          'La limite de zone est retirée. Les joueurs annoncent eux-mêmes « presse » ou « repli ».'),
        b('Situation', '25 min', '1/2 terrain', '6 contre 6 + gardien', grands, 'Demi',
          '5 secondes pour récupérer. Passé ce délai, l\'équipe doit être derrière le ballon.',
          'L\'éducateur siffle à 5 secondes s\'il le faut au début. Après le sifflet, un joueur encore devant le ballon est hors-jeu défensif : il rentre et l\'attaque continue. La règle est dure, on l\'applique deux séries, puis on laisse les joueurs se gérer sans sifflet.',
          'Descendre à 4 secondes. Le repli doit être plus tôt.'),
        b('Jeu', '20 min', '2/3 de terrain', '8 contre 7 + gardien', grands, 'Complet',
          'L\'équipe en infériorité travaille la réaction à la perte. But encaissé après un repli manqué = 2.',
          'Huit contre sept pour créer des pertes en attaquant. Le but double punit le joueur qui reste à presser seul alors que le ballon est parti. On explique la règle une fois. Ensuite le score parle.',
          'Revenir à un but normal. Observer si le choix presse ou repli reste.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match. Sur chaque perte dans le camp adverse, l\'équipe choisit et le choix est visible.',
          'L\'éducateur ne siffle plus le temps. Il relève après coup deux bonnes décisions et une où la moitié de l\'équipe pressait encore. Les joueurs disent qui aurait dû parler.',
          'Le capitaine a seul le droit d\'annoncer « repli » pendant 10 minutes, pour installer la parole.')
      ]),
      level('Lire le porteur', 'S\'il est de dos, on presse. S\'il est face au jeu et lancé, on freine et on replie.', {
        collectifs: 'La lecture est partagée. Le joueur le plus proche agit selon l\'orientation du porteur. Les autres s\'alignent sur lui.',
        individuels: 'Voir l\'orientation des épaules avant de sprinter. Contre un porteur de dos, harceler le contrôle. Contre un porteur de face, ralentir sa course et l\'orienter dehors.',
        criteres: 'On ne presse pas un attaquant déjà lancé de face. On ne laisse pas se retourner un milieu qui a reçu dos au but. Les deux cas apparaissent et sont traités différemment.'
      }, [
        b('Mise en train', '15 min', '25 × 15 m', '1 contre 1, puis 2 contre 2', ballons, 'Demi',
          'Le défenseur agit selon que le porteur est servi dos au but ou déjà de face.',
          'Deux services alternés, annoncés par la couleur du ballon ou par le côté. Ballon dans les pieds, dos au but : presser. Ballon devant, porteur lancé : freiner et orienter. Files qui tournent. Puis 2 contre 2 avec la même lecture.',
          'Le serveur choisit sans annoncer. Le défenseur lit seul.'),
        b('Situation', '25 min', '40 × 30 m', '6 contre 5', buts, 'Demi',
          'Récupérer sur les réceptions dos au but. Ne pas se faire éliminer sur les ballons devant.',
          'Cinq défenseurs. Les six attaquants alternent, par la consigne de leur meneur, un jeu en remise dos au but et un jeu en profondeur. La défense ne connaît pas l\'alternance à l\'avance. Point si elle presse le dos. Point si elle freine le ballon dans la course. But adverse s\'il y a erreur de lecture.',
          'L\'attaque n\'alterne plus : elle choisit selon ce que la défense montre.'),
        b('Jeu', '20 min', '1/2 terrain', '8 contre 8', grands, 'Demi',
          'Match. Le thème est rappelé avant, puis observé sans règle de points.',
          'Assez d\'espace pour les deux situations : réception dos au but au milieu, ballon dans la course sur les ailes. Gardiens. L\'éducateur fige une seule action de chaque type pour la faire décrire par un défenseur.',
          'Demander au gardien de relancer fort devant la défense, pour créer le porteur de face.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match. Grille en deux colonnes : dos au but / face au jeu. Juste ou non.',
          'La grille est simple pour un entretien : est-ce que la réaction correspond à l\'orientation du porteur. Les joueurs la voient à la fin, pas pendant. Score réel.',
          'Annoncer les 10 dernières minutes comme un finish de match, pertes plus fréquentes, lecture à tenir malgré la fatigue.')
      ]),
      level('Où a-t-on perdu', 'La zone de la perte change la réponse. Haut : presser. Bas : densifier et protéger.', {
        collectifs: 'Perte au-dessus de la ligne des 30 m adverses : pressing collectif court. Perte dans son camp : bloc déjà bas, pas de course vers l\'avant. Entre les deux : freiner.',
        individuels: 'Connaître la zone où l\'on est au moment de la perte. Ne pas appliquer le même sprint partout. Le gardien alerte quand la perte est basse.',
        criteres: 'Le pressing haut n\'apparaît que dans le bon camp. Dans son camp, l\'équipe est déjà compacte après la perte. Il y a trois réponses, pas une seule.'
      }, [
        b('Mise en train', '15 min', '1/2 terrain', 'Deux équipes de 8', ballons, 'Demi',
          'Selon le plot de zone, presser, freiner ou protéger.',
          'Trois bandes : haute, moyenne, basse. L\'éducateur fait perdre le ballon dans une bande en jouant lui-même un duel, ou le ballon change de camp naturellement. La bande donne la réponse. On le fait assez longtemps pour que les noms des réponses soient connus.',
          'Retirer les plots. Les joueurs nomment la bande eux-mêmes.'),
        b('Situation', '25 min', '2/3 de terrain', '8 contre 8', grands, 'Complet',
          'La bonne réaction de zone vaut un point défensif. La mauvaise donne le but facile à l\'adversaire.',
          'Si l\'équipe presse haut alors que la perte est dans son camp, l\'adversaire part du milieu avec un joueur de plus pour cette action. La conséquence est immédiate et jouée, pas discutée. Inversement, une bonne réaction haut qui récupère le ballon vaut le point.',
          'Retirer la punition du joueur de plus. Garder seulement le point. La règle doit devenir un choix, pas une peur.'),
        b('Jeu', '20 min', 'Terrain foot à 11', '9 contre 9', grands, 'Complet',
          'Match. Trois zones encore tracées légèrement. Les points de réaction s\'ajoutent au but.',
          'Les lignes restent visibles mais on ne siffle plus chaque zone. Le score du match domine. Un observateur au repos annonce de temps en temps « bonne zone » pour renforcer.',
          'Effacer les lignes à la mi-temps.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match sans lignes. La zone est lue.',
          'Transfert. L\'éducateur compare avec la séance où les bandes étaient tracées : les joueurs retrouvent-ils les trois réponses. Bilan oral court, mené par deux défenseurs et un milieu.',
          'L\'équipe adverse a consigne de voler le ballon haut pendant 8 minutes, puis de défendre bas.')
      ]),
      level('La perte en match', 'Réagir à la perte dans le flux du match, sans règle artificielle.', {
        collectifs: 'La réaction est une habitude du bloc : proches au ballon, ligne qui serre, parole unique. Après la récupération, sortir vite, mais ce n\'est pas le thème du jour.',
        individuels: 'Le joueur qui perd le ballon ne lève pas les bras. Il agit. Les autres ne le regardent pas, ils regardent le porteur.',
        criteres: 'Les pertes dans le camp adverse ne deviennent pas des occasions franches. Le temps entre la perte et la première action défensive est court. L\'équipe reste ensemble.'
      }, [
        b('Mise en train', '15 min', '30 × 20 m', '6 contre 6', ballons, 'Demi',
          'Rondo ouvert. À la perte, récupérer ou empêcher la sortie.',
          'Terrain moyen, deux petits buts. Jeu libre avec la seule consigne rappelée : à la perte, les proches agissent. Séries de 3 minutes. Fort engagement, propre dans les duels. U14 : on rappelle le duel épaule, pas le tacle par derrière.',
          'Un point de bonus si la récupération immédiate est suivie d\'une passe vers l\'avant. On ouvre déjà la transition offensive, sans la développer.'),
        b('Situation', '25 min', '1/2 terrain', '8 contre 8 + gardiens', grands, 'Demi',
          'Ne pas encaisser dans les 8 secondes qui suivent une perte.',
          'Match réduit égal. La règle d\'observation, dite avant le jeu : l\'éducateur lève le bras si un but arrive trop vite après une perte. Ce but compte quand même. Le bras sert de retour, pas de sanction. On veut le transfert, pas un match truqué.',
          'Annoncer le nombre de bras levés à la mi-temps. Demander aux joueurs comment le faire baisser.'),
        b('Jeu', '20 min', '2/3 de terrain', '9 contre 9', grands, 'Complet',
          'Match. Même observation, plus d\'espace, donc des pertes plus punissables.',
          'L\'espace plus grand rend le repli nécessaire. Le pressing seul ne suffit plus. Les joueurs doivent retrouver le choix des séances précédentes. L\'éducateur n\'ajoute pas de règle.',
          'Faire entrer deux joueurs frais à la 10e minute : la réaction doit tenir malgré le changement.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match de synthèse du cycle. Score réel, observation des 8 secondes après chaque perte.',
          'Grille tenue jusqu\'au bout : perte, réaction, conséquence. Elle peut être montrée dans le livret BFM comme trace du cycle. Les joueurs ne jouent pas pour la grille, ils jouent le match. Le retour final tient en trois séquences.',
          'Laisser les joueurs remplir eux-mêmes une colonne de la grille au bord du terrain, à tour de rôle.')
      ])
    ]
  },
  {
    id: 'proteger',
    name: 'S\'organiser pour protéger son but',
    phase: 'S\'organiser pour protéger son but',
    principle: 'S\'organiser pour protéger son but',
    means: 'Densité dans l\'axe ballon-but, couverture, duels et commandement du gardien',
    eval: false,
    levels: [
      level('Densité devant le but', 'Être nombreux dans l\'axe, sans plonger.', {
        collectifs: 'Serrer l\'axe ballon-but. Laisser l\'extérieur si besoin. Personne ne sort de la zone pour suivre un appel loin du but.',
        individuels: 'Placement entre l\'attaquant et le but. Duel retardé, pas cherché trop tôt. Parler avec le gardien.',
        criteres: 'Les frappes viennent de l\'angle, pas du point de penalty libre. L\'axe est occupé. Il n\'y a pas de plongeon qui ouvre le milieu de la surface.'
      }, [
        b('Mise en train', '15 min', 'Surface de réparation', '3 contre 2 + gardien', grands, 'Demi',
          'Empêcher la frappe axiale. Orienter vers le côté.',
          'Petit espace, beaucoup de répétitions. Deux défenseurs + gardien, trois attaquants. La défense marque le point si la frappe est excentrée ou bloquée. L\'attaque marque normalement. Séries courtes. Les duels restent debout : à 14 ans, on protège le corps, on ne se jette pas.',
          'Les attaquants n\'ont que 6 secondes. Puis un troisième défenseur entre.'),
        b('Situation', '25 min', 'Surface élargie', '4 contre 3 + gardien', grands, 'Demi',
          'Aucune frappe cadré depuis l\'axe sans un défenseur sur la trajectoire.',
          'Zone élargie de 5 m autour de la surface. Quatre défenseurs dont le placement est le thème, plus le gardien qui commande. Trois attaquants plus les suivants en vague. Point défensif à chaque centre repoussé ou tir contré. On fige seulement si l\'axe est vide au moment de la frappe.',
          'Ajouter un quatrième attaquant. La densité doit coulisser, pas se figer.'),
        b('Jeu', '20 min', '40 × 30 m', '6 contre 4 + gardien', grands, 'Demi',
          'L\'infériorité défend le but. But évité par un placement dans l\'axe = la défense garde le ballon.',
          'Règle de conséquence : si la défense bloque dans l\'axe, elle ressort et peut aller vers deux petits buts. Elle a donc une raison de protéger proprement, pas seulement de dégager. Les attaquants restent à 6.',
          'La sortie vers les petits buts n\'est autorisée que si le bloc est sorti ensemble, pas sur un dégagement d\'un seul.'),
        b('Jeu', '25 min', '1/2 terrain', '8 contre 8', grands, 'Demi',
          'Match. Observation de l\'axe au moment des centres et des frappes.',
          'Égalité. L\'éducateur se place dans l\'axe, derrière le but, et note si un défenseur y est au moment de la frappe. Bilan chiffré à la pause. Pas de règle qui change le score.',
          'Demander au gardien de ne sortir que sur sa parole. Les défenseurs restent sur la ligne de ballon.')
      ]),
      level('Le gardien commande', 'La protection du but passe par la voix du gardien et le placement qu\'il dicte.', {
        collectifs: 'Le gardien est le premier relais d\'information. La ligne écoute : elle serre, elle sort, elle reste. Un seul chef dans la surface.',
        individuels: 'Le gardien parle tôt, fort, et simplement. Les défenseurs répondent par le geste. Personne ne coupe la parole par un dégagement au hasard.',
        criteres: 'On entend le gardien avant le centre. La ligne bouge après sa parole. Les deux défenseurs ne parlent pas des ordres contraires.'
      }, [
        b('Mise en train', '15 min', 'Surface de réparation', 'Gardiens + défenseurs, centres servis', ballons, 'Demi',
          'Le gardien annonce « je sors » ou « je reste ». La ligne obéit.',
          'Centres servis des deux côtés, sans opposition d\'abord. Le gardien annonce. Si il sort, la ligne dégage l\'espace. S\'il reste, un défenseur attaque le ballon. Puis un attaquant est ajouté. Les deux gardiens jouent 8 minutes chacun.',
          'L\'attaquant part en même temps que le centre. L\'annonce doit être plus tôt.'),
        b('Situation', '25 min', '1/2 terrain', '5 contre 4 + gardien', grands, 'Demi',
          'Protéger le but. Chaque action commence par une parole du gardien.',
          'Si le gardien n\'a pas parlé et que le but est encaissé, on rejoue l\'action une fois pour qu\'il parle, puis le but compte si l\'erreur se répète. On ne veut pas d\'un match où le but ne compte jamais. Quatre défenseurs + gardien contre cinq. Centres et jeux intérieurs mélangés.',
          'Interdire aux défenseurs de parler en même temps que le gardien pendant 10 minutes.'),
        b('Jeu', '20 min', '40 × 35 m', '7 contre 6 + gardien', grands, 'Demi',
          'L\'équipe en infériorité protège. Le gardien a le droit d\'arrêter le jeu une fois par série pour replacer.',
          'Un seul arrêt par série de 5 minutes, pas plus, sinon on retombe dans une méthode directive. Le reste du temps il commande en jouant. Les attaquants cherchent le centre et la passe intérieure.',
          'Retirer le droit d\'arrêter le jeu. La parole se fait dans le flux.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match. On enregistre, sans matériel, ce que l\'on entend du gardien sur les cinq premières situations de but.',
          'L\'éducateur note les mots réellement dits. Au calme, le gardien dit s\'il a été entendu. Les défenseurs confirment. C\'est un travail de communication, pas de geste technique du gardien.',
          'Changer de gardien à la mi-temps. La ligne doit s\'habituer à une autre voix.')
      ]),
      level('Retarder le centre', 'Empêcher le centre de partir, ou le prendre dans l\'axe s\'il part.', {
        collectifs: 'Le latéral retarde l\'ailier sans se faire éliminer. L\'axial ferme le premier poteau. Le gardien est placé pour le centre, pas pour une frappe lointaine imaginaire.',
        individuels: 'Le latéral reste sur ses pieds, entre l\'ailier et la ligne de fond. Il ne tacle que si le ballon est exposé. L\'axial attaque le ballon de la tête ou du pied, en sécurité.',
        criteres: 'Les centres clairs diminuent. Ceux qui partent ne trouvent pas le premier poteau libre. Le latéral n\'est pas éliminé dos à son but.'
      }, [
        b('Mise en train', '15 min', 'Couloir et surface', '1 contre 1 puis centre', ballons, 'Demi',
          'Retarder l\'ailier. S\'il centre, le premier poteau est occupé.',
          'Couloir de 10 m. L\'ailier cherche la ligne de fond. Le latéral retarde. Un axial part du plot central dès que le centre est possible. Deux couloirs, gauche et droite. Gardiens. Les joueurs tournent sur les trois rôles.',
          'L\'ailier a un soutien. Le latéral doit empêcher la passe en retrait qui ouvre le centre.'),
        b('Situation', '25 min', '1/2 terrain', '6 contre 5 + gardien', grands, 'Demi',
          'L\'attaque marque sur centre. La défense marque si le centre est empêché ou dégagé dans l\'axe.',
          'Cinq défenseurs + gardien, organisation en ligne avec deux latéraux. Six attaquants obligés de finir par un centre, sinon le but ne compte pas. La contrainte est du côté de l\'attaque pour que la défense ait beaucoup de centres à gérer. Séries de 6 minutes.',
          'L\'attaque peut aussi finir par une passe intérieure. La défense ne doit plus seulement regarder l\'aile.'),
        b('Jeu', '20 min', '2/3 de terrain', '8 contre 8', grands, 'Complet',
          'But sur centre = 1. Centre empêché suivi d\'une récupération = 1 pour la défense.',
          'Égalité. Les deux équipes protègent et attaquent. Le point défensif évite de seulement subir. Hors-jeu, pour que les latéraux aient une ligne.',
          'Le centre empêché ne rapporte plus de point. On voit si le retardement continue.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match. Grille des centres : empêché, pris au premier poteau, occasion adverse.',
          'Match libre. La grille classe chaque centre. Elle montre si le thème tient sur un vrai terrain, avec les deux ailes. Débriefing côté par côté.',
          'Demander à l\'équipe observée de défendre en 4, pour que les latéraux aient un axial proche.')
      ]),
      level('Bloc bas en infériorité', 'Protéger le but longtemps, à moins, sans se disperser.', {
        collectifs: 'Bloc entre le ballon et le but, distances courtes, axe prioritaire. On dégage ou on garde selon la qualité du ballon, pas selon la panique. Les remplacements se font par la parole.',
        individuels: 'Rester debout dans le duel. Dégager en touche si l\'on ne peut pas garder. Ne pas lancer un contre tout seul si le bloc n\'est pas sorti.',
        criteres: 'L\'équipe en infériorité encaisse peu. Elle ne se fait pas trouer dans l\'axe. Les dégagements sont choisis. Le bloc ne monte pas joueur par joueur.'
      }, [
        b('Mise en train', '15 min', '30 × 25 m', '4 contre 2 dans la zone, rotations', ballons, 'Demi',
          'Les 2 protègent un petit but. Ils restent à deux, serrés.',
          'Zone réduite. Les 2 marquent s\'ils tiennent 20 secondes ou s\'ils dégagent en touche latérale. Les 4 marquent dans le petit but. Séries très courtes, beaucoup de rôles. Le thème est l\'attitude du bloc, pas la victoire des 2.',
          'Les 2 peuvent ressortir vers une cible s\'ils récupèrent en contrôlant. Pas en dégagement.'),
        b('Situation', '25 min', '1/2 terrain', '8 contre 5 + gardien', grands, 'Demi',
          'Tenir 4 minutes en encaissant le moins possible, puis sortir ensemble.',
          'Cinq + gardien défendent le grand but. Huit attaquent. Toutes les 4 minutes on compte les buts et on change trois défenseurs. Consigne : rester compacts, dégager si le ballon est aérien disputé, garder si le contrôle est propre. L\'éducateur valorise le bloc qui sort ensemble après la récupération, une fois, pas à chaque fois.',
          'Passer à 8 contre 6. Puis donner 30 secondes de supériorité offensive après une récupération propre.'),
        b('Jeu', '20 min', '2/3 de terrain', '9 contre 7 + gardien', grands, 'Complet',
          'L\'équipe à 7 protège un résultat fictif de 1 à 0. Chaque but évité jusqu\'à la fin du temps est une réussite.',
          'Le score de départ donne le sens. L\'équipe à 9 doit marquer. L\'équipe à 7 n\'a pas à aller marquer : elle protège. C\'est assumé. À 14 ans, savoir protéger un résultat fait partie du championnat. On surveille que cela ne devienne pas un dégagement permanent sans bloc.',
          'Autoriser l\'équipe à 7 à marquer dans un petit but lointain, seulement après 6 passes. Elle a une sortie.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11, un joueur exclu fictif', grands, 'Complet',
          'Pendant 10 minutes, une équipe joue à 10. Elle protège le but. Puis on inverse.',
          'L\'exclusion est fictive et expliquée : on simule la fin de match à 10. Pas de carton, pas de théâtre. Le thème est l\'organisation. Après 10 minutes, égalité retrouvée, et on observe ce qui reste du bloc. Hors-jeu.',
          'L\'équipe à 10 choisit qui « manque » : un latéral ou un axial. Le bloc doit se réorganiser différemment.')
      ]),
      level('Protéger un résultat', 'En match, tenir un score sans casser l\'équipe, jusqu\'au bout de la séance.', {
        collectifs: 'Le bloc reste en lien avec les milieux. On ne se replie pas dans la surface dès la première minute. On protège en gardant le ballon quand c\'est possible, et en défendant la surface quand il le faut.',
        individuels: 'Joueurs lucides, duels propres, pas de fautes évitables près du but. Le gardien gère le temps sur les 6 m. Les milieux reviennent.',
        criteres: 'Le score tenu au départ n\'est pas renversé. L\'équipe garde une sortie balle au pied. Les occasions franches adverses restent rares. Le bloc ne se coupe pas en deux lignes distantes.'
      }, [
        b('Mise en train', '15 min', '40 × 30 m', '7 contre 5', buts, 'Demi',
          'Les 5 protègent et, s\'ils récupèrent, conservent 8 passes pour « tenir le temps ».',
          'Le score n\'est pas encore là. On apprend à protéger puis à garder le ballon, ce qui est la meilleure protection. Les 7 pressent. Les 5 marquent un point toutes les 8 passes après récupération, et perdent le point s\'ils encaissent. Deux terrains ou rotations.',
          'Les 8 passes doivent se faire dans leur moitié. Puis ils peuvent sortir.'),
        b('Situation', '25 min', '2/3 de terrain', '8 contre 8 + gardiens, score 1 à 0', grands, 'Complet',
          'L\'équipe menée au score fictif a 12 minutes pour égaliser. L\'autre protège.',
          'Le score est annoncé et tenu par l\'éducateur. À la fin des 12 minutes on inverse les rôles. Protéger ne veut pas dire ne plus jouer : l\'équipe qui mène a le droit de marquer le second, qui clôt l\'exercice. Observation du lien milieux-défenseurs.',
          'Le second but ne clôt plus. Il faut tenir tout le temps, même à 2 à 0, sans se relâcher.'),
        b('Jeu', '20 min', 'Terrain foot à 11', '11 contre 11, score annoncé 2 à 1', grands, 'Complet',
          'Tenir 2 à 1 pendant 15 minutes. L\'équipe menée joue pour égaliser.',
          'Proche du championnat. L\'éducateur ne donne pas de système nouveau : l\'équipe protège avec son organisation. Il intervient seulement si le bloc se coupe en deux. Les remplaçants entrent comme en fin de match, pour tenir.',
          'Passer le score à 1 à 1 à la 10e minute, sur un but joué. Il faut alors réattaquer, le cycle de protection s\'arrête proprement.'),
        b('Jeu', '25 min', 'Terrain foot à 11', '11 contre 11', grands, 'Complet',
          'Match de synthèse. Les 12 premières minutes à score de parité, les 12 suivantes avec un but d\'avance fictif pour l\'équipe observée.',
          'On compare les deux états dans la même séance : protéger parce que le score le demande, pas parce que la consigne a duré tout l\'hiver. Grille courte : axe occupé, gardien entendu, sorties au pied, occasions concédées. Trace utile pour le livret.',
          'Laisser les joueurs choisir à la 12e minute s\'ils « mènent » ou non, et assumer le plan.')
      ])
    ]
  }
];

const dates = trainingDates();

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

const plan = [
  [0, 10, 22, 38, 54],
  [1, 11, 23, 39, 55],
  [2, 12, 24, 40, 56],
  [3, 13, 25, 41, 57],
  [4, 14, 28, 44, 61],
  [5, 15, 29, 45, 62],
  [6, 16, 30, 46, 63],
  [7, 17, 31, 47, 64]
];
const used = new Set(plan.flat());
if (used.size !== 40) throw new Error('Le calendrier des thèmes se chevauche');

const placed = [];
themes.forEach((theme, themeIndex) => {
  const slots = plan[themeIndex];
  const gaps = slots.slice(1).map((slot, index) => daysBetween(dates[slots[index]], dates[slot]));
  if (gaps.some((gap, index) => index > 0 && gap <= gaps[index - 1])) {
    throw new Error(`Écart non croissant pour ${theme.name} : ${gaps.join(', ')}`);
  }
  theme.levels.forEach((item, levelIndex) => {
    const slot = slots[levelIndex];
    placed.push({ theme, item, levelIndex, slot, date: dates[slot] });
  });
});

const slots = placed.map(item => item.slot);
if (new Set(slots).size !== slots.length) throw new Error('Deux séances sur le même créneau');
placed.sort((a, b) => a.slot - b.slot);

const roles = [
  ['01-mise-en-train', 'Mise en train', 'Préparer le thème sans figer le jeu.'],
  ['02-situation', 'Situation', 'Installer le thème dans une opposition réglée.'],
  ['03-jeu', 'Jeu à thème', 'Retrouver le thème dans un jeu plus libre.'],
  ['04-match', 'Match à thème', 'Transférer le thème dans des conditions proches du match.']
];

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

fs.mkdirSync(root, { recursive: true });
writeJson(path.join(root, 'index.json'), { type: 'fc-tactics-category', name: 'U14 Garçons' });
fs.rmSync(path.join(root, 'seances'), { recursive: true, force: true });

placed.forEach((entry, index) => {
  const sheet = index + 1;
  const dirName = `S${String(sheet).padStart(2, '0')}`;
  const dir = path.join(root, 'seances', dirName);
  const date = formatDate.format(entry.date);
  writeJson(path.join(dir, 'index.json'), {
    type: 'fc-tactics-seance',
    name: `${entry.theme.name} — ${entry.levelIndex + 1}/5 — ${entry.item.step}`,
    sheet: `S${sheet}`,
    date,
    phase: entry.theme.phase,
    principle: entry.theme.principle,
    means: `${entry.theme.means}. Difficulté ${entry.levelIndex + 1}/5.`
  });
  entry.item.blocks.forEach((block, blockIndex) => {
    const [id, name, role] = roles[blockIndex];
    writeJson(path.join(dir, id, 'index.json'), {
      type: 'fc-tactics-exercise',
      id,
      name,
      ...PAGE,
      fieldTemplate: block.fieldTemplate,
      markdownContent: md({
        objectif: `${role} ${entry.item.focus}`,
        but: block.but,
        consignes: block.consignes,
        variables: block.variable,
        collectifs: entry.item.collectifs,
        individuels: entry.item.individuels,
        criteres: entry.item.criteres
      }),
      drill: {
        kind: block.kind,
        method: 'Active',
        duration: block.duration,
        area: block.area,
        headcount: block.headcount,
        equipment: block.equipment
      },
      session: { date, level: 'U14', objective: entry.item.focus }
    });
  });
});

const byTheme = new Map(themes.map(theme => [theme.name, []]));
placed.forEach((entry, index) => {
  byTheme.get(entry.theme.name).push({
    sheet: `S${index + 1}`,
    date: formatDate.format(entry.date),
    step: entry.item.step,
    slot: entry.slot
  });
});

const previous = path.resolve('data/categories/U15F');
if (fs.existsSync(previous)) fs.rmSync(previous, { recursive: true, force: true });

console.log(`dates d'entraînement: ${dates.length}`);
console.log(`séances écrites: ${placed.length}`);
for (const [name, rows] of byTheme) {
  const gapDays = rows.slice(1).map((row, i) => Math.round((new Date(placed.find(p => p.slot === row.slot).date) - new Date(placed.find(p => p.slot === rows[i].slot).date)) / 86400000));
  console.log(`\n${name}`);
  rows.forEach((row, i) => console.log(`  ${row.sheet}  ${row.date}  ${row.step}${i ? `  (+${gapDays[i - 1]} j)` : ''}`));
}

