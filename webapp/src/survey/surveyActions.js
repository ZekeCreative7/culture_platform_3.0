import { state, saveState } from '../state.js';
import { getQrCodeFactory } from '../qrCode.js';

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

export function downloadQrCode(surveyId) {
  const survey = (state.surveys || []).find(s => s.id === surveyId);
  if (!survey) return;
  const link = survey.googleFormUrl
    ? survey.googleFormUrl
    : `${(state.qrBaseUrl || '').replace(/\/$/, '')}/survey.html?surveyId=${survey.id}`;

  try {
    const qr = getQrCodeFactory()(0, 'M');
    qr.addData(link);
    qr.make();

    const cellSize = 14;
    const margin = 4;
    const n = qr.getModuleCount();
    const size = (n + margin * 2) * cellSize;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000000';
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect((col + margin) * cellSize, (row + margin) * cellSize, cellSize, cellSize);
        }
      }
    }

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `QR_${survey.title.replace(/[^\w가-힣]/g, '_')}_${survey.phase}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    alert('QR 다운로드 실패: ' + (err?.message || err));
  }
}

// views/survey.js still renders onclick="..." string attributes, which only
// resolve against window.*, so keep these attached the same way app.js did.
window.copySurveyLink = copySurveyLink;
window.toggleClosedSurveysSection = toggleClosedSurveysSection;
window.toggleSurveyCard = toggleSurveyCard;
window.collapseAllSurveys = collapseAllSurveys;
window.downloadQrCode = downloadQrCode;
