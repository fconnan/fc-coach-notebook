import type { Page } from '$lib/stores/workspace';
import { exerciseDocument } from './exerciseFile';

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch);
}

function inline(text: string): string {
  return escape(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
}

export function renderMarkdown(source: string): string {
  const html: string[] = [];
  let list = false;
  const closeList = () => {
    if (!list) return;
    html.push('</ul>');
    list = false;
  };
  for (const line of source.replace(/\r\n/g, '\n').split('\n')) {
    if (!line.trim()) {
      closeList();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const item = /^[-*]\s+(.*)$/.exec(line);
    if (item) {
      if (!list) {
        html.push('<ul>');
        list = true;
      }
      html.push(`<li>${inline(item[1])}</li>`);
      continue;
    }
    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return html.join('');
}

export function exerciseHtml(page: Page): string {
  const drill = page.drill || {};
  return renderMarkdown(exerciseDocument({
    name: page.name,
    drill: {
      kind: drill.kind || '',
      method: drill.method || '',
      duration: drill.duration || '',
      area: drill.area || '',
      headcount: drill.headcount || '',
      equipment: drill.equipment || ''
    },
    markdownContent: page.markdownContent || ''
  }));
}
