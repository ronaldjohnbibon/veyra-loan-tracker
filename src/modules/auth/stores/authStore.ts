import { reactive } from 'vue';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/app/firebase/firebase';
import { signIn, signOutCurrentUser } from '../services/authService';
import type { AuthState } from '../types';

const state = reactive<AuthState>({
  user: null,
  ready: false,
});

const AUTH_READY_TIMEOUT_MS = 4000;
let authReadyPromise: Promise<User | null> | null = null;
let authListenerStarted = false;

export function useAuthStore() {
  function waitUntilReady() {
    if (state.ready) return Promise.resolve(state.user);

    if (!authReadyPromise || !authListenerStarted) {
      authListenerStarted = true;
      authReadyPromise = new Promise((resolve) => {
        const timeout = window.setTimeout(() => {
          state.user = auth.currentUser;
          state.ready = true;
          resolve(state.user);
        }, AUTH_READY_TIMEOUT_MS);

        onAuthStateChanged(auth, (user) => {
          window.clearTimeout(timeout);
          state.user = user;
          state.ready = true;
          resolve(user);
        });
      });
    }

    return authReadyPromise;
  }

  async function login(email: string, password: string) {
    await signIn(email, password);
  }

  async function logout() {
    await signOutCurrentUser();
  }

  return {
    state,
    waitUntilReady,
    login,
    logout,
  };
}
