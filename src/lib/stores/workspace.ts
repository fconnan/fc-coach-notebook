import { writable, derived } from 'svelte/store';

// ---------------------------------------------------------
// Types
// ---------------------------------------------------------

export type ElementType = 'player' | 'ball' | 'cone' | 'arrow' | 'field';
export type TeamType = 'team1' | 'team2' | 'none';

export interface Position {
  x: number;
  y: number;
}

export interface ComponentElement {
  id: string;
  type: ElementType;
  team: TeamType;
  position: Position;
  // Properties mapped to the element type
  radius?: number;
  label?: string;
  color?: string;
  strokeWidth?: number;
  endPosition?: Position; // For arrows/lines
}

export interface Page {
  id: string;
  name: string;
  fieldTemplate: 'Complet' | 'Demi';
  markdownContent: string;
  elements: ComponentElement[];
}

// ---------------------------------------------------------
// Stores
// ---------------------------------------------------------

// List of all pages
export const pages = writable<Page[]>([
  { 
    id: '1', 
    name: 'Schéma 1', 
    fieldTemplate: 'Complet', 
    markdownContent: '# Ma Fiche Tactique\n\n- Phase offensive\n- Occupation du terrain',
    elements: [] 
  }
]);

// Currently focused page ID
export const currentPageId = writable<string>('1');

// Currently selected element IDs on the active page
export const selectedIds = writable<string[]>([]);

// Derived store to get the currently active page object easily
export const currentPage = derived(
  [pages, currentPageId],
  ([$pages, $currentPageId]) => {
    return $pages.find(p => p.id === $currentPageId) || $pages[0];
  }
);

// Derived store to get the selected element(s) objects
export const selectedElements = derived(
  [currentPage, selectedIds],
  ([$currentPage, $selectedIds]) => {
    return $currentPage?.elements.filter(el => $selectedIds.includes(el.id)) || [];
  }
);

// ---------------------------------------------------------
// Actions (Reducers / Mutations)
// ---------------------------------------------------------

export function addElement(element: Omit<ComponentElement, 'id'>) {
  const newElement: ComponentElement = {
    ...element,
    id: crypto.randomUUID()
  };

  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => {
      if (page.id === activeId) {
        return { ...page, elements: [...page.elements, newElement] };
      }
      return page;
    });
  });

  // Select the newly added element
  selectedIds.set([newElement.id]);
}

export function updateElement(id: string, updates: Partial<ComponentElement>) {
  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => {
      if (page.id === activeId) {
        return {
          ...page,
          elements: page.elements.map(el => el.id === id ? { ...el, ...updates } : el)
        };
      }
      return page;
    });
  });
}

export function removeElements(ids: string[]) {
  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => {
      if (page.id === activeId) {
        return {
          ...page,
          elements: page.elements.filter(el => !ids.includes(el.id))
        };
      }
      return page;
    });
  });
  
  // Clear selection if deleted
  selectedIds.update(current => current.filter(id => !ids.includes(id)));
}

export function setFieldTemplate(template: 'Complet' | 'Demi') {
  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => {
      if (page.id === activeId) {
        return { ...page, fieldTemplate: template };
      }
      return page;
    });
  });
}

export function setMarkdownContent(content: string) {
  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => {
      if (page.id === activeId) {
        return { ...page, markdownContent: content };
      }
      return page;
    });
  });
}

// History stack will be implemented later
export const historyStack = writable<any[]>([]);
export const historyIndex = writable<number>(-1);

// Helper to grab value non-reactively when needed
function getCurrentPageId() {
  let id = '';
  currentPageId.subscribe(v => id = v)();
  return id;
}
