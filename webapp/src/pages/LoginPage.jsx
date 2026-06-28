import React, { useState } from 'react';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../firebase.js';
import { db, addDoc, collection, serverTimestamp } from '../firebase.js';

function authError(code) {
  const c = code || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return '이메일 또는 비밀번호를 확인해 주세요.';
  if (c.includes('email-already-in-use')) return '이미 가입된 이메일입니다. 로그인해 주세요.';
  if (c.includes('invalid-email')) return '올바른 이메일 주소를 입력해 주세요.';
  if (c.includes('weak-password')) return '비밀번호를 8자 이상으로 설정해 주세요.';
  if (c.includes('too-many-requests')) return '로그인 시도가 많아 잠시 후 다시 시도해 주세요.';
  return '로그인 중 오류가 발생했습니다. 다시 시도해 주세요.';
}

export function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signupDone, setSignupDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    const trimEmail = email.trim().toLowerCase();
    if (!trimEmail || !password) { setError('이메일과 비밀번호를 입력해 주세요.'); return; }
    if (mode === 'signup' && password.length < 8) { setError('비밀번호를 8자 이상으로 설정해 주세요.'); return; }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { user } = await createUserWithEmailAndPassword(auth, trimEmail, password);
        // 승인 요청 Firestore 기록
        await addDoc(collection(db, 'accessRequests'), {
          uid: user.uid,
          email: trimEmail,
          status: 'pending',
          requestedAt: serverTimestamp(),
          organizationId: 'lina',
        });
        setSignupDone(true);
      } else {
        await signInWithEmailAndPassword(auth, trimEmail, password);
        // onAuthStateChanged가 useAuth를 통해 앱 상태를 업데이트함
      }
    } catch (err) {
      setError(authError(err.code || ''));
    } finally {
      setLoading(false);
    }
  }

  if (signupDone) {
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.logo}>조직문화 플랫폼</div>
          <p style={{ fontSize: 15, color: '#1d1d1f', marginBottom: 8, fontWeight: 500 }}>가입 신청 완료</p>
          <p style={{ fontSize: 13, color: '#6e6e73', lineHeight: 1.6 }}>
            관리자 승인 후 이용 가능합니다.<br />
            승인되면 이 화면에서 자동으로 접속됩니다.
          </p>
          <button style={styles.linkBtn} onClick={() => { setSignupDone(false); setMode('login'); }}>
            로그인으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.logo}>조직문화 플랫폼</div>
        <p style={styles.subtitle}>Lina Life Insurance</p>

        <form onSubmit={submit} style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="이메일"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
          />

          <div style={{ position: 'relative' }}>
            <input
              style={{ ...styles.input, paddingRight: 44 }}
              type={showPw ? 'text' : 'password'}
              placeholder="비밀번호"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              disabled={loading}
            />
            <button
              type="button"
              style={styles.eyeBtn}
              onClick={() => setShowPw(v => !v)}
              tabIndex={-1}
            >
              {showPw ? '숨김' : '표시'}
            </button>
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" style={styles.primaryBtn} disabled={loading}>
            {loading ? '처리 중...' : mode === 'signup' ? '가입 신청' : '로그인'}
          </button>
        </form>

        <button
          style={styles.linkBtn}
          onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(''); }}
          disabled={loading}
        >
          {mode === 'login' ? '계정이 없으신가요? 가입 신청' : '이미 계정이 있으신가요? 로그인'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f7',
    padding: 24,
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '40px 32px',
    width: '100%',
    maxWidth: 360,
    boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  logo: {
    fontSize: 18,
    fontWeight: 700,
    color: '#1d1d1f',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    fontSize: 13,
    color: '#6e6e73',
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 8,
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    border: '1px solid #d2d2d7',
    borderRadius: 10,
    fontSize: 15,
    color: '#1d1d1f',
    outline: 'none',
    background: '#fff',
    boxSizing: 'border-box',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    fontSize: 12,
    color: '#6e6e73',
    cursor: 'pointer',
    padding: '4px 6px',
  },
  error: {
    fontSize: 13,
    color: '#d32f2f',
    margin: 0,
  },
  primaryBtn: {
    width: '100%',
    padding: '12px 0',
    background: '#0071e3',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
    marginTop: 4,
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#0071e3',
    fontSize: 13,
    cursor: 'pointer',
    padding: 0,
    textAlign: 'center',
  },
};
