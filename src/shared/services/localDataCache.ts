type LocalCollection = 'borrowers' | 'loans' | 'payments';

type LocalEntry<T> = {
  id: string;
  data: Partial<T>;
  full: boolean;
  updatedAt: string;
};

type LocalStore = Record<LocalCollection, LocalEntry<unknown>[]>;

const localWritesKey = 'veyra.localWrites';
const syncedClearGraceMs = 2000;
const emptyStore: LocalStore = {
  borrowers: [],
  loans: [],
  payments: [],
};

function canUseLocalStorage() {
  return typeof localStorage !== 'undefined';
}

function readStore(): LocalStore {
  if (!canUseLocalStorage()) return { ...emptyStore };

  try {
    return { ...emptyStore, ...JSON.parse(localStorage.getItem(localWritesKey) || '{}') };
  } catch {
    return { ...emptyStore };
  }
}

function saveStore(store: LocalStore) {
  if (!canUseLocalStorage()) return;
  localStorage.setItem(localWritesKey, JSON.stringify(store));
}

function saveEntry<T extends object>(collection: LocalCollection, id: string, data: Partial<T>, full: boolean) {
  const store = readStore();
  const entries = store[collection].filter((entry) => entry.id !== id);
  const existing = store[collection].find((entry) => entry.id === id) as LocalEntry<T> | undefined;

  // Keep a full local record full when later offline edits patch it.
  entries.push({
    id,
    data: {
      ...(existing?.data || {}),
      ...data,
    },
    full: full || existing?.full === true,
    updatedAt: new Date().toISOString(),
  });

  store[collection] = entries;
  saveStore(store);
}

export function writeLocalRecord<T extends object>(collection: LocalCollection, id: string, data: T) {
  // Stores a complete local record before Firestore sync finishes.
  saveEntry(collection, id, data, true);
}

export function patchLocalRecord<T extends object>(collection: LocalCollection, id: string, data: Partial<T>) {
  // Stores local changes over the cached Firestore record.
  saveEntry(collection, id, data, false);
}

export function removeLocalRecord(collection: LocalCollection, id: string) {
  const store = readStore();
  store[collection] = store[collection].filter((entry) => entry.id !== id);
  saveStore(store);
}

export function getLocalRecord<T>(collection: LocalCollection, id: string) {
  return readStore()[collection].find((entry) => entry.id === id) as LocalEntry<T> | undefined;
}

export function mergeLocalRecord<T extends { id: string }>(collection: LocalCollection, record: T) {
  const local = getLocalRecord<T>(collection, record.id);
  if (!local) return record;
  return { ...record, ...local.data, id: record.id } as T;
}

export function mergeLocalRecords<T extends { id: string }>(collection: LocalCollection, records: T[]) {
  // Applies pending local writes so lists update immediately.
  const byId = new Map(records.map((record) => [record.id, record]));

  readStore()[collection].forEach((entry) => {
    const existing = byId.get(entry.id);
    if (existing) {
      byId.set(entry.id, { ...existing, ...entry.data, id: entry.id } as T);
      return;
    }

    // Only full local creates can appear without a Firestore base record.
    if (entry.full) {
      byId.set(entry.id, { ...(entry.data as T), id: entry.id });
    }
  });

  return [...byId.values()];
}

export function clearSyncedLocalRecords(collection: LocalCollection, ids: string[]) {
  if (ids.length === 0) return;

  const store = readStore();
  const syncedIds = new Set(ids);
  const now = Date.now();
  store[collection] = store[collection].filter((entry) => {
    const ageMs = now - new Date(entry.updatedAt).getTime();
    return !syncedIds.has(entry.id) || ageMs < syncedClearGraceMs;
  });
  saveStore(store);
}
