// 카드별 "드래프트에 떴을 때 얼마나 골라지는지" + "썼을 때 얼마나 이기는지"를 전체
// 유저 기준으로 집계해요 (개인별이 아니라 글로벌 통계 - 개발자 대시보드 전용).
// titleCounts와 같은 패턴(전역 경로 + increment)을 재사용해요.

import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, get, update, increment } from 'firebase/database';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig.js';

let dbInstance = null;
function getDb() {
  if (!isFirebaseConfigured()) throw new Error('Firebase 설정이 비어있어요.');
  if (!dbInstance) {
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    dbInstance = getDatabase(app);
  }
  return dbInstance;
}

// 드래프트 화면에 카드 3장이 뜰 때마다, 그 3장 각각의 "떴음" 카운트를 올려요.
export async function bumpCardsOffered(cardIds) {
  if (!cardIds || cardIds.length === 0) return;
  const db = getDb();
  const updates = {};
  for (const id of cardIds) updates[`cardStats/${id}/offered`] = increment(1);
  await update(ref(db), updates).catch(() => {});
}

// 드래프트에서 실제로 그 카드를 골랐을 때.
export async function bumpCardPicked(cardId) {
  const db = getDb();
  await update(ref(db), { [`cardStats/${cardId}/picked`]: increment(1) }).catch(() => {});
}

// 실제로 카드를 사용했을 때(전역 집계 - 개인별 cardUseCounts와는 별개).
export async function bumpCardUsedGlobal(cardId) {
  const db = getDb();
  await update(ref(db), { [`cardStats/${cardId}/used`]: increment(1) }).catch(() => {});
}

// 대국이 끝났을 때, 이번 판에 내가 사용한 카드들 각각에 대해 "그 카드를 쓴 판"과
// "그 카드를 쓰고 이긴 판"을 집계해요. usedCardIds는 이번 판에 실제로 쓴 카드 id의
// 중복 없는 목록이에요 (같은 카드를 여러 번 썼어도 판 단위로는 1회만 반영).
export async function bumpCardGameOutcome(usedCardIds, won) {
  if (!usedCardIds || usedCardIds.length === 0) return;
  const db = getDb();
  const updates = {};
  for (const id of usedCardIds) {
    updates[`cardStats/${id}/gamesWithCard`] = increment(1);
    if (won) updates[`cardStats/${id}/winsWithCard`] = increment(1);
  }
  await update(ref(db), updates).catch(() => {});
}

// 개발자 대시보드에서 한 번에 불러다 쓸 전체 카드 통계.
export async function getAllCardStats() {
  const db = getDb();
  const snap = await get(ref(db, 'cardStats'));
  return snap.val() || {};
}
