import { subscribe } from '../state.js';
import { bindSessions, bindSessionDrawerControls } from '../app.js';
import { renderSessionsShell } from '../views/sessions.js';

function mountLegacyFragment(element, renderFragment, { debounceMs = 150 } = {}) {
  if (!element) return () => {};
  let disposed = false;
  let timer = null;

  function refresh() {
    if (disposed || !element) return;
    element.innerHTML = renderFragment();
    // bindSessions()/bindSessionDrawerControls() search the whole document,
    // not just this fragment, so calling both after either of the two
    // legacy fragments refreshes keeps every button across both bound.
    bindSessions();
    bindSessionDrawerControls();
  }

  refresh();

  const unsubscribe = subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(refresh, debounceMs);
  });

  return () => {
    disposed = true;
    clearTimeout(timer);
    unsubscribe();
    element.innerHTML = '';
  };
}

export function mountSessionsShell(element, options) {
  return mountLegacyFragment(element, renderSessionsShell, options);
}
