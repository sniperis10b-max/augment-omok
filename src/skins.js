// 바둑판과 바둑돌의 겉모습을 바꾸는 스킨 카탈로그예요. 지금은 개발자 계정에서만 고를 수 있어요
// (settings 자체는 이 브라우저에만 저장되는 로컬 설정이라, Firebase 계정 데이터와는 별개예요 -
// "내 계정만 열어준다"는 건 UI에서 개발자 계정일 때만 선택 가능하게 막아둔다는 뜻이에요).

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
];

export function getBoardSkinById(id) {
  return BOARD_SKINS.find((s) => s.id === id) || BOARD_SKINS[0];
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
    default: return false;
  }
}
