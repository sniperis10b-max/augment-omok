// AI 대전에서 핸디캡을 걸고 플레이하는 "챌린지" 모드 카탈로그예요.
// 각 챌린지는 게임 시작 시 규칙/보드/카드풀에 특정 핸디캡을 적용해요.

export const CHALLENGES = [
  { id: 'noCards', name: '무카드 챌린지', desc: '카드 없이 순수 오목 실력으로만 승부해요.' },
  { id: 'fourVsFive', name: '오목 대 사목', desc: '나는 5목이어야 승리, AI는 4목만 완성해도 승리해요.' },
  { id: 'narrowVision', name: '좁은 시야', desc: '보드 바깥 테두리 3칸이 처음부터 막힌 채 시작해요.' },
  { id: 'noDestroy', name: '파괴 금지', desc: '내 드래프트에서 파괴 계열 카드가 전부 빠져요.' },
  { id: 'noDefense', name: '방어 금지', desc: '내 드래프트에서 방어 계열 카드가 전부 빠져요.' },
  { id: 'blindDraft', name: '눈 감고 뽑기', desc: '드래프트에서 카드 이름/설명이 안 보이고 아이콘만 보여요.' },
  { id: 'noDiagonal', name: '대각선 금지', desc: '나는 대각선 방향 5목이 승리로 인정되지 않아요.' },
  { id: 'sixInRow', name: '6목만 인정', desc: '나는 6목을 만들어야 승리해요 (AI는 5목이면 승리).' },
  { id: 'doubleForbidden', name: '이중 금수', desc: '무작위 칸 10곳이 처음부터 막힌 채 시작해요.' },
  { id: 'silhouette', name: '흑백 실루엣', desc: '돌이 색이 아니라 채워짐/테두리 모양으로만 구분돼요.' },
  { id: 'ladder', name: '5단 계단', desc: '쉬움부터 불가능까지 5개 난이도를 연속으로 이겨야 해요. 중간에 지면 처음부터예요.' },
];

export const LADDER_LEVELS = ['easy', 'normal', 'hard', 'hell', 'impossible'];

// 파괴/방어 계열로 분류되는 카드 id들 (파괴 금지/방어 금지 챌린지에서 드래프트 풀에서 제외돼요)
export const DESTROY_CARD_IDS = new Set([
  'destroy', 'destroyChain', 'lightning', 'tsunami', 'blackhole', 'erosion', 'dice', 'coinFlip', 'mark', 'alchemy',
]);
export const DEFENSE_CARD_IDS = new Set([
  'watcher', 'guardian', 'reflect', 'barrier', 'ward', 'sanctuary', 'winShield', 'restore', 'resurrection',
]);

export function getChallengeById(id) {
  return CHALLENGES.find((c) => c.id === id) || null;
}

// 완주(전 챌린지 클리어) 여부를 계산해요. clearedSet은 achievementStats.challengesCleared 같은 객체예요.
export function hasCompletedAllChallenges(clearedSet = {}) {
  return CHALLENGES.every((c) => clearedSet[c.id]);
}
