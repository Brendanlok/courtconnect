import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAM954tO7yIoC395MHHVWyIvqPPfIWZRzo",
  authDomain: "courtconnect-8ecd3.firebaseapp.com",
  projectId: "courtconnect-8ecd3",
  storageBucket: "courtconnect-8ecd3.firebasestorage.app",
  messagingSenderId: "1037514457918",
  appId: "1:1037514457918:web:f5608f14d5facacda9e26f",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
