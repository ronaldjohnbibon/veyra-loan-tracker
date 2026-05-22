import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@/app/firebase/firebase';
import type { UserProfile } from '../types';

export function loginWithEmailAndPassword(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
}

export function getCurrentUser() {
  return auth.currentUser;
}

export async function getUserProfile(uid: string) {
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...(snapshot.data() as Omit<UserProfile, 'id'>) };
}

export async function getOrCreateUserProfile(user: User) {
  const existing = await getUserProfile(user.uid);
  if (existing) return existing;

  const fallbackName = user.displayName || user.email?.split('@')[0] || 'Assistant';
  const fallbackEmail = user.email || '';

  await setDoc(doc(db, 'users', user.uid), {
    name: fallbackName,
    email: fallbackEmail,
    role: 'assistant',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });

  return getUserProfile(user.uid);
}

export function listenToAuthStateChanges(callback: (user: User | null) => void | Promise<void>) {
  return onAuthStateChanged(auth, callback);
}
