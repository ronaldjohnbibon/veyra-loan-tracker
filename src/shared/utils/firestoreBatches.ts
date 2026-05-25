import { writeBatch, type DocumentData, type DocumentReference, type UpdateData } from 'firebase/firestore';
import { db } from '@/app/firebase/firebase';
import { finishFirestoreWrite } from '@/shared/services/offlineSyncService';

const MAX_BATCH_WRITES = 450;

export type BatchedUpdate = {
  ref: DocumentReference<DocumentData>;
  data: UpdateData<DocumentData>;
};

export async function commitBatchedUpdates(updates: BatchedUpdate[]) {
  for (let index = 0; index < updates.length; index += MAX_BATCH_WRITES) {
    const batch = writeBatch(db);
    updates.slice(index, index + MAX_BATCH_WRITES).forEach((update) => {
      batch.update(update.ref, update.data);
    });
    await finishFirestoreWrite('Batch update', batch.commit());
  }
}
