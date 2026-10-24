# -*- coding: utf-8 -*-
"""Bibliothèque soccer et schémas d'exercices. Les cinq schémas déjà écrits sont conservés."""
import hashlib
import json
import math
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data'))
LIB = os.path.join(ROOT, 'studio', 'library', 'soccer')
REP = os.path.join(ROOT, 'repertoire')

KEEP = {
    'creer-et-utiliser-des-espaces/sessions/creer-la-largeur/jeu-a-theme',
    'creer-et-utiliser-des-espaces/sessions/creer-la-largeur/match-a-theme',
    'creer-et-utiliser-des-espaces/sessions/creer-la-largeur/mise-en-train',
    'creer-et-utiliser-des-espaces/sessions/creer-la-largeur/situation',
    'creer-et-utiliser-des-espaces/sessions/largeur-puis-profondeur/situation',
}

OBJECTS = {
    'disc': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.24 -0.1 0.48 0.2">
  <ellipse cx="0" cy="0" rx="0.2" ry="0.07" fill="#fb923c" stroke="#fff7ed" stroke-width="0.02"/>
</svg>
''',
    'pole': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.1 -0.06 0.2 1.72">
  <line x1="0" y1="0" x2="0" y2="1.55" stroke="#facc15" stroke-width="0.07" stroke-linecap="round"/>
  <circle cx="0" cy="0" r="0.06" fill="#facc15"/>
</svg>
''',
    'hurdle': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.42 -0.04 0.84 0.52">
  <line x1="-0.28" y1="0" x2="-0.28" y2="0.32" stroke="#ef4444" stroke-width="0.045" stroke-linecap="round"/>
  <line x1="0.28" y1="0" x2="0.28" y2="0.32" stroke="#ef4444" stroke-width="0.045" stroke-linecap="round"/>
  <rect x="-0.34" y="0.28" width="0.68" height="0.07" rx="0.02" fill="#fecaca" stroke="#ef4444" stroke-width="0.02"/>
</svg>
''',
    'ladder': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2.15 -0.32 4.3 0.64">
  <line x1="-2" y1="-0.22" x2="2" y2="-0.22" stroke="#f8fafc" stroke-width="0.05"/>
  <line x1="-2" y1="0.22" x2="2" y2="0.22" stroke="#f8fafc" stroke-width="0.05"/>
  <line x1="-2" y1="-0.22" x2="-2" y2="0.22" stroke="#f8fafc" stroke-width="0.05"/>
  <line x1="2" y1="-0.22" x2="2" y2="0.22" stroke="#f8fafc" stroke-width="0.05"/>
  <line x1="-1.5" y1="-0.22" x2="-1.5" y2="0.22" stroke="#f8fafc" stroke-width="0.035"/>
  <line x1="-1" y1="-0.22" x2="-1" y2="0.22" stroke="#f8fafc" stroke-width="0.035"/>
  <line x1="-0.5" y1="-0.22" x2="-0.5" y2="0.22" stroke="#f8fafc" stroke-width="0.035"/>
  <line x1="0" y1="-0.22" x2="0" y2="0.22" stroke="#f8fafc" stroke-width="0.035"/>
  <line x1="0.5" y1="-0.22" x2="0.5" y2="0.22" stroke="#f8fafc" stroke-width="0.035"/>
  <line x1="1" y1="-0.22" x2="1" y2="0.22" stroke="#f8fafc" stroke-width="0.035"/>
  <line x1="1.5" y1="-0.22" x2="1.5" y2="0.22" stroke="#f8fafc" stroke-width="0.035"/>
</svg>
''',
    'mannequin': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.28 -0.04 0.56 1.78">
  <circle cx="0" cy="1.48" r="0.16" fill="#fdba74" stroke="#9a3412" stroke-width="0.03"/>
  <rect x="-0.16" y="0.72" width="0.32" height="0.58" rx="0.06" fill="#f97316" stroke="#9a3412" stroke-width="0.03"/>
  <line x1="-0.08" y1="0" x2="-0.08" y2="0.74" stroke="#9a3412" stroke-width="0.06" stroke-linecap="round"/>
  <line x1="0.08" y1="0" x2="0.08" y2="0.74" stroke="#9a3412" stroke-width="0.06" stroke-linecap="round"/>
</svg>
''',
    'corner-flag': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.08 -0.04 0.7 1.4">
  <line x1="0" y1="0" x2="0" y2="1.25" stroke="#f8fafc" stroke-width="0.04" stroke-linecap="round"/>
  <polygon points="0,1.22 0.5,1.02 0,0.78" fill="#ef4444" stroke="#fecaca" stroke-width="0.02"/>
</svg>
''',
    'mini-goal-2': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.16 -0.08 2.32 1.05">
  <rect x="-1" y="0" width="2" height="0.8" fill="none" stroke="#ffffff" stroke-width="0.08"/>
</svg>
''',
    'mini-goal-3': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.66 -0.08 3.32 1.25">
  <rect x="-1.5" y="0" width="3" height="1" fill="none" stroke="#ffffff" stroke-width="0.08"/>
</svg>
''',
}

OBJECT_COPY = {
    'cone': ('Plot', 'Plot orange, environ un mètre de haut. On le pose par son centre.'),
    'disc': ('Coupelle', 'Coupelle plate. Elle marque un appui sans gêner la conduite.'),
    'pole': ('Piquet', 'Piquet d’environ 1,5 m. Le point d’ancrage est le pied.'),
    'hurdle': ('Haie basse', 'Haie basse, environ 30 cm, pour les appuis et la fréquence.'),
    'ladder': ('Échelle de rythme', 'Échelle de 4 m. Elle garde cette longueur quand on étire la zone.'),
    'mannequin': ('Mannequin', 'Mannequin défensif. Il ne grossit pas avec la zone.'),
    'corner-flag': ('Drapeau de coin', 'Drapeau de corner, mât d’environ 1,2 m.'),
    'mini-goal-2': ('Mini-but 2 m', 'Mini-but de 2 m de large.'),
    'mini-goal-3': ('Mini-but 3 m', 'Mini-but de 3 m de large.'),
    'goal': ('But', 'But réglementaire, 7,32 m de large.'),
}


def num(value):
    if isinstance(value, str):
        return value
    value = float(value)
    if abs(value - round(value)) < 1e-9:
        return str(int(round(value)))
    return f'{value:.3f}'.rstrip('0').rstrip('.')


def flow(pairs):
    parts = []
    for key, value in pairs:
        if isinstance(value, dict):
            inner = ', '.join(f'{k}: {num(v)}' for k, v in value.items())
            parts.append(f'{key}: {{ {inner} }}')
        else:
            parts.append(f'{key}: {num(value)}')
    return '{ ' + ', '.join(parts) + ' }'


SHAPES = []


def add_shape(name, title, blurb, players=None, items=None, outline=False):
    SHAPES.append({
        'name': name,
        'title': title,
        'blurb': blurb,
        'players': players or [],
        'items': items or [],
        'outline': outline,
    })


add_shape('back-four', 'Ligne de 4', 'Quatre défenseurs bas, dans le rectangle où on pose la forme.', [
    (2, 0.16, 0.22), (4, 0.38, 0.18), (5, 0.62, 0.18), (3, 0.84, 0.22),
])
add_shape('diamond', 'Losange', 'Milieu en losange : 6, relayeurs, et pointe.', [
    (6, 0.50, 0.34), (8, 0.28, 0.48), (10, 0.72, 0.48), (9, 0.50, 0.64),
])
add_shape('wing-pair', 'Paire d’ailiers', 'Deux ailiers hauts et larges.', [
    (7, 0.12, 0.74), (11, 0.88, 0.74),
])
add_shape('gk-line', 'Gardien et défense', 'Gardien blanc et ligne de quatre devant lui.', [
    (1, 0.50, 0.06, 'white'), (2, 0.16, 0.24), (4, 0.38, 0.18), (5, 0.62, 0.18), (3, 0.84, 0.24),
])
add_shape('four-v-two', '4 contre 2', 'Quatre bleus autour de deux rouges.', items=[
    ('player', 7, 'blue', 0.18, 0.72), ('player', 8, 'blue', 0.40, 0.56),
    ('player', 9, 'blue', 0.60, 0.72), ('player', 11, 'blue', 0.82, 0.56),
    ('player', 4, 'red', 0.38, 0.34), ('player', 5, 'red', 0.62, 0.34),
])
add_shape('five-v-three', '5 contre 3', 'Cinq bleus contre trois rouges.', items=[
    ('player', 7, 'blue', 0.16, 0.78), ('player', 8, 'blue', 0.38, 0.62),
    ('player', 9, 'blue', 0.62, 0.78), ('player', 10, 'blue', 0.84, 0.62),
    ('player', 11, 'blue', 0.50, 0.48),
    ('player', 2, 'red', 0.28, 0.28), ('player', 4, 'red', 0.50, 0.18), ('player', 5, 'red', 0.72, 0.28),
])
add_shape('rondo-4', 'Rondo à 4', 'Quatre joueurs sur le carré, assez rentrés pour laisser les plots aux coins.', [
    (7, 0.22, 0.22), (8, 0.78, 0.22), (10, 0.78, 0.78), (11, 0.22, 0.78),
])
add_shape('rondo-5', 'Rondo à 5', 'Cinq joueurs autour du carré.', [
    (6, 0.50, 0.14), (7, 0.86, 0.38), (8, 0.72, 0.84), (10, 0.28, 0.84), (11, 0.14, 0.38),
])
add_shape('plot-rect', 'Rectangle de plots', 'Quatre plots aux coins. Le contour suit le rectangle, les plots restent à taille réelle.', items=[
    ('object', 'cone', 0, 0), ('object', 'cone', 1, 0), ('object', 'cone', 1, 1), ('object', 'cone', 0, 1),
], outline=True)
add_shape('plot-triangle', 'Triangle de plots', 'Trois plots. Étirer le rectangle change les distances, pas la taille des plots.', items=[
    ('object', 'cone', 0, 0), ('object', 'cone', 1, 0), ('object', 'cone', 0.5, 1),
], outline=True)
add_shape('plot-diamond', 'Losange de plots', 'Quatre plots en losange.', items=[
    ('object', 'cone', 0.5, 0), ('object', 'cone', 1, 0.5), ('object', 'cone', 0.5, 1), ('object', 'cone', 0, 0.5),
], outline=True)
add_shape('gate', 'Porte', 'Deux plots qui ferment une porte. Le trait entre les deux ne change pas d’épaisseur.', items=[
    ('object', 'cone', 0.38, 1), ('object', 'cone', 0.62, 1),
], outline=True)
add_shape('pole-line', 'Ligne de piquets', 'Quatre piquets dans l’axe.', items=[
    ('object', 'pole', 0.5, 0.14), ('object', 'pole', 0.5, 0.38),
    ('object', 'pole', 0.5, 0.62), ('object', 'pole', 0.5, 0.86),
])
add_shape('channels-2', 'Deux couloirs', 'Une ligne de plots coupe le rectangle en deux couloirs.', items=[
    ('object', 'cone', 0.5, 0), ('object', 'cone', 0.5, 0.5), ('object', 'cone', 0.5, 1),
])
add_shape('channels-3', 'Trois couloirs', 'Deux lignes de plots, trois couloirs.', items=[
    ('object', 'cone', 0.33, 0), ('object', 'cone', 0.33, 0.5), ('object', 'cone', 0.33, 1),
    ('object', 'cone', 0.67, 0), ('object', 'cone', 0.67, 0.5), ('object', 'cone', 0.67, 1),
])
add_shape('slalom', 'Slalom', 'Piquets alternés. On étire le couloir sans allonger les piquets.', items=[
    ('object', 'pole', 0.35, 0.12), ('object', 'pole', 0.65, 0.30),
    ('object', 'pole', 0.35, 0.48), ('object', 'pole', 0.65, 0.66), ('object', 'pole', 0.35, 0.84),
])
add_shape('ladder-lane', 'Échelle dans une bande', 'L’échelle reste à 4 m au milieu de la bande.', items=[
    ('object', 'cone', 0, 0), ('object', 'cone', 1, 0), ('object', 'cone', 1, 1), ('object', 'cone', 0, 1),
    ('object', 'ladder', 0.5, 0.5),
])
add_shape('mini-goals', 'Paire de mini-buts', 'Deux mini-buts de 2 m, un à chaque bout.', items=[
    ('object', 'mini-goal-2', 0.5, 0.04), ('object', 'mini-goal-2', 0.5, 0.96),
])
add_shape('mini-goals-3', 'Paire de mini-buts 3 m', 'Deux mini-buts de 3 m.', items=[
    ('object', 'mini-goal-3', 0.5, 0.04), ('object', 'mini-goal-3', 0.5, 0.96),
])
add_shape('finish-target', 'Cible de finition', 'But, mannequin et deux plots d’appui. Le but garde ses 7,32 m.', items=[
    ('object', 'goal', 0.5, 1), ('object', 'mannequin', 0.5, 0.62),
    ('object', 'cone', 0.22, 0.28), ('object', 'cone', 0.78, 0.28),
])
add_shape('rondo-box', 'Carré de conservation', 'Plots aux coins, coupelles au milieu de chaque côté.', items=[
    ('object', 'cone', 0, 0), ('object', 'disc', 0.5, 0), ('object', 'cone', 1, 0), ('object', 'disc', 1, 0.5),
    ('object', 'cone', 1, 1), ('object', 'disc', 0.5, 1), ('object', 'cone', 0, 1), ('object', 'disc', 0, 0.5),
], outline=True)
add_shape('lane-gate', 'Couloir et porte', 'Deux couloirs, et une porte au bout. Les deux formes se combinent.', items=[
    ('shape', 'channels-2'), ('shape', 'gate'),
])
add_shape('hurdle-line', 'Ligne de haies', 'Quatre haies basses en travers.', items=[
    ('object', 'hurdle', 0.15, 0.5), ('object', 'hurdle', 0.38, 0.5),
    ('object', 'hurdle', 0.62, 0.5), ('object', 'hurdle', 0.85, 0.5),
])
add_shape('mannequin-wall', 'Mur de mannequins', 'Quatre mannequins pour fixer ou contourner.', items=[
    ('object', 'mannequin', 0.2, 0.55), ('object', 'mannequin', 0.4, 0.55),
    ('object', 'mannequin', 0.6, 0.55), ('object', 'mannequin', 0.8, 0.55),
])
add_shape('corner-flags', 'Drapeaux de coin', 'Un drapeau à chaque coin du rectangle.', items=[
    ('object', 'corner-flag', 0, 0), ('object', 'corner-flag', 1, 0),
    ('object', 'corner-flag', 1, 1), ('object', 'corner-flag', 0, 1),
])

# Les formes déjà présentes, pour le tutoriel.
EXISTING = [
    ('3-5-2', '3-5-2', 'Gardien, trois défenseurs, cinq milieux, deux attaquants.'),
    ('4-2-3-1', '4-2-3-1', 'Deux sentinelles et trois milieux offensifs derrière la pointe.'),
    ('4-3-3', '4-3-3', 'Ligne de quatre, milieu à trois, trois attaquants.'),
    ('4-4-2', '4-4-2', 'Deux lignes de quatre et deux attaquants.'),
    ('block-8', 'Bloc de 8', 'Huit joueurs groupés, sans gardien.'),
    ('low-block-8', 'Bloc bas', 'Huit joueurs dont le gardien, serrés devant leur but.'),
]

SHAPE_NUMBERS = {}
for spec in SHAPES:
    numbers = [player[0] for player in spec['players']]
    for item in spec['items']:
        if item[0] == 'player':
            numbers.append(item[1])
    SHAPE_NUMBERS[spec['name']] = numbers

for name, _title, _blurb in EXISTING:
    if name == 'low-block-8':
        SHAPE_NUMBERS[name] = [1, 2, 3, 4, 5, 6, 7, 8]
    elif name == 'block-8':
        SHAPE_NUMBERS[name] = [2, 3, 6, 8, 7, 11, 10, 9]
    elif name == '4-4-2':
        SHAPE_NUMBERS[name] = [1, 2, 5, 6, 3, 7, 4, 8, 11, 9, 10]
    elif name == '4-3-3':
        SHAPE_NUMBERS[name] = [1, 2, 5, 6, 3, 4, 8, 10, 7, 9, 11]
    elif name == '4-2-3-1':
        SHAPE_NUMBERS[name] = [1, 2, 5, 6, 3, 4, 8, 7, 10, 11, 9]
    elif name == '3-5-2':
        SHAPE_NUMBERS[name] = [1, 4, 5, 3, 2, 6, 8, 10, 7, 11, 9]


def item_flow(item):
    kind = item[0]
    if kind == 'player':
        _kind, number, team, x, y = item
        return [('player', number), ('team', team), ('x', x), ('y', y)]
    if kind == 'object':
        _kind, name, x, y = item
        return [('object', name), ('x', x), ('y', y)]
    if kind == 'shape':
        return [('shape', item[1])]
    raise ValueError(item)


def write_shapes():
    folder = os.path.join(LIB, 'shapes')
    os.makedirs(folder, exist_ok=True)
    for spec in SHAPES:
        # Réécrit les items avec le bon flux (équipe, objet, forme).
        lines = ['type: fccn-schema:0', f'name: {spec["name"]}', 'units: relative']
        if spec['outline']:
            lines.append('outline: true')
        if spec['players']:
            lines.append('players:')
            for player in spec['players']:
                pairs = [('number', player[0])]
                if len(player) > 3 and player[3]:
                    pairs.append(('team', player[3]))
                pairs.extend([('x', player[1]), ('y', player[2])])
                lines.append('  - ' + flow(pairs))
        if spec['items']:
            lines.append('items:')
            for item in spec['items']:
                lines.append('  - ' + flow(item_flow(item)))
        text = '\n'.join(lines) + '\n'
        spec['yaml'] = text
        with open(os.path.join(folder, spec['name'] + '.yaml'), 'w', encoding='utf-8', newline='\n') as handle:
            handle.write(text)


def write_objects():
    folder = os.path.join(LIB, 'objects')
    os.makedirs(folder, exist_ok=True)
    for name, svg in OBJECTS.items():
        with open(os.path.join(folder, name + '.svg'), 'w', encoding='utf-8', newline='\n') as handle:
            handle.write(svg)


def segment(x1, y1, x2, y2):
    return f'  - {{ x1: {num(x1)}, y1: {num(y1)}, x2: {num(x2)}, y2: {num(y2)} }}'


def border(width, length):
    return [
        segment(0, 0, width, 0),
        segment(width, 0, width, length),
        segment(width, length, 0, length),
        segment(0, length, 0, 0),
    ]


def box_lines(width, length, depth, box_width):
    x0 = (width - box_width) / 2
    y0 = length - depth
    return [
        segment(x0, length, x0, y0),
        segment(x0, y0, x0 + box_width, y0),
        segment(x0 + box_width, y0, x0 + box_width, length),
    ]


def pitch_yaml(name, width, length, lines, margin):
    body = [
        'type: fccn-schema:0',
        f'name: {name}',
        'units: meters',
        'pitch:',
        f'  width: {num(width)}',
        f'  length: {num(length)}',
        f'  margin: {num(margin)}',
        'lines:',
        *lines,
        '',
    ]
    return '\n'.join(body)


PITCHES = []


def add_pitch(name, title, width, length, lines, margin, blurb):
    PITCHES.append({
        'name': name, 'title': title, 'width': width, 'length': length,
        'blurb': blurb, 'yaml': pitch_yaml(name, width, length, lines, margin),
    })


def rect_pitch(length, width):
    margin = 2 if max(length, width) >= 50 else 1.5
    lines = border(width, length)
    lines.append(segment(0, length / 2, width, length / 2))
    if min(length, width) >= 30:
        lines.append(segment(width / 2, 0, width / 2, length))
    add_pitch(
        f'rect-{num(length)}x{num(width)}',
        f'{num(length)} × {num(width)} m',
        width, length, lines, margin,
        f'Rectangle de {num(length)} m sur {num(width)} m, avec une médiane.',
    )


add_pitch(
    'two-thirds', 'Deux tiers', 68, 70,
    border(68, 70) + box_lines(68, 70, 16.5, 40.32) + box_lines(68, 70, 5.5, 18.32),
    2, 'Deux tiers de terrain, avec la surface et la surface de but.',
)
add_pitch(
    'penalty', 'Surface', 50, 36,
    border(50, 36) + box_lines(50, 36, 16.5, 40.32) + box_lines(50, 36, 5.5, 18.32),
    2, 'Autour de la surface : le rectangle fait 50 × 36 m et porte les deux surfaces.',
)
add_pitch(
    'penalty-wide', 'Surface élargie', 60, 40,
    border(60, 40) + box_lines(60, 40, 20, 48) + box_lines(60, 40, 8, 22),
    2, 'Surface élargie, 60 × 40 m, avec une zone de but plus large.',
)
for length, width in [
    (20, 15), (20, 20), (25, 15), (25, 20), (25, 25),
    (30, 20), (30, 25), (30, 30), (35, 25), (35, 30),
    (40, 20), (40, 25), (40, 30), (40, 35), (45, 30), (45, 35),
    (50, 40), (60, 40), (70, 50),
]:
    rect_pitch(length, width)

PITCH_SIZE = {pitch['name']: (pitch['width'], pitch['length']) for pitch in PITCHES}
PITCH_SIZE['half'] = (68, 52.5)
PITCH_SIZE['full'] = (68, 105)


def write_pitches():
    folder = os.path.join(LIB, 'pitches')
    os.makedirs(folder, exist_ok=True)
    for pitch in PITCHES:
        with open(os.path.join(folder, pitch['name'] + '.yaml'), 'w', encoding='utf-8', newline='\n') as handle:
            handle.write(pitch['yaml'])


def parse_md(text):
    title = ''
    fields = {}
    body = []
    started = False
    for line in text.splitlines():
        if line.startswith('# ') and not title:
            title = line[2:].strip()
            continue
        if line.startswith('## '):
            started = True
        if started:
            body.append(line)
            continue
        match = re.match(r'^[-*]\s+([^:]+):\s*(.*)$', line)
        if match:
            fields[match.group(1).strip().lower()] = match.group(2).strip()
    return title, fields, '\n'.join(body)


def kind_of(procede):
    value = procede.lower()
    if 'mise' in value:
        return 'warmup'
    if 'situation' in value:
        return 'situation'
    if 'match' in value or 'jeu' in value:
        return 'match'
    return 'warmup'


def counts_of(effectif, kind):
    text = effectif.lower()
    versus = re.search(r'(\d+)\s*contre\s*(\d+)', text)
    groups = re.search(r'(\d+)\s*groupes?\s*de\s*(\d+)', text)
    gk = 'gardien' in text
    joker = 'joker' in text
    if versus:
        return int(versus.group(1)), int(versus.group(2)), gk, joker
    if groups:
        return int(groups.group(1)) * int(groups.group(2)), 0, gk, joker
    found = re.search(r'(\d+)', text)
    if found:
        total = int(found.group(1))
        if kind == 'situation':
            red = max(1, total // 3)
            return total - red, red, gk, joker
        if kind == 'match':
            half = max(1, total // 2)
            return total - half, half, gk, joker
        return total, 0, gk, joker
    if kind == 'match':
        return 8, 8, gk, joker
    if kind == 'situation':
        return 5, 3, gk, joker
    return 6, 0, gk, joker


def pitch_of(area):
    raw = area.lower()
    if '1/2' in raw or 'demi' in raw:
        return 'half'
    if '2/3' in raw:
        return 'two-thirds'
    if 'élarg' in raw or 'elarg' in raw:
        return 'penalty-wide'
    if 'surface' in raw or 'entrée' in raw or 'entree' in raw:
        return 'penalty'
    if '11' in raw or 'foot' in raw or 'complet' in raw:
        return 'full'
    match = re.search(r'(\d+)\s*[×x]\s*(\d+)', raw)
    if match:
        return f'rect-{int(match.group(1))}x{int(match.group(2))}'
    if 'carr' in raw:
        return 'rect-25x25'
    return 'half'


def family_of(text, kind):
    if re.search(r'couloir|largeur', text):
        return 'channels'
    if re.search(r'rondo|conservation', text):
        return 'rondo'
    if re.search(r'slalom|piquet', text):
        return 'slalom'
    if re.search(r'échelle|echelle', text):
        return 'ladder'
    if re.search(r'haie', text):
        return 'hurdles'
    if re.search(r'mannequin', text):
        return 'mannequins'
    if re.search(r'mini[- ]?but|petit but', text):
        return 'small-goals'
    if re.search(r'finition|centrer|centre', text):
        return 'finish'
    if re.search(r'pressing|bloc bas|repli', text):
        return 'press'
    if re.search(r'plot|coupelle|cône|cone', text):
        return 'plots'
    if kind == 'match':
        return 'match'
    if kind == 'situation':
        return 'situation'
    return 'warmup'


def material_shape(text):
    if re.search(r'échelle|echelle', text):
        return 'ladder-lane'
    if re.search(r'piquet', text):
        return 'pole-line'
    if re.search(r'haie', text):
        return 'hurdle-line'
    if re.search(r'mannequin', text):
        return 'mannequin-wall'
    if re.search(r'mini[- ]?but|petit but', text):
        return 'mini-goals-3' if re.search(r'3\s*m', text) else 'mini-goals'
    if re.search(r'drapeau', text):
        return 'corner-flags'
    if re.search(r'plot|coupelle|cône|cone', text):
        return 'plot-rect'
    return None


def hash_of(key):
    return int(hashlib.md5(key.encode('utf-8')).hexdigest()[:8], 16)


def grid(count, x0, y0, x1, y1):
    if count <= 0 or x1 <= x0 or y1 <= y0:
        return []
    cols = max(1, min(count, round(math.sqrt(count * (x1 - x0) / (y1 - y0)))))
    rows = math.ceil(count / cols)
    points = []
    for index in range(count):
        column = index % cols
        row = index // cols
        points.append((
            x0 + (column + 0.5) * (x1 - x0) / cols,
            y0 + (row + 0.5) * (y1 - y0) / rows,
        ))
    return points


def clamp(value, low, high):
    return max(low, min(high, value))


FORMATIONS = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2']
FREE = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]


def attack_pieces(count, choice):
    if count == 11:
        return [FORMATIONS[choice % len(FORMATIONS)]], 0
    if count == 5 and choice % 2 == 0:
        return ['gk-line'], 0
    shapes = []
    left = count
    if left >= 4:
        shapes.append('back-four')
        left -= 4
    if left >= 4:
        shapes.append('diamond')
        left -= 4
    if left >= 2:
        shapes.append('wing-pair')
        left -= 2
    return shapes, left


def defense_pieces(count, family):
    if count >= 8 and family in ('match', 'press', 'situation'):
        return ['low-block-8'], count - 8
    if count >= 4:
        return ['back-four'], count - 4
    return [], count


class Sheet:
    def __init__(self, title, pitch):
        self.title = title
        self.pitch = pitch
        self.zones = []
        self.items = []
        self.phases = []
        self.numbers = {'blue': set(), 'red': set(), 'white': set(), 'yellow': set()}
        self.shapes = []

    def add_zone(self, name, rect, shapes):
        self.zones.append((name, rect, shapes))
        for shape, _team in shapes:
            self.shapes.append(shape)
            for number in SHAPE_NUMBERS.get(shape, []):
                team = _team or 'blue'
                if shape == 'gk-line' and number == 1:
                    team = 'white'
                if shape == 'low-block-8' and number == 1:
                    team = 'white'
                if shape in FORMATIONS and number == 1:
                    team = 'white'
                if shape in ('four-v-two', 'five-v-three'):
                    team = 'red' if number in (2, 4, 5) else 'blue'
                self.numbers[team].add(number)

    def add_player(self, team, number, x, y, width, length):
        if number in self.numbers[team]:
            return
        pad = 1.3
        x = clamp(x, pad, width - pad)
        y = clamp(y, pad, length - pad)
        self.items.append(('player', team, number, x, y))
        self.numbers[team].add(number)

    def render(self):
        lines = ['type: fccn-schema:0', f'name: {json.dumps(self.title, ensure_ascii=False)}', 'pitch:', f'  template: {self.pitch}']
        if self.zones:
            lines.append('zones:')
            for name, rect, shapes in self.zones:
                rect_text = ', '.join(f'{key}: {num(value)}' for key, value in rect.items())
                shape_text = ', '.join(
                    f'{{ shape: {shape}, team: {team} }}' if team else f'{{ shape: {shape} }}'
                    for shape, team in shapes
                )
                lines.append(f'  - {{ name: {name}, rect: {{ {rect_text} }}, items: [{shape_text}] }}')
        if self.items:
            lines.append('items:')
            for kind, *rest in self.items:
                if kind == 'player':
                    team, number, x, y = rest
                    lines.append(f'  - {{ player: {num(number)}, team: {team}, pos: {{ x: {num(x)}, y: {num(y)} }} }}')
                elif kind == 'ball':
                    lines.append(f'  - {{ ball: {num(rest[0])} }}')
        if self.phases:
            lines.append('phases:')
            for name, duration, moves in self.phases:
                lines.append(f'  - name: {name}')
                lines.append(f'    duration: {duration}')
                lines.append('    moves:')
                for move in moves:
                    lines.append(f'      - {move}')
        return '\n'.join(lines) + '\n'


def fresh_numbers(used, count):
    pool = [n for n in range(2, 40) if n not in used]
    return pool[:count]


def place_many(sheet, team, count, box, width, length, used):
    numbers = fresh_numbers(used | sheet.numbers[team], count)
    for number, (x, y) in zip(numbers, grid(count, *box)):
        sheet.add_player(team, number, x, y, width, length)
    return numbers


def phase_moves(style, ball, mate, dest, second, width, length):
    dx, dy = dest
    dx = clamp(dx, 1.5, width - 1.5)
    dy = clamp(dy, 1.5, length - 1.5)
    sx, sy = second
    sx = clamp(sx, 1.5, width - 1.5)
    sy = clamp(sy, 1.5, length - 1.5)
    if style == 'dribble' or mate is None:
        return (
            [f'{{ player: {ball}, dribble: {{ x: {num(dx)}, y: {num(dy)} }} }}'],
            [f'{{ player: {ball}, run: {{ x: {num(sx)}, y: {num(sy)} }} }}'],
        )
    return (
        [
            f'{{ from: {ball}, pass: {mate} }}',
            f'{{ player: {mate}, run: {{ x: {num(dx)}, y: {num(dy)} }} }}',
        ],
        [f'{{ from: {mate}, pass: {ball} }}', f'{{ player: {ball}, run: {{ x: {num(sx)}, y: {num(sy)} }} }}'],
    )


def build_sheet(title, fields, body, key):
    kind = kind_of(fields.get('procédé', fields.get('procede', '')))
    blob = '\n'.join([
        fields.get('aire', ''), fields.get('effectif', ''), fields.get('matériels', ''),
        fields.get('materiels', ''), body,
    ]).lower()
    pitch = pitch_of(fields.get('aire', ''))
    if pitch not in PITCH_SIZE:
        pitch = 'half'
    width, length = PITCH_SIZE[pitch]
    blue_n, red_n, gk, joker = counts_of(fields.get('effectif', ''), kind)
    family = family_of(blob, kind)
    choice = hash_of(key)
    sheet = Sheet(title or os.path.basename(os.path.dirname(key)), pitch)
    lined = pitch in ('half', 'full', 'two-thirds', 'penalty', 'penalty-wide')
    style = 'dribble' if re.search(r'conduite|dribbl|slalom', blob) or family in ('slalom', 'ladder', 'hurdles') else 'pass'
    pad = 2 if min(width, length) >= 20 else 1.4

    def meter_rect(x, y, w, h, padding=0.8, margin=0):
        rect = {'x': x, 'y': y, 'w': w, 'h': h}
        if margin:
            rect['margin'] = margin
        if padding:
            rect['padding'] = padding
        return rect

    def full_rect(padding=1, margin=0):
        return meter_rect(pad, pad, width - 2 * pad, length - 2 * pad, padding, margin)

    used_shapes = []

    def zone(name, rect, shapes):
        sheet.add_zone(name, rect, shapes)
        used_shapes.extend(shape for shape, _team in shapes)

    if family == 'channels':
        lanes = 3 if re.search(r'trois|3\s*couloir|largeur', blob) or width >= 30 else 2
        shape = 'lane-gate' if lanes == 2 and re.search(r'porte', blob) else ('channels-3' if lanes == 3 else 'channels-2')
        zone('couloirs', full_rect(1, 0.6), [(shape, None)])
        lane_w = (width - 2 * pad) / lanes
        for lane in range(lanes):
            x0 = pad + lane * lane_w + 1.2
            x1 = pad + (lane + 1) * lane_w - 1.2
            share = math.ceil(blue_n / lanes)
            start = lane * share
            count = max(0, min(share, blue_n - start))
            place_many(sheet, 'blue', count, (x0, pad + 1, x1, length * 0.7), width, length, set())
        if red_n:
            place_many(sheet, 'red', red_n, (pad + 2, length * 0.62, width - pad - 2, length - pad - 2), width, length, set())
    elif family == 'rondo':
        side = min(width - 2 * pad, length - 2 * pad) * 0.72
        side = max(8, side)
        x = (width - side) / 2
        y = (length - side) / 2
        shapes = [('rondo-box', None)]
        if blue_n == 4:
            shapes.append(('rondo-4', 'blue'))
        elif blue_n == 5:
            shapes.append(('rondo-5', 'blue'))
        zone('carre', meter_rect(x, y, side, side, 0.5, 0.8), shapes)
        if blue_n not in (4, 5):
            place_many(sheet, 'blue', blue_n, (x + 1.6, y + 1.6, x + side - 1.6, y + side - 1.6), width, length, set())
        if red_n:
            place_many(sheet, 'red', red_n, (x + side * 0.35, y + side * 0.35, x + side * 0.65, y + side * 0.65), width, length, set())
    elif family == 'slalom':
        lane = min(12, width - 2 * pad)
        x = (width - lane) / 2
        zone('slalom', meter_rect(x, pad + 3, lane, max(6, length - 2 * pad - 3), 0.4), [('slalom', None)])
        place_many(sheet, 'blue', blue_n, (pad, pad, width - pad, pad + 2.6), width, length, set())
    elif family == 'ladder':
        lane = min(8, width - 2 * pad)
        x = (width - lane) / 2
        zone('echelle', meter_rect(x, pad + 2, lane, max(6, length - 2 * pad - 2), 0.4), [('ladder-lane', None)])
        place_many(sheet, 'blue', blue_n, (x + lane + 1, pad + 2, width - pad, length - pad), width, length, set())
    elif family == 'hurdles':
        zone('haies', meter_rect(pad, length * 0.4, width - 2 * pad, max(5, length * 0.2), 0.4), [('hurdle-line', None)])
        place_many(sheet, 'blue', blue_n, (pad, pad, width - pad, length * 0.32), width, length, set())
    elif family == 'mannequins':
        zone('murs', meter_rect(pad, length * 0.55, width - 2 * pad, max(5, length * 0.22), 0.4), [('mannequin-wall', None)])
        place_many(sheet, 'blue', blue_n, (pad, pad, width - pad, length * 0.42), width, length, set())
        if red_n:
            place_many(sheet, 'red', red_n, (pad, length * 0.78, width - pad, length - pad), width, length, set())
    elif family == 'small-goals':
        shape = 'mini-goals-3' if re.search(r'3\s*m', blob) else 'mini-goals'
        zone('buts', full_rect(1.2), [(shape, None)])
        place_many(sheet, 'blue', blue_n, (pad + 2, length * 0.28, width - pad - 2, length * 0.48), width, length, set())
        if red_n:
            place_many(sheet, 'red', red_n, (pad + 2, length * 0.55, width - pad - 2, length * 0.75), width, length, set())
    elif family == 'finish':
        shape = 'gate' if lined else 'finish-target'
        zone('cible', meter_rect(pad, length * 0.58, width - 2 * pad, max(6, length * 0.36), 0.6), [(shape, None)])
        place_many(sheet, 'blue', max(0, blue_n - 1), (pad, pad, width * 0.7, length * 0.48), width, length, set())
        if blue_n and 11 not in sheet.numbers['blue']:
            sheet.add_player('blue', 11, width * 0.84, length * 0.62, width, length)
        if red_n:
            place_many(sheet, 'red', red_n, (width * 0.3, length * 0.5, width * 0.7, length * 0.7), width, length, set())
    elif family == 'plots' or family == 'warmup':
        variant = ['plot-rect', 'plot-triangle', 'plot-diamond'][choice % 3]
        side = min(width - 2 * pad, length - 2 * pad) * (0.55 if family == 'plots' else 0.7)
        x = (width - side) / 2
        y = (length - side) / 2
        zone('atelier', meter_rect(x, y, side, side, 0.6, 1), [(variant, None)])
        place_many(sheet, 'blue', blue_n, (x + side * 0.22, y + side * 0.22, x + side * 0.78, y + side * 0.78), width, length, set())
        if red_n:
            place_many(sheet, 'red', red_n, (pad, pad, width - pad, y - 1 if y > pad + 3 else y + side + 1), width, length, set())
    elif blue_n == 4 and red_n == 2:
        zone('superiorite', full_rect(1, 0.5), [('four-v-two', 'blue')])
        if not lined:
            zone('buts', full_rect(0.4), [('mini-goals', None)])
    elif blue_n == 5 and red_n == 3:
        zone('superiorite', full_rect(1, 0.5), [('five-v-three', 'blue')])
        if not lined:
            zone('buts', full_rect(0.4), [('mini-goals', None)])
    else:
        shapes, extra = attack_pieces(blue_n, choice)
        band = 0.48 if family == 'press' else 0.56
        zone('attaque', {
            'x': 0.04, 'y': 0.04, 'w': 0.92, 'h': round(band - 0.08, 2), 'unit': 'relative', 'padding': 0.02,
        }, [(shape, 'blue') for shape in shapes])
        if extra:
            place_many(
                sheet, 'blue', extra,
                (width * 0.28, length * (band - 0.16), width * 0.72, length * (band - 0.06)),
                width, length, set().union(*(SHAPE_NUMBERS.get(shape, []) for shape in shapes)),
            )
        d_shapes, d_extra = defense_pieces(red_n, family)
        if d_shapes:
            zone('defense', {
                'x': 0.06, 'y': band, 'w': 0.88, 'h': round(0.96 - band, 2), 'unit': 'relative', 'padding': 0.015,
            }, [(shape, 'red') for shape in d_shapes])
        if d_extra:
            place_many(sheet, 'red', d_extra, (pad + 2, length * (band + 0.02), width - pad - 2, length * (band + 0.14)), width, length, set(SHAPE_NUMBERS.get('low-block-8', [])) | set(SHAPE_NUMBERS.get('back-four', [])))
        elif red_n and not d_shapes:
            place_many(sheet, 'red', red_n, (pad, length * 0.62, width - pad, length - pad), width, length, set())
        if not lined and family == 'match':
            zone('buts', full_rect(0.5), [('mini-goals', None)])

    extra_shape = material_shape(blob)
    if extra_shape and extra_shape not in sheet.shapes and family not in ('channels', 'rondo', 'slalom', 'ladder', 'hurdles', 'mannequins', 'small-goals', 'plots', 'finish'):
        strip = min(10, width * 0.28)
        zone('materiel', meter_rect(width - pad - strip, pad, strip, max(6, length * 0.35), 0.4), [(extra_shape, None)])

    if gk and 1 not in sheet.numbers['white']:
        sheet.add_player('white', 1, width / 2, length - pad, width, length)
    if joker:
        number = 14 if 14 not in sheet.numbers['blue'] else 24
        sheet.add_player('yellow', number, width / 2, length * 0.5, width, length)

    blues = sorted(sheet.numbers['blue'])
    ball = next((n for n in (10, 9, 8, 7, 11, 6, 4, 2) if n in blues), blues[0] if blues else None)
    if ball is not None:
        sheet.items.append(('ball', ball))
        mate = next((n for n in (11, 7, 9, 8, 6, 10) if n in blues and n != ball), None)
        if mate is None:
            mate = next((n for n in blues if n != ball), None)
        names = {
            'channels': ('Passe', 'Changement'),
            'rondo': ('Conservation', 'Soutien'),
            'finish': ('Centre', 'Appel'),
            'press': ('Pressing', 'Relance'),
            'slalom': ('Conduite', 'Retour'),
            'ladder': ('Appuis', 'Retour'),
            'hurdles': ('Fréquence', 'Retour'),
            'match': ('Construction', 'Bascule'),
        }.get(family, ('Passe', 'Appel'))
        first, second = phase_moves(
            style, ball, mate,
            (width * 0.72, length * 0.7),
            (width * 0.32, length * 0.4),
            width, length,
        )
        sheet.phases.append((names[0], 4, first))
        sheet.phases.append((names[1], 5, second))
    return sheet.render(), family, pitch


def write_schemas():
    written = 0
    kept = 0
    families = {}
    for folder, _dirs, files in os.walk(REP):
        if 'content.md' not in files:
            continue
        rel = os.path.relpath(folder, REP).replace('\\', '/')
        if rel in KEEP:
            kept += 1
            continue
        text = open(os.path.join(folder, 'content.md'), encoding='utf-8').read()
        title, fields, body = parse_md(text)
        yaml, family, _pitch = build_sheet(title, fields, body, rel)
        with open(os.path.join(folder, 'schema.yaml'), 'w', encoding='utf-8', newline='\n') as handle:
            handle.write(yaml)
        written += 1
        families[family] = families.get(family, 0) + 1
    print('schemas', written, 'kept', kept)
    print('families', families)


def write_tutorial():
    lines = [
        '# Schémas soccer',
        '',
        'Un exercice se monte avec un terrain, une ou deux formes, et un rectangle. Les objets sont en mètres réels : étirer le rectangle écarte les distances, il n’agrandit pas les SVG.',
        '',
        'Le rectangle s’écrit sur une ligne. `x`, `y`, `w` et `h` décrivent la boîte extérieure. `margin` est hors du trait, `padding` est dedans. Le plus local l’emporte pour `unit` : celui de `rect`, puis celui de la zone, puis `units` du document. Sans précision, c’est le mètre.',
        '',
        '## Objets',
        '',
    ]
    for name, (title, blurb) in OBJECT_COPY.items():
        lines.extend([
            f'### {title}',
            '',
            blurb,
            '',
            f'![{title}](studio/library/soccer/objects/{name}.svg)',
            '',
            '```yaml',
            f'- {{ object: {name}, x: 10, y: 12 }}',
            '```',
            '',
        ])
    lines.extend(['## Formes', ''])
    catalog = [(spec['name'], spec['title'], spec['blurb']) for spec in SHAPES]
    catalog.extend(EXISTING)
    for name, title, blurb in catalog:
        lines.extend([
            f'### {title}',
            '',
            blurb,
            '',
            f'![{title}](studio/library/soccer/shapes/{name}.svg)',
            '',
            '```yaml',
            f'- {{ shape: {name} }}',
            '```',
            '',
        ])
    lines.extend([
        '## Terrains',
        '',
        'Les modèles `half` et `full` restent des SVG. Les autres sont des terrains en mètres.',
        '',
        '### Demi-terrain',
        '',
        'Moitié de terrain, but en haut du schéma.',
        '',
        '![Demi-terrain](studio/library/soccer/pitches/half.svg)',
        '',
        '```yaml',
        'pitch: { template: half }',
        '```',
        '',
        '### Terrain complet',
        '',
        'Terrain à 11, 68 × 105 m.',
        '',
        '![Terrain complet](studio/library/soccer/pitches/full.svg)',
        '',
        '```yaml',
        'pitch: { template: full }',
        '```',
        '',
    ])
    for pitch in PITCHES:
        lines.extend([
            f'### {pitch["title"]}',
            '',
            pitch['blurb'],
            '',
            f'![{pitch["title"]}](studio/library/soccer/pitches/{pitch["name"]}.svg)',
            '',
            '```yaml',
            f'pitch: {{ template: {pitch["name"]} }}',
            '```',
            '',
        ])
    lines.extend([
        '## Recettes',
        '',
        '### Rectangle de plots',
        '',
        'La marge reste à 1 m et le padding à 0,5 m quand on change `w` et `h`. Les plots ne grossissent pas.',
        '',
        '```yaml',
        'zones:',
        '  - { name: atelier, rect: { x: 8, y: 6, w: 16, h: 12, margin: 1, padding: 0.5 }, items: [{ shape: plot-rect }] }',
        '```',
        '',
        '### Rondo',
        '',
        'Le carré de plots et les quatre joueurs sont deux formes dans le même rectangle.',
        '',
        '```yaml',
        'zones:',
        '  - { name: rondo, rect: { x: 10, y: 8, w: 16, h: 16, padding: 1 }, items: [{ shape: rondo-box }, { shape: rondo-4, team: blue }] }',
        '```',
        '',
        '### Couloirs',
        '',
        'Trois couloirs sur un demi-terrain. Les plots marquent les limites.',
        '',
        '```yaml',
        'pitch:',
        '  template: half',
        'zones:',
        '  - { name: couloirs, rect: { x: 2, y: 2, w: 64, h: 48, margin: 0.6, padding: 1 }, items: [{ shape: channels-3 }] }',
        '```',
        '',
        '### Finition',
        '',
        'La cible occupe le haut du rectangle. Le but, le mannequin et les plots viennent de la forme.',
        '',
        '```yaml',
        'pitch:',
        '  template: rect-30x20',
        'zones:',
        '  - { name: cible, rect: { x: 2, y: 16, w: 16, h: 12, padding: 0.6 }, items: [{ shape: finish-target }] }',
        '```',
        '',
        '### Composition étirée',
        '',
        '`unit: relative` lit le rectangle comme une fraction du terrain. Le 4-3-3 occupe cette part. Le gardien, les joueurs et les distances suivent le rectangle ; aucun SVG n’est mis à l’échelle.',
        '',
        '```yaml',
        'pitch:',
        '  template: half',
        'zones:',
        '  - { name: bloc, rect: { x: 0.06, y: 0.08, w: 0.88, h: 0.84, unit: relative, margin: 0.02, padding: { y: 0.03, x: 0.04 } }, items: [{ shape: 4-3-3, team: blue }] }',
        '```',
        '',
    ])
    with open(os.path.join(ROOT, 'tutorial.md'), 'w', encoding='utf-8', newline='\n') as handle:
        handle.write('\n'.join(lines))


def main():
    write_objects()
    write_pitches()
    write_shapes()
    write_schemas()
    write_tutorial()
    print('objects', len(OBJECTS), 'pitches', len(PITCHES), 'shapes', len(SHAPES))


if __name__ == '__main__':
    main()
