// Local device persistence via the File System Access API, with a download fallback.

export function supportsFS(): boolean {
  return typeof (window as any).showSaveFilePicker === 'function';
}

const JSON_TYPES = [{ description: 'Tactique FC Tactics', accept: { 'application/json': ['.json'] } }];

export async function saveDeviceNew(name: string, content: string): Promise<any | null> {
  if (!supportsFS()) {
    downloadFile(`${name}.json`, content);
    return null;
  }
  const handle = await (window as any).showSaveFilePicker({
    suggestedName: `${name}.json`,
    types: JSON_TYPES
  });
  await writeHandle(handle, content);
  return handle;
}

export async function saveDeviceExisting(handle: any, content: string): Promise<void> {
  await writeHandle(handle, content);
}

async function writeHandle(handle: any, content: string) {
  if ((await handle.queryPermission?.({ mode: 'readwrite' })) === 'denied') {
    await handle.requestPermission?.({ mode: 'readwrite' });
  }
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

export async function openDevice(): Promise<{ name: string; content: string; handle: any } | null> {
  if (!supportsFS()) {
    return openDeviceFallback();
  }
  const [handle] = await (window as any).showOpenFilePicker({ types: JSON_TYPES, multiple: false });
  const file = await handle.getFile();
  const content = await file.text();
  return { name: file.name.replace(/\.json$/i, ''), content, handle };
}

function openDeviceFallback(): Promise<{ name: string; content: string; handle: any } | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const content = await file.text();
      resolve({ name: file.name.replace(/\.json$/i, ''), content, handle: null });
    };
    input.click();
  });
}

export function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
