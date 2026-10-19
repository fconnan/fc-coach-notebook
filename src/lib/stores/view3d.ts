import { writable } from 'svelte/store';
import type { Camera, WebGLRenderer } from 'three';

/** WebGL renderer ref for 3D export (set by View3D). */
export const view3dRenderer = writable<WebGLRenderer | null>(null);
/** Active perspective camera for DnD raycasting. */
export const view3dCamera = writable<Camera | null>(null);
