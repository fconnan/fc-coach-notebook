import fs from 'node:fs';

const file = 'node_modules/vite/dist/node/chunks/config.js';
if (!fs.existsSync(file)) process.exit(0);
const source = fs.readFileSync(file, 'utf8');
const next = source
  .replace(
    'const workerImportMetaUrlRE = /new\\s+(?:Worker|SharedWorker)\\s*\\(\\s*new\\s+URL.+?import\\.meta\\.url/s;',
    'const workerImportMetaUrlRE = /import\\.meta\\.url/;'
  )
  .replace(
    'code: /new\\s+URL.+import\\.meta\\.url/s',
    'code: /import\\.meta\\.url/'
  );
if (next === source) {
  const already = source.includes('const workerImportMetaUrlRE = /import\\.meta\\.url/;')
    && source.includes('code: /import\\.meta\\.url/');
  if (!already) console.warn('Le correctif Vite n’a pas trouvé les filtres attendus.');
} else {
  fs.writeFileSync(file, next);
  console.log('Filtres Vite corrigés.');
}
