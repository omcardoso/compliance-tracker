import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc, getDoc, query, where, writeBatch } from "firebase/firestore";

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

// ─── Filings ──────────────────────────────────────────────────────────────────
export async function fbGetFilings(year) {
  const q = year
    ? query(collection(db, "filings"), where("year", "==", parseInt(year)))
    : collection(db, "filings");
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), filingId: d.id }));
}
export async function fbSaveFiling(filing) {
  await setDoc(doc(db, "filings", filing.filingId), filing);
}
export async function fbDeleteFiling(filingId) {
  await deleteDoc(doc(db, "filings", filingId));
}
export async function fbDeleteYear(year) {
  const q = query(collection(db, "filings"), where("year", "==", parseInt(year)));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

// ─── Templates ────────────────────────────────────────────────────────────────
// Template key: "Tax Return", "Economic Substance", "Economic Substance_BVI", "Annual Return", etc.
export async function fbGetTemplates() {
  const snap = await getDocs(collection(db, "templates"));
  const result = {};
  snap.docs.forEach(d => { result[d.id] = d.data().steps; });
  return result;
}
export async function fbSaveTemplate(key, steps) {
  await setDoc(doc(db, "templates", key), { steps, updatedAt: new Date().toISOString() });
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export async function fbGetSettings() {
  const snap = await getDocs(collection(db, "settings"));
  const result = {};
  snap.docs.forEach(d => { result[d.id] = d.data(); });
  return result.appSettings || {};
}
export async function fbSaveSettings(settings) {
  await setDoc(doc(db, "settings", "appSettings"), { ...settings, updatedAt: new Date().toISOString() });
}
