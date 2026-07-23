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
  findOpenThreeFlankCells,
} from './gameLogic.js';

// 난이도별 조절값. blockChance: 상대 위협을 알아채고 막을 확률.
// cardUseChance: 여유 있을 때 카드를 섞어 쓸 확률. noise: 수 선택에 섞는 무작위성.
export const DIFFICULTIES = {
  easy: { label: '쉬움', blockChance: 0.6, cardUseChance: 0.25, noise: 30 },
  normal: { label: '보통', blockChance: 0.95, cardUseChance: 0.5, noise: 8 },
  hard: { label: '어려움', blockChance: 1, cardUseChance: 0.65, noise: 0, deepSearch: true, searchWidth: 6, searchDepth: 1 },
  hell: { label: '지옥', blockChance: 1, cardUseChance: 0.75, noise: 0, deepSearch: true, searchWidth: 10, searchDepth: 2 },
  impossible: { label: '불가능', blockChance: 1, cardUseChance: 0.85, noise: 0, deepSearch: true, searchWidth: 18, searchDepth: 3 },
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
  const cfg = DIFFICULTIES[difficulty] ?? DIFFICULTIES.normal;
  if (cfg.deepSearch) {
    const deep = chooseBestCellDeep(board, me, blockedFn, ruleFlags, cfg.searchWidth ?? 10, cfg.searchDepth ?? 2);
    if (deep) return deep;
  }

  const size = board.length;
  const opponent = otherPlayer(me);
  const noise = cfg.noise ?? 14;
  let best = null;
  let bestScore = -Infinity;
  const center = (size - 1) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isUsable(board, blockedFn, x, y)) continue;
      if (me === BLACK && isForbiddenMove(board, x, y, BLACK, ruleFlags)) continue;

      const attack = scoreCellFor(board, x, y, me);
      const defense = scoreCellFor(board, x, y, opponent) * 1.1;
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

// 상대의 응수 중 가장 좋은 점수를 계산해요 (재귀적으로 depth만큼 더 내다볼 수 있음).
function bestReplyScore(board, player, ruleFlags, width, depth) {
  const size = board.length;
  const candidates = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[y][x] !== 0) continue;
      if (player === BLACK && isForbiddenMove(board, x, y, BLACK, ruleFlags)) continue;
      const quick = scoreCellFor(board, x, y, player);
      candidates.push({ x, y, quick });
    }
  }

  if (candidates.length === 0) return 0;
  candidates.sort((a, b) => b.quick - a.quick);
  const top = candidates.slice(0, width);

  let best = -Infinity;
  for (const c of top) {
    const trial = board.map((row) => row.slice());
    trial[c.y][c.x] = player;
    if (checkWin(trial, c.x, c.y, player, {})) return 999999;

    let score = scoreCellFor(trial, c.x, c.y, player);
    if (depth > 1) {
      const opponent = otherPlayer(player);
      score -= bestReplyScore(trial, opponent, ruleFlags, Math.max(4, Math.floor(width / 2)), depth - 1) * 1.05;
    }
    if (score > best) best = score;
  }
  return best;
}

// 유력한 후보 몇 칸을 놓아본 뒤, 상대의 최선 응수(그리고 필요하면 그 다음 내 응수까지)를
// 내다봐서 가장 좋은 자리를 골라요. width/depth가 클수록 더 강하지만 느려져요.
function chooseBestCellDeep(board, me, blockedFn, ruleFlags, width, depth) {
  const size = board.length;
  const opponent = otherPlayer(me);
  const candidates = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isUsable(board, blockedFn, x, y)) continue;
      if (me === BLACK && isForbiddenMove(board, x, y, BLACK, ruleFlags)) continue;
      const quick = scoreCellFor(board, x, y, me) + scoreCellFor(board, x, y, opponent) * 1.05;
      candidates.push({ x, y, quick });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.quick - a.quick);
  const top = candidates.slice(0, width);

  let best = null;
  let bestScore = -Infinity;

  for (const c of top) {
    const trial = board.map((row) => row.slice());
    trial[c.y][c.x] = me;

    if (checkWin(trial, c.x, c.y, me, {})) return { x: c.x, y: c.y }; // 즉시 승리면 바로 선택

    const myEval = scoreCellFor(trial, c.x, c.y, me);
    const oppBest = bestReplyScore(trial, opponent, ruleFlags, Math.max(6, Math.floor(width * 0.75)), depth - 1);
    const total = myEval - oppBest * 1.1;

    if (total > bestScore) {
      bestScore = total;
      best = { x: c.x, y: c.y };
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

// AI가 자율적으로 판단할 수 있는(단일 대상 이하) 카드 목록과, 각 카드의 대상 계산기.
// blockedFn은 barrier/결계 등으로 실제 막힌 칸을 걸러내기 위해 받아요.
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
  barrier: (board, ai, blockedFn = () => false) => {
    const win = findOpponentWinningCell(board, ai);
    if (win && !blockedFn(win.x, win.y)) return win;
    const flanks = opponentOpenThreeFlanks(board, ai).filter((c) => board[c.y][c.x] === 0 && !blockedFn(c.x, c.y));
    return flanks[0] || null;
  },
  freezeCell: (board, ai, blockedFn = () => false) => {
    const win = findOpponentWinningCell(board, ai);
    if (win && !blockedFn(win.x, win.y)) return win;
    const flanks = opponentOpenThreeFlanks(board, ai).filter((c) => board[c.y][c.x] === 0 && !blockedFn(c.x, c.y));
    return flanks[0] || null;
  },
  corrupt: (board, ai) => findMostConnectedStone(board, otherPlayer(ai)),
  reinforce: (board, ai) => findMostConnectedStone(board, ai),
  sealLine: (board, ai) => findMostConnectedStone(board, otherPlayer(ai)),
  thornTrap: (board, ai, blockedFn = () => false) => chooseBestCell(board, ai, blockedFn, {}),
  wildcard: (board, ai, blockedFn = () => false) => chooseBestCell(board, ai, blockedFn, {}),
};

const NO_TARGET_PRIORITY = ['fourToWin', 'bomb', 'doubleMove', 'winShield', 'silence', 'randomSummon', 'miracle'];

// 상대의 열린 삼(다음에 열린 사가 될 수 있는 자리)이 있으면 그 확장 칸들을 반환
function opponentOpenThreeFlanks(board, aiPlayer) {
  return findOpenThreeFlankCells(board, otherPlayer(aiPlayer));
}

// 내 열린 삼이 있으면 그 확장 칸들을 반환 (공격 타이밍 판단용)
function myOpenThreeFlanks(board, aiPlayer) {
  return findOpenThreeFlankCells(board, aiPlayer);
}

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
        const target = AI_CARD_HANDLERS[cardId](board, aiPlayer, blockedFn);
        if (target) return { cardId, target };
      }
    }
    if (hand.includes('winShield')) return { cardId: 'winShield' };
  }

  // 2) 상대가 열린 삼(다음다음 수에 못 막는 위협이 될 수 있는 자리)을 만들었으면 미리 막아요
  if (!opponentThreat) {
    const flanks = opponentOpenThreeFlanks(board, aiPlayer).filter(
      (c) => board[c.y][c.x] === 0 && !blockedFn(c.x, c.y)
    );
    if (flanks.length > 0 && Math.random() < blockChance) {
      for (const cardId of ['barrier', 'freezeCell']) {
        if (hand.includes(cardId)) {
          return { cardId, target: flanks[0] };
        }
      }
      if (hand.includes('destroy')) {
        const target = findMostConnectedStone(board, otherPlayer(aiPlayer));
        if (target) return { cardId: 'destroy', target };
      }
    }
  }

  // 3) 내가 열린 삼을 갖고 있으면(곧 강한 공격 찬스), 공격형 카드를 적극적으로 써요
  if (!opponentThreat) {
    const myFlanks = myOpenThreeFlanks(board, aiPlayer);
    if (myFlanks.length > 0) {
      const attackCandidates = ['fourToWin', 'doubleMove', 'bomb'].filter((id) => hand.includes(id));
      if (attackCandidates.length > 0 && Math.random() < Math.min(1, cardUseChance + 0.25)) {
        return { cardId: attackCandidates[0] };
      }
    }
  }

  // 4) 여유 있는 상황이면 카드를 섞어 사용
  const developCandidates = NO_TARGET_PRIORITY.filter((id) => hand.includes(id));
  const targetedCandidates = ['reinforce', 'corrupt', 'sealLine', 'thornTrap'].filter((id) => hand.includes(id));

  if (Math.random() < cardUseChance) {
    if (developCandidates.length > 0 && Math.random() < 0.6) {
      return { cardId: developCandidates[0] };
    }
    if (targetedCandidates.length > 0) {
      const cardId = targetedCandidates[Math.floor(Math.random() * targetedCandidates.length)];
      const target = AI_CARD_HANDLERS[cardId](board, aiPlayer, blockedFn);
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
  provoke: 3, confuse: 3, steal: 4, comboBlock: 5, miracle: 2,
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

export function computeAITarget(cardId, board, aiPlayer, blockedFn = () => false) {
  const handler = AI_CARD_HANDLERS[cardId];
  if (!handler) return null;
  return handler(board, aiPlayer, blockedFn);
}

export { BOARD_SIZE };
