import { browser } from '$app/environment';
import { pushState, replaceState } from '$app/navigation';
import { page } from '$app/stores';
import { WORKSPACE_AREAS, WORKSPACE_DOORS, type WorkspaceArea, type WorkspaceDoor } from './catalog';

export interface AddressTarget {
  door: WorkspaceDoor | '';
  area: WorkspaceArea | '';
  item: string;
  child: string;
  exercise: string;
}

type AddressReader = () => AddressTarget;
type AddressGo = (target: AddressTarget) => Promise<void>;

const doors = new Set<string>(WORKSPACE_DOORS.map(door => door.id));
const areas = new Set<string>(WORKSPACE_AREAS.map(area => area.id));

let readAddress: AddressReader | null = null;
let goAddress: AddressGo | null = null;
let applying = false;
let installed = false;
let armed = false;

export function bindAddress(read: AddressReader, go: AddressGo) {
  readAddress = read;
  goAddress = go;
}

export function parseAddress(pathname: string): AddressTarget | null {
  const parts = pathname.split('/').filter(Boolean);
  if (!parts.length) return { door: '', area: '', item: '', child: '', exercise: '' };
  const door = parts[0];
  if (!doors.has(door)) return null;
  if (door === 'season') {
    return { door: 'season', area: 'seasons', item: parts[1] || '', child: '', exercise: '' };
  }
  if (door === 'repertoire') {
    let rest = parts.slice(1);
    if (rest[0] === 'themes') rest = rest.slice(1);
    if (rest[0] === 'categories') rest = [];
    return {
      door: 'repertoire',
      area: 'themes',
      item: rest[0] || '',
      child: rest[1] || '',
      exercise: rest[2] || ''
    };
  }
  const area = parts[1] || '';
  if (area && !areas.has(area)) return null;
  return {
    door: door as WorkspaceDoor,
    area: area as WorkspaceArea | '',
    item: parts[2] || '',
    child: parts[3] || '',
    exercise: parts[4] || ''
  };
}

export function addressPath(target: AddressTarget): string {
  if (!target.door) return '/';
  const parts: string[] = [target.door];
  if (target.door === 'season') {
    if (target.item) parts.push(target.item);
  } else if (target.door === 'repertoire') {
    if (target.item) parts.push(target.item);
    if (target.child) parts.push(target.child);
    if (target.exercise) parts.push(target.exercise);
  } else if (target.area) {
    parts.push(target.area);
    if (target.item) parts.push(target.item);
    if (target.child) parts.push(target.child);
    if (target.exercise) parts.push(target.exercise);
  }
  return `/${parts.join('/')}`;
}

export function publishAddress(mode: 'push' | 'replace' = 'push') {
  if (!browser || applying || !readAddress) return;
  const path = addressPath(readAddress());
  if (path === location.pathname) return;
  const url = path + location.search + location.hash;
  if (mode === 'replace') replaceState(url, {});
  else pushState(url, {});
}

export async function followAddress(pathname = browser ? location.pathname : '/', mode: 'url' | 'fill' | 'disk' = 'url') {
  if (!browser || !readAddress || !goAddress || applying) return;
  const target = parseAddress(pathname);
  if (!target) return;
  const current = addressPath(readAddress());
  if (mode === 'fill' && (pathname === '/' || pathname === '')) {
    if (current !== '/') publishAddress('replace');
    return;
  }
  if (mode !== 'disk' && current === pathname) return;
  applying = true;
  try {
    await goAddress(target);
  } finally {
    applying = false;
    publishAddress('replace');
  }
}

export function armAddress() {
  armed = true;
}

export function installAddress() {
  if (!browser || installed) return;
  installed = true;
  page.subscribe(() => {
    if (!armed || applying || !readAddress) return;
    // pushState notifies this store without updating page.url, so the browser
    // location is the address that just changed.
    const pathname = location.pathname;
    if (pathname === addressPath(readAddress())) return;
    void followAddress(pathname);
  });
}
