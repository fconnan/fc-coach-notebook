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
  let depth = 0;
  const closeTo = (target: number) => {
    while (depth > target) {
      html.push('</ul>');
      depth -= 1;
    }
  };
  for (const line of source.replace(/\r\n/g, '\n').split('\n')) {
    if (!line.trim()) {
      closeTo(0);
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      closeTo(0);
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const item = /^(\s*)[-*]\s+(.*)$/.exec(line);
    if (item) {
      const level = item[1].length >= 2 ? 2 : 1;
      if (level > depth) {
        while (depth < level) {
          html.push('<ul>');
          depth += 1;
        }
      } else closeTo(level);
      html.push(`<li>${inline(item[2])}</li>`);
      continue;
    }
    if (depth > 0 && /^\s+\S/.test(line)) {
      html.push(`<li class="md-note">${inline(line.trim())}</li>`);
      continue;
    }
    closeTo(0);
    html.push(`<p>${inline(line.trim())}</p>`);
  }
  closeTo(0);
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
