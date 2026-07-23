// 카드 정의. targetType은 카드 사용 시 무엇을 선택해야 하는지를 나타내요.
// 'none'         : 선택 없이 즉시 발동
// 'enemyStone'   : 상대 돌 1개 선택
// 'ownStone'     : 내 돌 1개 선택
// 'ownThenEnemy' : 내 돌 1개 선택 후 상대 돌 1개 선택 (위치 교환)
// 'ownThenEmpty' : 내 돌 1개 선택 후 빈 칸 선택 (이동)
// 'emptyCell'    : 빈 칸 1개 선택
// 'anyStoneCell' : 돌이 있는 칸(내 것이든 상대 것이든) 1개 선택
// 'line'         : 보드 위 한 칸을 선택해 그 칸이 속한 직선(가로/세로/대각선 중 선택)을 지정

export const CARDS = [
  { id: 'destroy', name: '파괴', desc: '지정한 상대 돌 1개를 판에서 제거해요.', targetType: 'enemyStone', icon: 'Skull' },
  { id: 'alchemy', name: '연금술', desc: '지정한 상대 돌 1개를 내 돌로 바꿔요. 이 카드로는 승리를 완성할 수 없어요.', targetType: 'enemyStone', icon: 'FlaskConical' },
  { id: 'swap', name: '위치 교환', desc: '내 돌 1개와 상대 돌 1개의 위치를 바꿔요.', targetType: 'ownThenEnemy', icon: 'ArrowLeftRight' },
  { id: 'overwrite', name: '관통', desc: '이미 돌이 있는 칸 위에 내 돌을 겹쳐 놓아요. 이번 턴 착수로 처리돼요. 이 카드로는 승리를 완성할 수 없어요.', targetType: 'anyStoneCell', icon: 'Layers' },
  { id: 'moveStone', name: '돌 이동', desc: '내 돌 1개를 다른 빈 칸으로 옮겨요.', targetType: 'ownThenEmpty', icon: 'Move' },
  { id: 'reinforce', name: '연마', desc: '내 돌 1개를 강화해, 파괴/변환 효과에 영구히 면역으로 만들어요.', targetType: 'ownStone', icon: 'ShieldCheck' },
  { id: 'barrier', name: '장벽', desc: '빈 칸 1개를 영구히 착수 불가능한 장애물로 만들어요.', targetType: 'emptyCell', icon: 'Ban' },
  { id: 'ward', name: '결계', desc: '지정 칸을 중심으로 2x2 범위를 2턴 동안 착수 금지시켜요.', targetType: 'emptyCell', icon: 'ShieldAlert' },
  { id: 'shrinkBoard', name: '판 축소', desc: '보드 가장자리 한 줄 전체를 영구히 착수 불가능하게 만들어요.', targetType: 'none', icon: 'Minimize2' },
  { id: 'fourToWin', name: '사목 승리', desc: '30% 확률로 발동해요. 성공하면 다음에 내가 놓을 돌이 4목만 완성해도 승리로 인정돼요. 실패해도 카드는 소모돼요.', targetType: 'none', icon: 'Trophy' },
  { id: 'doubleMove', name: '연속 두기', desc: '이번 턴에 돌을 연속으로 2개 놓을 수 있어요. 단, 두 번째로 놓는 돌로는 승리할 수 없어요.', targetType: 'none', icon: 'Repeat2' },
  { id: 'freezeCell', name: '시한 격리', desc: '지정한 빈 칸을 3턴 동안 아무도 놓을 수 없게 동결해요.', targetType: 'emptyCell', icon: 'Snowflake' },
  { id: 'corrupt', name: '오염', desc: '지정한 상대 돌 주위 8칸을 영구히 착수 금지 지역으로 만들어요.', targetType: 'enemyStone', icon: 'Biohazard' },
  { id: 'bomb', name: '폭발 시한폭탄', desc: '이번에 내가 놓는 돌이 시한폭탄이 돼요. 3턴 후 그 돌과 주변 3x3이 모두 파괴돼요.', targetType: 'none', icon: 'Bomb' },
  { id: 'undoLast', name: '타임 리턴', desc: '가장 최근에 놓인 돌 1개를 판에서 되돌려요.', targetType: 'none', icon: 'Undo2' },
  { id: 'timeReset', name: '타임 리셋', desc: '판을 5수 전 상태로 되돌려요.', targetType: 'none', icon: 'History' },
  { id: 'chaosShift', name: '격동', desc: '판 위의 모든 돌이 무작위 방향으로 한 칸씩 밀려나요.', targetType: 'none', icon: 'Shuffle' },
  { id: 'release33', name: '3-3 해제', desc: '이번 판 끝까지 흑돌의 3-3 금수 규칙을 없애요.', targetType: 'none', icon: 'Unlock' },
  { id: 'allow44', name: '4-4 허용', desc: '흑돌의 4-4 금수 규칙을 1회 무시하고 착수할 수 있어요.', targetType: 'none', icon: 'KeyRound' },
  { id: 'sealLine', name: '라인 봉인', desc: '지정한 칸이 속한 가로줄을 봉인해요. 그 줄 위에서는 5목이 완성돼도 승리로 인정되지 않아요.', targetType: 'emptyOrAnyCell', icon: 'SeparatorHorizontal' },
  { id: 'thornTrap', name: '가시밭', desc: '빈 칸 1개에 보이지 않는 함정을 설치해요. 상대가 그 칸에 놓으면 상대의 다음 턴이 스킵돼요.', targetType: 'emptyCell', icon: 'Sprout' },
  { id: 'comboBlock', name: '연속 공격 차단', desc: '상대의 열린 삼을 찾아, 그걸 사(四)로 만들 수 있는 칸들을 상대의 다음 한 수 동안 막아요.', targetType: 'none', icon: 'ShieldOff' },
  { id: 'randomSummon', name: '랜덤 소환', desc: '무작위 카드 1장을 즉시 손에 추가로 얻어요.', targetType: 'none', icon: 'Sparkles' },
  { id: 'provoke', name: '도발', desc: '지정한 칸을 기준으로 4x4 영역을 정해, 상대는 다음 한 수를 반드시 그 안에 둬야 해요.', targetType: 'emptyOrAnyCell', icon: 'Target' },
  { id: 'confuse', name: '혼란', desc: '지정한 칸을 기준으로, 상대의 다음 착수가 그 주변 8칸 중 무작위 위치에 놓여요.', targetType: 'emptyOrAnyCell', icon: 'Dices' },
  { id: 'steal', name: '강탈', desc: '상대가 가장 최근에 사용한 카드와 같은 카드를 내 손에 1장 추가로 얻어요.', targetType: 'none', icon: 'HandMetal' },
  { id: 'winShield', name: '동시 승리 방지', desc: '다음에 상대가 5목을 완성해도 그 승리를 1회 무효화하고 게임을 이어가요.', targetType: 'none', icon: 'ShieldPlus' },
  { id: 'wildcard', name: '와일드카드', desc: '흑과 백 모두로 인정되는 중립 돌을 빈 칸 1개에 설치해요.', targetType: 'emptyCell', icon: 'CircleDot' },
  { id: 'silence', name: '침묵', desc: '상대는 다음 2번의 턴 동안 카드를 사용할 수 없어요.', targetType: 'none', icon: 'VolumeX' },
  { id: 'miracle', name: '기적', desc: '1% 확률로 즉시 승리해요. 실패해도 카드는 소모되고 턴이 넘어가요.', targetType: 'none', icon: 'Star' },
  { id: 'destroyChain', name: '연쇄 파괴', desc: '지정한 상대 돌 1개와, 그 돌에 바로 붙어있는 상대 돌 1개까지 최대 2개를 함께 제거해요. 강화된 돌은 대상이 되지 않아요.', targetType: 'enemyStone', icon: 'Zap' },
  { id: 'restore', name: '복구', desc: '최근 5수 안에 파괴되거나 상대 돌로 바뀐 내 돌 1개를, 그 자리가 비어있다면 원래대로 되돌려요.', targetType: 'none', icon: 'RotateCcw' },
  { id: 'watcher', name: '감시자', desc: '발동해두면, 상대가 다음에 나에게 파괴나 연금술 카드를 쓸 때 그 효과를 1회 무효화해요.', targetType: 'none', icon: 'Eye' },
  { id: 'duplicate', name: '복제', desc: '지금 내 손에 있는 카드 중 하나를 무작위로 복제해서 1장 더 얻어요.', targetType: 'none', icon: 'Copy' },
  { id: 'vortex', name: '소용돌이', desc: '지정한 칸을 중심으로 3x3 범위 안의 모든 돌(내 것, 상대 것 상관없이)의 위치를 무작위로 뒤섞어요.', targetType: 'emptyOrAnyCell', icon: 'Tornado' },
];

export function getCardById(id) {
  return CARDS.find((c) => c.id === id);
}

// 드래프트용 무작위 카드 3장 뽑기 (풀에서 중복 없이)
export function drawRandomCards(pool, count = 3) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
