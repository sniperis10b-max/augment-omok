// 바둑판과 바둑돌의 겉모습을 바꾸는 스킨 카탈로그예요. 지금은 개발자 계정에서만 고를 수 있어요
// (settings 자체는 이 브라우저에만 저장되는 로컬 설정이라, Firebase 계정 데이터와는 별개예요 -
// "내 계정만 열어준다"는 건 UI에서 개발자 계정일 때만 선택 가능하게 막아둔다는 뜻이에요).

import { CARDS } from './cards.js';
import { CHALLENGES } from './challenges.js';

export const BOARD_SKINS = [
  {
    id: 'classic',
    name: '클래식 나무',
    background: '#dcb35c',
    border: '#b8903f',
    line: 'rgba(0, 0, 0, 0.35)',
    questDesc: '기본 제공',
  },
  {
    id: 'darkWalnut',
    name: '다크 월넛',
    background: 'linear-gradient(135deg, #6b4a2f, #4a3120)',
    border: '#3a2718',
    line: 'rgba(255, 255, 255, 0.18)',
    questDesc: 'AI 대전 50판 완료',
  },
  {
    id: 'marble',
    name: '대리석',
    background: 'linear-gradient(135deg, #f2f0ea, #dedad0)',
    border: '#c7c2b4',
    line: 'rgba(0, 0, 0, 0.25)',
    questDesc: '무승부 10판 달성 (AI+온라인 누적)',
  },
  {
    id: 'deepBlue',
    name: '딥 블루',
    background: 'linear-gradient(135deg, #1e3a5f, #0f2138)',
    border: '#0a1826',
    line: 'rgba(255, 255, 255, 0.2)',
    questDesc: '온라인 대전(친선+랭크 합산) 20판 완료',
  },
  {
    id: 'emeraldFelt',
    name: '에메랄드 펠트',
    background: 'linear-gradient(135deg, #1f5c42, #123a29)',
    border: '#0d2a1d',
    line: 'rgba(255, 255, 255, 0.18)',
    questDesc: '랭크전 골드 티어 최초 도달',
  },
  {
    id: 'roseGold',
    name: '로즈 골드',
    background: 'linear-gradient(135deg, #e8b4a8, #c98a7a)',
    border: '#a8695a',
    line: 'rgba(0, 0, 0, 0.25)',
    questDesc: '서로 다른 친구 5명과 각각 온라인 대전 1판 이상',
  },
  {
    id: 'midnight',
    name: '미드나잇',
    background: 'linear-gradient(135deg, #2a2a30, #121216)',
    border: '#08080a',
    line: 'rgba(255, 255, 255, 0.18)',
    questDesc: '자정~새벽 4시 사이 대국 5판 (AI+온라인)',
  },
  {
    id: 'pastelMint',
    name: '파스텔 민트',
    background: 'linear-gradient(135deg, #d5f0e0, #b8e0cc)',
    border: '#9bcbb2',
    line: 'rgba(0, 0, 0, 0.2)',
    questDesc: '온라인 대전에서 무승부 제안으로 5판 마무리',
  },
  {
    id: 'aurora',
    name: '오로라',
    background: 'linear-gradient(135deg, #7bf1c9, #7b9df1, #c97bf1)',
    border: '#5a8fd6',
    line: 'rgba(255, 255, 255, 0.2)',
    questDesc: '랭크전 티어 승급 15회',
  },
  {
    id: 'lavastone',
    name: '용암석',
    background: 'linear-gradient(135deg, #ff6a3d, #7a1f0d)',
    border: '#4a1206',
    line: 'rgba(255, 220, 180, 0.3)',
    questDesc: '파괴 계열 카드로 상대 돌 30개 파괴',
  },
  {
    id: 'galaxy',
    name: '은하수',
    background: 'radial-gradient(circle at 30% 30%, #4b3f8a, #0a0a2a)',
    border: '#1a1a3a',
    line: 'rgba(255, 255, 255, 0.25)',
    questDesc: '온라인 대전에서 완벽한 승부(카드 없이 승리) 10회',
  },
  {
    id: 'ancientRuins',
    name: '고대 유적',
    background: 'linear-gradient(135deg, #b8ab8a, #8a7a5a)',
    border: '#6b5d42',
    line: 'rgba(0, 0, 0, 0.3)',
    questDesc: '100수 이상 대국 10판 진행 (승패 무관)',
  },
  {
    id: 'chessboard',
    name: '체스판',
    background: 'repeating-conic-gradient(#2a2a2a 0% 25%, #f2f2f2 0% 50%)',
    border: '#1a1a1a',
    line: 'rgba(255, 0, 0, 0.3)',
    questDesc: '온라인 대전(친선전+랭크전) 총 100판 진행',
  },
  {
    id: 'glacier',
    name: '빙하',
    background: 'linear-gradient(135deg, #dff6ff, #8fd3f4)',
    border: '#5fb0d8',
    line: 'rgba(0, 60, 90, 0.25)',
    questDesc: "'얼리기' 카드 100회 사용",
  },
  {
    id: 'desertStorm',
    name: '사막의 폭풍',
    background: 'linear-gradient(135deg, #e8c27a, #b8862f)',
    border: '#8a6320',
    line: 'rgba(60, 30, 0, 0.3)',
    questDesc: "'소용돌이' 카드 100회 사용",
  },
  {
    id: 'goldenTemple',
    name: '황금 사원',
    background: 'linear-gradient(135deg, #ffe27a, #a67c1a)',
    border: '#7a5a10',
    line: 'rgba(80, 50, 0, 0.35)',
    questDesc: '랭크전 200판 진행 (승패 무관)',
  },
  {
    id: 'dawn',
    name: '여명',
    background: 'linear-gradient(135deg, #ffd6a5, #ff9a8b, #a5c8ff)',
    border: '#e08a6a',
    line: 'rgba(80, 40, 30, 0.25)',
    questDesc: '오전 5시~8시 사이 대국 30판',
  },
  {
    id: 'ruinedBattlefield',
    name: '폐허가 된 전장',
    background: 'linear-gradient(135deg, #5a5248, #2a2620)',
    border: '#1a1712',
    line: 'rgba(255, 120, 60, 0.25)',
    questDesc: '상대에게 돌 5개 이상 파괴당한 판에서도 승리 10회',
  },
  {
    id: 'nebula',
    name: '네뷸러',
    background: 'radial-gradient(circle at 40% 40%, #ff7ae0, #4a1a8a, #0a0a2a)',
    border: '#3a1a6a',
    line: 'rgba(255, 255, 255, 0.25)',
    questDesc: '확률형 카드 성공 누적 150회',
  },
  {
    id: 'firstSnow',
    name: '첫눈',
    background: 'linear-gradient(135deg, #ffffff, #dce8f0)',
    border: '#c0d4e0',
    line: 'rgba(80, 100, 120, 0.2)',
    questDesc: '무승부로 대국 50판 마무리',
  },
  {
    id: 'alchemistBench',
    name: '연금술사의 작업대',
    background: 'linear-gradient(135deg, #6a4a2a, #3a2a14)',
    border: '#2a1c0e',
    line: 'rgba(180, 220, 120, 0.3)',
    questDesc: "'연금술' 카드 100회 사용",
  },
  {
    id: 'plagueGround',
    name: '역병지대',
    background: 'linear-gradient(135deg, #4a5a2a, #1a2a0a)',
    border: '#0e1a06',
    line: 'rgba(140, 200, 60, 0.3)',
    questDesc: "'오염' 카드 100회 사용",
  },
  {
    id: 'errorBoard',
    name: 'ERROR',
    background:
      'repeating-linear-gradient(0deg, rgba(0,0,0,0.5) 0 1px, transparent 1px 3px), ' +
      'repeating-linear-gradient(90deg, #050007 0 6px, #ff003c 6px 8px, #050007 8px 22px, #00fff9 22px 24px, #050007 24px 38px, #050007 38px 46px, #ff003c 46px 47px, #050007 47px 64px)',
    border: '#ff003c',
    line: 'rgba(0, 255, 249, 0.35)',
    questDesc: '???',
  },
];

export const STONE_SKINS = [
  {
    id: 'classic',
    name: '클래식',
    black: '#1a1a1a',
    white: '#fbfaf6',
    whiteBorder: '#8a8678',
    questDesc: '기본 제공',
  },
  {
    id: 'onyxPearl',
    name: '오닉스 & 진주',
    black: 'linear-gradient(160deg, #2a2a2a, #050505)',
    white: 'linear-gradient(160deg, #fffdf5, #e8e2cf)',
    whiteBorder: '#c9bfa0',
    questDesc: '흑으로 10승 + 백으로 10승 모두 달성',
  },
  {
    id: 'neon',
    name: '네온',
    black: 'linear-gradient(160deg, #ff2e93, #7a0f47)',
    white: 'linear-gradient(160deg, #39f3ff, #0b8b96)',
    whiteBorder: '#0b8b96',
    questDesc: "'메아리' 카드 성공 2회",
  },
  {
    id: 'goldSilver',
    name: '골드 & 실버',
    black: 'linear-gradient(160deg, #caa243, #7a5c14)',
    white: 'linear-gradient(160deg, #f2f2f2, #b9b9b9)',
    whiteBorder: '#9c9c9c',
    questDesc: '랭크전 플래티넘 티어 최초 도달',
  },
  {
    id: 'pastel',
    name: '파스텔',
    black: 'linear-gradient(160deg, #9d8ce0, #6a58b8)',
    white: 'linear-gradient(160deg, #fff3b0, #ffe27a)',
    whiteBorder: '#e0c460',
    questDesc: '친선전(랜덤 매칭+친구와 플레이) 30판 완료',
  },
  {
    id: 'woodTone',
    name: '우드톤',
    black: 'linear-gradient(160deg, #6b4226, #3d2314)',
    white: 'linear-gradient(160deg, #e8c9a0, #cca774)',
    whiteBorder: '#a98552',
    questDesc: '100수 이상 대국에서 승리 5회',
  },
  {
    id: 'rubySapphire',
    name: '루비 & 사파이어',
    black: 'linear-gradient(160deg, #c22b3d, #6e1420)',
    white: 'linear-gradient(160deg, #4d7ee0, #1f4a9e)',
    whiteBorder: '#1f4a9e',
    questDesc: '랭크전 루비 티어 최초 도달',
  },
  {
    id: 'monochrome',
    name: '모노크롬 그라데이션',
    black: 'linear-gradient(160deg, #4a4a4a, #0a0a0a)',
    white: 'linear-gradient(160deg, #ffffff, #cfcfcf)',
    whiteBorder: '#aaaaaa',
    questDesc: '칭호 10개 이상 해금',
  },
  {
    id: 'crystal',
    name: '크리스탈',
    black: 'linear-gradient(160deg, #3a2f6b, #1a1440)',
    white: 'linear-gradient(160deg, #d8f0ff, #9fd6f5)',
    whiteBorder: '#7fc0e8',
    questDesc: "'낙인' 카드 50회 사용",
  },
  {
    id: 'phoenix',
    name: '불사조',
    black: 'linear-gradient(160deg, #ff8c3d, #c22b1a)',
    white: 'linear-gradient(160deg, #ffe27a, #ff9d3d)',
    whiteBorder: '#e08a2a',
    questDesc: "'복구' 카드 50회 사용",
  },
  {
    id: 'shadow',
    name: '그림자',
    black: 'linear-gradient(160deg, #1a1a1a, #000000)',
    white: 'linear-gradient(160deg, #6a6a6a, #2a2a2a)',
    whiteBorder: '#3a3a3a',
    questDesc: '감시자로 상대 효과 50회 무효화',
  },
  {
    id: 'hologram',
    name: '홀로그램',
    black: 'linear-gradient(160deg, #3df1ff, #9d3dff)',
    white: 'linear-gradient(160deg, #ffffff, #b3f5ff)',
    whiteBorder: '#7fe0f0',
    questDesc: '모든 카드를 각각 10번씩 사용',
  },
  {
    id: 'windSpirit',
    name: '바람의 정령',
    black: 'linear-gradient(160deg, #a8d8c8, #4a8a7a)',
    white: 'linear-gradient(160deg, #f0fff8, #c8ecdf)',
    whiteBorder: '#a0d8c0',
    questDesc: "'봉인' 카드 100회 사용",
  },
  {
    id: 'steel',
    name: '강철',
    black: 'linear-gradient(160deg, #5a6470, #2a3038)',
    white: 'linear-gradient(160deg, #e8ecef, #b8c2ca)',
    whiteBorder: '#9aa5ad',
    questDesc: "'강화' 카드 100회 사용",
  },
  {
    id: 'mirror',
    name: '거울',
    black: 'linear-gradient(160deg, #cfd8e0, #8fa0ac)',
    white: 'linear-gradient(160deg, #ffffff, #dfe8ee)',
    whiteBorder: '#c0ccd6',
    questDesc: "'복제' 카드 100회 사용",
  },
  {
    id: 'cursedDoll',
    name: '저주받은 인형',
    black: 'linear-gradient(160deg, #4a1a2a, #1a0a12)',
    white: 'linear-gradient(160deg, #d8a8b8, #8a4a5a)',
    whiteBorder: '#6a3a48',
    questDesc: "'낙인' 200회 누적 사용",
  },
  {
    id: 'obelisk',
    name: '오벨리스크',
    black: 'linear-gradient(160deg, #6a5a3a, #2a2214)',
    white: 'linear-gradient(160deg, #e8d8a8, #b8a068)',
    whiteBorder: '#9a8850',
    questDesc: "'성역' 카드 100회 사용",
  },
  {
    id: 'crown',
    name: '왕관',
    black: 'linear-gradient(160deg, #3a2a0a, #1a1005)',
    white: 'linear-gradient(160deg, #ffe27a, #d4af37)',
    whiteBorder: '#b8952a',
    questDesc: '불가능 난이도 AI 20연승',
  },
  {
    id: 'invisible',
    name: '투명 돌',
    black: 'transparent',
    white: 'transparent',
    whiteBorder: 'transparent',
    questDesc: '모든 챌린지(핸디캡) 클리어',
  },
  {
    id: 'twins',
    name: '쌍둥이',
    black: 'linear-gradient(160deg, #8a8aff, #3a3a9a)',
    white: 'linear-gradient(160deg, #ffffff, #c0c0ff)',
    whiteBorder: '#a0a0e0',
    questDesc: "'복제' 카드 30회 사용",
  },
  {
    id: 'frostbite',
    name: '동결',
    black: 'linear-gradient(160deg, #2a4a5a, #0a1a2a)',
    white: 'linear-gradient(160deg, #d8f0ff, #a0d8ec)',
    whiteBorder: '#8ac8e0',
    questDesc: "'얼리기' 카드 50회 사용",
  },
  {
    id: 'swappedFate',
    name: '뒤바뀐 운명',
    black: 'linear-gradient(160deg, #e8e8e8, #2a2a2a)',
    white: 'linear-gradient(160deg, #2a2a2a, #e8e8e8)',
    whiteBorder: '#8a8a8a',
    questDesc: "'위치 교환' 카드 100회 사용",
  },
  {
    id: 'taxidermy',
    name: '박제',
    black: 'linear-gradient(160deg, #6a5a4a, #2a2018)',
    white: 'linear-gradient(160deg, #e0d0b8, #b0987a)',
    whiteBorder: '#9a8262',
    questDesc: "'낙인' 카드 30회 사용",
  },
  {
    id: 'reverseEngineer',
    name: '역설계',
    black: 'linear-gradient(160deg, #4a4a5a, #16161e)',
    white: 'linear-gradient(160deg, #b8c8e0, #7888a8)',
    whiteBorder: '#647092',
    questDesc: "'관통' 카드 100회 사용",
  },
  {
    id: 'errorStone',
    name: 'ERROR',
    black:
      'repeating-linear-gradient(95deg, #050005 0 3px, #ff003c 3px 4px, #050005 4px 10px, #00fff9 10px 11px, #050005 11px 17px, #050005 17px 22px, #ff003c 22px 23px, #050005 23px 30px)',
    white:
      'repeating-linear-gradient(95deg, #f5f5f5 0 3px, #ff003c 3px 4px, #f5f5f5 4px 10px, #00fff9 10px 11px, #f5f5f5 11px 17px, #f5f5f5 17px 22px, #ff003c 22px 23px, #f5f5f5 23px 30px)',
    whiteBorder: '#ff003c',
    questDesc: '???',
  },
];

export function getBoardSkinById(id) {
  return BOARD_SKINS.find((s) => s.id === id) || BOARD_SKINS[0];
}

// -------- 관리자(개발자) 전용: 스킨을 퀘스트 조건 없이 직접 부여/회수 --------

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

function emailToKey(email) {
  return email.trim().toLowerCase().replace(/[.#$[\]]/g, '_');
}

// 이 계정이 "퀘스트 조건 없이" 강제로 부여받은 스킨들이에요. isBoardSkinUnlocked/
// isStoneSkinUnlocked와 별개로, 이 목록에 있으면 무조건 사용 가능해요.
export async function getGrantedSkins(uid) {
  const db = getDb();
  const snap = await get(ref(db, `users/${uid}`));
  const data = snap.val() || {};
  return {
    board: data.grantedBoardSkins || {},
    stone: data.grantedStoneSkins || {},
  };
}

export async function adminGrantSkinsByEmail(email, boardSkinIds, stoneSkinIds) {
  const db = getDb();
  const uidSnap = await get(ref(db, `usersByEmail/${emailToKey(email)}`));
  if (!uidSnap.exists()) return { ok: false, reason: 'not-found' };
  const uid = uidSnap.val();
  const updates = {};
  for (const id of boardSkinIds || []) updates[`users/${uid}/grantedBoardSkins/${id}`] = true;
  for (const id of stoneSkinIds || []) updates[`users/${uid}/grantedStoneSkins/${id}`] = true;
  await update(ref(db), updates);
  return { ok: true, uid };
}

export async function adminRevokeSkins(uid, boardSkinIds, stoneSkinIds) {
  const db = getDb();
  const updates = {};
  for (const id of boardSkinIds || []) updates[`users/${uid}/grantedBoardSkins/${id}`] = null;
  for (const id of stoneSkinIds || []) updates[`users/${uid}/grantedStoneSkins/${id}`] = null;
  await update(ref(db), updates);
}

export function getStoneSkinById(id) {
  return STONE_SKINS.find((s) => s.id === id) || STONE_SKINS[0];
}

// 스킨 하나의 해금 조건을 확인해요. stats는 users/{uid}/achievementStats,
// ctx는 { peakTierIndex, friendsPlayedCount, titleCount } 처럼 다른 시스템 값들을 모아둔 값이에요.
export function isBoardSkinUnlocked(skinId, stats = {}, ctx = {}) {
  switch (skinId) {
    case 'classic': return true;
    case 'darkWalnut': return (stats.aiGames || 0) >= 50;
    case 'marble': return (stats.totalDraws || 0) >= 10;
    case 'deepBlue': return (stats.onlineGames || 0) >= 20;
    case 'emeraldFelt': return (ctx.peakTierIndex || 0) >= 2;
    case 'roseGold': return (ctx.friendsPlayedCount || 0) >= 5;
    case 'midnight': return (stats.midnightGames || 0) >= 5;
    case 'pastelMint': return (stats.drawOfferSuccesses || 0) >= 5;
    case 'aurora': return (stats.tierPromotions || 0) >= 15;
    case 'lavastone': return (stats.destroyKills || 0) >= 30;
    case 'galaxy': return (stats.flawlessVictories || 0) >= 10;
    case 'ancientRuins': return (stats.longGamesPlayed || 0) >= 10;
    case 'chessboard': return (stats.onlineGames || 0) >= 100;
    case 'glacier': return (stats.freezeCellUses || 0) >= 100;
    case 'desertStorm': return (stats.vortexUses || 0) >= 100;
    case 'goldenTemple': return (stats.rankedGamesPlayed || 0) >= 200;
    case 'dawn': return (stats.dawnGames || 0) >= 30;
    case 'ruinedBattlefield': return (stats.ruinedBattlefieldWins || 0) >= 10;
    case 'nebula': return (stats.probSuccess || 0) >= 150;
    case 'firstSnow': return (stats.totalDraws || 0) >= 50;
    case 'alchemistBench': return (stats.alchemyUses || 0) >= 100;
    case 'plagueGround': return (stats.corruptUses || 0) >= 100;
    case 'errorBoard': return (stats.tutorialClicks || 0) >= 100;
    default: return false;
  }
}

export function isStoneSkinUnlocked(skinId, stats = {}, ctx = {}) {
  switch (skinId) {
    case 'classic': return true;
    case 'onyxPearl': return (stats.blackWins || 0) >= 10 && (stats.whiteWins || 0) >= 10;
    case 'neon': return (stats.echoSuccesses || 0) >= 2;
    case 'goldSilver': return (ctx.peakTierIndex || 0) >= 3;
    case 'pastel': return (stats.casualGames || 0) >= 30;
    case 'woodTone': return (stats.longGameWins || 0) >= 5;
    case 'rubySapphire': return (ctx.peakTierIndex || 0) >= 5;
    case 'monochrome': return (ctx.titleCount || 0) >= 10;
    case 'crystal': return (stats.markUses || 0) >= 50;
    case 'phoenix': return (stats.restoreUses || 0) >= 50;
    case 'shadow': return (stats.watcherBlocks || 0) >= 50;
    case 'hologram': return CARDS.every((c) => (ctx.cardUseCounts?.[c.id] || 0) >= 10);
    case 'windSpirit': return (stats.sealLineUses || 0) >= 100;
    case 'steel': return (stats.reinforceUses || 0) >= 100;
    case 'mirror': return (stats.duplicateUses || 0) >= 100;
    case 'cursedDoll': return (stats.markUses || 0) >= 200;
    case 'obelisk': return (stats.sanctuaryUses || 0) >= 100;
    case 'crown': return (stats.impossibleWinStreak || 0) >= 20;
    case 'invisible': {
      const cleared = ctx.challengesCleared || {};
      return CHALLENGES.every((c) => cleared[c.id]);
    }
    case 'twins': return (stats.duplicateUses || 0) >= 30;
    case 'frostbite': return (stats.freezeCellUses || 0) >= 50;
    case 'swappedFate': return (stats.swapUses || 0) >= 100;
    case 'taxidermy': return (stats.markUses || 0) >= 30;
    case 'reverseEngineer': return (stats.overwriteUses || 0) >= 100;
    case 'errorStone': return (stats.timeLimit369Count || 0) >= 2;
    default: return false;
  }
}

function clampProgress(current, target) {
  const safeCurrent = Math.max(0, current || 0);
  const pct = target > 0 ? Math.min(100, Math.round((safeCurrent / target) * 100)) : 0;
  return { current: Math.min(safeCurrent, target), target, pct };
}

// 스킨 하나의 달성 진행률을 계산해요. 조건이 하나면 current/target을 주고,
// 조건이 여러 개(예: 흑 10승 + 백 10승)면 제일 뒤처진 쪽을 기준으로 퍼센트만 줘요
// (단위가 서로 달라서 하나의 x/y로 합칠 수 없어서예요 - current/target은 null이 돼요).
export function getBoardSkinProgress(skinId, stats = {}, ctx = {}) {
  switch (skinId) {
    case 'darkWalnut': return clampProgress(stats.aiGames, 50);
    case 'marble': return clampProgress(stats.totalDraws, 10);
    case 'deepBlue': return clampProgress(stats.onlineGames, 20);
    case 'emeraldFelt': return clampProgress(ctx.peakTierIndex, 2);
    case 'roseGold': return clampProgress(ctx.friendsPlayedCount, 5);
    case 'midnight': return clampProgress(stats.midnightGames, 5);
    case 'pastelMint': return clampProgress(stats.drawOfferSuccesses, 5);
    case 'aurora': return clampProgress(stats.tierPromotions, 15);
    case 'lavastone': return clampProgress(stats.destroyKills, 30);
    case 'galaxy': return clampProgress(stats.flawlessVictories, 10);
    case 'ancientRuins': return clampProgress(stats.longGamesPlayed, 10);
    case 'chessboard': return clampProgress(stats.onlineGames, 100);
    case 'glacier': return clampProgress(stats.freezeCellUses, 100);
    case 'desertStorm': return clampProgress(stats.vortexUses, 100);
    case 'goldenTemple': return clampProgress(stats.rankedGamesPlayed, 200);
    case 'dawn': return clampProgress(stats.dawnGames, 30);
    case 'ruinedBattlefield': return clampProgress(stats.ruinedBattlefieldWins, 10);
    case 'nebula': return clampProgress(stats.probSuccess, 150);
    case 'firstSnow': return clampProgress(stats.totalDraws, 50);
    case 'alchemistBench': return clampProgress(stats.alchemyUses, 100);
    case 'plagueGround': return clampProgress(stats.corruptUses, 100);
    case 'errorBoard': return null; // 조건이 비밀이라 진행률도 안 보여줘요
    default: return null;
  }
}

export function getStoneSkinProgress(skinId, stats = {}, ctx = {}) {
  switch (skinId) {
    case 'onyxPearl': {
      const p1 = clampProgress(stats.blackWins, 10).pct;
      const p2 = clampProgress(stats.whiteWins, 10).pct;
      return { current: null, target: null, pct: Math.min(p1, p2) };
    }
    case 'neon': return clampProgress(stats.echoSuccesses, 2);
    case 'goldSilver': return clampProgress(ctx.peakTierIndex, 3);
    case 'pastel': return clampProgress(stats.casualGames, 30);
    case 'woodTone': return clampProgress(stats.longGameWins, 5);
    case 'rubySapphire': return clampProgress(ctx.peakTierIndex, 5);
    case 'monochrome': return clampProgress(ctx.titleCount, 10);
    case 'crystal': return clampProgress(stats.markUses, 50);
    case 'phoenix': return clampProgress(stats.restoreUses, 50);
    case 'shadow': return clampProgress(stats.watcherBlocks, 50);
    case 'hologram': {
      const counts = ctx.cardUseCounts || {};
      let minCount = Infinity;
      for (const c of CARDS) minCount = Math.min(minCount, counts[c.id] || 0);
      return clampProgress(minCount === Infinity ? 0 : minCount, 10);
    }
    case 'windSpirit': return clampProgress(stats.sealLineUses, 100);
    case 'steel': return clampProgress(stats.reinforceUses, 100);
    case 'mirror': return clampProgress(stats.duplicateUses, 100);
    case 'cursedDoll': return clampProgress(stats.markUses, 200);
    case 'obelisk': return clampProgress(stats.sanctuaryUses, 100);
    case 'crown': return clampProgress(stats.impossibleWinStreak, 20);
    case 'invisible': {
      const cleared = ctx.challengesCleared || {};
      const count = CHALLENGES.filter((c) => cleared[c.id]).length;
      return clampProgress(count, CHALLENGES.length);
    }
    case 'twins': return clampProgress(stats.duplicateUses, 30);
    case 'frostbite': return clampProgress(stats.freezeCellUses, 50);
    case 'swappedFate': return clampProgress(stats.swapUses, 100);
    case 'taxidermy': return clampProgress(stats.markUses, 30);
    case 'reverseEngineer': return clampProgress(stats.overwriteUses, 100);
    case 'errorStone': return null; // 조건이 비밀이라 진행률도 안 보여줘요
    default: return null;
  }
}
