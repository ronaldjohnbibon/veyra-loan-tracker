import { reactive } from 'vue';

type OnlineSyncHandler = () => void | Promise<void>;

type SyncIssue = {
  id: string;
  operation: string;
  message: string;
  createdAt: string;
};

const syncIssuesKey = 'veyra.syncIssues';
const handlers = new Set<OnlineSyncHandler>();
let initialized = false;

function browserIsOnline() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

export function isDeviceOnline() {
  return browserIsOnline();
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
  issues.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    operation,
    message: errorMessage(error),
    createdAt: new Date().toISOString(),
  });
  saveIssues(issues);
  offlineSyncState.issueCount = issues.length;
}

export async function finishFirestoreWrite<T>(operation: string, write: Promise<T>, offlineValue?: T) {
  if (!browserIsOnline()) {
    write.catch((error) => recordSyncIssue(operation, error));
    return offlineValue as T;
  }

  try {
    return await write;
  } catch (error) {
    recordSyncIssue(operation, error);
    throw error;
  }
}

async function runSyncHandlers() {
  if (!browserIsOnline() || offlineSyncState.isSyncing) return;

  offlineSyncState.isSyncing = true;
  try {
    for (const handler of handlers) {
      await handler();
    }
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

  const updateOnlineStatus = () => {
    offlineSyncState.isOnline = browserIsOnline();
    if (offlineSyncState.isOnline) {
      void runSyncHandlers();
    }
  };

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  document.addEventListener('visibilitychange', updateOnlineStatus);
  updateOnlineStatus();
}
