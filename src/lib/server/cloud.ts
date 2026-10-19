import { gitlabHost } from './oauth';

export interface CloudItem { name: string; id?: string; path?: string; }

// ---------------- Google Drive ----------------

export async function driveList(token: string): Promise<CloudItem[]> {
  const q = encodeURIComponent("mimeType='application/json' and trashed=false");
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&orderBy=modifiedTime desc&pageSize=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Drive: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.files ?? []).map((f: any) => ({ id: f.id, name: (f.name || '').replace(/\.json$/i, '') }));
}

export async function driveLoad(token: string, id: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Drive: ${res.status} ${await res.text()}`);
  return res.text();
}

export async function driveSave(token: string, name: string, content: string, fileId?: string): Promise<CloudItem> {
  const boundary = 'fctactics' + Math.random().toString(16).slice(2);
  const metadata: any = { name: `${name}.json`, mimeType: 'application/json' };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    content +
    `\r\n--${boundary}--`;
  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,name`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name`;
  const res = await fetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body
  });
  if (!res.ok) throw new Error(`Drive: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { id: data.id, name };
}

// ---------------- GitHub ----------------

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}
function b64encode(str: string) { return Buffer.from(str, 'utf-8').toString('base64'); }
function b64decode(str: string) { return Buffer.from(str.replace(/\n/g, ''), 'base64').toString('utf-8'); }

export async function githubRepos(token: string): Promise<string[]> {
  const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member', {
    headers: ghHeaders(token)
  });
  if (!res.ok) throw new Error(`GitHub: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map((r: any) => r.full_name);
}

function ghDir(path: string) { return path ? path.replace(/^\/|\/$/g, '') : ''; }

export async function githubList(token: string, repo: string, branch: string, path: string): Promise<CloudItem[]> {
  const dir = ghDir(path);
  const ref = branch ? `?ref=${encodeURIComponent(branch)}` : '';
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(dir)}${ref}`, {
    headers: ghHeaders(token)
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : [])
    .filter((f: any) => f.type === 'file' && f.name.endsWith('.json'))
    .map((f: any) => ({ name: f.name.replace(/\.json$/i, ''), path: f.path }));
}

export async function githubLoad(token: string, repo: string, path: string, branch: string): Promise<string> {
  const ref = branch ? `?ref=${encodeURIComponent(branch)}` : '';
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}${ref}`, {
    headers: ghHeaders(token)
  });
  if (!res.ok) throw new Error(`GitHub: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return b64decode(data.content);
}

export async function githubSave(token: string, repo: string, branch: string, path: string, name: string, content: string): Promise<CloudItem> {
  const dir = ghDir(path);
  const filePath = `${dir ? dir + '/' : ''}${name}.json`;
  const ref = branch ? `?ref=${encodeURIComponent(branch)}` : '';
  const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(filePath)}${ref}`, {
    headers: ghHeaders(token)
  });
  let sha: string | undefined;
  if (getRes.ok) sha = (await getRes.json()).sha;
  const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(filePath)}`, {
    method: 'PUT',
    headers: ghHeaders(token),
    body: JSON.stringify({ message: `tactique: ${name}`, content: b64encode(content), branch: branch || undefined, sha })
  });
  if (!putRes.ok) throw new Error(`GitHub: ${putRes.status} ${await putRes.text()}`);
  return { name, path: filePath };
}

// ---------------- GitLab ----------------

function glBase(projectId: string) {
  return `${gitlabHost()}/api/v4/projects/${encodeURIComponent(projectId)}`;
}
function glDir(path: string) { return path ? path.replace(/^\/|\/$/g, '') : ''; }

export async function gitlabProjects(token: string): Promise<Array<{ id: number; name: string }>> {
  const res = await fetch(`${gitlabHost()}/api/v4/projects?membership=true&min_access_level=30&per_page=100&order_by=last_activity_at`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`GitLab: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map((p: any) => ({ id: p.id, name: p.path_with_namespace }));
}

export async function gitlabList(token: string, projectId: string, branch: string, path: string): Promise<CloudItem[]> {
  const dir = glDir(path);
  const res = await fetch(`${glBase(projectId)}/repository/tree?path=${encodeURIComponent(dir)}&ref=${encodeURIComponent(branch)}&per_page=100`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`GitLab: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : [])
    .filter((f: any) => f.type === 'blob' && f.name.endsWith('.json'))
    .map((f: any) => ({ name: f.name.replace(/\.json$/i, ''), path: f.path }));
}

export async function gitlabLoad(token: string, projectId: string, path: string, branch: string): Promise<string> {
  const res = await fetch(`${glBase(projectId)}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(branch)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`GitLab: ${res.status} ${await res.text()}`);
  return res.text();
}

export async function gitlabSave(token: string, projectId: string, branch: string, path: string, name: string, content: string): Promise<CloudItem> {
  const dir = glDir(path);
  const filePath = `${dir ? dir + '/' : ''}${name}.json`;
  const headHostUrl = `${glBase(projectId)}/repository/files/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(branch)}`;
  const exists = (await fetch(headHostUrl, { method: 'HEAD', headers: { Authorization: `Bearer ${token}` } })).ok;
  const res = await fetch(`${glBase(projectId)}/repository/files/${encodeURIComponent(filePath)}`, {
    method: exists ? 'PUT' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ branch, content, commit_message: `tactique: ${name}` })
  });
  if (!res.ok) throw new Error(`GitLab: ${res.status} ${await res.text()}`);
  return { name, path: filePath };
}
