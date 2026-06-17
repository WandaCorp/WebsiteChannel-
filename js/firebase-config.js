// ============================================
// firebase-config.js
// Configuración centralizada de Firebase
// Firestore Database + Authentication
// ============================================

// --- SDK Firebase (v9+ modular) ---
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  increment,
  collectionGroup
} from "firebase/firestore";

// --- Firebase Auth ---
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signInAnonymously,
  onAuthStateChanged,
  signOut
} from "firebase/auth";

// ==================== FIREBASE CONFIG ====================

const firebaseConfig = {
  apiKey: "AIzaSyAyaiNMaBJntL9dL4Bo158CPboL_R4e3Lc",
  authDomain: "nettiss-proyect.firebaseapp.com",
  projectId: "nettiss-proyect",
  storageBucket: "nettiss-proyect.firebasestorage.app",
  messagingSenderId: "828897684139",
  appId: "1:828897684139:web:5014554b53eadd3c47a5ee"
};

// ==================== INICIALIZACIÓN ====================

/** Instancia única de la app Firebase */
const app = initializeApp(firebaseConfig);

/** Instancia de Firestore Database */
const db = getFirestore(app);

/** Instancia de Firebase Auth */
const auth = getAuth(app);

// --- Proveedores de autenticación ---

/** Proveedor de Google */
const googleProvider = new GoogleAuthProvider();

/** Proveedor de Apple */
const appleProvider = new OAuthProvider('apple.com');

// ==================== EXPORTACIONES ====================

// --- Firestore ---
export {
  db,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  increment,
  collectionGroup
};

// --- Auth ---
export {
  auth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signOut,
  googleProvider,
  appleProvider,
  signInAnonymously
};