import './surveyActions.js';
import { subscribe } from '../state.js';
import { renderSurveyOrphanAndTemplates } from '../views/survey.js';

function mountLegacyFragment(element, renderFragment, { debounceMs = 150, afterRefresh } = {}) {
  if (!element) return () => {};
  let disposed = false;
  let timer = null;

  function refresh() {
    if (disposed || !element) return;
    element.innerHTML = renderFragment();
    afterRefresh?.();
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

export function mountSurveyOrphanAndTemplates(element, options) {
  return mountLegacyFragment(element, renderSurveyOrphanAndTemplates, options);
}
