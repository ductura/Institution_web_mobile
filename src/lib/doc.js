// Pomoćne funkcije editora. Čiste funkcije, rade i u pregledniku i u Node testovima.

export function debounce(fn, ms) {
  let t;
  const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  wrapped.flush = (...args) => { clearTimeout(t); return fn(...args); };
  return wrapped;
}

/** Stara poveznica '#/doc/abc' -> { view: 'doc', id: 'abc' }; sve ostalo -> popis */
export function parseRoute(hash = '') {
  const m = String(hash).match(/^#\/doc\/([\w-]+)$/);
  return m ? { view: 'doc', id: m[1] } : { view: 'list' };
}

/** Putanja stranice dokumenta (bez osnovne putanje; nju dodaje Next). */
export function docHref(id) {
  return `/doc/${encodeURIComponent(id)}`;
}

export function wordCount(text = '') {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  return words.length;
}

// Rječnik sučelja (Ductus docs/PRODUCT.md §5): „spremljeno” uvijek kaže gdje.
const LABELS = {
  idle: '',
  dirty: 'Izmjene još nisu na poslužitelju',
  saving: 'Spremanje na poslužitelj…',
  saved: 'Spremljeno na poslužitelju',
  error: 'Spremanje na poslužitelj nije uspjelo',
};
export function saveStatusLabel(state) {
  return LABELS[state] ?? '';
}

/** Zaslonska tipkovnica je vjerojatno otvorena kad vidljivi dio padne ispod 75 % visine prozora. */
export function isKeyboardOpen(visualHeight, layoutHeight) {
  if (!visualHeight || !layoutHeight) return false;
  return visualHeight / layoutHeight < 0.75;
}
