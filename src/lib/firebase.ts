import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Firebase configuration provided by the user
const firebaseConfig = {
  apiKey: 'AIzaSyDW6PxwUO1Btw7mz_Oz3tJqcLIdBpZ7giY',
  authDomain: 'rixa-4aa10.firebaseapp.com',
  projectId: 'rixa-4aa10',
  storageBucket: 'rixa-4aa10.firebasestorage.app',
  messagingSenderId: '865095311782',
  appId: '1:865095311782:web:92cbf2ceb46f32d2dc6f67',
  measurementId: 'G-LSEE5S2PKX',
}

// Initialize Firebase
export const firebaseApp = initializeApp(firebaseConfig)

// Initialize Auth + Google Provider
export const firebaseAuth = getAuth(firebaseApp)
firebaseAuth.useDeviceLanguage()

export const googleAuthProvider = new GoogleAuthProvider()

// Firestore
export const db = getFirestore(firebaseApp)


