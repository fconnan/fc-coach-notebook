export type TemplateName = 'session' | 'exercise';

export function fillTemplate(source: string, values: Record<string, string>): string {
  return source.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_match, key: string) => values[key] ?? '');
}

export async function readTemplate(name: TemplateName): Promise<string> {
  const response = await fetch(`/api/workspace?template=${name}`);
  if (!response.ok) return '';
  const data = await response.json() as { markdown?: string };
  return data.markdown || '';
}
