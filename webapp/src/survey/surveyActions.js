import { state, saveState } from '../state.js';

export function copySurveyLink(link) {
  const tempInput = document.createElement("input");
  tempInput.value = link;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand("copy");
  document.body.removeChild(tempInput);
  alert("설문 링크가 복사되었습니다!");
}

export function toggleClosedSurveysSection() {
  state.closedSurveysCollapsed = !state.closedSurveysCollapsed;
  saveState();
}

export function toggleSurveyCard(id) {
  state.collapsedSurveyIds = state.collapsedSurveyIds || [];
  const idx = state.collapsedSurveyIds.indexOf(id);
  if (idx >= 0) state.collapsedSurveyIds.splice(idx, 1);
  else state.collapsedSurveyIds.push(id);
  saveState();
}

export function collapseAllSurveys(collapse) {
  const ids = (state.surveys || []).map(s => s.id);
  state.collapsedSurveyIds = collapse ? ids : [];
  saveState();
}

// views/survey.js still renders onclick="..." string attributes, which only
// resolve against window.*, so keep these attached the same way app.js did.
window.copySurveyLink = copySurveyLink;
window.toggleClosedSurveysSection = toggleClosedSurveysSection;
window.toggleSurveyCard = toggleSurveyCard;
window.collapseAllSurveys = collapseAllSurveys;
