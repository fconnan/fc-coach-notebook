import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const monacoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'node_modules/monaco-editor').replaceAll('\\', '/');

const pathBrowserifyEsm = {
	name: 'path-browserify-esm',
	transform(code: string, id: string) {
		if (!id.replaceAll('\\', '/').includes('/path-browserify/index.js')) return;
		if (!code.includes('module.exports = posix;')) return;
		return code.replace(
			'module.exports = posix;',
			`export { posix };
export default posix;
export const basename = posix.basename;
export const dirname = posix.dirname;
export const extname = posix.extname;
export const format = posix.format;
export const isAbsolute = posix.isAbsolute;
export const join = posix.join;
export const normalize = posix.normalize;
export const parse = posix.parse;
export const relative = posix.relative;
export const resolve = posix.resolve;
export const sep = posix.sep;
export const delimiter = posix.delimiter;
export const win32 = posix.win32;`
		);
	}
};

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), pathBrowserifyEsm],
	resolve: {
		alias: [
			{ find: /^monaco-editor\/(.*)/, replacement: `${monacoRoot}/$1` }
		]
	},
	ssr: {
		noExternal: ['carta-md']
	}
});
