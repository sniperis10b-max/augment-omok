// Vercel 서버리스 함수(api/*.js)에서 공통으로 쓰는 Firebase Admin 초기화 + 인증 헬퍼예요.
//
// 필요한 환경변수 (Vercel 프로젝트 설정 > Environment Variables에 등록해야 해요):
//   FIREBASE_PROJECT_ID     - Firebase 프로젝트 ID (예: augment-omok)
//   FIREBASE_CLIENT_EMAIL   - 서비스 계정 이메일
//   FIREBASE_PRIVATE_KEY    - 서비스 계정 개인 키 (줄바꿈이 \n 문자로 이스케이프된 상태로 저장)
//   FIREBASE_DATABASE_URL   - Realtime Database URL (예: https://augment-omok-default-rtdb.firebaseio.com)
//
// 서비스 계정 키는 Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > "새 비공개 키 생성"으로 받아요.
// 절대 Git에 커밋하거나 클라이언트 코드에 넣으면 안 돼요 — Vercel 환경변수에만 저장해요.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const databaseURL = process.env.FIREBASE_DATABASE_URL;

  if (!projectId || !clientEmail || !privateKey || !databaseURL) {
    throw new Error(
      'Firebase Admin 환경변수가 안 채워져 있어요. Vercel 프로젝트 설정에서 '
      + 'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_DATABASE_URL을 등록해주세요.'
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    databaseURL,
  });
}

export function getDb() {
  return getDatabase(getAdminApp());
}

// 요청 헤더의 "Authorization: Bearer <idToken>"을 검증해서 uid를 돌려줘요.
// 토큰이 없거나 유효하지 않으면 null을 돌려줘요 (예외를 던지지 않아요 - 호출부에서
// "로그인 안 됨"으로 자연스럽게 처리하도록).
export async function getUidFromRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const match = /^Bearer (.+)$/.exec(authHeader);
  if (!match) return null;
  try {
    const decoded = await getAuth(getAdminApp()).verifyIdToken(match[1]);
    return decoded.uid;
  } catch {
    return null;
  }
}

// 이메일로 개발자 계정 여부를 판단해요 (관리자 UI에서 쓰는 계정과 동일).
export const DEV_EMAIL = 'sniperis10b@gmail.com';

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 아주 짧은 시간에 같은 API를 너무 많이 부르는 걸 막는 간단한 속도 제한이에요.
// windowMs 동안 maxRequests번 넘게 부르면 거부해요. Firebase 트랜잭션으로 동시 요청도
// 안전하게 처리해요. (레디스 같은 전용 저장소 없이, 이미 쓰고 있는 Firebase로 처리해요.)
export async function checkRateLimit(uid, bucket, maxRequests = 20, windowMs = 10000) {
  const db = getDb();
  const ref = db.ref(`rateLimits/${uid}/${bucket}`);
  const now = Date.now();
  const result = await ref.transaction((current) => {
    if (!current || now - current.windowStart > windowMs) {
      return { windowStart: now, count: 1 };
    }
    return { windowStart: current.windowStart, count: current.count + 1 };
  });
  const count = result.snapshot.val()?.count ?? 1;
  return count <= maxRequests;
}
