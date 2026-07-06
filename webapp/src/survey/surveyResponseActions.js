import {
  state,
  saveState,
  notify,
  surveyRows,
  rowMatchesSurvey,
  normalizeSurveyRecord,
  saveResponsesToFirestore,
  setSurveyDistributionActiveInFirestore,
  saveSurveyTemplateToFirestore,
  deleteSurveyTemplateFromFirestore,
  deleteResponseFromFirestore,
  fetchAllResponsesFromFirestore,
  updateSurveyInFirestore,
  deleteSurveyDocFromFirestore,
  subscribeResponsesFromFirestore,
  recordAuditLog,
} from '../state.js';
import { uid, sessionLabel, defaultQuestions } from '../utils.js';
import { parseCSV } from '../upload/csvParser.js';
import { ensureXlsxLoaded } from '../report/reportExport.js';
import { runDestructiveAction } from '../operational/destructiveAction.js';

export function uploadSurveyResults(surveyId) {
  const survey = (state.surveys || []).find((s) => s.id === surveyId);
  if (!survey) { alert('설문 정보를 찾을 수 없습니다.'); return; }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,text/csv';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const text = await file.text();
    await ensureXlsxLoaded();
    const { parsed, errors } = parseCSV(text, survey.sessionId, survey.phase);
    if (errors.length) {
      alert('CSV 오류:\n' + errors.join('\n'));
      return;
    }
    if (!confirm(`${file.name}\n\n${parsed.length}행의 응답을 저장할까요?\n세션: ${survey.title} [${survey.phase}]`)) return;
    const uploadedAt = new Date().toISOString();
    const enrichedRows = parsed.map((row) => ({
      ...row,
      surveyId: survey.id,
      distributionId: survey.distribution?.id || null,
      sourceType: 'CSV 업로드',
      uploadedAt,
    }));
    state.responses.push(...enrichedRows);
    saveState();
    saveResponsesToFirestore(enrichedRows).catch((e) => console.error('Firestore 저장 실패:', e));
  };
  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
}

export function downloadSurveyTemplate(surveyId) {
  const survey = state.surveys.find((s) => s.id === surveyId);
  const session = state.sessions.find((s) => s.id === survey?.sessionId);
  if (!survey) { alert('설문 정보를 찾을 수 없습니다.'); return; }
  const cohort = session ? session.cohort : 1;
  const yearLabel = session?.year ? `${session.year}년_` : '';
  const qCols = (survey.questions || []).filter((q) => q.type === 'quant').map((q) => q.id);
  if (qCols.length === 0) qCols.push(...['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8']);
  const headers = ['[기수]', ...qCols.map((q) => `[${q}]`)];
  const sampleRow = [cohort, ...qCols.map(() => '')];
  const csv = [headers.join(','), sampleRow.join(',')].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `설문응답_템플릿_${yearLabel}${cohort}기_${survey.phase}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export async function deleteSurvey(id) {
  const survey = (state.surveys || []).find((item) => item.id === id);
  if (!survey) return;
  const responseCount = surveyRows(survey).length;
  const before = JSON.parse(JSON.stringify(survey));
  const now = new Date().toISOString();
  return runDestructiveAction({
    title: '설문 배포를 종료할까요?',
    body: `"${survey.title}" 링크와 QR을 비활성화합니다.`,
    impact: [
      `기존 응답 ${responseCount}건은 삭제하지 않습니다.`,
      '문항별 응답과 분석 화면에서는 계속 확인할 수 있습니다.',
    ],
    applyLocal: () => {
      survey.status = 'closed';
      survey.distributionActive = false;
      survey.distribution = {
        ...(survey.distribution || {}),
        id: survey.distribution?.id || `distribution-${id}`,
        active: false,
        status: 'closed',
        closedAt: now,
        deletedAt: now,
      };
      saveState();
    },
    rollbackLocal: () => {
      Object.assign(survey, before);
      saveState();
    },
    persistRemote: async () => {
      await setSurveyDistributionActiveInFirestore(id, false);
      await recordAuditLog({
        action: 'survey_closed',
        targetId: id,
        targetType: 'survey',
        detail: `${survey.title || ''} · 응답 ${responseCount}건 보존`,
      });
    },
    onError: (e) => {
      console.error('Firestore 배포 종료 실패:', e);
      alert('서버 동기화에 실패해 배포 종료를 되돌렸습니다: ' + (e?.message || e));
    },
  });
}

export function reopenSurveyDistribution(id) {
  const survey = (state.surveys || []).find((item) => item.id === id);
  if (!survey) return;
  if (!confirm(`"${survey.title}" 설문 링크와 QR 배포를 다시 활성화할까요?`)) return;
  const now = new Date().toISOString();
  survey.status = 'active';
  survey.distributionActive = true;
  survey.distribution = {
    ...(survey.distribution || {}),
    id: survey.distribution?.id || `distribution-${id}`,
    active: true,
    status: 'active',
    publishedAt: now,
    closedAt: '',
    deletedAt: '',
  };
  saveState();
  setSurveyDistributionActiveInFirestore(id, true).catch((e) => {
    console.error('Firestore 배포 재개 실패:', e);
    alert('화면에서는 배포가 재개됐지만 서버 동기화에 실패했습니다: ' + e.message);
  });
}

export function saveSurveyAsTemplate(surveyId) {
  const survey = (state.surveys || []).find((s) => s.id === surveyId);
  if (!survey || !survey.questions || !survey.questions.length) { alert('해당 설문에 질문이 없습니다.'); return; }
  if (!state.surveyTemplates) state.surveyTemplates = [];
  const templateData = {
    title: survey.title,
    sessionType: survey.sessionType || '',
    phase: survey.phase || '',
    questions: JSON.parse(JSON.stringify(survey.questions)),
  };
  const newId = uid();
  state.surveyTemplates.push({ ...templateData, id: newId });
  saveState();
  saveSurveyTemplateToFirestore(newId, templateData).catch((e) => {
    console.error('Firestore 템플릿 저장 실패:', e);
    alert('템플릿이 저장됐지만 서버 동기화에 실패했습니다: ' + e.message);
  });
  alert(`"${survey.title}"을(를) 템플릿으로 저장했습니다. 이제 이 설문을 지워도 템플릿은 남습니다.`);
}

export function deleteSurveyTemplate(id) {
  if (!confirm('이 템플릿을 삭제하시겠습니까?')) return;
  state.surveyTemplates = (state.surveyTemplates || []).filter((t) => t.id !== id);
  saveState();
  deleteSurveyTemplateFromFirestore(id).catch((e) => console.error('Firestore 템플릿 삭제 실패:', e));
}

export async function resetSurveyResponses(id) {
  const survey = (state.surveys || []).find((s) => s.id === id);
  if (!survey) return;
  const rows = surveyRows(survey);
  if (!rows.length) { alert('리셋할 응답 데이터가 없습니다.'); return; }
  const previousResponses = state.responses || [];
  const removedIds = new Set(rows.map((r) => r.id));
  return runDestructiveAction({
    title: '설문 응답을 완전 삭제할까요?',
    body: `"${survey.title}"의 링크/QR 응답과 업로드 결과 ${rows.length}건을 DB에서 삭제합니다.`,
    impact: [
      '배포 종료와 달리 응답 데이터가 사라집니다.',
      '서버 삭제가 성공한 뒤 화면에서 제거합니다.',
    ],
    persistRemote: async () => {
      await Promise.all(rows.map((r) => deleteResponseFromFirestore(r.id, { throwOnError: true })));
      await recordAuditLog({
        action: 'survey_responses_reset',
        targetId: id,
        targetType: 'survey',
        detail: `${survey.title || ''} · ${rows.length}건 삭제`,
      });
    },
    onSuccess: () => {
      state.responses = previousResponses.filter((r) => !removedIds.has(r.id));
      saveState();
    },
    onError: (e) => {
      console.error('Firestore 응답 삭제 실패:', e);
      alert('서버 삭제에 실패해 화면 데이터는 유지했습니다: ' + (e?.message || e));
    },
  });
}

function orphanGroupKey(row) {
  return row.surveyId || `legacy:${row.sessionId || ''}|${row.phase || ''}|${Number(row.cohort) || 0}`;
}

export async function scanForOrphanResponses() {
  state.orphanScanLoading = true;
  state.orphanScanError = '';
  notify();
  try {
    const allRows = await fetchAllResponsesFromFirestore();
    const currentSurveys = state.surveys || [];
    const groups = new Map();
    allRows.forEach((row) => {
      // A row is only truly orphaned if no current survey would already surface it —
      // checking surveyId alone misses legacy rows with no surveyId tag that still
      // match a live survey via the sessionId/phase/cohort fallback, which would
      // otherwise get duplicated into a second "recovered" card for the same slot.
      if (currentSurveys.some((survey) => rowMatchesSurvey(row, survey))) return;
      const key = orphanGroupKey(row);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });

    state.orphanScanResult = Array.from(groups.entries()).map(([key, rows]) => {
      const sample = rows[0];
      const session = state.sessions.find((s) => s.id === sample.sessionId);
      const dates = rows.map((r) => r.createdAt).filter(Boolean).sort();
      const uploaded = rows.filter((r) => String(r.sourceType || '').includes('업로드')).length;
      return {
        key,
        surveyId: sample.surveyId || '',
        sessionId: sample.sessionId || '',
        phase: sample.phase || '',
        cohort: Number(sample.cohort) || 0,
        sessionLabel: session ? `${session.type} · ${sessionLabel(session)}` : (sample.sessionId ? '삭제된 세션' : '세션 정보 없음'),
        count: rows.length,
        uploadedCount: uploaded,
        linkedCount: rows.length - uploaded,
        firstAt: dates[0] || '',
        lastAt: dates[dates.length - 1] || '',
      };
    }).sort((a, b) => b.count - a.count);
  } catch (e) {
    console.error('고아 응답 스캔 실패:', e);
    state.orphanScanError = e.message || String(e);
  } finally {
    state.orphanScanLoading = false;
    saveState();
  }
}

function dedupeKeyForGroup(group) {
  return `${group.sessionId}|${group.phase}|${group.cohort}`;
}

// Multiple orphan groups can share the same session+phase+cohort (e.g. a survey was
// deleted and recreated more than once, leaving several old surveyIds behind for the
// same logical survey slot). surveyRows()'s sessionId/phase/cohort fallback already
// pulls every matching row into whichever single survey we recover for that slot, so
// recovering more than one card per slot would just split the same responses across
// duplicate cards. Keep only the group with the most recent activity per slot.
function dedupeOrphanGroups(groups) {
  const bySlot = new Map();
  groups.forEach((group) => {
    const slotKey = dedupeKeyForGroup(group);
    const existing = bySlot.get(slotKey);
    if (!existing || (group.lastAt || '') > (existing.lastAt || '')) {
      bySlot.set(slotKey, group);
    }
  });
  return Array.from(bySlot.values());
}

function buildRecoveredSurveyFromGroup(group) {
  const now = new Date().toISOString();
  const id = group.surveyId || uid();
  return normalizeSurveyRecord({
    id,
    title: `복구된 설문 (${group.phase || '단계 미상'} · ${group.sessionLabel})`,
    sessionId: group.sessionId,
    sessionCohort: group.cohort,
    phase: group.phase,
    questions: defaultQuestions(group.phase || '사후'),
    status: 'closed',
    recoveredAt: now,
    distribution: { id: `distribution-${id}`, active: false, status: 'closed', publishedAt: '', closedAt: now, deletedAt: now },
  });
}

export function recoverOrphanSurvey(key) {
  const group = (state.orphanScanResult || []).find((g) => g.key === key);
  if (!group) return;
  if (!confirm(`이 데이터(${group.count}건)를 "배포 종료 · 응답 보관" 목록에 설문으로 복구할까요?\n\n응답 자체는 이미 안전하게 보관되어 있었고, 이 작업은 그 응답을 다시 볼 수 있도록 설문 카드만 새로 만듭니다.`)) return;
  const survey = buildRecoveredSurveyFromGroup(group);
  const slotKey = dedupeKeyForGroup(group);
  state.surveys = [...(state.surveys || []), survey];
  // Drop every orphan group for this same session+phase+cohort, not just the one clicked —
  // they'll all show up under this one recovered card via the legacy fallback match.
  state.orphanScanResult = (state.orphanScanResult || []).filter((g) => dedupeKeyForGroup(g) !== slotKey);
  saveState();
  subscribeResponsesFromFirestore({ force: true });
  updateSurveyInFirestore(survey.id, survey).catch((e) => {
    console.error('Firestore 복구 설문 저장 실패:', e);
    alert('화면에는 복구됐지만 서버 저장에 실패했습니다: ' + e.message);
  });
}

export function recoverAllOrphanSurveys() {
  const groups = state.orphanScanResult || [];
  if (!groups.length) return;
  const deduped = dedupeOrphanGroups(groups);
  const skipped = groups.length - deduped.length;
  if (!confirm(`연결 끊긴 응답 그룹 ${groups.length}개 중, 같은 세션·단계로 중복된 ${skipped}개는 가장 최근 응답 기준으로 합쳐서 총 ${deduped.length}개의 설문으로 복구합니다.\n\n전체 복구할까요?`)) return;
  const newSurveys = deduped.map(buildRecoveredSurveyFromGroup);
  state.surveys = [...(state.surveys || []), ...newSurveys];
  state.orphanScanResult = [];
  saveState();
  subscribeResponsesFromFirestore({ force: true });
  Promise.all(newSurveys.map((survey) => updateSurveyInFirestore(survey.id, survey))).catch((e) => {
    console.error('Firestore 전체 복구 저장 실패:', e);
    alert('화면에는 복구됐지만 일부 서버 저장에 실패했습니다: ' + e.message);
  });
}

export function deleteRecoveredSurveyCard(id) {
  const survey = (state.surveys || []).find((s) => s.id === id);
  if (!survey) return;
  if (!confirm(`"${survey.title}" 카드를 목록에서 지울까요?\n\n카드만 지워지고 원본 응답 데이터는 전혀 삭제되지 않습니다. 결과는 Change(변화 분석) 화면에서 세션·단계로 계속 조회할 수 있습니다.`)) return;
  state.surveys = (state.surveys || []).filter((s) => s.id !== id);
  saveState();
  subscribeResponsesFromFirestore({ force: true });
  deleteSurveyDocFromFirestore(id).catch((e) => {
    console.error('Firestore 설문 카드 삭제 실패:', e);
    alert('화면에는 지워졌지만 서버 삭제에 실패했습니다: ' + e.message);
  });
}
