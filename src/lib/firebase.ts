import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase configuration provided by the user
const firebaseConfig = {
  apiKey: "AIzaSyC_PdWctQaQOTzvk9s2_fiVpd7Zl5YuChA",
  authDomain: "rixa2-8042b.firebaseapp.com",
  projectId: "rixa2-8042b",
  storageBucket: "rixa2-8042b.firebasestorage.app",
  messagingSenderId: "1058537801124",
  appId: "1:1058537801124:web:aed1334e340d46b288ed31",
  measurementId: "G-0FFJS1QPBF",
};

// Initialize Firebase
export const firebaseApp = initializeApp(firebaseConfig);

// Initialize Auth + Google Provider
export const firebaseAuth = getAuth(firebaseApp);
firebaseAuth.useDeviceLanguage();

export const googleAuthProvider = new GoogleAuthProvider();

// Firestore
export const db = getFirestore(firebaseApp);
