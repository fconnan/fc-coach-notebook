export const LEVELS = [
  { value: 1, label: 'Non acquis' },
  { value: 2, label: 'En cours d\'acquisition' },
  { value: 3, label: 'Partiellement acquis' },
  { value: 4, label: 'Acquis' },
  { value: 5, label: 'Maîtrisé' }
] as const;

export interface Criterion {
  id: string;
  name: string;
  short: string;
}

export interface Domain {
  id: string;
  name: string;
  short: string;
  criteria: Criterion[];
}

export interface ProgressGoal {
  finding: string;
  objective: string;
  situation: string;
  indicator: string;
  period: string;
}

export interface SkillPoint {
  id: string;
  name: string;
  short: string;
  score: number | null;
}

export interface SkillGroup {
  id: string;
  name: string;
  short: string;
  criteria: SkillPoint[];
}

export interface EvaluationModel {
  title: string;
  training: boolean;
  match: boolean;
  position: string;
  /** Titre du radar général. Vide : le repère `{{skills}}` n'a pas de nom, le radar n'est pas affiché. */
  skillsTitle: string | null;
  domains: SkillGroup[];
  scores: Record<string, number>;
  notes: Record<string, string>;
  goals: ProgressGoal[];
}

export const DOMAINS: Domain[] = [
  {
    id: 'TECH',
    name: 'Technique',
    short: 'Technique',
    criteria: [
      { id: 'TECH-01', name: 'Contrôle du ballon', short: 'Contrôle' },
      { id: 'TECH-02', name: 'Passe', short: 'Passe' },
      { id: 'TECH-03', name: 'Conduite de balle', short: 'Conduite' },
      { id: 'TECH-04', name: 'Dribble', short: 'Dribble' },
      { id: 'TECH-05', name: 'Frappe', short: 'Frappe' }
    ]
  },
  {
    id: 'INTEL',
    name: 'Intelligence de jeu',
    short: 'Intelligence',
    criteria: [
      { id: 'INTEL-01', name: 'Prise d\'information', short: 'Information' },
      { id: 'INTEL-02', name: 'Vision du jeu', short: 'Vision' },
      { id: 'INTEL-03', name: 'Anticipation', short: 'Anticipation' },
      { id: 'INTEL-04', name: 'Prise de décision', short: 'Décision' },
      { id: 'INTEL-05', name: 'Adaptation au jeu', short: 'Adaptation' }
    ]
  },
  {
    id: 'OFF',
    name: 'Jeu offensif',
    short: 'Offensif',
    criteria: [
      { id: 'OFF-01', name: 'Démarquage', short: 'Démarquage' },
      { id: 'OFF-02', name: 'Appels', short: 'Appels' },
      { id: 'OFF-03', name: 'Disponibilité', short: 'Disponibilité' },
      { id: 'OFF-04', name: 'Création d\'espaces', short: 'Espaces' },
      { id: 'OFF-05', name: 'Efficacité offensive', short: 'Efficacité' }
    ]
  },
  {
    id: 'DEF',
    name: 'Jeu défensif',
    short: 'Défensif',
    criteria: [
      { id: 'DEF-01', name: 'Placement défensif', short: 'Placement' },
      { id: 'DEF-02', name: 'Duel défensif', short: 'Duel' },
      { id: 'DEF-03', name: 'Pressing', short: 'Pressing' },
      { id: 'DEF-04', name: 'Interception', short: 'Interception' },
      { id: 'DEF-05', name: 'Replacement défensif', short: 'Replacement' }
    ]
  },
  {
    id: 'ATH',
    name: 'Capacités athlétiques',
    short: 'Athlétique',
    criteria: [
      { id: 'ATH-01', name: 'Coordination', short: 'Coordination' },
      { id: 'ATH-02', name: 'Vitesse', short: 'Vitesse' },
      { id: 'ATH-03', name: 'Accélération', short: 'Accélération' },
      { id: 'ATH-04', name: 'Changements de direction', short: 'Appuis' },
      { id: 'ATH-05', name: 'Répétition des efforts', short: 'Répétition' }
    ]
  },
  {
    id: 'MENT',
    name: 'Attitude et collectif',
    short: 'Collectif',
    criteria: [
      { id: 'MENT-01', name: 'Engagement', short: 'Engagement' },
      { id: 'MENT-02', name: 'Concentration', short: 'Concentration' },
      { id: 'MENT-03', name: 'Persévérance', short: 'Persévérance' },
      { id: 'MENT-04', name: 'Communication', short: 'Communication' },
      { id: 'MENT-05', name: 'Coopération', short: 'Coopération' }
    ]
  }
];

const GOAL_FIELDS = [
  ['finding', 'Constat'],
  ['objective', 'Objectif'],
  ['situation', 'Situation'],
  ['indicator', 'Indicateur'],
  ['period', 'Période']
] as const;

export function levelLabel(value: number | null): string {
  if (value == null) return 'Non observé';
  return LEVELS.find(level => level.value === value)?.label || 'Non observé';
}

export function blankSheet(title: string): EvaluationModel {
  return { title, training: false, match: false, position: '', skillsTitle: null, domains: [], scores: {}, notes: {}, goals: [] };
}

export function domainAverage(sheet: EvaluationModel, domain: { criteria: { id: string; score?: number | null }[] }): number | null {
  const values = domain.criteria.flatMap(item => {
    const score = item.score !== undefined ? item.score : sheet.scores[item.id];
    return score == null ? [] : [score];
  });
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function formatAverage(value: number | null): string {
  if (value == null) return '—';
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function contextLabel(sheet: EvaluationModel | null): string {
  if (!sheet) return '';
  const parts = [sheet.training ? 'Entraînement' : '', sheet.match ? 'Match' : ''].filter(Boolean);
  return parts.join(', ');
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function goalEmpty(goal: ProgressGoal): boolean {
  return GOAL_FIELDS.every(([key]) => !goal[key].trim());
}

export interface SkillsMarker {
  heading: string;
  title: string | null;
}

/** Le repère `{{skills}}` vit dans le template, sur le `##` des compétences. */
export function skillsMarkerFrom(template: string): SkillsMarker | null {
  const match = /^##\s+(.+?)\s*\{\{\s*skills(?:\s+([^}]*))?\s*\}\}\s*$/im.exec(template.replace(/^\uFEFF/, ''));
  if (!match) return null;
  const title = (match[2] || '').trim();
  return { heading: match[1].trim(), title: title || null };
}

export function withoutSkillsMarker(text: string): string {
  return text.replace(/[ \t]*\{\{\s*skills(?:\s+[^}]*)?\s*\}\}/gi, '');
}

export function formatEvaluation(sheet: EvaluationModel): string {
  const lines = [`# ${sheet.title.trim() || 'Évaluation'}`, ''];
  if (sheet.training) lines.push('Contexte: Entraînement');
  if (sheet.match) lines.push('Contexte: Match');
  if (sheet.position.trim()) lines.push(`Poste: ${clean(sheet.position)}`);
  if (lines.length > 2) lines.push('');
  lines.push('## Compétences', '');
  for (const domain of sheet.domains) {
    lines.push(`- ${domain.name}`);
    for (const item of domain.criteria) {
      const score = item.score ?? sheet.scores[item.id];
      lines.push(`    - ${item.name}: ${score == null ? '' : score}`.trimEnd());
      const note = (sheet.notes[item.id] || '').trim();
      if (note) {
        for (const row of note.split(/\n/)) lines.push(`      ${row}`);
      }
    }
  }
  lines.push('');
  const goals = sheet.goals.filter(goal => !goalEmpty(goal)).slice(0, 3);
  lines.push('## Plan de progression', '');
  goals.forEach((goal, index) => {
    lines.push(`### ${index + 1}`);
    for (const [key, label] of GOAL_FIELDS) {
      const value = clean(goal[key]);
      if (value) lines.push(`${label}: ${value}`);
    }
    lines.push('');
  });
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

function skillId(name: string): string {
  const domain = DOMAINS.find(item => item.name === name);
  if (domain) return domain.id;
  for (const group of DOMAINS) {
    const criterion = group.criteria.find(item => item.name === name);
    if (criterion) return criterion.id;
  }
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'skill';
}

function splitScore(text: string): { name: string; score: number | null } {
  const match = /^(.*?):\s*(.*)$/.exec(text.trim());
  if (!match) return { name: text.trim(), score: null };
  const raw = match[2].trim().replace(',', '.');
  const score = Number(raw);
  return { name: match[1].trim(), score: score >= 1 && score <= 5 ? score : null };
}

export function parseEvaluation(markdown: string, marker: SkillsMarker | null = null): EvaluationModel {
  const sheet = blankSheet('');
  let goal: ProgressGoal | null = null;
  let noteId = '';
  let sawSkills = false;
  let inSkills = false;
  let skillsTitle: string | null = null;
  let domainIndent = -1;
  let group: SkillGroup | null = null;
  const groups: SkillGroup[] = [];
  for (const raw of markdown.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trimEnd();
    const skills = /\{\{\s*skills(?:\s+([^}]*))?\s*\}\}/i.exec(line);
    if (skills) {
      sawSkills = true;
      inSkills = true;
      skillsTitle = marker ? marker.title : ((skills[1] || '').trim() || null);
      noteId = '';
      if (line.trim() === skills[0]) continue;
    }
    if (line.startsWith('# ')) {
      sheet.title = line.slice(2).trim();
      noteId = '';
      inSkills = false;
      continue;
    }
    if (line.startsWith('## ')) {
      noteId = '';
      goal = null;
      const heading = line.slice(3).replace(/\{\{\s*skills(?:\s+[^}]*)?\s*\}\}/i, '').trim();
      if (skills || (marker != null && heading === marker.heading)) {
        sawSkills = true;
        inSkills = true;
        domainIndent = -1;
        group = null;
        if (marker) skillsTitle = marker.title;
        else if (skills) skillsTitle = (skills[1] || '').trim() || null;
      } else {
        inSkills = false;
      }
      continue;
    }
    if (line.startsWith('### ')) {
      noteId = '';
      inSkills = false;
      goal = { finding: '', objective: '', situation: '', indicator: '', period: '' };
      sheet.goals.push(goal);
      continue;
    }
    if (inSkills) {
      const bullet = /^(\s*)[-*]\s+(.*)$/.exec(line.replace(/\t/g, '    '));
      if (bullet) {
        const indent = bullet[1].length;
        const parsed = splitScore(bullet[2]);
        if (!parsed.name) continue;
        const id = skillId(parsed.name);
        if (domainIndent < 0 || indent <= domainIndent) {
          domainIndent = indent;
          group = { id, name: parsed.name, short: parsed.name, criteria: [] };
          groups.push(group);
          noteId = '';
        } else if (group) {
          group.criteria.push({ id, name: parsed.name, short: parsed.name, score: parsed.score });
          if (parsed.score != null) sheet.scores[id] = parsed.score;
          noteId = id;
        }
        continue;
      }
      if (noteId && line.trim()) {
        const text = line.trim();
        sheet.notes[noteId] = sheet.notes[noteId] ? `${sheet.notes[noteId]}\n${text}` : text;
      }
      continue;
    }
    const context = /^Contexte:\s*(.+)$/.exec(line.trim());
    if (context) {
      const value = context[1].trim().toLowerCase();
      if (value.startsWith('entra')) sheet.training = true;
      if (value.startsWith('match')) sheet.match = true;
      noteId = '';
      continue;
    }
    const position = /^Poste:\s*(.*)$/.exec(line.trim());
    if (position) {
      sheet.position = position[1].trim();
      noteId = '';
      continue;
    }
    const field = /^(Constat|Objectif|Situation|Indicateur|Période):\s*(.*)$/.exec(line.trim());
    if (field && goal) {
      const key = GOAL_FIELDS.find(([, label]) => label === field[1])?.[0];
      if (key) goal[key] = field[2].trim();
      noteId = '';
    }
  }
  sheet.goals = sheet.goals.filter(item => !goalEmpty(item)).slice(0, 3);
  sheet.skillsTitle = sawSkills ? skillsTitle : null;
  sheet.domains = groups;
  return sheet;
}
