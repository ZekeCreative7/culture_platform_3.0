import React, { useState } from 'react';
import { auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../firebase.js';
import { doc, writeBatch, serverTimestamp } from '../firebase.js';

function authError(code) {
  const c = code || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return '이메일 또는 비밀번호를 확인해 주세요.';
  if (c.includes('email-already-in-use')) return '이미 가입된 이메일입니다. 로그인해 주세요.';
  if (c.includes('invalid-email')) return '올바른 이메일 주소를 입력해 주세요.';
  if (c.includes('weak-password')) return '비밀번호를 8자 이상으로 설정해 주세요.';
  if (c.includes('too-many-requests')) return '로그인 시도가 많아 잠시 후 다시 시도해 주세요.';
  if (c.includes('network-request-failed')) return '네트워크 연결을 확인해 주세요.';
  if (c.includes('configuration-not-found') || c.includes('operation-not-allowed')) return 'Firebase Authentication 설정을 확인해 주세요.';
  return '오류가 발생했습니다. 다시 시도해 주세요.';
}

const INITIAL_STATUS = {
  tone: 'ready',
  title: '로그인하거나 새 계정을 만들어 주세요.',
  detail: '회원가입 후 관리자 승인이 완료되면 접속할 수 있습니다.',
  spinner: false,
};

export function LoginPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(INITIAL_STATUS);

  async function submit(e) {
    e.preventDefault();
    const trimEmail = email.trim().toLowerCase();
    if (!trimEmail || !password) {
      setStatus({ tone: 'error', title: '이메일과 비밀번호를 모두 입력해 주세요.' });
      return;
    }
    if (mode === 'signup' && password.length < 8) {
      setStatus({ tone: 'error', title: '비밀번호는 8자 이상으로 설정해 주세요.' });
      return;
    }

    setLoading(true);
    setStatus({
      tone: 'checking',
      title: mode === 'signup' ? '회원 계정을 만들고 있습니다.' : '로그인 중입니다.',
      detail: '잠시만 기다려 주세요.',
      spinner: true,
    });

    try {
      if (mode === 'signup') {
        const { user } = await createUserWithEmailAndPassword(auth, trimEmail, password);
        const batch = writeBatch(db);
        batch.set(doc(db, 'accessRequests', user.uid), {
          uid: user.uid,
          email: trimEmail,
          status: 'pending',
          organizationId: 'lina',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.set(doc(db, 'mail', user.uid), {
          requestUid: user.uid,
          requesterEmail: trimEmail,
          to: ['zekedesign7@gmail.com'],
          message: {
            subject: '[Lina Culture Platform] 새로운 회원 승인 요청',
            text: `새로운 회원 승인 요청이 도착했습니다.\n\n요청 이메일: ${trimEmail}\n\n관리자 계정으로 Lina Culture Platform에 로그인한 뒤 '회원 승인'에서 확인해 주세요.`,
          },
          createdAt: serverTimestamp(),
        });
        await batch.commit();
        // useAuth의 onAuthStateChanged가 pending 상태를 처리함
      } else {
        await signInWithEmailAndPassword(auth, trimEmail, password);
        // useAuth의 onAuthStateChanged가 승인 확인 후 앱 진입 처리
      }
    } catch (err) {
      setLoading(false);
      setStatus({ tone: 'error', title: authError(err.code || '') });
    }
  }

  function switchMode() {
    setMode(m => m === 'login' ? 'signup' : 'login');
    setStatus(INITIAL_STATUS);
  }

  return (
    <div className="auth-gate">
      <div className="auth-gate-backdrop" />
      <div className="auth-shell">
        <div
          className="auth-visual"
          style={{ background: 'linear-gradient(170deg, #060f26 0%, #0a2252 55%, #0d3a82 100%)' }}
        >
          <div className="auth-visual-caption">
            <span>조직문화 분석 플랫폼</span>
            <strong>조직의 변화를<br />데이터로 읽습니다</strong>
          </div>
        </div>

        <div className="auth-panel">
          <div className="auth-brand-row">
            <img src="./assets/lina_logo_square.png" alt="" />
            <span>Lina Life Insurance</span>
          </div>
          <div className="auth-copy">
            <span className="auth-eyebrow">조직문화 운영 플랫폼</span>
            <h1>안녕하세요.</h1>
            <p>Lina Life Insurance 조직문화 운영 전용 플랫폼입니다.<br />인가된 계정으로 로그인하거나 가입을 신청해 주세요.</p>
          </div>

          <form className="auth-form" onSubmit={submit}>
            <label htmlFor="lp-email">이메일</label>
            <input
              id="lp-email"
              type="email"
              placeholder="이메일 주소 입력"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
            />

            <label htmlFor="lp-password">비밀번호</label>
            <div className="auth-password-field">
              <input
                id="lp-password"
                type={showPw ? 'text' : 'password'}
                placeholder={mode === 'signup' ? '8자 이상 입력' : '비밀번호 입력'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                tabIndex={-1}
                aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
              >
                {showPw ? '숨김' : '보기'}
              </button>
            </div>

            <div className="auth-actions">
              <button type="submit" className="auth-primary" disabled={loading}>
                {loading ? '처리 중...' : mode === 'login' ? '로그인' : '가입 신청'}
              </button>
              <button
                type="button"
                className="auth-secondary"
                onClick={switchMode}
                disabled={loading}
              >
                {mode === 'login' ? '가입 신청' : '로그인으로'}
              </button>
            </div>

            <div className={`auth-status${status.tone ? ' ' + status.tone : ''}`}>
              {status.spinner
                ? <span className="auth-spinner" aria-hidden="true" />
                : <span className="auth-status-mark" aria-hidden="true" />
              }
              <div>
                <strong>{status.title}</strong>
                {status.detail && <span>{status.detail}</span>}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
