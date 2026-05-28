import { reactive } from 'vue';

type OnlineSyncHandler = () => void | Promise<void>;
type NetworkConnectionCheck = () => boolean | Promise<boolean>;

type SyncIssue = {
  id: string;
  operation: string;
  message: string;
  createdAt: string;
};

const syncIssuesKey = 'veyra.syncIssues';
const firestoreTimeoutMs = 1500;
const offlineAssumptionMs = 15000;
const handlers = new Set<OnlineSyncHandler>();
let initialized = false;
let assumeOfflineUntil = 0;
let networkConnectionCheck: NetworkConnectionCheck | null = null;
const offlineFallback = Symbol('offlineFallback');

function browserIsOnline() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false && Date.now() > assumeOfflineUntil;
}

export function isDeviceOnline() {
  return browserIsOnline();
}

export function registerNetworkConnectionCheck(check: NetworkConnectionCheck) {
  networkConnectionCheck = check;
  return () => {
    if (networkConnectionCheck === check) {
      networkConnectionCheck = null;
    }
  };
}

async function hasRealNetworkConnection() {
  if (!browserIsOnline()) return false;
  if (!networkConnectionCheck) return true;
  return networkConnectionCheck();
}

function markFirestoreUnreachable() {
  assumeOfflineUntil = Date.now() + offlineAssumptionMs;
  offlineSyncState.isOnline = false;
  window.setTimeout(() => {
    offlineSyncState.isOnline = browserIsOnline();
    if (offlineSyncState.isOnline) {
      void runSyncHandlers();
    }
  }, offlineAssumptionMs + 50);
}

function loadIssues(): SyncIssue[] {
  try {
    return JSON.parse(localStorage.getItem(syncIssuesKey) || '[]') as SyncIssue[];
  } catch {
    return [];
  }
}

function saveIssues(issues: SyncIssue[]) {
  localStorage.setItem(syncIssuesKey, JSON.stringify(issues.slice(-25)));
}

function clearSyncIssues() {
  localStorage.removeItem(syncIssuesKey);
  offlineSyncState.issueCount = 0;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Sync failed.';
}

export const offlineSyncState = reactive({
  isOnline: browserIsOnline(),
  isSyncing: false,
  lastSyncAt: '',
  issueCount: loadIssues().length,
});

export function recordSyncIssue(operation: string, error: unknown) {
  const issues = loadIssues();
  const nextIssues = [
    ...issues,
    {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      operation,
      message: errorMessage(error),
      createdAt: new Date().toISOString(),
    },
  ].slice(-25);
  saveIssues(nextIssues);
  offlineSyncState.issueCount = nextIssues.length;
}

function timeoutFallback() {
  return new Promise<typeof offlineFallback>((resolve) => {
    window.setTimeout(() => resolve(offlineFallback), firestoreTimeoutMs);
  });
}

export async function finishFirestoreRead<T>(read: Promise<T>, cacheRead: () => Promise<T>) {
  if (!browserIsOnline()) return cacheRead();

  let fellBackToCache = false;
  const trackedRead = read.catch((error) => {
    if (!fellBackToCache) throw error;
    return undefined as T;
  });
  let result: T | typeof offlineFallback;
  try {
    result = await Promise.race([trackedRead, timeoutFallback()]);
  } catch {
    markFirestoreUnreachable();
    return cacheRead();
  }

  if (result === offlineFallback) {
    fellBackToCache = true;
    markFirestoreUnreachable();
    return cacheRead();
  }

  return result;
}

export async function finishFirestoreWrite<T>(operation: string, write: Promise<T>, offlineValue?: T) {
  if (!browserIsOnline()) {
    write.catch((error) => recordSyncIssue(operation, error));
    return offlineValue as T;
  }

  let returnedOffline = false;
  const trackedWrite = write.catch((error) => {
    recordSyncIssue(operation, error);
    if (!returnedOffline) throw error;
    return offlineValue as T;
  });
  const result = await Promise.race([trackedWrite, timeoutFallback()]);

  if (result === offlineFallback) {
    returnedOffline = true;
    markFirestoreUnreachable();
    return offlineValue as T;
  }

  return result;
}

async function runSyncHandlers() {
  if (offlineSyncState.isSyncing) return;
  // Verify the internet is usable before showing or running reconnect sync.
  offlineSyncState.isOnline = await hasRealNetworkConnection();
  if (!offlineSyncState.isOnline) return;

  offlineSyncState.isSyncing = true;
  try {
    for (const handler of handlers) {
      await handler();
    }
    clearSyncIssues();
    offlineSyncState.lastSyncAt = new Date().toISOString();
  } catch (error) {
    recordSyncIssue('Reconnect sync', error);
  } finally {
    offlineSyncState.isSyncing = false;
  }
}

export function registerOnlineSync(handler: OnlineSyncHandler) {
  handlers.add(handler);
  if (browserIsOnline()) {
    window.setTimeout(() => runSyncHandlers(), 0);
  }
  return () => handlers.delete(handler);
}

export function initializeOfflineSync() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const updateOnlineStatus = async () => {
    // Browser online can be true before the internet is reachable.
    offlineSyncState.isOnline = await hasRealNetworkConnection();
    if (offlineSyncState.isOnline) {
      await runSyncHandlers();
    }
  };

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  document.addEventListener('visibilitychange', updateOnlineStatus);
  updateOnlineStatus();
}
