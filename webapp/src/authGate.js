import {
  auth, db, collection, doc, getDoc, getDocs, setDoc, onSnapshot, serverTimestamp, writeBatch,
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut
} from './firebase.js?v=20260622-csv-upload-xlsx-load-fix-v1';

export const MASTER_EMAIL = 'rhokoo7@naver.com';

let currentUser = null;
let accessGrantedUid = '';
let pendingUnsubscribe = null;
let onAccessGrantedHandler = null;

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function isMaster(user = currentUser) {
  return String(user?.email || '').toLowerCase() === MASTER_EMAIL;
}

function friendlyAuthError(error) {
  const code = String(error?.code || '');
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return '이메일 또는 비밀번호를 확인해 주세요.';
  if (code.includes('email-already-in-use')) return '이미 가입된 이메일입니다. 로그인해 주세요.';
  if (code.includes('invalid-email')) return '올바른 이메일 주소를 입력해 주세요.';
  if (code.includes('weak-password')) return '비밀번호를 8자 이상으로 설정해 주세요.';
  if (code.includes('too-many-requests')) return '로그인 시도가 많아 잠시 보호 중입니다. 잠시 후 다시 시도해 주세요.';
  if (code.includes('network-request-failed')) return '네트워크 연결이 원활하지 않습니다. 연결을 확인한 뒤 다시 시도해 주세요.';
  if (code.includes('configuration-not-found')) return 'Firebase Authentication 설정이 아직 완료되지 않았습니다. Firebase Console에서 Authentication을 시작하고 이메일/비밀번호 로그인을 활성화해 주세요.';
  if (code.includes('operation-not-allowed')) return 'Firebase에서 이메일 로그인이 아직 활성화되지 않았습니다.';
  if (code.includes('permission-denied')) return '승인 정보를 확인할 권한이 없습니다. Firestore 보안 규칙을 확인해 주세요.';
  return error?.message ? `접속 처리 중 오류가 발생했습니다. (${error.message})` : '접속 처리 중 오류가 발생했습니다.';
}

function setStatus({ tone = 'checking', title, detail = '', spinner = false }) {
  const status = $('#auth-status');
  if (!status) return;
  status.className = `auth-status ${tone}`;
  status.innerHTML = `${spinner ? '<span class="auth-spinner" aria-hidden="true"></span>' : '<span class="auth-status-mark" aria-hidden="true"></span>'}<div><strong>${escapeHtml(title)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ''}</div>`;
}

function setGateMode(mode) {
  const isBusy = mode === 'busy';
  const isPending = mode === 'pending';
  $('#auth-form')?.classList.toggle('is-hidden', isPending);
  const switchButton = $('#auth-switch-account');
  if (switchButton) switchButton.hidden = !isPending;
  ['#auth-email', '#auth-password', '#auth-login', '#auth-signup', '#auth-password-toggle'].forEach((selector) => {
    const element = $(selector);
    if (element) element.disabled = isBusy;
  });
}

function showGate() {
  document.body.classList.add('auth-locked');
  $('#auth-gate')?.classList.remove('is-hidden');
}

function hideGate() {
  $('#auth-gate')?.classList.add('is-hidden');
  document.body.classList.remove('auth-locked');
}

function clearPendingListener() {
  if (pendingUnsubscribe) pendingUnsubscribe();
  pendingUnsubscribe = null;
}

async function ensurePendingRequest(user) {
  const requestRef = doc(db, 'accessRequests', user.uid);
  const snapshot = await getDoc(requestRef);
  if (!snapshot.exists()) {
    const batch = writeBatch(db);
    batch.set(requestRef, {
      uid: user.uid,
      email: user.email || '',
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    batch.set(doc(db, 'mail', user.uid), {
      requestUid: user.uid,
      requesterEmail: user.email || '',
      to: ['zekedesign7@gmail.com'],
      message: {
        subject: '[Lina Culture Platform] 새로운 회원 승인 요청',
        text: `새로운 회원 승인 요청이 도착했습니다.\n\n요청 이메일: ${user.email || '확인 불가'}\n\n관리자 계정으로 Lina Culture Platform에 로그인한 뒤 '회원 승인'에서 확인해 주세요.`
      },
      createdAt: serverTimestamp()
    });
    await batch.commit();
  }
  return requestRef;
}

async function grantAccess(user) {
  if (accessGrantedUid === user.uid) return;
  accessGrantedUid = user.uid;
  clearPendingListener();
  setGateMode('busy');
  setStatus({
    title: '승인이 확인되었습니다. 접속 중입니다.',
    detail: '조직문화 운영 데이터와 화면을 안전하게 불러오고 있습니다.',
    spinner: true
  });
  try {
    await onAccessGrantedHandler?.(user);
    hideGate();
    syncAuthControls();
  } catch (error) {
    accessGrantedUid = '';
    showGate();
    setGateMode('login');
    setStatus({ tone: 'error', title: '플랫폼 데이터를 불러오지 못했습니다.', detail: friendlyAuthError(error) });
  }
}

async function checkAccess(user) {
  if (isMaster(user)) {
    await grantAccess(user);
    return;
  }

  setGateMode('busy');
  setStatus({ title: '승인 상태를 확인하고 있습니다.', detail: '네트워크 상태에 따라 잠시 시간이 걸릴 수 있습니다.', spinner: true });
  const requestRef = await ensurePendingRequest(user);
  const snapshot = await getDoc(requestRef);
  if (snapshot.data()?.status === 'approved') {
    await grantAccess(user);
    return;
  }

  setGateMode('pending');
  setStatus({
    tone: 'pending',
    title: '관리자 승인 대기 중입니다.',
    detail: `${user.email || '가입 계정'}으로 신청되었습니다. 승인되면 이 화면에서 자동으로 접속됩니다.`
  });
  clearPendingListener();
  pendingUnsubscribe = onSnapshot(requestRef, (nextSnapshot) => {
    if (nextSnapshot.data()?.status === 'approved') grantAccess(user);
  }, (error) => {
    setStatus({ tone: 'error', title: '승인 상태를 확인하지 못했습니다.', detail: friendlyAuthError(error) });
  });
}

async function submitAuth(mode) {
  const email = String($('#auth-email')?.value || '').trim().toLowerCase();
  const password = String($('#auth-password')?.value || '');
  if (!email || !password) {
    setStatus({ tone: 'error', title: '이메일과 비밀번호를 모두 입력해 주세요.' });
    return;
  }
  if (mode === 'signup' && password.length < 8) {
    setStatus({ tone: 'error', title: '비밀번호는 8자 이상으로 설정해 주세요.' });
    return;
  }

  setGateMode('busy');
  setStatus({
    title: mode === 'signup' ? '회원 계정을 만들고 있습니다.' : '로그인 중입니다.',
    detail: '창을 닫지 말고 잠시만 기다려 주세요.',
    spinner: true
  });
  try {
    if (mode === 'signup') await createUserWithEmailAndPassword(auth, email, password);
    else await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    setGateMode('login');
    setStatus({ tone: 'error', title: friendlyAuthError(error) });
  }
}

async function logout() {
  clearPendingListener();
  accessGrantedUid = '';
  currentUser = null;
  await signOut(auth);
}

function bindGateControls() {
  $('#auth-login')?.addEventListener('click', () => submitAuth('login'));
  $('#auth-signup')?.addEventListener('click', () => submitAuth('signup'));
  $('#auth-switch-account')?.addEventListener('click', logout);
  $('#auth-password')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitAuth('login');
  });
  $('#auth-password-toggle')?.addEventListener('click', () => {
    const input = $('#auth-password');
    if (!input) return;
    const reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    $('#auth-password-toggle').textContent = reveal ? '숨김' : '보기';
    $('#auth-password-toggle').setAttribute('aria-label', reveal ? '비밀번호 숨기기' : '비밀번호 보기');
  });
}

export function syncAuthControls() {
  const emailLabel = $('#signed-in-email');
  if (emailLabel) emailLabel.textContent = currentUser?.email || '';
  const adminButton = $('#access-admin-button');
  if (adminButton) adminButton.hidden = !isMaster();
  if (adminButton && !adminButton.dataset.authBound) {
    adminButton.dataset.authBound = 'true';
    adminButton.addEventListener('click', openAccessAdmin);
  }
  const logoutButton = $('#auth-logout-button');
  if (logoutButton && !logoutButton.dataset.authBound) {
    logoutButton.dataset.authBound = 'true';
    logoutButton.addEventListener('click', logout);
  }
}

function formatTimestamp(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('ko-KR') : '방금 전';
}

async function approveUser(uid) {
  if (!isMaster()) return;
  const requestRef = doc(db, 'accessRequests', uid);
  const snapshot = await getDoc(requestRef);
  if (!snapshot.exists()) return;
  await setDoc(requestRef, {
    ...snapshot.data(),
    status: 'approved',
    approvedAt: serverTimestamp(),
    approvedBy: currentUser.email,
    updatedAt: serverTimestamp()
  });
  await loadAccessRequests();
}

async function loadAccessRequests() {
  const list = $('#access-request-list');
  if (!list || !isMaster()) return;
  list.innerHTML = '<div class="access-admin-loading"><span class="auth-spinner"></span>가입 요청을 불러오는 중입니다.</div>';
  try {
    const snapshot = await getDocs(collection(db, 'accessRequests'));
    const requests = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => String(item.email || '').toLowerCase() !== MASTER_EMAIL)
      .sort((a, b) => String(b.createdAt?.seconds || '').localeCompare(String(a.createdAt?.seconds || '')));
    list.innerHTML = requests.length ? requests.map((request) => `
      <article class="access-request-card">
        <div><strong>${escapeHtml(request.email || '이메일 없음')}</strong><span>${escapeHtml(formatTimestamp(request.createdAt))}</span></div>
        <span class="access-status ${request.status === 'approved' ? 'approved' : 'pending'}">${request.status === 'approved' ? '승인 완료' : '승인 대기'}</span>
        ${request.status === 'approved' ? '' : `<button type="button" data-approve-uid="${escapeHtml(request.id)}">접속 승인</button>`}
      </article>`).join('') : '<div class="access-admin-empty">현재 승인 대기 중인 계정이 없습니다.</div>';
    list.querySelectorAll('[data-approve-uid]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = '승인 중...';
        try { await approveUser(button.dataset.approveUid); }
        catch (error) {
          button.disabled = false;
          button.textContent = '다시 시도';
          alert(friendlyAuthError(error));
        }
      });
    });
  } catch (error) {
    list.innerHTML = `<div class="access-admin-empty error">${escapeHtml(friendlyAuthError(error))}</div>`;
  }
}

export async function openAccessAdmin() {
  if (!isMaster()) return;
  const root = $('#access-admin-root');
  root.innerHTML = `
    <div class="access-admin-overlay" role="dialog" aria-modal="true" aria-label="회원 승인 관리">
      <section class="access-admin-panel">
        <header><div><span>관리자 콘솔</span><h2>회원 접속 승인</h2><p>가입 요청을 확인하고 승인하면 해당 계정이 즉시 플랫폼에 접속합니다.</p></div><button type="button" id="access-admin-close" aria-label="닫기">×</button></header>
        <div id="access-request-list"></div>
      </section>
    </div>`;
  $('#access-admin-close')?.addEventListener('click', () => { root.innerHTML = ''; });
  root.querySelector('.access-admin-overlay')?.addEventListener('click', (event) => {
    if (event.target.classList.contains('access-admin-overlay')) root.innerHTML = '';
  });
  await loadAccessRequests();
}

export function initializeAuthGate({ onAccessGranted }) {
  onAccessGrantedHandler = onAccessGranted;
  bindGateControls();
  showGate();
  setGateMode('busy');
  setStatus({ title: '접속 정보를 확인하고 있습니다.', detail: '네트워크 상태에 따라 잠시 시간이 걸릴 수 있습니다.', spinner: true });

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (!user) {
      accessGrantedUid = '';
      clearPendingListener();
      showGate();
      setGateMode('login');
      setStatus({ tone: 'ready', title: '로그인하거나 새 계정을 만들어 주세요.', detail: '회원가입 후 관리자 승인이 완료되면 접속할 수 있습니다.' });
      return;
    }
    try {
      await checkAccess(user);
    } catch (error) {
      setGateMode('login');
      setStatus({ tone: 'error', title: '승인 상태를 확인하지 못했습니다.', detail: friendlyAuthError(error) });
    }
  });
}
