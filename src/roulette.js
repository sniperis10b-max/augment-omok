// "룰렛 모드" - 대국을 시작하면(카드 드래프트 전) 이 목록에서 무작위로 하나가 뽑혀서
// 그 판 내내 적용되는 특수 규칙이에요. 온라인에서는 룰렛 모드를 켠 사람끼리만
// 매칭돼요(친구와 플레이는 예외).

export const ROULETTE_RULES = [
  { id: 'reverseWin', name: '역전 오목', desc: '5목을 먼저 완성하는 쪽이 오히려 패배해요.' },
  { id: 'destroyWin', name: '파괴전 승리', desc: '상대 돌을 10개 파괴하면 오목과 무관하게 즉시 승리해요.' },
  { id: 'rollingWin', name: '승리조건 롤링', desc: '5수마다 승리 조건이 4목 → 5목 → 6목 순서로 계속 바뀌어요.' },
  { id: 'colorSwap', name: '색깔 교대전', desc: '10수마다 판 위 모든 돌의 흑/백이 서로 뒤바뀌어요.' },
  { id: 'doubleMoveAlways', name: '연속 두기 상시', desc: '모든 턴에 무조건 돌을 2개씩 놓아요 (두 번째 수로는 승리 불가).' },
  { id: 'forceCardTurn', name: '강제 카드 턴', desc: '손에 카드가 있으면 이번 턴에 카드를 먼저 써야만 착수할 수 있어요.' },
  { id: 'noCardConsumption', name: '카드 소모 없음', desc: '카드를 써도 손에서 사라지지 않고 계속 남아있어요.' },
  { id: 'autoCardPerTurn', name: '매턴 카드 자동 지급', desc: '드래프트 없이, 내 턴이 시작될 때마다 무작위 카드 1장을 자동으로 받아요.' },
  { id: 'destroyOnly', name: '파괴전', desc: '드래프트 카드 풀이 파괴 계열 카드로만 구성돼요.' },
  { id: 'cardSteal', name: '카드 강탈', desc: '상대가 카드를 쓰면, 나도 같은 카드를 즉시 하나 더 얻어요.' },
  { id: 'canyonCollapse', name: '협곡 붕괴', desc: '10수마다 판 바깥 테두리가 한 줄씩 영구히 막혀서 점점 좁아져요.' },
  { id: 'autoDecay', name: '자동 소멸', desc: '놓은 지 12수가 지난 돌은 자동으로 사라져요.' },
  { id: 'betrayal', name: '배신', desc: '돌을 놓을 때마다 50% 확률로 그 돌이 상대 돌로 바뀌어요.' },
  { id: 'fogOfWar', name: '안개 전장', desc: '상대의 돌이 화면에 보이지 않아요 (감으로 두는 대국).' },
  { id: 'recentOnly', name: '최근 3수만 표시', desc: '판 전체가 아니라 가장 최근에 놓인 돌 3개만 화면에 보여요.' },
  { id: 'shrinkingTime', name: '점점 짧아지는 시간', desc: '한 수 놓을 때마다 제한시간이 0.5초씩 줄어들어요 (최소 1초).' },
  { id: 'suddenDeath', name: '번개 결착', desc: '40수 안에 승부가 안 나면 그 판은 무조건 무승부로 끝나요.' },
  { id: 'voidWinRoulette', name: '승리 무효 룰렛', desc: '오목을 완성해도 50% 확률로 무효 처리되고 대국이 계속돼요.' },
];

export function getRouletteRuleById(id) {
  return ROULETTE_RULES.find((r) => r.id === id) || null;
}

export function pickRandomRouletteRule() {
  return ROULETTE_RULES[Math.floor(Math.random() * ROULETTE_RULES.length)].id;
}

// 룰렛 "승리조건 롤링": 5수마다 4목 -> 5목 -> 6목 순서로 순환해요.
// gameReducer.js(실제 승리 판정)와 ai.js(AI의 승패 위협 감지) 양쪽에서 같이 써요.
export function rollingWinLength(ply) {
  const bucket = Math.floor(ply / 5) % 3;
  return [4, 5, 6][bucket];
}
