import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { consignesCell, drillFromBlock, markdownFromCells, splitMarkdown, type SeanceFile, type SectionKey } from '$lib/workspace/model';
import { migratePage, type Page } from '$lib/stores/workspace';

const TABLE = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0';
const TEXT = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
const DRAW = 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0';
const SVG = 'urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0';
const XLINK = 'http://www.w3.org/1999/xlink';
const META = 'urn:oasis:names:tc:opendocument:xmlns:meta:1.0';
const OFFICE = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';
const MANIFEST = 'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0';

const ORG_ROWS = [3, 26, 49, 72];

export interface SheetBlock {
  kind: string;
  method: string;
  duration: string;
  area: string;
  headcount: string;
  objectif: string;
  but: string;
  consignes: string;
  variables: string;
  collectifs: string;
  individuels: string;
  criteres: string;
}

export interface SheetData {
  sheet: string;
  phase: string;
  principle: string;
  means: string;
  coach: string;
  date: string;
  category: string;
  blocks: SheetBlock[];
}

function attrNum(el: Element, name: string): number {
  const v = el.getAttributeNS(TABLE, name) || el.getAttribute(`table:${name}`);
  const n = parseInt(v || '1', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function setRep(el: Element, name: string, n: number) {
  if (n <= 1) {
    el.removeAttributeNS(TABLE, name);
    el.removeAttribute(`table:${name}`);
  } else {
    el.setAttributeNS(TABLE, `table:${name}`, String(n));
  }
}

function tableRows(table: Element): Element[] {
  return [...table.children].filter(el => el.localName === 'table-row');
}

function takeRow(table: Element, index: number): Element | null {
  let i = 0;
  for (const row of tableRows(table)) {
    const rep = attrNum(row, 'number-rows-repeated');
    if (index < i + rep) return isolate(row, index - i, rep, 'number-rows-repeated');
    i += rep;
  }
  return null;
}

function isolate(el: Element, offset: number, rep: number, attr: string): Element {
  if (rep === 1 || offset === 0 && rep === 1) return el;
  const parent = el.parentElement;
  if (!parent || rep === 1) return el;
  const before = offset;
  const after = rep - offset - 1;
  if (before > 0) {
    const pre = el.cloneNode(true) as Element;
    setRep(pre, attr, before);
    parent.insertBefore(pre, el);
  }
  setRep(el, attr, 1);
  if (after > 0) {
    const post = el.cloneNode(true) as Element;
    setRep(post, attr, after);
    parent.insertBefore(post, el.nextSibling);
  }
  return el;
}

function cellAt(row: Element, target: number): Element | null {
  let col = 0;
  for (const cell of [...row.children]) {
    if (cell.localName !== 'table-cell' && cell.localName !== 'covered-table-cell') continue;
    const rep = attrNum(cell, 'number-columns-repeated');
    if (cell.localName === 'covered-table-cell') {
      col += rep;
      continue;
    }
    if (target >= col && target < col + rep) {
      return isolate(cell, target - col, rep, 'number-columns-repeated');
    }
    col += rep;
  }
  return null;
}

function readText(cell: Element | null): string {
  if (!cell) return '';
  const lines = [...cell.children].filter(c => c.localName === 'p').map(p => p.textContent || '');
  return lines.join('\n').trim();
}

function setText(cell: Element | null, text: string) {
  if (!cell) return;
  const doc = cell.ownerDocument;
  if (!doc) return;
  for (const child of [...cell.children]) {
    if (child.localName === 'p') cell.removeChild(child);
  }
  cell.removeAttributeNS(OFFICE, 'value');
  cell.removeAttributeNS(OFFICE, 'date-value');
  cell.removeAttribute('office:value');
  cell.removeAttribute('office:date-value');
  cell.setAttributeNS(OFFICE, 'office:value-type', 'string');
  const lines = (text || '').split(/\r?\n/);
  for (const line of lines.length ? lines : ['']) {
    const p = doc.createElementNS(TEXT, 'text:p');
    p.textContent = line;
    cell.appendChild(p);
  }
}

function findTable(doc: Document, name: string): Element | null {
  const tables = doc.getElementsByTagNameNS(TABLE, 'table');
  for (const table of tables) {
    const n = table.getAttributeNS(TABLE, 'name') || table.getAttribute('table:name');
    if (n === name) return table;
  }
  return null;
}

function textAt(table: Element, row: number, col: number): string {
  const found = takeRow(table, row);
  if (!found) return '';
  return readText(cellAt(found, col));
}

function putText(table: Element, row: number, col: number, text: string) {
  const found = takeRow(table, row);
  if (!found) return;
  setText(cellAt(found, col), text);
}

function readBlock(table: Element, org: number): SheetBlock {
  const at = (row: number, col: number) => textAt(table, row, col);
  return {
    kind: at(org + 3, 0),
    method: at(org + 3, 5),
    duration: at(org + 5, 6),
    area: at(org + 6, 6),
    headcount: at(org + 7, 6),
    objectif: at(org + 8, 2),
    but: at(org + 10, 2),
    consignes: at(org + 13, 2),
    variables: at(org + 19, 2),
    collectifs: at(org + 3, 26),
    individuels: at(org + 11, 26),
    criteres: at(org + 19, 26)
  };
}

function blockHasText(block: SheetBlock): boolean {
  return Object.values(block).some(v => v.trim());
}

function readSheet(doc: Document, sheet: string): SheetData | null {
  const table = findTable(doc, sheet);
  if (!table) return null;
  const at = (row: number, col: number) => textAt(table, row, col);
  const data: SheetData = {
    sheet,
    phase: at(0, 6),
    principle: at(1, 6),
    means: at(2, 6),
    coach: at(0, 23),
    date: at(1, 23),
    category: at(2, 23),
    blocks: ORG_ROWS.map(org => readBlock(table, org))
  };
  const any = data.phase || data.principle || data.means || data.date || data.blocks.some(blockHasText);
  return any ? data : null;
}

function writeBlock(table: Element, org: number, block: SheetBlock) {
  const put = (row: number, col: number, text: string) => putText(table, row, col, text);
  put(org + 3, 0, block.kind);
  put(org + 3, 5, block.method);
  put(org + 5, 6, block.duration);
  put(org + 6, 6, block.area);
  put(org + 7, 6, block.headcount);
  put(org + 8, 2, block.objectif);
  put(org + 10, 2, block.but);
  put(org + 13, 2, block.consignes);
  put(org + 19, 2, block.variables);
  put(org + 3, 26, block.collectifs);
  put(org + 11, 26, block.individuels);
  put(org + 19, 26, block.criteres);
}

function blockFromExercise(page: Page): SheetBlock {
  const md = page.markdownContent || '';
  const { sections } = splitMarkdown(md);
  const drill = page.drill || {};
  return {
    kind: drill.kind || '',
    method: drill.method || '',
    duration: drill.duration || '',
    area: drill.area || '',
    headcount: drill.headcount || '',
    objectif: sections.objectif || '',
    but: sections.but || '',
    consignes: consignesCell(md),
    variables: sections.variables || '',
    collectifs: sections.collectifs || '',
    individuels: sections.individuels || '',
    criteres: sections.criteres || ''
  };
}

function cellsToMarkdown(block: SheetBlock): string {
  const cells: Partial<Record<SectionKey, string>> = {
    objectif: block.objectif,
    but: block.but,
    consignes: block.consignes,
    variables: block.variables,
    collectifs: block.collectifs,
    individuels: block.individuels,
    criteres: block.criteres
  };
  return markdownFromCells(cells);
}

function upsertImage(cell: Element, name: string, href: string) {
  const doc = cell.ownerDocument;
  if (!doc) return;
  for (const frame of [...cell.getElementsByTagNameNS(DRAW, 'frame')]) {
    const n = frame.getAttributeNS(DRAW, 'name') || frame.getAttribute('draw:name');
    if (n === name) frame.parentElement?.removeChild(frame);
  }
  const frame = doc.createElementNS(DRAW, 'draw:frame');
  frame.setAttributeNS(DRAW, 'draw:name', name);
  frame.setAttributeNS(SVG, 'svg:x', '0.2cm');
  frame.setAttributeNS(SVG, 'svg:y', '0.8cm');
  frame.setAttributeNS(SVG, 'svg:width', '7.2cm');
  frame.setAttributeNS(SVG, 'svg:height', '5.2cm');
  const img = doc.createElementNS(DRAW, 'draw:image');
  img.setAttributeNS(XLINK, 'xlink:href', href);
  img.setAttributeNS(XLINK, 'xlink:type', 'simple');
  img.setAttributeNS(XLINK, 'xlink:show', 'embed');
  img.setAttributeNS(XLINK, 'xlink:actuate', 'onLoad');
  frame.appendChild(img);
  cell.appendChild(frame);
}

interface MetaBag {
  seances: Record<string, SeanceFile>;
}

function readMeta(xml: string): MetaBag {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const nodes = doc.getElementsByTagNameNS(META, 'user-defined');
  for (const node of nodes) {
    const name = node.getAttributeNS(META, 'name') || node.getAttribute('meta:name');
    if (name === 'fctactics') {
      try {
        const parsed = JSON.parse(node.textContent || '{}') as MetaBag;
        return { seances: parsed.seances || {} };
      } catch {
        return { seances: {} };
      }
    }
  }
  return { seances: {} };
}

function writeMeta(xml: string, bag: MetaBag): string {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  let node: Element | null = null;
  for (const item of doc.getElementsByTagNameNS(META, 'user-defined')) {
    const name = item.getAttributeNS(META, 'name') || item.getAttribute('meta:name');
    if (name === 'fctactics') node = item;
  }
  if (!node) {
    const meta = doc.getElementsByTagNameNS(OFFICE, 'meta')[0] || doc.documentElement;
    node = doc.createElementNS(META, 'meta:user-defined');
    node.setAttributeNS(META, 'meta:name', 'fctactics');
    meta.appendChild(node);
  }
  node.textContent = JSON.stringify(bag);
  return serialize(doc);
}

function ensureManifest(xml: string, paths: string[]): string {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const root = doc.documentElement;
  const existing = new Set<string>();
  for (const entry of doc.getElementsByTagNameNS(MANIFEST, 'file-entry')) {
    const path = entry.getAttributeNS(MANIFEST, 'full-path') || entry.getAttribute('manifest:full-path');
    if (path) existing.add(path);
  }
  for (const path of paths) {
    if (existing.has(path)) continue;
    const entry = doc.createElementNS(MANIFEST, 'manifest:file-entry');
    entry.setAttributeNS(MANIFEST, 'manifest:full-path', path);
    entry.setAttributeNS(MANIFEST, 'manifest:media-type', 'image/png');
    root.appendChild(entry);
  }
  return serialize(doc);
}

function serialize(doc: Document): string {
  const body = new XMLSerializer().serializeToString(doc);
  if (body.startsWith('<?xml')) return body;
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
}

function unzip(bytes: Uint8Array): Record<string, Uint8Array> {
  return unzipSync(bytes);
}

function rezip(files: Record<string, Uint8Array>): Uint8Array {
  const entries: Record<string, Uint8Array | [Uint8Array, { level: number }]> = {};
  if (files['mimetype']) entries['mimetype'] = [files['mimetype'], { level: 0 as const }];
  for (const [name, data] of Object.entries(files)) {
    if (name !== 'mimetype') entries[name] = data;
  }
  return zipSync(entries as import('fflate').Zippable);
}

function exerciseFromBlock(block: SheetBlock, index: number, previous: Page | undefined): Page {
  const page = previous ? migratePage(structuredClone(previous)) : migratePage({ name: `Exercice ${index + 1}` });
  page.name = page.name || `Exercice ${index + 1}`;
  page.drill = { ...page.drill, ...drillFromBlock(block) };
  page.markdownContent = cellsToMarkdown(block);
  return page;
}

/** Read every filled sheet. Cell text replaces the matching markdown; metadata keeps the diagram and the frames. */
export function importClasseur(bytes: Uint8Array): SeanceFile[] {
  const files = unzip(bytes);
  const content = files['content.xml'];
  if (!content) throw new Error('Classeur sans content.xml');
  const doc = new DOMParser().parseFromString(strFromU8(content), 'application/xml');
  const meta = files['meta.xml'] ? readMeta(strFromU8(files['meta.xml'])) : { seances: {} };
  const out: SeanceFile[] = [];
  for (let n = 1; n <= 80; n++) {
    const sheet = `S${n}`;
    const data = readSheet(doc, sheet);
    const stored = meta.seances[sheet];
    if (!data && !stored) continue;
    if (!data && stored) {
      out.push(stored);
      continue;
    }
    if (!data) continue;
    const baseExercises = stored?.exercises?.map(ex => migratePage(ex)) ?? [];
    const filled = data.blocks
      .map((block, i) => ({ block, i }))
      .filter(({ block }) => blockHasText(block));
    const fromSheet = (filled.length ? filled : data.blocks.slice(0, 1).map((block, i) => ({ block, i })))
      .filter(({ block }) => blockHasText(block) || baseExercises.length === 0)
      .map(({ block, i }) => exerciseFromBlock(block, i, baseExercises[i]));
    const extra = baseExercises.slice(4);
    const exercises = fromSheet.length ? [...fromSheet, ...extra] : baseExercises;
    out.push({
      id: stored?.id || crypto.randomUUID(),
      name: stored?.name || data.phase || sheet,
      sheet,
      date: data.date || stored?.date || '',
      phase: data.phase || '',
      principle: data.principle || '',
      means: data.means || '',
      exercises: exercises.length ? exercises : [migratePage({ name: 'Exercice 1' })]
    });
  }
  return out;
}

export interface OdsImage {
  index: number;
  png: Uint8Array;
}

/** Write one séance into its sheet. Returns a warning when more than four exercises are kept only in the app. */
export function exportSeanceToOds(
  bytes: Uint8Array,
  seance: SeanceFile,
  coach: string,
  category: string,
  images: OdsImage[]
): { bytes: Uint8Array; warning?: string } {
  const files = unzip(bytes);
  if (!files['content.xml']) throw new Error('Classeur sans content.xml');
  const doc = new DOMParser().parseFromString(strFromU8(files['content.xml']), 'application/xml');
  const table = findTable(doc, seance.sheet || 'S1');
  if (!table) throw new Error(`Feuille ${seance.sheet} introuvable`);

  const header = (row: number, col: number, text: string) => putText(table, row, col, text);
  header(0, 6, seance.phase || '');
  header(1, 6, seance.principle || '');
  header(2, 6, seance.means || '');
  header(0, 23, coach);
  header(1, 23, seance.date || '');
  header(2, 23, category);

  const written = seance.exercises.slice(0, 4);
  ORG_ROWS.forEach((org, i) => {
    const page = written[i];
    writeBlock(table, org, page ? blockFromExercise(page) : emptyBlock());
    const image = images.find(img => img.index === i);
    if (image && page) {
      const href = `Pictures/fct-${seance.sheet}-${i + 1}.png`;
      const orgRow = takeRow(table, org);
      const cell = orgRow ? cellAt(orgRow, 0) : null;
      if (cell) upsertImage(cell, `fct-${seance.sheet}-${i + 1}`, href);
      files[href] = image.png;
    }
  });

  files['content.xml'] = strToU8(serialize(doc));
  const metaXml = files['meta.xml'] ? strFromU8(files['meta.xml']) : '<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"><office:meta/></office:document-meta>';
  const bag = readMeta(metaXml);
  bag.seances[seance.sheet] = seance;
  files['meta.xml'] = strToU8(writeMeta(metaXml, bag));
  if (files['META-INF/manifest.xml']) {
    const paths = images.filter(img => img.index < 4).map(img => `Pictures/fct-${seance.sheet}-${img.index + 1}.png`);
    files['META-INF/manifest.xml'] = strToU8(ensureManifest(strFromU8(files['META-INF/manifest.xml']), paths));
  }
  const warning = seance.exercises.length > 4
    ? `${seance.exercises.length - 4} exercice(s) dépassent les 4 blocs de la feuille ${seance.sheet}. Ils restent dans la séance et dans le PDF.`
    : undefined;
  return { bytes: rezip(files), warning };
}

function emptyBlock(): SheetBlock {
  return {
    kind: '', method: '', duration: '', area: '', headcount: '',
    objectif: '', but: '', consignes: '', variables: '',
    collectifs: '', individuels: '', criteres: ''
  };
}
