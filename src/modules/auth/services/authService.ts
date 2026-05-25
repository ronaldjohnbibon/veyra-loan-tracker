import {
  createUserWithEmailAndPassword,
  deleteUser,
  inMemoryPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, userCreationAuth } from '@/app/firebase/firebase';
import type { SystemUserInput, UserProfile } from '../types';

const usersRef = collection(db, 'users');

function userProfileFromDoc(snapshot: Awaited<ReturnType<typeof getDoc>>) {
  return { id: snapshot.id, ...(snapshot.data() as Omit<UserProfile, 'id'>) };
}

function sortUsersByName(users: UserProfile[]) {
  return [...users].sort((first, second) => first.name.localeCompare(second.name));
}

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
  return userProfileFromDoc(snapshot);
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

export function watchSystemUsers(callback: (users: UserProfile[]) => void) {
  return onSnapshot(
    usersRef,
    (snapshot) => {
      callback(sortUsersByName(snapshot.docs.map(userProfileFromDoc)));
    },
    (error) => {
      console.error('Unable to load system users.', error);
      callback([]);
    },
  );
}

export async function createSystemUser(input: SystemUserInput, currentUser: User) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  await setPersistence(userCreationAuth, inMemoryPersistence);
  const credential = await createUserWithEmailAndPassword(userCreationAuth, email, input.password);

  try {
    await updateProfile(credential.user, { displayName: name });
    await setDoc(doc(db, 'users', credential.user.uid), {
      name,
      email,
      role: input.role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
    });

    return getUserProfile(credential.user.uid);
  } catch (error) {
    // Remove the Auth account if its authorization profile could not be saved.
    await deleteUser(credential.user).catch(() => undefined);
    throw error;
  } finally {
    await signOut(userCreationAuth).catch(() => undefined);
  }
}

export function listenToAuthStateChanges(callback: (user: User | null) => void | Promise<void>) {
  return onAuthStateChanged(auth, callback);
}
