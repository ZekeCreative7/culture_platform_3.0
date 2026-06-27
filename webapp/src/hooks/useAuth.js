/**
 * 1단계: useAuth 훅
 *
 * Firebase Auth 상태를 React에서 구독합니다.
 * 기존 authGate.js의 Firestore 승인 로직은 건드리지 않고,
 * React 컴포넌트가 인증 상태를 읽을 수 있는 인터페이스만 제공합니다.
 *
 * 실제 로그인/승인 플로우는 3단계에서 AuthGate 페이지를 이전할 때
 * authGate.js 내부 로직을 이 훅 안으로 흡수합니다.
 */

import { useState, useEffect } from 'react';
import { auth, onAuthStateChanged, signOut } from '../firebase.js';
import { getDoc, doc, db } from '../firebase.js';

const MASTER_EMAIL = 'rhokoo7@naver.com';

/**
 * @returns {{
 *   user: import('firebase/auth').User | null,
 *   status: 'loading' | 'unauthenticated' | 'pending' | 'granted',
 *   isLoading: boolean,
 *   isAuthenticated: boolean,
 *   isMaster: boolean,
 *   orgId: string,
 *   logout: () => Promise<void>,
 * }}
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const [orgId, setOrgId] = useState('lina');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setStatus('unauthenticated');
        return;
      }

      setUser(firebaseUser);

      // 마스터 계정은 즉시 승인
      if (firebaseUser.email?.toLowerCase() === MASTER_EMAIL) {
        setStatus('granted');
        setOrgId(window.__currentOrgId || 'lina');
        return;
      }

      // 일반 계정: Firestore accessRequests 문서로 승인 여부 확인
      try {
        const snap = await getDoc(doc(db, 'accessRequests', firebaseUser.uid));
        const data = snap.data();
        if (data?.status === 'approved') {
          setOrgId(data.organizationId || 'lina');
          setStatus('granted');
        } else {
          setStatus('pending');
        }
      } catch {
        setStatus('pending');
      }
    });

    return () => unsubscribe();
  }, []);

  return {
    user,
    status,
    isLoading: status === 'loading',
    isAuthenticated: status === 'granted',
    isMaster: user?.email?.toLowerCase() === MASTER_EMAIL,
    orgId,
    logout: () => signOut(auth),
  };
}
