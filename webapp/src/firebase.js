import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getFirestore,
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
  where
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check.js';

const firebaseConfig = {
  apiKey: "AIzaSyAD1setZ-VrrB5do3wl6iHuVcqY91se0tk",
  authDomain: "culture-platform-8cd24.firebaseapp.com",
  projectId: "culture-platform-8cd24",
  storageBucket: "culture-platform-8cd24.firebasestorage.app",
  messagingSenderId: "391783796041",
  appId: "1:391783796041:web:7bdd71d7fb4be533e81e98"
};

const firebaseApp = initializeApp(firebaseConfig);
const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(window.location.hostname);
if (isLocalDevelopment) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
export const appCheck = initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaEnterpriseProvider('6LfuSSktAAAAANg8W3c0tVOUp6_aH99ZlZX8nbMg'),
  isTokenAutoRefreshEnabled: true
});
export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);
setPersistence(auth, browserLocalPersistence).catch((error) => console.error('Firebase 로그인 유지 설정 실패:', error));
export { collection, doc, addDoc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, serverTimestamp, writeBatch, query, where };
export { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut };
