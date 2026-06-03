import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, CACHE_SIZE_UNLIMITED, persistentLocalCache, persistentMultipleTabManager, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
setLogLevel('error');

// Initialize Firestore with robust connectivity settings and persistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
  experimentalForceLongPolling: true,
}, (firebaseConfig as any).firestoreDatabaseId);

let cachedAccessToken: string | null = null;

export const setCachedAccessToken = (token: string) => {
  cachedAccessToken = token;
  try {
    localStorage.setItem('google_access_token', token);
    const expiresAt = Date.now() + 55 * 60 * 1000; // 55 minutes from now
    localStorage.setItem('google_access_token_expires_at', expiresAt.toString());
  } catch (e) {
    console.error('Failed to save access token in localStorage:', e);
  }
};

export const getCachedAccessToken = () => {
  if (cachedAccessToken) return cachedAccessToken;

  try {
    const token = localStorage.getItem('google_access_token');
    const expiresAtStr = localStorage.getItem('google_access_token_expires_at');
    if (token && expiresAtStr) {
      const expiresAt = parseInt(expiresAtStr, 10);
      if (Date.now() < expiresAt) {
        cachedAccessToken = token;
        return cachedAccessToken;
      }
    }
  } catch (e) {
    console.error('Failed to read access token from localStorage:', e);
  }

  // Clear if expired or not found to maintain consistency
  cachedAccessToken = null;
  try {
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_access_token_expires_at');
  } catch (e) {
    // Ignore issues during clean clean-up
  }
  return null;
};

export const clearCachedAccessToken = () => {
  cachedAccessToken = null;
  try {
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_access_token_expires_at');
  } catch (e) {
    console.error('Failed to clear access token from localStorage:', e);
  }
};

export const auth = getAuth();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
