import { parse } from 'yaml';
import { buildScene, libraryFor, renderSvg } from './scene';
import type { LibraryEntry, SchemaDoc } from './types';

const DEFAULT_SOURCE = 'type: fccn-schema:0\nname: exercise\npitch:\n  template: half\n';

let libraryTask: Promise<LibraryEntry[]> | null = null;

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
  render: (phase: number, progress: number) => string;
}

function svgOf(scene: ReturnType<typeof buildScene>): string {
  return renderSvg(scene).replace(/<\?xml[\s\S]*?\?>\s*/, '');
}

export async function liveExercisePreview(source: string, at = '', id = ''): Promise<ExercisePreview> {
  const library = await loadLibrary();
  const doc = parse(source || DEFAULT_SOURCE) as SchemaDoc;
  if (!doc || typeof doc !== 'object') throw new Error('YAML illisible');
  const names = libraryFor(at || id, library, at ? `${at}/schema.yaml` : '');
  return {
    phases: buildScene(doc, names, 0, 0).phases,
    render: (phase, progress) => svgOf(buildScene(doc, names, phase, progress))
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
    render: (phase, progress) => svgOf(buildScene(doc, names, phase, progress))
  };
}
