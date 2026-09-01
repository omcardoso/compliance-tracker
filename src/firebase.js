import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAkpyA0SjuaMDpwKDXnsKq67vNBGYfh4BU",
  authDomain: "westchester-compliance.firebaseapp.com",
  projectId: "westchester-compliance",
  storageBucket: "westchester-compliance.firebasestorage.app",
  messagingSenderId: "904156148967",
  appId: "1:904156148967:web:255dbf0536eff89360de42"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
