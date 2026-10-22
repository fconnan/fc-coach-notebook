function fold(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
}

/** True when the query is empty or one of the values contains it, ignoring case and accents. */
export function matches(query: string, ...values: Array<string | number | null | undefined>): boolean {
  const wanted = fold(query.trim());
  return !wanted || values.some(value => value != null && fold(String(value)).includes(wanted));
}
