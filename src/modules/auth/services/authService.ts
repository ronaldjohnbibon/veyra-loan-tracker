import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '@/app/firebase/firebase';

export function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOutCurrentUser() {
  return signOut(auth);
}
