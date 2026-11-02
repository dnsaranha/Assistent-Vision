import { initializeApp as initializeAdminApp, cert, applicationDefault, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

export function initializeFirebaseAdmin() {
  if (getAdminApps().length) return getAdminAuth();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    initializeAdminApp({ credential: cert(serviceAccount), projectId: projectId || serviceAccount.project_id });
  } else {
    initializeAdminApp({ credential: applicationDefault(), ...(projectId ? { projectId } : {}) });
  }
  return getAdminAuth();
}


