type Saver = () => Promise<boolean | void>;

let saver: Saver | null = null;

export function registerExerciseSaver(fn: Saver): () => void {
  saver = fn;
  return () => {
    if (saver === fn) saver = null;
  };
}

/** Enregistre l’exercice ouvert. Retourne false s’il n’y a pas d’éditeur ouvert. */
export async function saveExerciseDraft(): Promise<boolean> {
  if (!saver) return false;
  await saver();
  return true;
}
