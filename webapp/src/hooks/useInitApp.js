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
  loadSessionsFromFirestore,
  loadSurveysFromFirestore,
  loadSurveyTemplatesFromFirestore,
  subscribeSessionsFromFirestore,
  subscribeOrganizationFromFirestore,
  subscribePulseYearsFromFirestore,
  subscribePulseCommitmentsFromFirestore,
  syncSurveysToSessions,
  setDbStatus,
} from '../state.js';

export function useInitApp(isAuthenticated, orgId) {
  const initialized = useRef(false);
  const unsubs = useRef([]);

  useEffect(() => {
    if (!isAuthenticated || initialized.current) return;
    initialized.current = true;

    // orgId를 전역에 등록 — state.js의 getCurrentOrgId()가 참조함
    if (orgId) window.__currentOrgId = orgId;

    (async () => {
      try {
        // 초기 일괄 로드 (sessions + surveys + templates)
        await Promise.all([
          loadSessionsFromFirestore(),
          loadSurveysFromFirestore(),
          loadSurveyTemplatesFromFirestore(),
        ]);
        syncSurveysToSessions();
      } catch (e) {
        console.error('[useInitApp] 초기 로드 실패:', e);
        setDbStatus('error');
        return;
      }

      // 실시간 구독 시작
      // 각 subscribe 함수는 내부적으로 saveState() → notify() 와
      // setDbStatus('connected') → notify() 를 호출하므로
      // Zustand 동기화 및 손오프 페이지 디바운스 refresh가 자동으로 트리거된다.
      // 초기 로드 완료 후 responses 구독 시작
      window.updateResponsesSubscription?.();

      unsubs.current = [
        subscribeSessionsFromFirestore(() => {
          syncSurveysToSessions();
          // 세션 목록 변경 시 responses 구독도 재설정 (세션 추가/삭제 반영)
          window.updateResponsesSubscription?.();
        }),
        subscribeOrganizationFromFirestore(),
        subscribePulseYearsFromFirestore(),
        subscribePulseCommitmentsFromFirestore(),
      ].filter(Boolean);
    })();

    return () => {
      unsubs.current.forEach(fn => fn?.());
      unsubs.current = [];
    };
  }, [isAuthenticated, orgId]);
}
