import { parse } from 'yaml';
import { buildScene, elementKind, elementScene, libraryFor, renderSvg } from './scene';
import type { LibraryEntry, SchemaDoc } from './types';

const DEFAULT_SOURCE = 'version: fccn-schema:1\nname: exercise\npitch: half-attack\n';

let libraryTask: Promise<LibraryEntry[]> | null = null;

export function refreshLibrary() {
  libraryTask = null;
}

function loadLibrary(): Promise<LibraryEntry[]> {
  if (!libraryTask) {
    libraryTask = fetch('/api/schema?part=library')
      .then(async response => {
        const body = await response.json() as { library?: LibraryEntry[]; error?: string };
        if (!response.ok) throw new Error(body.error || 'Bibliothèque illisible');
        return body.library || [];
      })
      .catch(err => {
        libraryTask = null;
        throw err;
      });
  }
  return libraryTask;
}

export interface ExercisePreview {
  phases: { name: string; duration: number }[];
  render: (phase: number, progress: number, picks?: boolean) => string;
}

function svgOf(scene: ReturnType<typeof buildScene>, picks = false): string {
  return renderSvg(scene, picks).replace(/<\?xml[\s\S]*?\?>\s*/, '');
}

export async function liveElementPreview(source: string, elementId = ''): Promise<ExercisePreview> {
  const library = await loadLibrary();
  const doc = parse(source) as SchemaDoc;
  if (!doc || typeof doc !== 'object') throw new Error('YAML illisible');
  if (elementId) {
    doc.id = elementId;
    doc.type = elementKind(elementId);
  }
  const names = libraryFor('elements', library);
  const phases = (doc.phases || []).map(item => ({
    name: item.name || 'Phase',
    duration: typeof item.duration === 'number' && Number.isFinite(item.duration) ? item.duration : 4
  }));
  return {
    phases,
    render: (phase, progress, picks) => elementScene(doc, names, phase, progress, Boolean(picks))
  };
}

export async function liveExercisePreview(source: string, at = '', id = ''): Promise<ExercisePreview> {
  const library = await loadLibrary();
  const doc = parse(source || DEFAULT_SOURCE) as SchemaDoc;
  if (!doc || typeof doc !== 'object') throw new Error('YAML illisible');
  const names = libraryFor(at || id, library, at ? `${at}/schema.yaml` : '');
  return {
    phases: buildScene(doc, names, 0, 0).phases,
    render: (phase, progress, picks) => svgOf(buildScene(doc, names, phase, progress), picks)
  };
}

export async function loadExercisePreview(at: string, id = ''): Promise<ExercisePreview> {
  const query = new URLSearchParams({ part: 'source' });
  if (at) query.set('at', at);
  if (id) query.set('id', id);
  const [library, response] = await Promise.all([
    loadLibrary(),
    fetch(`/api/schema?${query}`)
  ]);
  const body = await response.json() as { source?: string; error?: string };
  if (!response.ok) throw new Error(body.error || 'Schéma illisible');
  const doc = parse(body.source || DEFAULT_SOURCE) as SchemaDoc;
  const names = libraryFor(at || id, library, at ? `${at}/schema.yaml` : '');
  return {
    phases: buildScene(doc, names, 0, 0).phases,
    render: (phase, progress, picks) => svgOf(buildScene(doc, names, phase, progress), picks)
  };
}
