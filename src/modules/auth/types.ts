import type { User as FirebaseUser } from 'firebase/auth';
import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'owner' | 'assistant';
export type DateValue = Timestamp | string;

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: DateValue;
  updatedAt?: DateValue;
  updatedBy?: string;
}

export type AuthState = {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  ready: boolean;
};
