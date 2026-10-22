type Saver = () => Promise<boolean | void>;
type Leave = () => Promise<boolean>;

let saver: Saver | null = null;
let leave: Leave | null = null;
let leaveGranted = false;
let denyUntil = 0;

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

export function registerExerciseLeave(fn: Leave): () => void {
  leaveGranted = false;
  leave = fn;
  return () => {
    if (leave === fn) leave = null;
  };
}

/** true si l’exercice ouvert peut être quitté. */
export async function confirmLeaveExercise(): Promise<boolean> {
  if (Date.now() < denyUntil) return false;
  if (leaveGranted) return true;
  if (!leave) return true;
  const ok = await leave();
  if (ok) {
    leaveGranted = true;
    setTimeout(() => { leaveGranted = false; }, 0);
  } else {
    denyUntil = Date.now() + 1000;
  }
  return ok;
}
