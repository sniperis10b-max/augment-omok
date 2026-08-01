// 시즌 패스 시스템 - 1단계(데이터/설정 레이어)만 구현한 상태예요.
// 아직 안 된 것: 코인 지급, 상점, 시즌 패스 화면 UI, 레벨업 감지/토스트.
// 여기 있는 건: 시즌 기간, 레벨 곡선, 보상 지점, 미션 목록, 미션 진행도 계산 함수.

import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, get, update } from 'firebase/database';
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

// ---------- 시즌 기본 정보 ----------

export const CURRENT_SEASON = {
  id: '2026-08',
  name: '불꽃놀이의 밤',
  // 이번 시즌만 시작일이 달의 중간(7/30)이라 예외적으로 기간이 좀 짧아요.
  // 다음 시즌부터는 매달 1일 시작 ~ 말일 종료로 정착시킬 예정.
  startDate: '2026-07-30',
  endDate: '2026-08-31',
};

export function isSeasonActive(date = new Date()) {
  const key = date.toISOString().slice(0, 10);
  return key >= CURRENT_SEASON.startDate && key <= CURRENT_SEASON.endDate;
}

// ---------- 레벨 곡선 / 코인 / 보상 지점 ----------

export const SEASON_MAX_LEVEL = 30;
export const POINTS_PER_LEVEL = 300; // 레벨 하나를 올리는 데 필요한 포인트 (누적 아님, 간격)
export const COINS_PER_LEVEL_UP = 100; // 레벨이 하나 오를 때마다 지급되는 코인

// 레벨 n에 도달하기 위해 필요한 "누적" 포인트예요. (레벨30 = 30*300 = 9000)
export function pointsRequiredForLevel(level) {
  return Math.max(0, level) * POINTS_PER_LEVEL;
}

// 현재 누적 포인트로 몇 레벨인지 계산해요 (최대 SEASON_MAX_LEVEL로 캡).
export function levelForPoints(points) {
  const level = Math.floor((points || 0) / POINTS_PER_LEVEL);
  return Math.min(SEASON_MAX_LEVEL, Math.max(0, level));
}

// 특정 레벨에서 다음 레벨까지 얼마나 남았는지 (진행률 바 표시용).
export function levelProgress(points) {
  const level = levelForPoints(points);
  if (level >= SEASON_MAX_LEVEL) {
    return { level, current: points, target: pointsRequiredForLevel(SEASON_MAX_LEVEL), pct: 100 };
  }
  const prevReq = pointsRequiredForLevel(level);
  const nextReq = pointsRequiredForLevel(level + 1);
  const span = nextReq - prevReq;
  const into = Math.max(0, (points || 0) - prevReq);
  return { level, current: into, target: span, pct: Math.min(100, Math.round((into / span) * 100)) };
}

// 레벨 10/20/30 도달 시 받는 보상이에요. 실제 스킨/칭호 id는 나중에 skins.js/achievements.js
// 쪽에 시즌 전용 항목을 추가할 때 맞춰서 채워 넣을 예정 (지금은 표시용 placeholder).
export const REWARD_LEVELS = {
  10: { level: 10, type: 'boardSkin', id: 'seasonFireworksSky', name: '불꽃놀이 밤하늘' },
  20: { level: 20, type: 'stoneSkin', id: 'seasonSparkler', name: '스파클러' },
  30: { level: 30, type: 'title', id: 'seasonFireworksPeak', name: '불꽃의 절정' },
};

// ---------- 미션 정의 ----------
// statKey는 achievementStats 안의 "시즌 전용" 카운터예요 (seasonGamesPlayed 등).
// 전부 2인 로컬 대국은 집계 대상에서 빠져요 (AI 대전/온라인 대전만 인정).

export const DAILY_MISSIONS = [
  { id: 'dailyGames3', name: '대국 3판 완료', statKey: 'seasonGamesPlayed', target: 3, points: 100 },
  { id: 'dailyCards15', name: '카드 15회 사용', statKey: 'seasonCardUses', target: 15, points: 100 },
  { id: 'dailyWin1', name: '1승 달성', statKey: 'seasonWins', target: 1, points: 100 },
];

export const WEEKLY_MISSIONS = [
  { id: 'weeklyGames7', name: '누적 대국 7판', statKey: 'seasonGamesPlayed', target: 7, points: 200 },
  { id: 'weeklyCards100', name: '카드 100회 사용', statKey: 'seasonCardUses', target: 100, points: 200 },
  { id: 'weeklyOnline5', name: '온라인 대전 5판', statKey: 'seasonOnlineGames', target: 5, points: 200 },
];

// 시즌 마일스톤은 baseline(기준선) 없이, 시즌 전용 누적 카운터를 그대로 target과 비교해요.
export const SEASON_MILESTONES = [
  { id: 'seasonGames30', name: '대국 30판', statKey: 'seasonGamesPlayed', target: 30, points: 400 },
  { id: 'seasonCards300', name: '카드 300회 사용', statKey: 'seasonCardUses', target: 300, points: 400 },
  { id: 'seasonWins30', name: '누적 30승', statKey: 'seasonWins', target: 30, points: 400 },
];

// ---------- 일일/주간 baseline 스냅샷 (dailyQuests.js와 같은 방식) ----------
// 일일/주간 미션은 "기간 시작 시점의 스탯 값"을 baseline으로 저장해두고, 그 차이로
// 진행도를 계산해요. 그래야 시즌 누적 카운터 하나로 일일/주간/시즌 미션을 다 같이 쓸 수 있어요.

function getTodayKey(date = new Date()) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD (UTC 기준)
}

// 이번 시즌 시작일 기준으로 몇 번째 "주"인지 계산해요 (7일 단위, 0부터 시작).
function getWeekIndex(date = new Date()) {
  const start = new Date(`${CURRENT_SEASON.startDate}T00:00:00Z`);
  const diffDays = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return Math.max(0, Math.floor(diffDays / 7));
}

// 오늘 일일 미션 baseline이 없으면(날짜가 바뀌었으면) 새로 저장하고, 있으면 그대로 반환.
export async function ensureSeasonDailyMissions(uid, stats) {
  const db = getDb();
  const snap = await get(ref(db, `users/${uid}/seasonDaily`));
  const existing = snap.val();
  const today = getTodayKey();

  if (existing && existing.date === today && existing.seasonId === CURRENT_SEASON.id) return existing;

  const baseline = {};
  for (const m of DAILY_MISSIONS) baseline[m.statKey] = stats?.[m.statKey] || 0;
  const fresh = { seasonId: CURRENT_SEASON.id, date: today, baseline, claimed: {} };
  await update(ref(db, `users/${uid}`), { seasonDaily: fresh });
  return fresh;
}

// 이번 주 주간 미션 baseline이 없으면(주가 바뀌었으면) 새로 저장하고, 있으면 그대로 반환.
export async function ensureSeasonWeeklyMissions(uid, stats) {
  const db = getDb();
  const snap = await get(ref(db, `users/${uid}/seasonWeekly`));
  const existing = snap.val();
  const weekIndex = getWeekIndex();

  if (existing && existing.weekIndex === weekIndex && existing.seasonId === CURRENT_SEASON.id) return existing;

  const baseline = {};
  for (const m of WEEKLY_MISSIONS) baseline[m.statKey] = stats?.[m.statKey] || 0;
  const fresh = { seasonId: CURRENT_SEASON.id, weekIndex, baseline, claimed: {} };
  await update(ref(db, `users/${uid}`), { seasonWeekly: fresh });
  return fresh;
}

// 미션 목록 + baseline + 현재 스탯을 받아서 { id, name, target, current, done, points } 배열을 돌려줘요.
function computeProgress(missionList, periodDoc, stats) {
  if (!periodDoc) return [];
  return missionList.map((m) => {
    const baseline = periodDoc.baseline?.[m.statKey] || 0;
    const current = Math.max(0, (stats?.[m.statKey] || 0) - baseline);
    return {
      id: m.id,
      name: m.name,
      points: m.points,
      target: m.target,
      current: Math.min(current, m.target),
      done: current >= m.target,
      claimed: !!periodDoc.claimed?.[m.id],
    };
  });
}

export function getDailyMissionProgress(seasonDaily, stats) {
  return computeProgress(DAILY_MISSIONS, seasonDaily, stats);
}

export function getWeeklyMissionProgress(seasonWeekly, stats) {
  return computeProgress(WEEKLY_MISSIONS, seasonWeekly, stats);
}

// 시즌 마일스톤은 baseline이 없어요(시즌 전체 누적이라 시즌 카운터 자체가 baseline 0부터 시작).
export function getSeasonMilestoneProgress(seasonMilestoneClaims, stats) {
  return SEASON_MILESTONES.map((m) => {
    const current = stats?.[m.statKey] || 0;
    return {
      id: m.id,
      name: m.name,
      points: m.points,
      target: m.target,
      current: Math.min(current, m.target),
      done: current >= m.target,
      claimed: !!seasonMilestoneClaims?.[m.id],
    };
  });
}

export { isFirebaseConfigured };

// 개발자 계정 전용: 시즌 레벨을 특정 레벨로 강제 설정해요 (코인도 그 레벨만큼 채워줘요).
export async function devSetSeasonLevel(uid, level) {
  const db = getDb();
  const points = pointsRequiredForLevel(level);
  const coins = level * COINS_PER_LEVEL_UP;
  await update(ref(db), {
    [`users/${uid}/seasonPoints`]: points,
    [`users/${uid}/seasonCoins`]: coins,
    [`users/${uid}/achievementStats/seasonLevel`]: level,
  });
}

// 화면에서 한 번에 불러다 쓰기 좋게, 시즌 관련 필드를 통째로 읽어와요.
export async function getSeasonProgressData(uid) {
  const db = getDb();
  const snap = await get(ref(db, `users/${uid}`));
  const data = snap.val() || {};
  return {
    seasonPoints: data.seasonPoints || 0,
    seasonCoins: data.seasonCoins || 0,
    seasonDaily: data.seasonDaily || null,
    seasonWeekly: data.seasonWeekly || null,
    seasonMilestoneClaims: data.seasonMilestoneClaims || {},
  };
}

// ---------- 시즌 상점 ----------
// 코인으로 구매하는 아이템이에요. 스탯 조건 없이 "구매하면 바로 지급"이라, 스킨은
// 기존 관리자 지급 경로(grantedBoardSkins/grantedStoneSkins)를, 칭호는 기존
// unlockTitles와 같은 경로(users/{uid}/titles)를 그대로 재사용해요.
export const SHOP_ITEMS = [
  { id: 'nightMarketRegular', type: 'title', name: '야시장 단골', price: 300 },
  { id: 'fuseLighter', type: 'title', name: '도화선', price: 400 },
  { id: 'lastFirework', type: 'title', name: '마지막 폭죽', price: 500 },
  { id: 'firefly', type: 'stoneSkin', name: '반딧불이', price: 700 },
  { id: 'fuseWick', type: 'stoneSkin', name: '폭죽 심지', price: 900 },
  { id: 'riverFestival', type: 'boardSkin', name: '강변 축제', price: 700 },
  { id: 'fireworkSmoke', type: 'boardSkin', name: '폭죽 연기 자국', price: 900 },
];

export function getShopItemById(id) {
  return SHOP_ITEMS.find((i) => i.id === id) || null;
}

// 이미 산 아이템인지는 화면 쪽에서 myTitles/myGrantedSkins로 확인해서 버튼을 막아주세요
// (여기서는 코인만 확인하고 중복 구매 자체를 막지는 않아요).
export async function purchaseShopItem(uid, itemId, currentCoins, unlimited = false) {
  const item = getShopItemById(itemId);
  if (!item) return { ok: false, reason: 'not-found' };
  if (!unlimited && (currentCoins || 0) < item.price) return { ok: false, reason: 'insufficient' };

  const db = getDb();
  const updates = {};
  let newCoins = currentCoins;
  if (!unlimited) {
    newCoins = currentCoins - item.price;
    updates[`users/${uid}/seasonCoins`] = newCoins;
  }
  if (item.type === 'title') {
    updates[`users/${uid}/titles/${item.id}`] = true;
  } else if (item.type === 'boardSkin') {
    updates[`users/${uid}/grantedBoardSkins/${item.id}`] = true;
  } else if (item.type === 'stoneSkin') {
    updates[`users/${uid}/grantedStoneSkins/${item.id}`] = true;
  }
  await update(ref(db), updates);
  return { ok: true, newCoins, item };
}

// ---------- 포인트 누적 + 미션 수령(코인 지급) ----------
// 미션 하나를 "수령"하면: seasonPoints에 그 미션 포인트를 더하고, 그 결과로 레벨이
// 올랐으면 오른 만큼 코인(레벨당 100)을 seasonCoins에 지급해요.

export async function claimSeasonMission(uid, periodType, missionId, points, currentSeasonPoints) {
  const db = getDb();
  const periodPath = periodType === 'daily' ? 'seasonDaily' : periodType === 'weekly' ? 'seasonWeekly' : 'seasonMilestoneClaims';

  const beforeLevel = levelForPoints(currentSeasonPoints);
  const newPoints = (currentSeasonPoints || 0) + points;
  const afterLevel = levelForPoints(newPoints);
  const coinsAwarded = Math.max(0, afterLevel - beforeLevel) * COINS_PER_LEVEL_UP;

  const coinSnap = await get(ref(db, `users/${uid}/seasonCoins`));
  const newCoins = (coinSnap.val() || 0) + coinsAwarded;

  const updates = {
    [`users/${uid}/seasonPoints`]: newPoints,
    [`users/${uid}/seasonCoins`]: newCoins,
    [`users/${uid}/achievementStats/seasonLevel`]: afterLevel,
  };
  if (periodType === 'season') {
    updates[`users/${uid}/seasonMilestoneClaims/${missionId}`] = true;
  } else {
    updates[`users/${uid}/${periodPath}/claimed/${missionId}`] = true;
  }
  await update(ref(db), updates);

  return { newPoints, newCoins, coinsAwarded, leveledUpTo: coinsAwarded > 0 ? afterLevel : null };
}

// 관리자(개발자) 전용: 지정한 유저의 시즌 코인을 원하는 값으로 강제로 바꿔요.
export async function adminSetSeasonCoins(uid, newCoins) {
  const db = getDb();
  await update(ref(db, `users/${uid}`), { seasonCoins: Math.max(0, Math.floor(newCoins)) });
  return Math.max(0, Math.floor(newCoins));
}
