// "랭크전" 전용 점수 시스템. 온라인 대전 전반에 쓰이는 레이팅(rating.js)과는 완전히 별개의
// 점수예요 - 레이팅은 친선전을 포함한 모든 온라인 대전에서 변동되지만, 랭크 포인트는
// "랭크전"으로 진행한 대국에서만 변동돼요. 티어(브론즈~마스터)는 이 랭크 포인트를 기준으로 매겨요.
//
// 점수 변동 규칙 (tiers.js와 맞물려요):
// - 0점에서 시작
// - 이기면 무조건 +100점
// - 지면 "현재 내 티어"에 따라 정해진 만큼 잃어요 (브론즈 -10 ~ 마스터 -200, tiers.js 참고)
// - 무승부는 변동 없음

import { initializeApp, getApps } from 'firebase/app';
import {
  getDatabase, ref, get, update, runTransaction, query, orderByChild, limitToLast,
} from 'firebase/database';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig.js';
import { getLossAmount, getTierForRating, TIERS } from './tiers.js';

export const DEFAULT_RANK_POINTS = 0;
const WIN_POINTS = 100;

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

// 로그인할 때 호출해서, 랭크 포인트가 아직 없으면 0점으로 만들어요.
// 이미 있으면 건드리지 않고 현재 값을 반환해요.
export async function ensureRankPointsInitialized(uid, displayName, isDev = false) {
  const db = getDb();
  const result = await runTransaction(ref(db, `users/${uid}/rankPoints`), (cur) => (cur == null ? DEFAULT_RANK_POINTS : cur));
  const points = result.snapshot.val() ?? DEFAULT_RANK_POINTS;
  await update(ref(db, `rankLeaderboard/${uid}`), { displayName: displayName || '이름 없음', points, isDev });
  return points;
}

export async function getRankPoints(uid) {
  const db = getDb();
  const snap = await get(ref(db, `users/${uid}/rankPoints`));
  return snap.exists() ? snap.val() : DEFAULT_RANK_POINTS;
}

// 이기면 +100, 지면 "현재 내 티어"에 따른 만큼 감점, 비기면 0.
// (상대방 점수는 필요 없어요 - 오직 내 현재 점수와 결과만으로 정해져요)
export function computeRankPointsDelta(myPointsBefore, result) {
  if (result === 'win') return WIN_POINTS;
  if (result === 'loss') return -getLossAmount(myPointsBefore);
  return 0;
}

export async function applyRankPointsChange(uid, pointsBefore, delta, displayName, isDev = false) {
  const db = getDb();
  const newPoints = Math.max(0, pointsBefore + delta);
  await update(ref(db), {
    [`users/${uid}/rankPoints`]: newPoints,
    [`rankLeaderboard/${uid}/points`]: newPoints,
    [`rankLeaderboard/${uid}/displayName`]: displayName || '이름 없음',
    [`rankLeaderboard/${uid}/isDev`]: isDev,
  });
  return newPoints;
}

// 랭크전 전용 순위표 (레이팅 순위표와는 다른 별도 목록이에요)
export async function fetchRankLeaderboard(limit = 100) {
  const db = getDb();
  const q = query(ref(db, 'rankLeaderboard'), orderByChild('points'), limitToLast(limit));
  const snap = await get(q);
  const val = snap.val() || {};
  return Object.entries(val)
    .map(([uid, v]) => ({
      uid,
      displayName: v.displayName || '이름 없음',
      points: v.points ?? DEFAULT_RANK_POINTS,
      isDev: !!v.isDev,
      titleName: v.titleName || null,
      tierBadgeId: v.tierBadgeId || null,
    }))
    .sort((a, b) => b.points - a.points);
}

// 랭크 포인트가 바뀔 때마다 호출해서, "지금까지 도달한 가장 높은 티어"를 갱신해요.
// (점수가 떨어져도 한 번 도달한 티어는 기록에 남아요 - 나중에 칭호처럼 골라 달 수 있게)
export async function updatePeakTier(uid, currentPoints) {
  const db = getDb();
  const currentIndex = TIERS.findIndex((t) => t.id === getTierForRating(currentPoints).id);
  const result = await runTransaction(ref(db, `users/${uid}/peakTierIndex`), (cur) => Math.max(cur || 0, currentIndex));
  return result.snapshot.val() || 0;
}

export async function getPeakTierIndex(uid) {
  const db = getDb();
  const snap = await get(ref(db, `users/${uid}/peakTierIndex`));
  return snap.exists() ? snap.val() : 0;
}

// 관리자(개발자) 전용: 실제로 점수를 안 올려도 최고 티어를 강제로 지정해줘요.
export async function forceSetPeakTierIndex(uid, index) {
  const db = getDb();
  await update(ref(db, `users/${uid}`), { peakTierIndex: index });
  return index;
}

// 지금까지 도달한 티어 중 하나를 골라 "티어 뱃지"로 장착해요 (칭호와는 별개, 동시에 달 수 있어요).
// 순위표/채팅 등 다른 사람도 볼 수 있는 곳에 이름만 별도로 복사해둬요.
export async function equipTierBadge(uid, tierId, displayName) {
  const db = getDb();
  const tier = tierId ? TIERS.find((t) => t.id === tierId) : null;
  await update(ref(db), {
    [`users/${uid}/equippedTierId`]: tierId || null,
    [`leaderboard/${uid}/tierBadgeId`]: tierId || null,
    [`leaderboard/${uid}/displayName`]: displayName || '이름 없음',
    [`rankLeaderboard/${uid}/tierBadgeId`]: tierId || null,
    [`rankLeaderboard/${uid}/displayName`]: displayName || '이름 없음',
  });
  return tier;
}

export async function getEquippedTierId(uid) {
  const db = getDb();
  const snap = await get(ref(db, `users/${uid}/equippedTierId`));
  return snap.exists() ? snap.val() : null;
}

export { isFirebaseConfigured };
