import React, { useEffect, useRef, memo } from 'react';
import { state as vanillaState } from '../state.js';
import { renderSessions } from '../views/sessions.js';

/**
 * Sessions 페이지 — "hand-off to vanilla" 패턴
 *
 * React.memo(() => true) 로 re-render를 차단합니다.
 * 마운트 시 renderSessions() + bindSessions() 를 1회 실행하고,
 * 이후 모든 DOM 업데이트는 bindSessions 내 34개 render() 호출이 직접 처리합니다.
 * 언마운트(다른 뷰로 이동) 후 다시 세션 뷰로 돌아오면 재마운트되어 초기화됩니다.
 */
export const SessionsPage = memo(function SessionsPage() {
  const divRef = useRef(null);

  useEffect(() => {
    vanillaState.activeView = 'sessions';
    if (divRef.current) {
      divRef.current.innerHTML = renderSessions();
      requestAnimationFrame(() => {
        window.__vanillaBindCanvas?.();
      });
    }
  }, []);

  return <div ref={divRef} />;
}, () => true); // always skip re-render; vanilla owns the DOM
