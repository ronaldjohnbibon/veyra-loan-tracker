import type { User as FirebaseUser } from 'firebase/auth';
import type { Timestamp } from 'firebase/firestore';

export const USER_ROLES = ['owner', 'assistant'] as const;

export type UserRole = (typeof USER_ROLES)[number];
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

export interface SystemUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export type AuthState = {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  ready: boolean;
};
