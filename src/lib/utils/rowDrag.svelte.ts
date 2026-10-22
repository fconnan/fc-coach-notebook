type SaveOrder = (ids: string[]) => Promise<string | null>;

function reordered(ids: string[], from: string, to: string): string[] | null {
  const start = ids.indexOf(from);
  const end = ids.indexOf(to);
  if (start < 0 || end < 0 || start === end) return null;
  const next = ids.slice();
  next.splice(start, 1);
  next.splice(end, 0, from);
  return next;
}

/** Drag and drop of table rows to reorder a list of ids. */
export class RowDrag {
  dragId = $state('');
  dropId = $state('');
  error = $state('');

  rowClass = (ids: string[], id: string): string => {
    const classes = ['cursor-pointer'];
    if (id === this.dragId) classes.push('opacity-50');
    if (this.dragId && id === this.dropId && id !== this.dragId) {
      classes.push(ids.indexOf(this.dragId) < ids.indexOf(id)
        ? '[&>td]:shadow-[inset_0_-2px_0_var(--color-fg-brand)]'
        : '[&>td]:shadow-[inset_0_2px_0_var(--color-fg-brand)]');
    }
    return classes.join(' ');
  };

  start = (event: DragEvent, id: string) => {
    this.dragId = id;
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
  };

  over = (event: DragEvent, id: string) => {
    if (!this.dragId) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dropId = id;
  };

  end = () => {
    this.dragId = '';
    this.dropId = '';
  };

  drop = async (event: DragEvent, ids: string[], id: string, save: SaveOrder) => {
    event.preventDefault();
    const next = reordered(ids, this.dragId, id);
    this.end();
    if (next) this.error = (await save(next)) || '';
  };
}
