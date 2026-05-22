import { reactive } from 'vue';
import type { User } from 'firebase/auth';
import {
  getCurrentUser,
  getOrCreateUserProfile,
  listenToAuthStateChanges,
  loginWithEmailAndPassword,
  logout as logoutCurrentUser,
} from '../services/authService';
import type { AuthState } from '../types';

const state = reactive<AuthState>({
  user: null,
  profile: null,
  ready: false,
});

let authReadyPromise: Promise<User | null> | null = null;
let authListenerStarted = false;

export function useAuthStore() {
  async function setCurrentUser(user: User | null) {
    state.user = user;
    state.profile = user ? await getOrCreateUserProfile(user) : null;
  }

  function waitUntilReady() {
    if (state.ready) return Promise.resolve(state.user);

    if (!authReadyPromise || !authListenerStarted) {
      authListenerStarted = true;
      authReadyPromise = new Promise((resolve) => {
        listenToAuthStateChanges(async (user) => {
          try {
            await setCurrentUser(user);
          } catch (error) {
            console.error('Unable to load user profile.', error);
            state.user = user;
            state.profile = null;
          }

          if (!state.ready) {
            state.ready = true;
            resolve(user);
          }
        });
      });
    }

    return authReadyPromise;
  }

  async function login(email: string, password: string) {
    const credential = await loginWithEmailAndPassword(email, password);
    await setCurrentUser(credential.user);
    state.ready = true;
  }

  async function logout() {
    await logoutCurrentUser();
    await setCurrentUser(getCurrentUser());
    state.ready = true;
  }

  function isOwner() {
    return state.profile?.role === 'owner';
  }

  return {
    state,
    waitUntilReady,
    login,
    logout,
    isOwner,
  };
}
