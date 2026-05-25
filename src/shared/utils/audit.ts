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

export function updateAudit(user: User) {
  return {
    updatedAt: serverTimestamp(),
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

export function deleteAudit(user: User) {
  return {
    deletedAt: serverTimestamp(),
    deletedBy: user.uid,
    ...updateAudit(user),
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
