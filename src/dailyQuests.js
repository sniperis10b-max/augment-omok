// 매일 초기화되는 일일 퀘스트 시스템이에요. 이미 추적 중인 achievementStats 카운터를
// "오늘 시작 시점 값(baseline)"과 비교해서 진행도를 계산해요 - 별도로 오늘치만 세는
// 카운터를 새로 안 만들어도 돼요.

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

// statKey는 achievementStats 안의 필드 이름이에요 (없으면 0으로 취급).
export const QUEST_TEMPLATES = [
  { id: 'aiGames2', name: 'AI 대전 2판', statKey: 'aiGames', target: 2 },
  { id: 'onlineGames1', name: '온라인 대전 1판', statKey: 'onlineGames', target: 1 },
  { id: 'wins2', name: '승리 2회 (모드 무관)', statKey: 'wins', target: 2 },
  { id: 'cardUses5', name: '카드 5장 사용', statKey: 'totalCardUses', target: 5 },
  { id: 'destroyKills3', name: '파괴 계열로 상대 돌 3개 파괴', statKey: 'destroyKills', target: 3 },
  { id: 'probCards2', name: '확률형 카드 2회 시도 (성공/실패 무관)', statKey: 'totalProbAttempts', target: 2 },
  { id: 'draws1', name: '무승부 1회', statKey: 'totalDraws', target: 1 },
  { id: 'longGames1', name: '100수 이상 대국 1판', statKey: 'longGamesPlayed', target: 1 },
];

export const DAILY_REWARD_RANK_POINTS = 30;

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (기기 로컬 시간이 아니라 UTC 기준이에요)
}

function pickThreeTemplates() {
  const shuffled = [...QUEST_TEMPLATES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

// 오늘 퀘스트가 아직 없으면(날짜가 바뀌었으면) 새로 3개를 뽑아서 저장하고,
// 있으면 그대로 반환해요. stats는 users/{uid}/achievementStats예요.
export async function ensureDailyQuests(uid, stats) {
  const db = getDb();
  const snap = await get(ref(db, `users/${uid}/dailyQuests`));
  const existing = snap.val();
  const today = getTodayKey();

  if (existing && existing.date === today) return existing;

  const picked = pickThreeTemplates().map((t) => ({
    id: t.id,
    baseline: stats?.[t.statKey] || 0,
  }));
  const fresh = { date: today, quests: picked, rewardClaimed: false };
  await update(ref(db, `users/${uid}`), { dailyQuests: fresh });
  return fresh;
}

// 퀘스트별 진행도를 계산해요. { id, name, target, current, done }
export function getQuestProgress(dailyQuests, stats) {
  if (!dailyQuests) return [];
  return dailyQuests.quests.map((q) => {
    const template = QUEST_TEMPLATES.find((t) => t.id === q.id);
    if (!template) return null;
    const current = Math.max(0, (stats?.[template.statKey] || 0) - q.baseline);
    return {
      id: q.id,
      name: template.name,
      target: template.target,
      current: Math.min(current, template.target),
      done: current >= template.target,
    };
  }).filter(Boolean);
}

// 오늘 퀘스트 3개를 전부 완료했고 아직 보상을 안 받았으면, 랭크 포인트를 조금 얹어주고
// 보상 수령 처리해요. 이미 받았거나 아직 다 못 깼으면 아무 일도 안 일어나요.
export async function claimDailyReward(uid, dailyQuests, stats, applyRankPointsChange, currentRankPoints) {
  if (!dailyQuests || dailyQuests.rewardClaimed) return { claimed: false };
  const progress = getQuestProgress(dailyQuests, stats);
  if (progress.length === 0 || !progress.every((q) => q.done)) return { claimed: false };

  const db = getDb();
  await update(ref(db, `users/${uid}/dailyQuests`), { rewardClaimed: true });
  const newPoints = await applyRankPointsChange(uid, currentRankPoints, DAILY_REWARD_RANK_POINTS, null, false);
  return { claimed: true, newPoints };
}

export { isFirebaseConfigured };
