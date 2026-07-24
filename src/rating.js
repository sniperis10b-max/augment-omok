// 온라인 대전 전용 레이팅 시스템. 기본 1000점에서 시작하고, 상대와의 점수 차이에 따라
// 승/무/패 변동폭이 달라져요 (차이가 클수록 낮은 쪽은 크게 얻고 적게 잃어요).
//
// - 100점 이내 차이: 승 +10 / 무 0 / 패 -10 (양쪽 동일)
// - 100~300점 차이: 높은 쪽 승 +7 / 무 -1 / 패 -13, 낮은 쪽 승 +13 / 무 +1 / 패 -7
// - 300점 초과 차이: 높은 쪽 승 +5 / 무 -2 / 패 -15, 낮은 쪽 승 +15 / 무 +2 / 패 -5
//
// 순위표는 이메일 없이 닉네임 + 점수만 별도 경로(leaderboard/{uid})에 저장해서,
// 다른 사람의 이메일 등 민감한 정보가 함께 노출될 일이 없게 해요.

import { initializeApp, getApps } from 'firebase/app';
import {
  getDatabase, ref, get, update, runTransaction, query, orderByChild, limitToLast,
} from 'firebase/database';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig.js';

export const DEFAULT_RATING = 1000;

let dbInstance = null;

function getDb() {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase 설정이 비어있어요. firebaseConfig.js를 채워주세요.');
  }
  if (!dbInstance) {
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    dbInstance = getDatabase(app);
  }
  return dbInstance;
}

// 로그인할 때 호출해서, 레이팅이 아직 없으면 1000점으로 만들고 순위표에도 반영해요.
// 이미 레이팅이 있으면 건드리지 않고(닉네임만 최신화), 현재 레이팅을 반환해요.
// isDev: 이 계정이 개발자 계정인지 (호출하는 쪽에서 이메일로 판별해서 넘겨줘요 - 순위표
// 자체엔 이메일을 저장하지 않기 때문에, 배지 표시를 위해 별도로 true/false만 남겨둬요)
export async function ensureRatingInitialized(uid, displayName, isDev = false) {
  const db = getDb();
  const result = await runTransaction(ref(db, `users/${uid}/rating`), (cur) => (cur == null ? DEFAULT_RATING : cur));
  const rating = result.snapshot.val() ?? DEFAULT_RATING;
  await update(ref(db, `leaderboard/${uid}`), { displayName: displayName || '이름 없음', rating, isDev });
  return rating;
}

export async function getRating(uid) {
  const db = getDb();
  const snap = await get(ref(db, `users/${uid}/rating`));
  return snap.exists() ? snap.val() : DEFAULT_RATING;
}

// 내 레이팅(myRating), 상대 레이팅(opponentRating), 결과(result: 'win'|'draw'|'loss')를 받아
// 이번 대국으로 내 점수가 얼마나 바뀌어야 하는지 계산해요.
export function computeRatingDelta(myRating, opponentRating, result) {
  const diff = Math.abs(myRating - opponentRating);
  const amHigher = myRating >= opponentRating;

  let table;
  if (diff <= 100) {
    table = { win: 10, draw: 0, loss: -10 };
  } else if (diff <= 300) {
    table = amHigher ? { win: 7, draw: -1, loss: -13 } : { win: 13, draw: 1, loss: -7 };
  } else {
    table = amHigher ? { win: 5, draw: -2, loss: -15 } : { win: 15, draw: 2, loss: -5 };
  }
  return table[result] ?? 0;
}

// 계산된 변동폭을 실제로 반영해요. 0점 밑으로는 안 내려가게 막아요.
export async function applyRatingChange(uid, ratingBefore, delta, displayName, isDev = false) {
  const db = getDb();
  const newRating = Math.max(0, ratingBefore + delta);
  await update(ref(db), {
    [`users/${uid}/rating`]: newRating,
    [`leaderboard/${uid}/rating`]: newRating,
    [`leaderboard/${uid}/displayName`]: displayName || '이름 없음',
    [`leaderboard/${uid}/isDev`]: isDev,
  });
  return newRating;
}

// 순위표 상위 N명을 점수 높은 순으로 반환해요. (닉네임 + 점수만 - 이메일 등은 아예 안 담겨있어요)
export async function fetchLeaderboard(limit = 100) {
  const db = getDb();
  const q = query(ref(db, 'leaderboard'), orderByChild('rating'), limitToLast(limit));
  const snap = await get(q);
  const val = snap.val() || {};
  return Object.entries(val)
    .map(([uid, v]) => ({
      uid,
      displayName: v.displayName || '이름 없음',
      rating: v.rating ?? DEFAULT_RATING,
      isDev: !!v.isDev,
      titleName: v.titleName || null,
      tierBadgeId: v.tierBadgeId || null,
    }))
    .sort((a, b) => b.rating - a.rating);
}

export { isFirebaseConfigured };
