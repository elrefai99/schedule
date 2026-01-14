import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Your web app's Firebase configuration
// These values are safe to expose publicly
const firebaseConfig = {
     apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCvLo_ct6hpT-9YtNwsOsl8jQhrG7AG5-k",
     authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "schedule-5bf3f.firebaseapp.com",
     projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "schedule-5bf3f",
     storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "schedule-5bf3f.firebasestorage.app",
     messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "873645947107",
     appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:873645947107:web:41f15f2d0f3671c1f26dd6",
     measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-2ZES5ZER8R"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app)

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider()

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app)

export default app
