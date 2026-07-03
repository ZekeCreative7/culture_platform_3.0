import { state as vanillaState, subscribe } from '../state.js';
import { bindSurveyCreator, renderSurveyCreator } from '../views/survey.js';

export function mountSurveyCreator(element, { debounceMs = 150 } = {}) {
  if (!element) return () => {};

  vanillaState.activeView = 'survey';
  let disposed = false;
  let timer = null;

  function refresh() {
    if (disposed || !element) return;
    element.innerHTML = renderSurveyCreator();
    bindSurveyCreator();
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
