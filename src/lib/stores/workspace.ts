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
  endPosition?: Position; // Deprecated, using pathPoints for new arrows
  pathPoints?: Position[]; // Array of points for arrows/paths
  curveType?: 'L' | 'Q' | 'C' | 'S' | 'T'; 
  arrowStart?: boolean;
  arrowEnd?: boolean;
  strokeDasharray?: string;
  angle?: number; // Rotation in degrees (0-359)
  leftLegLength?: number; 
  rightLegLength?: number;
  linkedStartId?: string; // ID of the element the start point is linked to
  linkedEndId?: string;   // ID of the element the end point is linked to
}

export interface Page {
  id: string;
  name: string;
  fieldTemplate: 'Complet' | 'Demi' | 'DemiBas';
  nextTeam1Number: number;
  nextTeam2Number: number;
  markdownContent: string;
  elements: ComponentElement[];
  showPlayerDetails: boolean;
  // Styles Globaux
  team1Color: string;
  team2Color: string;
  team1Size: number;
  team2Size: number;
  ballColor: string;
  ballSize: number;
  showFieldStripes: boolean;
}

// ---------------------------------------------------------
// Stores
// ---------------------------------------------------------

export const DEFAULT_PAGE: Page = { 
  id: '1', 
  name: '', 
  fieldTemplate: 'Complet', 
  markdownContent: '',
  elements: [],
  nextTeam1Number: 1,
  nextTeam2Number: 1,
  showPlayerDetails: false,
  team1Color: '#5e6ad2',
  team2Color: '#d25e5e',
  team1Size: 14,
  team2Size: 14,
  ballColor: '#ffffff',
  ballSize: 8,
  showFieldStripes: true
};

// List of all pages
export const pages = writable<Page[]>([DEFAULT_PAGE]);


// Currently focused page ID
export const currentPageId = writable<string>('1');

// Currently selected element IDs on the active page
export const selectedIds = writable<string[]>([]);

// Currently active tool (e.g., 'arrow')
export const activeTool = writable<ElementType | null>(null);

// Unsaved changes flag
export const isDirty = writable<boolean>(false);

// Flag to track if a tactic (file set) is currently loaded and active
export const isTacticLoaded = writable<boolean>(false);

// Track the active directory handle reactively
export const activeDirectoryHandle = writable<FileSystemDirectoryHandle | null>(null);

// Global control for the Tactic Browser modal visibility
export const showTacticBrowser = writable<boolean>(false);

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

  isDirty.set(true);
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
  isDirty.set(true);
  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => {
      if (page.id === activeId) {
        // 1. Update the targeted element
        const nextElements = page.elements.map(el => el.id === id ? { ...el, ...updates } : el);
        const movedEl = nextElements.find(el => el.id === id);

        // 2. If it's a move, update linked arrows
        if (movedEl && updates.position) {
          return {
            ...page,
            elements: nextElements.map(el => {
              if (el.type === 'arrow' && (el.linkedStartId === id || el.linkedEndId === id)) {
                const newPoints = [...(el.pathPoints || [el.position, el.endPosition || { x: el.position.x + 50, y: el.position.y }])];
                let changed = false;
                if (el.linkedStartId === id) {
                  newPoints[0] = movedEl.position;
                  changed = true;
                }
                if (el.linkedEndId === id) {
                  newPoints[newPoints.length - 1] = movedEl.position;
                  changed = true;
                }
                if (changed) {
                  return { ...el, pathPoints: newPoints, position: newPoints[0] };
                }
              }
              return el;
            })
          };
        }
        return { ...page, elements: nextElements };
      }
      return page;
    });
  });
}

export function removeElements(ids: string[]) {
  isDirty.set(true);
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

export function setFieldTemplate(template: 'Complet' | 'Demi' | 'DemiBas') {
  isDirty.set(true);
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

export function incrementTeamNumber(team: TeamType) {
  if (team === 'none') return;
  isDirty.set(true);
  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => {
      if (page.id === activeId) {
        return {
          ...page,
          nextTeam1Number: team === 'team1' ? page.nextTeam1Number + 1 : page.nextTeam1Number,
          nextTeam2Number: team === 'team2' ? page.nextTeam2Number + 1 : page.nextTeam2Number
        };
      }
      return page;
    });
  });
}

export function setShowPlayerDetails(visible: boolean) {
  isDirty.set(true);
  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => {
      if (page.id === activeId) {
        return { ...page, showPlayerDetails: visible };
      }
      return page;
    });
  });
}

export function setMarkdownContent(content: string) {
  isDirty.set(true);
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

export function updatePageSettings(updates: Partial<Page>) {
  isDirty.set(true);
  pages.update(p => {
    const activeId = getCurrentPageId();
    return p.map(page => {
      if (page.id === activeId) {
        return { ...page, ...updates };
      }
      return page;
    });
  });
}

/**
 * Replaces the entire session content with external data.
 * Always ensures a unique ID to trigger UI refreshes.
 */
export function importPage(data: Partial<Page>) {
  const newId = data.id || `page-${Date.now()}`; 
  const newPage: Page = {
    ...DEFAULT_PAGE,
    ...data,
    id: newId
  };
  
  pages.set([newPage]);
  currentPageId.set(newId);
  selectedIds.set([]);
  isTacticLoaded.set(true);
}

/**
 * Resets the session to the empty/welcome state.
 */
export function unloadTactic() {
  pages.set([{ ...DEFAULT_PAGE }]);
  isTacticLoaded.set(false);
  isDirty.set(false);
  selectedIds.set([]);
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
