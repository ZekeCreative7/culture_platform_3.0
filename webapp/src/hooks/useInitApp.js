/**
 * useInitApp — React 앱에서 Firestore 데이터 로딩을 시작하는 훅.
 *
 * 인증이 완료된 직후 한 번만 실행되며, 이후 Firestore 리스너가
 * state.js의 notify()를 통해 Zustand 스토어를 자동으로 동기화한다.
 *
 * 바닐라 app.js의 initApp()에 해당하는 역할이지만 render()를 호출하지 않는다.
 */
import { useEffect, useRef } from 'react';
import {
  state as vanillaState,
  saveOrgData,
  saveState,
  subscribeSessionsFromFirestore,
  subscribeSurveysFromFirestore,
  subscribeSurveyTemplatesFromFirestore,
  subscribeOrganizationFromFirestore,
  subscribePulseYearsFromFirestore,
  subscribePulseCommitmentsFromFirestore,
  subscribeQualSignalsFromFirestore,
  subscribeResponsesFromFirestore,
  syncSurveysToSessions,
  setDbStatus,
  pulseCache,
  commitmentsCache,
} from '../state.js';
import { setCurrentOrgId } from '../auth/currentAuthContext.js';

if (window.location.search.includes('preview=1')) {
  sessionStorage.setItem('previewMode', 'true');
} else if (window.location.search.includes('preview=0')) {
  sessionStorage.removeItem('previewMode');
}

const LOCAL_PREVIEW = window.location.search.includes('preview=1')
  || sessionStorage.getItem('previewMode') === 'true';

export function useInitApp(isAuthenticated, orgId) {
  const initializedKey = useRef('');
  const unsubs = useRef([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const nextOrgId = orgId || 'lina';
    const nextKey = `${LOCAL_PREVIEW ? 'preview' : 'live'}:${nextOrgId}`;
    if (initializedKey.current === nextKey) return;
    initializedKey.current = nextKey;

    setCurrentOrgId(nextOrgId);

    (async () => {
      if (LOCAL_PREVIEW) {
        // 로컬 미리보기 모드: Firebase 호출 우회 및 로컬 데이터 시딩
        const ORG_DATA_VERSION = 6;
        const orgNeedsSeed = !vanillaState.orgUnits || vanillaState.orgUnits.length < 10
          || !vanillaState.orgMembers || vanillaState.orgMembers.length < 10
          || (vanillaState.orgDataVersion || 0) < ORG_DATA_VERSION;
        if (orgNeedsSeed) {
          try {
            const { default: orgData } = await import('../org_data.json');
            vanillaState.orgUnits = orgData.units;
            vanillaState.orgMembers = orgData.members;
            vanillaState.orgDataVersion = orgData.version || ORG_DATA_VERSION;
            const ceo = vanillaState.orgUnits.find(u => u.level === 'company');
            if (ceo) {
              vanillaState.selectedCompany = ceo.id;
            }
            saveOrgData();
            saveState();
          } catch (e) {
            console.error('[useInitApp] 로컬 데이터 시딩 실패:', e);
          }
        }
        vanillaState.sessionsLoaded = true;
        vanillaState.surveysLoaded = true;
        vanillaState.responsesLoaded = true;
        pulseCache.loaded = true;
        pulseCache.loading = false;
        pulseCache.error = "";
        pulseCache.fromCache = false;
        commitmentsCache.loaded = true;
        commitmentsCache.loading = false;
        setDbStatus('connected');
        return;
      }

      unsubs.current = [
        subscribeSessionsFromFirestore(() => {
          syncSurveysToSessions();
          // 세션 목록 변경 시 responses 구독도 재설정 (세션 추가/삭제 반영)
          subscribeResponsesFromFirestore();
        }),
        subscribeSurveysFromFirestore(() => {
          syncSurveysToSessions();
          subscribeResponsesFromFirestore();
        }),
        subscribeSurveyTemplatesFromFirestore(),
        subscribeOrganizationFromFirestore(),
        subscribePulseYearsFromFirestore(),
        subscribePulseCommitmentsFromFirestore(),
        subscribeQualSignalsFromFirestore(),
        subscribeResponsesFromFirestore({ force: true }),
      ].filter(Boolean);

      // 각 subscribe 함수의 첫 스냅샷이 초기 로드 역할을 겸한다.
      // 세션/설문 스냅샷이 도착하면 콜백에서 responses 구독도 재설정된다.
    })();

    return () => {
      unsubs.current.forEach(fn => fn?.());
      unsubs.current = [];
      initializedKey.current = '';
    };
  }, [isAuthenticated, orgId]);
}
