import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider
} from 'firebase/app-check';

const firebaseConfig = {
  apiKey: "AIzaSyAD1setZ-VrrB5do3wl6iHuVcqY91se0tk",
  authDomain: "culture-platform-8cd24.firebaseapp.com",
  projectId: "culture-platform-8cd24",
  storageBucket: "culture-platform-8cd24.firebasestorage.app",
  messagingSenderId: "391783796041",
  appId: "1:391783796041:web:7bdd71d7fb4be533e81e98"
};

const firebaseApp = initializeApp(firebaseConfig);
const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  || window.location.hostname.startsWith('192.168.')
  || window.location.hostname.startsWith('10.')
  || window.location.hostname.startsWith('172.')
  || window.location.hostname.endsWith('.local');
if (isLocalDevelopment) {
  // A literal `true` here makes the SDK mint a brand-new random debug token on every
  // page load, which then 403s against App Check until that exact token is registered
  // in the Firebase console — so every hard refresh silently breaks Firestore again.
  // Persist one token per browser instead, so it only needs registering once.
  const STORAGE_KEY = 'FIREBASE_APPCHECK_DEBUG_TOKEN';
  let debugToken = localStorage.getItem(STORAGE_KEY);
  if (!debugToken) {
    debugToken = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, debugToken);
  }
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  console.info('[App Check] local debug token (등록 필요 시 1회만):', debugToken);
}
export const appCheck = isLocalDevelopment ? null : initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaEnterpriseProvider('6LfuSSktAAAAANg8W3c0tVOUp6_aH99ZlZX8nbMg'),
  isTokenAutoRefreshEnabled: true
});
// 오프라인/재방문 시 마지막으로 받은 문서를 IndexedDB에서 즉시 읽어 대시보드 숫자가
// 네트워크 왕복(Auth → App Check → Firestore) 없이 먼저 그려지도록 한다.
export const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
export const auth = getAuth(firebaseApp);
setPersistence(auth, browserLocalPersistence).catch((error) => console.error('Firebase 로그인 유지 설정 실패:', error));
export { collection, doc, addDoc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, serverTimestamp, writeBatch, query, where, orderBy, limit };
export { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut };
