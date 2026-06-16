import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyAD1setZ-VrrB5do3wl6iHuVcqY91se0tk",
  authDomain: "culture-platform-8cd24.firebaseapp.com",
  projectId: "culture-platform-8cd24",
  storageBucket: "culture-platform-8cd24.firebasestorage.app",
  messagingSenderId: "391783796041",
  appId: "1:391783796041:web:7bdd71d7fb4be533e81e98"
};

const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
export { collection, doc, addDoc, getDoc, getDocs, deleteDoc, onSnapshot, serverTimestamp };
