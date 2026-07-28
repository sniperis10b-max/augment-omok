// 돌을 놓을 때 나오는 시각 이펙트 카탈로그예요. 스킨보다 조건을 더 어렵게 잡았어요.
// className은 index.css에 정의된 CSS 애니메이션 클래스와 짝을 이뤄요.

export const PLACEMENT_EFFECTS = [
  { id: 'none', name: '없음 (기본)', className: '', questDesc: '기본 제공' },
  { id: 'shock', name: '충격파', className: 'fx-shock', questDesc: '랭크전 15연승' },
  { id: 'ripple', name: '파동', className: 'fx-ripple', questDesc: '마스터 티어 도달 후, 그 상태에서 랭크전 10승 추가' },
  { id: 'flash', name: '섬광', className: 'fx-flash', questDesc: "불가능 AI 10승 + 흑 10승 + 백 10승 모두 달성" },
  { id: 'glow', name: '잔광', className: 'fx-glow', questDesc: '스킨 6종 이상 + 칭호 20개 이상 해금' },
];

export function getPlacementEffectById(id) {
  return PLACEMENT_EFFECTS.find((e) => e.id === id) || PLACEMENT_EFFECTS[0];
}

// 이펙트 하나의 해금 조건을 확인해요. stats는 achievementStats, ctx는
// { unlockedSkinCount, titleCount } 처럼 다른 시스템에서 모아온 값이에요.
export function isPlacementEffectUnlocked(effectId, stats = {}, ctx = {}) {
  switch (effectId) {
    case 'none': return true;
    case 'shock': return (stats.onlineWinStreak || 0) >= 15;
    case 'ripple': return (stats.postMasterWins || 0) >= 10;
    case 'flash':
      return (stats.aiImpossibleWins || 0) >= 10
        && (stats.blackWins || 0) >= 10
        && (stats.whiteWins || 0) >= 10;
    case 'glow':
      return (ctx.unlockedSkinCount || 0) >= 6 && (ctx.titleCount || 0) >= 20;
    default: return false;
  }
}

function clampProgress(current, target) {
  const safeCurrent = Math.max(0, current || 0);
  const pct = target > 0 ? Math.min(100, Math.round((safeCurrent / target) * 100)) : 0;
  return { current: Math.min(safeCurrent, target), target, pct };
}

// 이펙트 하나의 달성 진행률. 조건이 여러 개인 것들(섬광/잔광)은 제일 뒤처진 조건
// 기준으로 퍼센트만 줘요 (단위가 서로 달라서 하나의 x/y로 못 합쳐요).
export function getPlacementEffectProgress(effectId, stats = {}, ctx = {}) {
  switch (effectId) {
    case 'shock': return clampProgress(stats.onlineWinStreak, 15);
    case 'ripple': return clampProgress(stats.postMasterWins, 10);
    case 'flash': {
      const p1 = clampProgress(stats.aiImpossibleWins, 10).pct;
      const p2 = clampProgress(stats.blackWins, 10).pct;
      const p3 = clampProgress(stats.whiteWins, 10).pct;
      return { current: null, target: null, pct: Math.min(p1, p2, p3) };
    }
    case 'glow': {
      const p1 = clampProgress(ctx.unlockedSkinCount, 6).pct;
      const p2 = clampProgress(ctx.titleCount, 20).pct;
      return { current: null, target: null, pct: Math.min(p1, p2) };
    }
    default: return null;
  }
}
