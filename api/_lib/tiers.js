// 온라인 대전을 위한 랭크 티어 시스템 (rankpoints.js의 랭크 포인트를 기준으로 매겨요).
//
// - 랭크 포인트는 0점에서 시작해요.
// - 이기면 무조건 +100점.
// - 지면 "현재 내 티어"에 따라 점수를 잃어요 (같은 티어 안의 1/2/3 단계는 잃는 양이 똑같아요):
//     브론즈 -10, 실버 -30, 골드 -50, 플래티넘 -70, 다이아몬드 -90,
//     루비 -110, 에메랄드 -130, 신화 -165, 마스터 -200
// - 마스터를 제외한 모든 티어는 3단계(3 → 2 → 1, 1이 제일 높은 단계)로 나뉘어요.
// - 티어가 높아질수록 그 티어를 통과하는 데 필요한 점수 구간(폭)도 더 넓어져요
//   (브론즈 300 / 실버 400 / 골드 500 / 플래티넘 600 / 다이아몬드 700 / 루비 800 / 에메랄드 900 / 신화 1100).

// 티어별 "한 단계(division)"의 폭.
// 브론즈 300 / 실버 400 / 골드 500 / 플래티넘 600 / 다이아몬드 700 / 루비 800 / 에메랄드 900 / 신화 1100
const DIVISION_WIDTHS = [300, 400, 500, 600, 700, 800, 900, 1100];
const DIVISIONS_PER_TIER = 3;

const TIER_META = [
  { id: 'bronze', name: '브론즈', color: '#a97142', color2: '#6b4423', icon: 'Shield', lossAmount: 10 },
  { id: 'silver', name: '실버', color: '#c3ccd6', color2: '#8a94a0', icon: 'ShieldCheck', lossAmount: 30 },
  { id: 'gold', name: '골드', color: '#f6d365', color2: '#d89b1f', icon: 'Star', lossAmount: 50 },
  { id: 'platinum', name: '플래티넘', color: '#7ee8d5', color2: '#2fa89b', icon: 'Hexagon', lossAmount: 70 },
  { id: 'diamond', name: '다이아몬드', color: '#8ec5fc', color2: '#3b7fd1', icon: 'Gem', lossAmount: 90 },
  { id: 'ruby', name: '루비', color: '#ff7a9c', color2: '#b8264f', icon: 'Flame', lossAmount: 110 },
  { id: 'emerald', name: '에메랄드', color: '#6fe0a8', color2: '#22935c', icon: 'Octagon', lossAmount: 130 },
  { id: 'mythic', name: '신화', color: '#c896f7', color2: '#7b3fd1', icon: 'Sparkles', lossAmount: 165 },
  { id: 'master', name: '마스터', color: '#ffe27a', color2: '#8a6d00', icon: 'Crown', lossAmount: 200 },
];

// 각 티어의 시작 점수(min)를 미리 계산해둬요. 마스터(마지막)는 폭이 없어(끝없이 열려있어) 그 앞까지 누적.
function buildTiers() {
  let cursor = 0;
  const tiers = [];
  for (let i = 0; i < TIER_META.length; i++) {
    const meta = TIER_META[i];
    const isLast = i === TIER_META.length - 1;
    const divisionWidth = DIVISION_WIDTHS[i] ?? null;
    const totalWidth = isLast ? null : divisionWidth * DIVISIONS_PER_TIER;
    tiers.push({ ...meta, min: cursor, divisionWidth, totalWidth, hasDivisions: !isLast });
    if (!isLast) cursor += totalWidth;
  }
  return tiers;
}

export const TIERS = buildTiers();

export function getTierById(id) {
  return TIERS.find((t) => t.id === id);
}

// 점수로 현재 티어 + 단계(division, 마스터는 null)를 찾아요.
// division은 1(막 진입) → 2 → 3(다음 티어 직전) 순서예요.
export function getTierForRating(points) {
  const safePoints = Math.max(0, points || 0);
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (safePoints >= t.min) tier = t;
    else break;
  }
  if (!tier.hasDivisions) {
    return { ...tier, division: null, displayName: tier.name };
  }
  const intoTier = safePoints - tier.min;
  const divisionIndex = Math.min(DIVISIONS_PER_TIER - 1, Math.floor(intoTier / tier.divisionWidth));
  const division = divisionIndex + 1; // 0번째 구간 = 1단계, 마지막 구간 = 3단계
  return { ...tier, division, displayName: `${tier.name} ${division}` };
}

// 다음 단계(같은 티어 안이면 다음 division, 마지막 단계면 다음 티어)까지 남은 점수.
// 이미 마스터면 null(더 이상 다음이 없음).
export function getNextTierInfo(points) {
  const safePoints = Math.max(0, points || 0);
  const current = getTierForRating(safePoints);
  if (!current.hasDivisions) return null; // 마스터

  const idx = TIERS.findIndex((t) => t.id === current.id);
  const intoTier = safePoints - current.min;
  const divisionIndex = Math.min(DIVISIONS_PER_TIER - 1, Math.floor(intoTier / current.divisionWidth));
  const nextBoundary = current.min + (divisionIndex + 1) * current.divisionWidth;

  if (divisionIndex + 1 < DIVISIONS_PER_TIER) {
    // 같은 티어의 다음 단계로
    const nextDivision = divisionIndex + 2;
    return {
      next: { ...current, division: nextDivision, displayName: `${current.name} ${nextDivision}` },
      pointsNeeded: Math.max(0, nextBoundary - safePoints),
    };
  }
  // 다음 티어로
  const nextTierMeta = TIERS[idx + 1];
  const nextInfo = nextTierMeta.hasDivisions
    ? { ...nextTierMeta, division: 1, displayName: `${nextTierMeta.name} 1` }
    : { ...nextTierMeta, division: null, displayName: nextTierMeta.name };
  return { next: nextInfo, pointsNeeded: Math.max(0, nextTierMeta.min - safePoints) };
}

// 패배 시 잃는 점수(항상 양수로 반환 - 호출하는 쪽에서 빼면 돼요). 현재 티어 기준이라
// 같은 티어의 1/2/3 단계는 전부 동일해요.
export function getLossAmount(points) {
  return getTierForRating(points).lossAmount;
}
