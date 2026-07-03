import { subscribe } from '../state.js';
import { bindSessions, bindSessionDrawerControls } from '../app.js';
import { renderSessionsShell, renderSessionsOverlays } from '../views/sessions.js';
import { renderCalendar } from '../views/survey.js';

function mountLegacyFragment(element, renderFragment, { debounceMs = 150 } = {}) {
  if (!element) return () => {};
  let disposed = false;
  let timer = null;

  function refresh() {
    if (disposed || !element) return;
    element.innerHTML = renderFragment();
    // bindSessions()/bindSessionDrawerControls() search the whole document,
    // not just this fragment, so calling both after any one of the three
    // legacy fragments refreshes keeps every button across all three bound.
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

export function mountSessionsCalendar(element, options) {
  return mountLegacyFragment(element, renderCalendar, options);
}

export function mountSessionsOverlays(element, options) {
  return mountLegacyFragment(element, renderSessionsOverlays, options);
}
