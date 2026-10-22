import { persisted } from './layout';

export interface Bookmark {
  path: string;
  label: string;
}

export const bookmarks = persisted<Bookmark[]>('fctactics_bookmarks', []);

export function addBookmark(bookmark: Bookmark) {
  bookmarks.update(list => list.some(item => item.path === bookmark.path) ? list : [...list, bookmark]);
}

export function removeBookmark(path: string) {
  bookmarks.update(list => list.filter(item => item.path !== path));
}
