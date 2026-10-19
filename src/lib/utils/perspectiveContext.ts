import { getContext, setContext } from 'svelte';
import type { Projector } from '$lib/utils/projection';

const PERSPECTIVE_CTX = Symbol('perspective');

export function setPerspectiveContext(getter: () => Projector | null) {
  setContext(PERSPECTIVE_CTX, getter);
}

export function getPerspectiveContext(): Projector | null {
  const getter = getContext<(() => Projector | null) | undefined>(PERSPECTIVE_CTX);
  return getter ? getter() : null;
}
