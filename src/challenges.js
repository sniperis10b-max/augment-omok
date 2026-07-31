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

// 확률에 기대는 카드들 (성공/실패가 갈리는 카드) - '카드 도박꾼' 챌린지의 드래프트 풀로도 써요.
export const PROB_CARD_IDS = new Set(['coinFlip', 'miracle', 'echo', 'shortWin', 'longWin', 'resurrection', 'lottery', 'dice']);

// 되돌리기/복구 계열 카드 ('한 번의 기회' 챌린지에서 제외돼요) - 지금은 안 쓰지만 나중에 참고용
export const RESTORE_CARD_IDS = new Set(['undoLast', 'restore', 'resurrection', 'timeReset']);

// 챌린지 두 번째 세트예요. 전부 AI 불가능 난이도 기준이고, 10개를 전부 클리어하면
// 첫 번째 세트와는 별개의 스킨(투명 돌 아님)을 하나 더 받아요.
export const CHALLENGES_2 = [
  { id: 'narrowVision5', name: '좁은 시야 확장판', desc: '보드 바깥 테두리 5칸이 처음부터 막힌 채 시작해요.' },
  { id: 'quadForbidden', name: '사중 금수', desc: '무작위 칸 20곳이 처음부터 막힌 채 시작해요.' },
  { id: 'colorReverse', name: '흑백 역전', desc: '나는 무조건 백으로 시작하고, 렌주 금수(3-3, 4-4, 육목)가 흑 대신 백에게 적용돼요.' },
  { id: 'sevenInRow', name: '7목 지옥', desc: '나는 7목을 만들어야 승리해요 (AI는 5목이면 승리).' },
  { id: 'lonelyLight', name: '한 줄기 빛', desc: '상대(AI)의 돌이 화면에 아예 보이지 않아요.' },
  { id: 'silentRule', name: '침묵의 규칙', desc: '카드를 쓸 때마다 내 다음 턴이 자동으로 스킵돼요.' },
  { id: 'smallBoard', name: '좁은 판', desc: '15x15가 아니라 11x11의 작은 판에서 대국해요.' },
  { id: 'wideHell', name: '넓은 지옥', desc: '19x19의 넓은 판에서 대국해요.' },
  { id: 'finitePatience', name: '유한한 인내', desc: '30수 안에 승부를 못 내면 그 즉시 패배해요.' },
  { id: 'impossibleHandicap', name: '불가능', desc: '나는 카드를 한 장도 못 받고, AI는 카드 30장을 갖고 시작해요.' },
];

export function hasCompletedAllChallenges2(clearedSet = {}) {
  return CHALLENGES_2.every((c) => clearedSet[c.id]);
}

// 챌린지 세 번째 세트예요. 10개를 전부 클리어하면 '번개 각인' 돌 스킨을 받아요.
export const CHALLENGES_3 = [
  { id: 'handlessPlay', name: '손 없이 두기', desc: '카드 시스템이 완전히 꺼져요. 나도 AI도 카드 없이 순수 실력으로 승부해요.' },
  { id: 'cardStormAI', name: '카드 폭풍', desc: 'AI가 매 턴마다 카드 2장씩 자동으로 받아요 (나는 평소대로 드래프트해요).' },
  { id: 'frozenTime', name: '얼어붙은 시간', desc: '한 수당 제한시간이 무조건 1초로 고정돼요.' },
  { id: 'diagonalOnlyPlayer', name: '대각선만', desc: '내 승리는 대각선 방향으로만 인정돼요 (AI는 모든 방향 인정).' },
  { id: 'scatteredVision', name: '흩어진 시야', desc: '판 위 무작위 15칸이 게임 내내 안 보여요 (누구 돌이든 상관없이).' },
  { id: 'oneCardDuel', name: '카드 한 방 승부', desc: '나는 이번 판에 카드를 딱 1번만 쓸 수 있어요 (AI는 평소대로).' },
  { id: 'confusion', name: '혼란', desc: '실제로 두는 자리는 정확한데, 화면에는 돌이 무작위로 흐트러진 위치에 놓인 것처럼 보여요.' },
  { id: 'firstMoveConcession', name: '첫 수 양보', desc: 'AI가 먼저 3수를 두고 시작해요 (나는 4번째 수부터).' },
  { id: 'cardMisfire', name: '카드 감별 실패', desc: '카드는 자유롭게 고르지만, 실제로 발동될 때는 무작위 다른 카드로 바뀌어요.' },
  { id: 'unlimitedExpansion', name: '무제한 확장', desc: '21x21의 아주 넓은 판에서 대국해요.' },
];

export function hasCompletedAllChallenges3(clearedSet = {}) {
  return CHALLENGES_3.every((c) => clearedSet[c.id]);
}

// 파괴/방어 계열로 분류되는 카드 id들 (파괴 금지/방어 금지 챌린지에서 드래프트 풀에서 제외돼요)
export const DESTROY_CARD_IDS = new Set([
  'destroy', 'destroyChain', 'lightning', 'tsunami', 'blackhole', 'erosion', 'dice', 'coinFlip', 'mark', 'alchemy',
]);
export const DEFENSE_CARD_IDS = new Set([
  'watcher', 'guardian', 'reflect', 'barrier', 'ward', 'sanctuary', 'winShield', 'restore', 'resurrection',
]);

export function getChallengeById(id) {
  return CHALLENGES.find((c) => c.id === id) || CHALLENGES_2.find((c) => c.id === id) || CHALLENGES_3.find((c) => c.id === id) || null;
}

// 완주(전 챌린지 클리어) 여부를 계산해요. clearedSet은 achievementStats.challengesCleared 같은 객체예요.
export function hasCompletedAllChallenges(clearedSet = {}) {
  return CHALLENGES.every((c) => clearedSet[c.id]);
}
