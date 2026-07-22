// 간단한 휴리스틱 기반 AI. 완벽한 수읽기는 아니지만, 막을 자리/이을 자리를
// 점수로 평가해서 그럴듯하게 두고, 상황에 따라 카드도 사용해요.

import {
  BOARD_SIZE,
  DIRECTIONS,
  BLACK,
  WHITE,
  otherPlayer,
  isForbiddenMove,
  checkWin,
} from './gameLogic.js';

// 난이도별 조절값. blockChance: 상대 위협을 알아채고 막을 확률.
// cardUseChance: 여유 있을 때 카드를 섞어 쓸 확률. noise: 수 선택에 섞는 무작위성.
export const DIFFICULTIES = {
  easy: { label: '쉬움', blockChance: 0.45, cardUseChance: 0.15, noise: 45 },
  normal: { label: '보통', blockChance: 0.85, cardUseChance: 0.35, noise: 14 },
  hard: { label: '어려움', blockChance: 1, cardUseChance: 0.55, noise: 0 },
};

function inB(size, x, y) {
  return x >= 0 && x < size && y >= 0 && y < size;
}

// 한 방향으로 뻗었을 때 만들어지는 연속 길이와 열린 끝의 개수를 셈
function lineStrength(board, x, y, dx, dy, player) {
  const size = board.length;
  let count = 1;
  let openEnds = 0;

  for (let s = 1; s < 5; s++) {
    const nx = x + dx * s, ny = y + dy * s;
    if (!inB(size, nx, ny)) break;
    if (board[ny][nx] === player) { count++; continue; }
    if (board[ny][nx] === 0) openEnds++;
    break;
  }
  for (let s = 1; s < 5; s++) {
    const nx = x - dx * s, ny = y - dy * s;
    if (!inB(size, nx, ny)) break;
    if (board[ny][nx] === player) { count++; continue; }
    if (board[ny][nx] === 0) openEnds++;
    break;
  }

  return { count, openEnds };
}

function patternScore(count, openEnds) {
  if (count >= 5) return 100000;
  if (count === 4 && openEnds >= 1) return openEnds === 2 ? 12000 : 4000;
  if (count === 3 && openEnds >= 1) return openEnds === 2 ? 1500 : 350;
  if (count === 2 && openEnds >= 1) return openEnds === 2 ? 120 : 40;
  return count * 5;
}

// 이 칸에 player가 놓았을 때 만들어지는 위협 점수
function scoreCellFor(board, x, y, player) {
  let score = 0;
  for (const [dx, dy] of DIRECTIONS) {
    const { count, openEnds } = lineStrength(board, x, y, dx, dy, player);
    score += patternScore(count, openEnds);
  }
  return score;
}

function isUsable(board, blockedFn, x, y) {
  return board[y][x] === 0 && !blockedFn(x, y);
}

// 보드에서 둘 만한 칸 하나를 골라요. 내 공격과 상대 방어를 함께 고려.
export function chooseBestCell(board, me, blockedFn, ruleFlags, difficulty = 'normal') {
  const size = board.length;
  const opponent = otherPlayer(me);
  const noise = DIFFICULTIES[difficulty]?.noise ?? 14;
  let best = null;
  let bestScore = -Infinity;
  const center = (size - 1) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isUsable(board, blockedFn, x, y)) continue;
      if (me === BLACK && isForbiddenMove(board, x, y, BLACK, ruleFlags)) continue;

      const attack = scoreCellFor(board, x, y, me);
      const defense = scoreCellFor(board, x, y, opponent) * 1.05;
      const centerBias = (1 - (Math.abs(x - center) + Math.abs(y - center)) / size) * 8;
      const randomness = (Math.random() - 0.5) * noise;
      const total = attack + defense + centerBias + randomness;

      if (total > bestScore) {
        bestScore = total;
        best = { x, y };
      }
    }
  }

  return best;
}

// 상대가 다음 한 수로 바로 이길 수 있는 칸이 있는지 찾음 (있으면 그 칸을 반환)
export function findOpponentWinningCell(board, aiPlayer) {
  const opponent = otherPlayer(aiPlayer);
  const size = board.length;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[y][x] !== 0) continue;
      const trial = board.map((row) => row.slice());
      trial[y][x] = opponent;
      if (checkWin(trial, x, y, opponent, {})) return { x, y };
    }
  }
  return null;
}

// 보드에서 player의 돌 중 가장 위협적인(연결이 많은) 돌 하나를 찾음
function findMostConnectedStone(board, player) {
  const size = board.length;
  let best = null;
  let bestScore = -Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[y][x] !== player) continue;
      let score = 0;
      for (const [dx, dy] of DIRECTIONS) {
        const { count, openEnds } = lineStrength(board, x, y, dx, dy, player);
        score += patternScore(count, openEnds);
      }
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
  }
  return best;
}

// AI가 자율적으로 판단할 수 있는(단일 대상 이하) 카드 목록과, 각 카드의 대상 계산기
const AI_CARD_HANDLERS = {
  destroy: (board, ai) => {
    const threat = findOpponentWinningCell(board, ai);
    if (threat) {
      // 위협 라인을 이루는 인접 상대 돌 하나를 제거
      const opp = otherPlayer(ai);
      const size = board.length;
      for (const [dx, dy] of DIRECTIONS) {
        for (let s = -4; s <= 4; s++) {
          const nx = threat.x + dx * s, ny = threat.y + dy * s;
          if (inB(size, nx, ny) && board[ny][nx] === opp) return { x: nx, y: ny };
        }
      }
    }
    return findMostConnectedStone(board, otherPlayer(ai));
  },
  barrier: (board, ai) => findOpponentWinningCell(board, ai),
  freezeCell: (board, ai) => findOpponentWinningCell(board, ai),
  corrupt: (board, ai) => findMostConnectedStone(board, otherPlayer(ai)),
  reinforce: (board, ai) => findMostConnectedStone(board, ai),
  sealLine: (board, ai) => findMostConnectedStone(board, otherPlayer(ai)),
  thornTrap: (board, ai) => chooseBestCell(board, ai, () => false, {}),
  wildcard: (board, ai) => chooseBestCell(board, ai, () => false, {}),
};

const NO_TARGET_PRIORITY = ['fourToWin', 'bomb', 'doubleMove', 'winShield', 'silence', 'randomSummon'];

// state는 gameReducer의 state 형태를 그대로 받아요 (board, hand, ruleFlags 등)
export function decideAIAction(state, aiPlayer, hand, blockedFn, difficulty = 'normal') {
  if (state.silencedTurns[aiPlayer] > 0) return null; // 침묵 상태면 카드를 쓸 수 없으니 바로 돌을 놓아요.

  const { blockChance, cardUseChance } = DIFFICULTIES[difficulty] ?? DIFFICULTIES.normal;
  const board = state.board;
  const opponentThreat = findOpponentWinningCell(board, aiPlayer);

  // 1) 상대가 바로 이길 수 있는 상황이면, 막을 수 있는 카드부터 우선 사용 (난이도에 따라 놓칠 수도 있음)
  if (opponentThreat && Math.random() < blockChance) {
    for (const cardId of ['barrier', 'freezeCell', 'destroy']) {
      if (hand.includes(cardId)) {
        const target = AI_CARD_HANDLERS[cardId](board, aiPlayer);
        if (target) return { cardId, target };
      }
    }
    if (hand.includes('winShield')) return { cardId: 'winShield' };
  }

  // 2) 여유 있는 상황이면 낮은 확률로 발전 카드를 사용
  const developCandidates = NO_TARGET_PRIORITY.filter((id) => hand.includes(id));
  const targetedCandidates = ['reinforce', 'corrupt', 'sealLine', 'thornTrap'].filter((id) => hand.includes(id));

  if (Math.random() < cardUseChance) {
    if (developCandidates.length > 0 && Math.random() < 0.6) {
      return { cardId: developCandidates[0] };
    }
    if (targetedCandidates.length > 0) {
      const cardId = targetedCandidates[Math.floor(Math.random() * targetedCandidates.length)];
      const target = AI_CARD_HANDLERS[cardId](board, aiPlayer);
      if (target) return { cardId, target };
    }
  }

  return null; // 카드 대신 그냥 돌을 놓기로 결정
}

// 드래프트 중 AI가 카드를 고를 때 쓰는 대략적인 우선순위
const DRAFT_WEIGHT = {
  destroy: 10, alchemy: 7, moveStone: 6, reinforce: 8, freezeCell: 8,
  corrupt: 7, sealLine: 6, doubleMove: 9, fourToWin: 8, bomb: 7,
  wildcard: 6, winShield: 7, silence: 6, barrier: 6, thornTrap: 5,
  randomSummon: 5, swap: 4, overwrite: 4, ward: 5, allow44: 4,
  release33: 4, shrinkBoard: 3, undoLast: 4, timeReset: 3, chaosShift: 2,
  provoke: 3, confuse: 3, steal: 4, comboBlock: 5,
};

export function pickDraftCard(options) {
  const weights = options.map((id) => DRAFT_WEIGHT[id] || 3);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < options.length; i++) {
    r -= weights[i];
    if (r <= 0) return options[i];
  }
  return options[options.length - 1];
}

export function computeAITarget(cardId, board, aiPlayer) {
  const handler = AI_CARD_HANDLERS[cardId];
  if (!handler) return null;
  return handler(board, aiPlayer);
}

export { BOARD_SIZE };
