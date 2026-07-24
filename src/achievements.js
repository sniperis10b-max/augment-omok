// 업적(달성 조건)과 칭호(장착해서 닉네임 옆에 보여주는 표시) 시스템.
//
// 중요: 로컬 2인 대국(같은 화면에서 흑/백을 번갈아 두는 방식)은 "내 색"이 명확하지 않아서
// 어떤 업적에도 포함되지 않아요. AI 대전과 온라인 대전 결과만 집계돼요.
// (기존 개인 전적 통계(social.js의 stats)도 같은 방식으로 동작해요 - 일관성을 맞췄어요)
//
// 저장 구조:
// - users/{uid}/achievementStats : 각종 누적 카운터
// - users/{uid}/titles           : 잠금 해제한 칭호 id 목록 ({ [titleId]: true })
// - users/{uid}/equippedTitle    : 지금 장착 중인 칭호 id (또는 null)
// - leaderboard/{uid}/titleName  : 장착 중인 칭호의 "이름"만 별도로 복사해둬요.
//   (다른 사람이 순위표/채팅에서 내 칭호를 보려면 내 전체 통계에 접근할 필요 없이
//    이 한 줄만 읽으면 되도록 하기 위해서예요 - 개발자 뱃지 때와 같은 이유예요)

import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, get, update, runTransaction, increment } from 'firebase/database';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig.js';

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

// 카드 아이디 39종은 cards.js가 진짜 출처예요. 여기서는 순환 참조를 피하려고
// 개수만 필요할 때 호출하는 쪽에서 CARDS.length를 넘겨받아요.

export const TITLES = [
  // 누적 승수 (2인 대국 제외)
  { id: 'rookie', name: '새내기', desc: '누적 1승 달성 (2인 대국은 포함되지 않아요)', category: '승리' },
  { id: 'skilled', name: '숙련자', desc: '누적 10승 달성 (2인 대국은 포함되지 않아요)', category: '승리' },
  { id: 'veteran', name: '베테랑', desc: '누적 50승 달성 (2인 대국은 포함되지 않아요)', category: '승리' },
  { id: 'master', name: '거장', desc: '누적 100승 달성 (2인 대국은 포함되지 않아요)', category: '승리' },
  { id: 'god', name: '신', desc: '누적 1000승 달성 (2인 대국은 포함되지 않아요)', category: '승리' },

  // 레이팅/랭크 (온라인 대전 전용)
  { id: 'underdog', name: '언더독', desc: '나보다 레이팅이 300점 이상 높은 상대에게 승리 (온라인 대전 전용)', category: '랭크' },
  { id: 'hallOfFame', name: '명예의 전당', desc: '순위표 100위 안에 진입 (온라인 대전 전용)', category: '랭크' },
  { id: 'topTier', name: '최상위권', desc: '순위표 10위 안에 진입 (온라인 대전 전용)', category: '랭크' },
  { id: 'omokKing', name: '오목왕', desc: '순위표 1위 달성 (온라인 대전 전용)', category: '랭크' },
  { id: 'rehab', name: '재활 치료 시급', desc: '레이팅이 1000점 밑으로 떨어짐 (온라인 대전 전용)', category: '랭크' },

  // 카드 활용
  { id: 'allRounder', name: '올라운더', desc: '모든 카드를 한 번씩 사용', category: '카드' },
  { id: 'destroyer', name: '파괴신', desc: '파괴 계열 카드로 상대 돌 100개 파괴', category: '카드' },
  { id: 'luckyOne', name: '행운아', desc: '확률형 카드 성공 10회', category: '카드' },
  { id: 'unlucky', name: '불운의 아이콘', desc: '확률형 카드 실패 10회', category: '카드' },
  { id: 'miracleWorker', name: '기적의 주인공', desc: "'기적' 카드(1%) 성공", category: '카드' },
  { id: 'gambler', name: '도박사', desc: "'동전 던지기' 카드 100회 사용", category: '카드' },
  { id: 'penniless', name: '무일푼', desc: '손패가 0장인 상태로 게임을 마침 (2인 대국은 포함되지 않아요)', category: '카드' },
  { id: 'watcherEye', name: '감시의 눈', desc: "'감시자' 카드로 상대 효과를 5번 무효화", category: '카드' },
  { id: 'purifier', name: '정화자', desc: "'정화' 카드를 10회 사용", category: '카드' },
  { id: 'tradeMaster', name: '거래의 달인', desc: "'거래' 카드를 20회 사용", category: '카드' },

  // 온라인/소셜
  { id: 'beginner', name: '입문자', desc: '온라인 대전 첫 판 완료', category: '소셜' },
  { id: 'socialite', name: '인맥왕', desc: '친구 10명 추가', category: '소셜' },
  { id: 'backseat', name: '훈수충', desc: '관전 중 채팅 10회 전송', category: '소셜' },
  { id: 'contributor', name: '기여자', desc: '문의하기로 피드백 전달', category: '소셜' },
  { id: 'inviter', name: '초대장', desc: '친구를 대국에 5번 초대', category: '소셜' },
  { id: 'streakLogin', name: '연속 접속', desc: '7일 연속으로 접속', category: '소셜' },

  // 스타일
  { id: 'pacifist', name: '평화주의자', desc: '무승부 제안으로 게임을 5번 성사 (온라인 대전 전용)', category: '스타일' },
  { id: 'blackMaster', name: '선공의 달인', desc: '흑으로 20승 (2인 대국은 포함되지 않아요)', category: '스타일' },
  { id: 'whiteMaster', name: '후공의 달인', desc: '백으로 20승 (2인 대국은 포함되지 않아요)', category: '스타일' },
  { id: 'stormStreak', name: '폭풍 연승', desc: '온라인 대전 5연승', category: '스타일' },
  { id: 'eternalStreak', name: '불멸의 연승', desc: '온라인 대전 10연승', category: '스타일' },
  { id: 'flawlessVictory', name: '완벽한 승부', desc: '온라인 대전에서 카드를 하나도 안 쓰고 승리', category: '스타일' },
  { id: 'longGameMaster', name: '장기전의 신', desc: '100수 이상 진행된 대국에서 승리 (2인 대국은 포함되지 않아요)', category: '스타일' },
  { id: 'fullHouse', name: '풀 하우스', desc: '판이 90% 이상 찬 뒤에 승리 (2인 대국은 포함되지 않아요)', category: '스타일' },

  // 승리
  { id: 'aiSlayer', name: 'AI 학살자', desc: "최고 난이도('불가능') AI를 10번 이김", category: '승리' },

  // 특별 (자동 해금)
  { id: 'developer', name: '개발자', desc: '이 게임을 만든 사람에게 자동으로 주어지는 칭호', category: '특별' },
];

export function getTitleById(id) {
  return TITLES.find((t) => t.id === id);
}

// 누적 승수 구간 - 값이 임계값을 넘을 때마다 해당 칭호를 해금해요.
const WIN_TIERS = [
  { id: 'rookie', threshold: 1 },
  { id: 'skilled', threshold: 10 },
  { id: 'veteran', threshold: 50 },
  { id: 'master', threshold: 100 },
  { id: 'god', threshold: 1000 },
];

// 순수 함수: 카운터 값과 임계값을 비교해서 새로 해금해야 할 칭호 id 목록을 돌려줘요.
// (Firebase 접근 없이 테스트 가능하게 분리했어요)
export function computeNewlyUnlockedWinTiers(totalWins, alreadyUnlocked = {}) {
  return WIN_TIERS.filter((t) => totalWins >= t.threshold && !alreadyUnlocked[t.id]).map((t) => t.id);
}

const SIMPLE_THRESHOLDS = {
  luckyOne: 10,
  unlucky: 10,
  gambler: 100,
  socialite: 10,
  backseat: 10,
  pacifist: 5,
  blackMaster: 20,
  whiteMaster: 20,
  watcherEye: 5,
  purifier: 10,
  tradeMaster: 20,
  inviter: 5,
  streakLogin: 7,
  stormStreak: 5,
  eternalStreak: 10,
  aiSlayer: 10,
};

export function checkSimpleThreshold(titleId, value) {
  const threshold = SIMPLE_THRESHOLDS[titleId];
  if (threshold == null) return false;
  return value >= threshold;
}

export const DESTROYER_THRESHOLD = 100;

const DESTROYER_FIELD_MAP = {
  luckyOne: 'probSuccess',
  unlucky: 'probFail',
  gambler: 'coinFlipUses',
  backseat: 'spectatorChats',
  pacifist: 'drawOfferSuccesses',
  blackMaster: 'blackWins',
  whiteMaster: 'whiteWins',
  watcherEye: 'watcherBlocks',
  purifier: 'purifyUses',
  tradeMaster: 'tradeUses',
  inviter: 'invitesSent',
  stormStreak: 'onlineWinStreak',
  eternalStreak: 'onlineWinStreak',
  aiSlayer: 'aiImpossibleWins',
};

function clampProgress(current, target) {
  const safeCurrent = Math.max(0, current || 0);
  const pct = target > 0 ? Math.min(100, Math.round((safeCurrent / target) * 100)) : 0;
  return { current: Math.min(safeCurrent, target), target, pct };
}

// 칭호 하나의 달성 진행률을 계산해요. stats는 users/{uid}/achievementStats,
// extra.friendsCount는 친구 목록 길이(인맥왕 전용, 별도 경로에 있어서 따로 넘겨줘요).
// 숫자로 진행률을 매길 수 없는(달성/미달성만 있는) 칭호는 null을 돌려줘요.
export function getTitleProgress(titleId, stats = {}, extra = {}) {
  const winTier = WIN_TIERS.find((t) => t.id === titleId);
  if (winTier) return clampProgress(stats.wins, winTier.threshold);

  if (titleId === 'socialite') return clampProgress(extra.friendsCount, SIMPLE_THRESHOLDS.socialite);
  if (titleId === 'streakLogin') return clampProgress(stats.loginStreak?.streak, SIMPLE_THRESHOLDS.streakLogin);
  if (titleId === 'destroyer') return clampProgress(stats.destroyKills, DESTROYER_THRESHOLD);

  const field = DESTROYER_FIELD_MAP[titleId];
  if (field) return clampProgress(stats[field], SIMPLE_THRESHOLDS[titleId]);

  return null;
}

// -------- Firebase 연동 --------

export async function getAchievementData(uid) {
  const db = getDb();
  const snap = await get(ref(db, `users/${uid}`));
  const val = snap.val() || {};
  return {
    stats: val.achievementStats || {},
    titles: val.titles || {},
    equippedTitle: val.equippedTitle || null,
  };
}

// field 카운터를 amount만큼 증가시키고, 새 값을 돌려줘요.
export async function bumpCounter(uid, field, amount = 1) {
  const db = getDb();
  const result = await runTransaction(ref(db, `users/${uid}/achievementStats/${field}`), (cur) => (cur || 0) + amount);
  return result.snapshot.val() || 0;
}

// 이겼으면 연승 카운터를 1 늘리고, 졌거나 비겼으면 0으로 끊어요. (폭풍 연승/불멸의 연승용)
export async function updateWinStreak(uid, won) {
  const db = getDb();
  const result = await runTransaction(
    ref(db, `users/${uid}/achievementStats/onlineWinStreak`),
    (cur) => (won ? (cur || 0) + 1 : 0)
  );
  return result.snapshot.val() || 0;
}

// 하루에 한 번, 로그인할 때마다 호출해요. 어제 접속했으면 연속 기록에 1을 더하고,
// 오늘 이미 기록했으면 그대로, 그 외(하루 이상 건너뜀)엔 1로 리셋해요. (연속 접속용)
export async function updateLoginStreak(uid) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const result = await runTransaction(ref(db, `users/${uid}/achievementStats/loginStreak`), (cur) => {
    if (!cur) return { streak: 1, lastDate: today };
    if (cur.lastDate === today) return cur;
    if (cur.lastDate === yesterday) return { streak: (cur.streak || 0) + 1, lastDate: today };
    return { streak: 1, lastDate: today };
  });
  return result.snapshot.val() || { streak: 1, lastDate: today };
}

// 카드 id를 "사용한 적 있는 카드" 집합에 추가하고, 지금까지 몇 종류를 써봤는지 돌려줘요.
export async function markCardUsed(uid, cardId) {
  const db = getDb();
  await update(ref(db, `users/${uid}/achievementStats/cardsUsed`), { [cardId]: true });
  const snap = await get(ref(db, `users/${uid}/achievementStats/cardsUsed`));
  const val = snap.val() || {};
  return Object.keys(val).length;
}

// 칭호 하나를 잠금 해제해요. 이미 해금되어 있으면 아무 일도 안 해요.
// 진짜로 "처음" 해금된 경우에만 titleCounts(칭호별 보유자 수)를 1 늘려요.
export async function unlockTitle(uid, titleId) {
  const db = getDb();
  const result = await runTransaction(ref(db, `users/${uid}/titles/${titleId}`), (cur) => (cur ? undefined : true));
  if (result.committed) {
    await update(ref(db), { [`titleCounts/${titleId}`]: increment(1) }).catch(() => {});
  }
  return result.committed;
}

export async function unlockTitles(uid, titleIds) {
  if (!titleIds || titleIds.length === 0) return;
  const db = getDb();
  const updates = {};
  for (const id of titleIds) {
    updates[`users/${uid}/titles/${id}`] = true;
    updates[`titleCounts/${id}`] = increment(1);
  }
  await update(ref(db), updates);
}

// 칭호를 장착해요. 순위표/채팅 등에서 다른 사람도 볼 수 있도록 이름을 함께 복사해둬요.
export async function equipTitle(uid, titleId, displayName) {
  const db = getDb();
  const title = titleId ? getTitleById(titleId) : null;
  await update(ref(db), {
    [`users/${uid}/equippedTitle`]: titleId || null,
    [`leaderboard/${uid}/titleName`]: title ? title.name : null,
    [`leaderboard/${uid}/displayName`]: displayName || '이름 없음',
  });
}

// 칭호별 보유자 수를 한 번에 조회해요. ({ [titleId]: 보유자 수 })
export async function getTitleCounts() {
  const db = getDb();
  const snap = await get(ref(db, 'titleCounts'));
  return snap.val() || {};
}

// titleCounts를 실제 users/*/titles 데이터를 전부 세어서 다시 계산해요.
// 집계 기능이 생기기 전에 이미 해금된 칭호들처럼, 카운트가 실제와 어긋났을 때 바로잡는 용도예요.
export async function recomputeTitleCounts() {
  const db = getDb();
  const snap = await get(ref(db, 'users'));
  const users = snap.val() || {};
  const counts = {};
  for (const uid of Object.keys(users)) {
    const titles = users[uid]?.titles || {};
    for (const titleId of Object.keys(titles)) {
      if (titles[titleId]) counts[titleId] = (counts[titleId] || 0) + 1;
    }
  }
  await update(ref(db), { titleCounts: counts });
  return counts;
}

// 관리자(개발자) 전용: 칭호별로 누가 갖고 있는지 전체 목록을 만들어요.
// { [titleId]: [{ uid, displayName, email }] }
export async function getTitleHolders() {
  const db = getDb();
  const snap = await get(ref(db, 'users'));
  const users = snap.val() || {};
  const holders = {};
  for (const uid of Object.keys(users)) {
    const u = users[uid] || {};
    const titles = u.titles || {};
    const displayName = u.profile?.displayName || '(이름 없음)';
    const email = u.profile?.email || null;
    for (const titleId of Object.keys(titles)) {
      if (!titles[titleId]) continue;
      if (!holders[titleId]) holders[titleId] = [];
      holders[titleId].push({ uid, displayName, email });
    }
  }
  return holders;
}

// Realtime Database 키 규칙(., #, $, [, ] 금지)에 맞게 이메일을 안전한 키로 바꿔요.
function emailToKey(email) {
  return email.trim().toLowerCase().replace(/[.#$[\]]/g, '_');
}

// 관리자(개발자) 전용: 특정 이메일 계정의 칭호를 전부 회수하고 장착도 해제해요.
export async function revokeAllTitlesByEmail(email) {
  const db = getDb();
  const uidSnap = await get(ref(db, `usersByEmail/${emailToKey(email)}`));
  if (!uidSnap.exists()) return { ok: false, reason: 'not-found' };
  const uid = uidSnap.val();
  await update(ref(db), {
    [`users/${uid}/titles`]: null,
    [`users/${uid}/equippedTitle`]: null,
    [`leaderboard/${uid}/titleName`]: null,
  });
  await recomputeTitleCounts();
  return { ok: true, uid };
}

export { isFirebaseConfigured };
