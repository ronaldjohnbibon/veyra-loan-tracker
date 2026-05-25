import { serverTimestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';

export function createAudit(user: User) {
  return {
    createdAt: serverTimestamp(),
    createdBy: user.uid,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
    deletedAt: null,
    deletedBy: null,
  };
}

export function createLocalAudit(user: User) {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    createdBy: user.uid,
    updatedAt: now,
    updatedBy: user.uid,
    deletedAt: null,
    deletedBy: null,
  };
}

export function updateAudit(user: User) {
  return {
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  };
}

export function updateLocalAudit(user: User) {
  return {
    updatedAt: new Date().toISOString(),
    updatedBy: user.uid,
  };
}

export function cancelAudit(user: User) {
  return {
    cancelledAt: serverTimestamp(),
    cancelledBy: user.uid,
    ...updateAudit(user),
  };
}

export function cancelLocalAudit(user: User) {
  return {
    cancelledAt: new Date().toISOString(),
    cancelledBy: user.uid,
    ...updateLocalAudit(user),
  };
}

export function deleteAudit(user: User) {
  return {
    deletedAt: serverTimestamp(),
    deletedBy: user.uid,
    ...updateAudit(user),
  };
}

export function deleteLocalAudit(user: User) {
  return {
    deletedAt: new Date().toISOString(),
    deletedBy: user.uid,
    ...updateLocalAudit(user),
  };
}

export function restoreAudit(user: User) {
  return {
    deletedAt: null,
    deletedBy: null,
    deleteReason: null,
    ...updateAudit(user),
  };
}

export function restoreLocalAudit(user: User) {
  return {
    deletedAt: null,
    deletedBy: null,
    deleteReason: null,
    ...updateLocalAudit(user),
  };
}
