import type { JSONSchema } from 'monaco-yaml';
import type { LibraryEntry } from './types';
import source from './fccn-schema-0.json' with { type: 'json' };

const NAMED = new Set(['template', 'object', 'shape', 'boundary']);

export function schemaDocument(names: string[]): JSONSchema {
  const known = names.length ? names : ['half', 'full'];
  const doc = structuredClone(source) as JSONSchema;
  stamp(doc, known);
  return doc;
}

function stamp(node: JSONSchema, known: string[]) {
  const props = node.properties;
  if (props && typeof props === 'object') {
    for (const [key, child] of Object.entries(props)) {
      if (!child || typeof child === 'boolean') continue;
      if (NAMED.has(key) && acceptsString(child)) child.enum = [...known];
      stamp(child, known);
    }
  }
  const items = node.items;
  if (Array.isArray(items)) {
    for (const child of items) if (child && typeof child !== 'boolean') stamp(child, known);
  } else if (items && typeof items !== 'boolean') stamp(items, known);
  for (const list of [node.oneOf, node.anyOf, node.allOf]) {
    if (!list) continue;
    for (const child of list) if (child && typeof child !== 'boolean') stamp(child, known);
  }
  if (node.additionalProperties && typeof node.additionalProperties !== 'boolean') stamp(node.additionalProperties, known);
  for (const child of Object.values(node.definitions || {})) stamp(child, known);
}

function acceptsString(node: JSONSchema) {
  return node.type === 'string' || (Array.isArray(node.type) && node.type.includes('string'));
}

export function namesFrom(entries: LibraryEntry[]): string[] {
  return [...new Set(entries.map(entry => entry.name).filter(Boolean))].sort();
}
