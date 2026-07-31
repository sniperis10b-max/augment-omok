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
import { CARDS } from './cards.js';
import { rollingWinLength } from './roulette.js';

// 난이도별 조절값. blockChance: 상대 위협을 알아채고 막을 확률.
// cardUseChance: 여유 있을 때 카드를 섞어 쓸 확률. noise: 수 선택에 섞는 무작위성.
export const DIFFICULTIES = {
  easy: { label: '쉬움', blockChance: 0.6, cardUseChance: 0.25, noise: 30 },
  normal: { label: '보통', blockChance: 0.95, cardUseChance: 0.5, noise: 8 },
  hard: { label: '어려움', blockChance: 1, cardUseChance: 0.65, noise: 0, deepSearch: true, searchWidth: 10, searchDepth: 2 },
  hell: { label: '지옥', blockChance: 1, cardUseChance: 0.75, noise: 0, deepSearch: true, searchWidth: 16, searchDepth: 3 },
  impossible: { label: '불가능', blockChance: 1, cardUseChance: 0.85, noise: 0, deepSearch: true, searchWidth: 16, searchDepth: 5 },
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

// opponent가 이 칸에 두면 동시에 여러 개의 강한 위협(사 또는 사+삼)을 만들어서,
// 다음 내 한 수로는 전부 막을 수 없게 되는 자리를 찾아요. 이런 자리는 열린 삼이
// 되기도 전에 미리 막아야 해요 - 안 그러면 뒤늦게 열린 삼을 막아도 이미 늦어요.
function findForcingCellForPlayer(board, subject, ruleFlags) {
  const size = board.length;
  let best = null;
  let bestSeverity = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[y][x] !== 0) continue;
      if (subject === BLACK && isForbiddenMove(board, x, y, BLACK, ruleFlags)) continue;

      const trial = board.map((row) => row.slice());
      trial[y][x] = subject;

      let fours = 0;
      let openThrees = 0;
      for (const [dx, dy] of DIRECTIONS) {
        const { count, openEnds } = lineStrength(trial, x, y, dx, dy, subject);
        if (count >= 4 && openEnds >= 1) fours++;
        else if (count === 3 && openEnds === 2) openThrees++;
      }

      // 사가 2개 이상(더블포), 또는 사+삼 조합이면 한 수로 못 막는 강제 승리 찬스예요.
      const severity = fours >= 2 ? 3 : (fours >= 1 && openThrees >= 1) ? 2 : 0;
      if (severity > bestSeverity) {
        bestSeverity = severity;
        best = { x, y };
      }
    }
  }

  return best;
}

function findOpponentForcingCell(board, aiPlayer, ruleFlags) {
  return findForcingCellForPlayer(board, otherPlayer(aiPlayer), ruleFlags);
}

// player가 지금 바로(이 한 수로) 이길 수 있는 칸이 있으면 반환
function findWinningCellFor(board, player, blockedFn, ruleFlags, winLength = 5) {
  const size = board.length;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isUsable(board, blockedFn, x, y)) continue;
      if (player === BLACK && isForbiddenMove(board, x, y, BLACK, ruleFlags)) continue;
      const trial = board.map((row) => row.slice());
      trial[y][x] = player;
      if (checkWin(trial, x, y, player, { winLength })) return { x, y };
    }
  }
  return null;
}

// 보드에서 둘 만한 칸 하나를 골라요. 내 공격과 상대 방어를 함께 고려.
export function chooseBestCell(board, me, blockedFn, ruleFlags, difficulty = 'normal', winLength = 5) {
  const cfg = DIFFICULTIES[difficulty] ?? DIFFICULTIES.normal;
  const opponent = otherPlayer(me);

  // 0) 내가 지금 바로 이길 수 있으면 최우선으로 그 자리를 선택 (다른 어떤 평가보다 우선)
  const myWin = findWinningCellFor(board, me, blockedFn, ruleFlags, winLength);
  if (myWin) return myWin;

  // 1) 상대가 바로 이길 수 있는 자리가 있으면, 점수 계산과 무관하게 반드시 막아요
  //    (난이도별 blockChance에 따라 일부러 놓칠 수도 있어요 - 쉬움/보통을 약하게 만드는 요소)
  // 주의: 그 자리가 하필 나(흑)에게 금수라면 실제로는 거기 둘 수 없어요. 그런 경우 그냥
  // 넘어가서(카드로 막거나, 안 되면 다른 자리를 찾도록) 아래로 흘려보내야 해요 - 안 그러면
  // 매번 같은 금수 자리를 골랐다가 거부당하는 무한 반복에 빠져요.
  const oppWin = findOpponentWinningCell(board, me, winLength);
  const oppWinBlockable = oppWin
    && isUsable(board, blockedFn, oppWin.x, oppWin.y)
    && !(me === BLACK && isForbiddenMove(board, oppWin.x, oppWin.y, BLACK, ruleFlags));
  if (oppWinBlockable && Math.random() < cfg.blockChance) {
    return oppWin;
  }

  // 1.2) 상대가 다음 수에 바로 이길 수 있는 상황(막을 수 없는 경우 포함)이면, 내가 아무리
  //      좋은 공격 기회가 있어도 그건 다음다음 수라 늦어요 - 절대 내 공격을 우선하면 안 돼요.
  const opponentHasImmediateWin = !!oppWin;

  // 1.5) 내가 이 한 수로 더블포(사 2개)나 사+삼 조합을 만들 수 있으면, 상대가 한 수로는
  //      절대 못 막는 강제 승리 찬스예요. 단, 상대가 나보다 먼저 이길 수 있는 상황이면
  //      의미가 없으니(상대가 먼저 이겨버려요) 그럴 땐 이 공격을 쓰지 않아요.
  if (!opponentHasImmediateWin) {
    const myForcingCell = findForcingCellForPlayer(board, me, ruleFlags);
    if (myForcingCell && isUsable(board, blockedFn, myForcingCell.x, myForcingCell.y)) {
      return myForcingCell;
    }
  }

  // 1.7) 상대가 그 자리에 두면 사(四)를 2개 만들거나 사+삼을 동시에 만들어서 한 수로는
  //      절대 못 막게 되는 자리가 있으면, 열린 삼이 되기 전에 미리 막아요. (마찬가지로 금수면 제외)
  const forcingCell = findOpponentForcingCell(board, me, ruleFlags);
  const forcingCellBlockable = forcingCell
    && isUsable(board, blockedFn, forcingCell.x, forcingCell.y)
    && !(me === BLACK && isForbiddenMove(board, forcingCell.x, forcingCell.y, BLACK, ruleFlags));
  if (forcingCellBlockable && Math.random() < cfg.blockChance) {
    return forcingCell;
  }

  // 2) 상대의 열린 삼(놔두면 어느 쪽으로도 못 막는 열린 사가 되는 자리)도 최우선으로 차단해요.
  //    이걸 놓치면 스크린샷처럼 대각선/직선이 슬금슬금 완성되는 걸 못 막게 돼요.
  if (Math.random() < cfg.blockChance) {
    const flanks = findOpenThreeFlankCells(board, opponent).filter(
      (c) => isUsable(board, blockedFn, c.x, c.y) && !(me === BLACK && isForbiddenMove(board, c.x, c.y, BLACK, ruleFlags))
    );
    if (flanks.length > 0) {
      let bestFlank = flanks[0];
      let bestFlankScore = -Infinity;
      for (const f of flanks) {
        const s = scoreCellFor(board, f.x, f.y, opponent) * 1.1 + scoreCellFor(board, f.x, f.y, me);
        if (s > bestFlankScore) { bestFlankScore = s; bestFlank = f; }
      }
      return bestFlank;
    }
  }

  if (cfg.deepSearch) {
    const deep = chooseBestCellDeep(board, me, blockedFn, ruleFlags, cfg.searchWidth ?? 10, cfg.searchDepth ?? 2);
    if (deep) return deep;
  }

  const size = board.length;
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

  // 안전장치: 판이 봉쇄 카드들로 심하게 좁아져서 "금수가 아닌 빈 칸"이 하나도 안 남는
  // 극단적인 경우, best가 null인 채로 끝나면 AI가 그대로 아무 수도 안 두고 멈춰버려요.
  // 그런 최악의 상황에서도 일단 둘 수 있는 칸(금수 여부는 무시)이라도 찾아서 시도해요.
  if (!best) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (isUsable(board, blockedFn, x, y)) { best = { x, y }; break; }
      }
      if (best) break;
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
export function findOpponentWinningCell(board, aiPlayer, winLength = 5) {
  const opponent = otherPlayer(aiPlayer);
  const size = board.length;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[y][x] !== 0) continue;
      const trial = board.map((row) => row.slice());
      trial[y][x] = opponent;
      if (checkWin(trial, x, y, opponent, { winLength })) return { x, y };
    }
  }
  return null;
}

// 보드에서 player의 돌 중 가장 위협적인(연결이 많은) 돌 하나를, 점수와 함께 찾음.
// protectedStones가 주어지면 강화(연마)로 보호된 돌은 후보에서 제외해요 - 파괴/변환
// 대상으로 골라봤자 게임에서 거부당하기 때문이에요.
function findMostConnectedStoneWithScore(board, player, protectedStones = {}, exclude = null) {
  const size = board.length;
  let best = null;
  let bestScore = -Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[y][x] !== player) continue;
      if (protectedStones[`${x},${y}`]) continue;
      if (exclude && exclude.has(`${x},${y}`)) continue;
      let score = 0;
      for (const [dx, dy] of DIRECTIONS) {
        const { count, openEnds } = lineStrength(board, x, y, dx, dy, player);
        score += patternScore(count, openEnds);
      }
      if (score > bestScore) { bestScore = score; best = { x, y, score }; }
    }
  }
  return best;
}

// 보드에서 player의 돌 중 가장 위협적인(연결이 많은) 돌 하나를 찾음 (보호된 돌 제외)
function findMostConnectedStone(board, player, protectedStones = {}, exclude = null) {
  const result = findMostConnectedStoneWithScore(board, player, protectedStones, exclude);
  return result ? { x: result.x, y: result.y } : null;
}

// 상대가 그 자리에 두면 가장 위협적일 빈 칸을 찾아요 (얼리기/장벽/결계 카드로 그 자리를
// 미리 막아버리는 용도 - "상대 돌을 파괴"가 아니라 "상대가 원하는 자리를 선점"하는 방어예요).
function findBestEmptyCellForOpponent(board, aiPlayer, blockedFn = () => false) {
  const opponent = otherPlayer(aiPlayer);
  const size = board.length;
  let best = null;
  let bestScore = -Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[y][x] !== 0 || blockedFn(x, y)) continue;
      let score = 0;
      for (const [dx, dy] of DIRECTIONS) {
        const { count, openEnds } = lineStrength(board, x, y, dx, dy, opponent);
        score += patternScore(count, openEnds);
      }
      if (score > bestScore) { bestScore = score; best = { x, y, score }; }
    }
  }
  return best;
}

// AI가 자율적으로 판단할 수 있는(단일 대상 이하) 카드 목록과, 각 카드의 대상 계산기.
// blockedFn은 barrier/결계 등으로 실제 막힌 칸을 걸러내기 위해 받아요.
const AI_CARD_HANDLERS = {
  destroy: (board, ai, blockedFn = () => false, protectedStones = {}) => {
    const threat = findOpponentWinningCell(board, ai);
    if (threat) {
      // 위협 라인을 이루는 인접 상대 돌 하나를 제거 (강화되어 보호된 돌은 건너뛰어요)
      const opp = otherPlayer(ai);
      const size = board.length;
      for (const [dx, dy] of DIRECTIONS) {
        for (let s = -4; s <= 4; s++) {
          const nx = threat.x + dx * s, ny = threat.y + dy * s;
          if (inB(size, nx, ny) && board[ny][nx] === opp && !protectedStones[`${nx},${ny}`]) {
            return { x: nx, y: ny };
          }
        }
      }
    }
    return findMostConnectedStone(board, otherPlayer(ai), protectedStones);
  },
  barrier: (board, ai, blockedFn = () => false) => {
    const win = findOpponentWinningCell(board, ai);
    if (win && !blockedFn(win.x, win.y)) return win;
    const forcing = findOpponentForcingCell(board, ai, {});
    if (forcing && !blockedFn(forcing.x, forcing.y)) return forcing;
    const flanks = opponentOpenThreeFlanks(board, ai).filter((c) => board[c.y][c.x] === 0 && !blockedFn(c.x, c.y));
    return flanks[0] || null;
  },
  freezeCell: (board, ai, blockedFn = () => false) => {
    const win = findOpponentWinningCell(board, ai);
    if (win && !blockedFn(win.x, win.y)) return win;
    const forcing = findOpponentForcingCell(board, ai, {});
    if (forcing && !blockedFn(forcing.x, forcing.y)) return forcing;
    const flanks = opponentOpenThreeFlanks(board, ai).filter((c) => board[c.y][c.x] === 0 && !blockedFn(c.x, c.y));
    return flanks[0] || null;
  },
  corrupt: (board, ai) => findMostConnectedStone(board, otherPlayer(ai)),
  reinforce: (board, ai) => findMostConnectedStone(board, ai),
  sealLine: (board, ai) => findMostConnectedStone(board, otherPlayer(ai)),
  thornTrap: (board, ai, blockedFn = () => false) => chooseBestCell(board, otherPlayer(ai), blockedFn, {}),
  wildcard: (board, ai, blockedFn = () => false) => chooseBestCell(board, ai, blockedFn, {}),
  // 낙인/동전 던지기는 파괴처럼 위협 라인 위주 상대 돌을 노려요 (강화 여부는 상관없어요)
  mark: (board, ai) => {
    const threat = findOpponentWinningCell(board, ai);
    if (threat) {
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
  // 성역은 내 가장 강한 진영을 보호막으로 감싸요
  sanctuary: (board, ai) => findMostConnectedStone(board, ai),
  // 소용돌이는 상대 진영이 뭉쳐있는 지점을 중심으로 흩뜨려요
  vortex: (board, ai) => findMostConnectedStone(board, otherPlayer(ai)),
};
// 연쇄 파괴는 첫 타겟 선정 방식이 파괴와 동일해요 (인접 돌 제거는 게임 로직이 자동으로 처리).
AI_CARD_HANDLERS.destroyChain = AI_CARD_HANDLERS.destroy;
// 동전 던지기는 이제 상대 돌 2개를 고르는 카드라서, 이미 고른 대상(pending)은 피해서
// 두 번째 대상을 찾아요. 첫 번째는 낙인/파괴처럼 위협 라인 위주로 고르고, 두 번째는
// 그다음으로 위협적인 상대 돌을 골라요 (마땅한 게 없으면 null을 반환해 카드를 취소해요).
AI_CARD_HANDLERS.coinFlip = (board, ai, blockedFn = () => false, protectedStones = {}, pending = []) => {
  const exclude = new Set(pending.map((p) => `${p.x},${p.y}`));
  if (pending.length === 0) {
    return AI_CARD_HANDLERS.mark(board, ai, blockedFn, protectedStones);
  }
  return findMostConnectedStone(board, otherPlayer(ai), protectedStones, exclude);
};
// 주사위도 마찬가지로 위협 라인 위주 상대 돌을 노려요.
AI_CARD_HANDLERS.dice = AI_CARD_HANDLERS.mark;
// 낙뢰/해일은 상대 돌이 가장 많이 몰려있는 세로줄/가로줄을 노려요.
AI_CARD_HANDLERS.lightning = (board, ai) => {
  const opp = otherPlayer(ai);
  const size = board.length;
  let bestX = 0, bestCount = -1, bestY = Math.floor(size / 2);
  for (let x = 0; x < size; x++) {
    let count = 0;
    for (let y = 0; y < size; y++) if (board[y][x] === opp) count++;
    if (count > bestCount) { bestCount = count; bestX = x; }
  }
  for (let y = 0; y < size; y++) if (board[y][bestX] === opp) { bestY = y; break; }
  return { x: bestX, y: bestY };
};
AI_CARD_HANDLERS.tsunami = (board, ai) => {
  const opp = otherPlayer(ai);
  const size = board.length;
  let bestY = 0, bestCount = -1, bestX = Math.floor(size / 2);
  for (let y = 0; y < size; y++) {
    let count = 0;
    for (let x = 0; x < size; x++) if (board[y][x] === opp) count++;
    if (count > bestCount) { bestCount = count; bestY = y; }
  }
  for (let x = 0; x < size; x++) if (board[bestY][x] === opp) { bestX = x; break; }
  return { x: bestX, y: bestY };
};
// 블랙홀은 상대 진영이 가장 뭉쳐있는 지점을 중심으로 잡아요.
AI_CARD_HANDLERS.blackhole = (board, ai) => findMostConnectedStone(board, otherPlayer(ai));
AI_CARD_HANDLERS.alchemy = (board, ai) => findMostConnectedStone(board, otherPlayer(ai));

// 위치 교환: 내 약한(아무) 돌 하나와 상대의 가장 위협적인 돌을 바꿔치기해요.
AI_CARD_HANDLERS.swap = (board, ai, blockedFn = () => false, protectedStones = {}, pending = []) => {
  if (pending.length === 0) {
    // 내 돌 아무거나 (가장 연결이 약한 돌을 내주는 게 아까울 게 없어요)
    const size = board.length;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (board[y][x] === ai) return { x, y };
      }
    }
    return null;
  }
  return findMostConnectedStone(board, otherPlayer(ai), protectedStones);
};

// 관통: 상대의 가장 위협적인 돌 위에 겹쳐 놓아요 (승리는 안 되지만 상대 라인을 끊어요).
AI_CARD_HANDLERS.overwrite = (board, ai, blockedFn = () => false, protectedStones = {}) =>
  findMostConnectedStone(board, otherPlayer(ai), protectedStones);

// 돌 이동: 내 돌 하나를, 내가 가장 강하게 확장할 수 있는 빈 칸으로 옮겨요.
AI_CARD_HANDLERS.moveStone = (board, ai, blockedFn = () => false, protectedStones = {}, pending = []) => {
  if (pending.length === 0) {
    const size = board.length;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (board[y][x] === ai && !protectedStones[`${x},${y}`]) return { x, y };
      }
    }
    return null;
  }
  // findBestEmptyCellForOpponent(board, X)는 "X의 상대"에게 좋은 칸을 찾아줘요.
  // 그래서 otherPlayer(ai)를 넣으면 "ai 자신"에게 좋은 칸을 찾는 셈이 돼요.
  const best = findBestEmptyCellForOpponent(board, otherPlayer(ai), blockedFn);
  return best ? { x: best.x, y: best.y } : null;
};

// 얼리기/장벽/결계: 상대가 가장 원할 빈 칸을 미리 막아버려요.
AI_CARD_HANDLERS.freezeCell = (board, ai, blockedFn = () => false) => {
  const best = findBestEmptyCellForOpponent(board, ai, blockedFn);
  return best ? { x: best.x, y: best.y } : null;
};
AI_CARD_HANDLERS.barrier = AI_CARD_HANDLERS.freezeCell;
AI_CARD_HANDLERS.ward = AI_CARD_HANDLERS.freezeCell;

// 도발/혼란: 상대의 다음 수를 그 자리 근처로 강제/무작위화해서 상대가 노리던 흐름을 끊어요.
AI_CARD_HANDLERS.provoke = (board, ai, blockedFn = () => false) => {
  const best = findBestEmptyCellForOpponent(board, ai, blockedFn);
  return best ? { x: best.x, y: best.y } : null;
};
AI_CARD_HANDLERS.confuse = AI_CARD_HANDLERS.provoke;

// 상대의 열린 삼(다음에 열린 사가 될 수 있는 자리)이 있으면 그 확장 칸들을 반환
function opponentOpenThreeFlanks(board, aiPlayer) {
  return findOpenThreeFlankCells(board, otherPlayer(aiPlayer));
}

// 내 열린 삼이 있으면 그 확장 칸들을 반환 (공격 타이밍 판단용)
function myOpenThreeFlanks(board, aiPlayer) {
  return findOpenThreeFlankCells(board, aiPlayer);
}

// 파괴/낙인/동전던지기처럼 "상대 돌 하나를 노리는" 카드 중 손에 있는 걸 우선순위대로 골라요.
function pickDestroyLikeCard(hand, board, aiPlayer, protectedStones) {
  for (const cardId of ['destroy', 'destroyChain', 'mark', 'coinFlip', 'dice', 'erosion', 'lightning', 'tsunami']) {
    if (hand.includes(cardId)) {
      if (cardId === 'erosion') return { cardId };
      const target = AI_CARD_HANDLERS[cardId](board, aiPlayer, () => false, protectedStones);
      if (target) return { cardId, target };
    }
  }
  return null;
}

// state는 gameReducer의 state 형태를 그대로 받아요 (board, hand, ruleFlags 등)
export function decideAIAction(state, aiPlayer, hand, blockedFn, difficulty = 'normal') {
  if (state.silencedTurns[aiPlayer] > 0) return null; // 침묵 상태면 카드를 쓸 수 없으니 바로 돌을 놓아요.

  const { blockChance, cardUseChance } = DIFFICULTIES[difficulty] ?? DIFFICULTIES.normal;
  const board = state.board;
  const protectedStones = state.protectedStones ?? {};
  const winLength = state.rouletteRule === 'rollingWin' ? rollingWinLength(state.ply) : 5;

  // 룰렛 "강제 카드 턴": 카드를 먼저 안 쓰면 착수 자체가 거부돼서, 그냥 놔두면 AI가
  // "카드는 안 쓰겠다"고 판단할 때마다 착수 거부 -> 재시도를 무한 반복하게 돼요.
  // 그래서 카드가 있으면 무조건(선택이 아니라 필수로) 하나를 골라 쓰게 만들어요.
  if (state.rouletteRule === 'forceCardTurn' && !state.cardUsedThisTurn?.[aiPlayer] && hand.length > 0) {
    const noTargetCard = hand.find((id) => CARDS.find((c) => c.id === id)?.targetType === 'none');
    if (noTargetCard) return { cardId: noTargetCard };
    for (const cardId of hand) {
      const handler = AI_CARD_HANDLERS[cardId];
      if (!handler) continue;
      const target = handler(board, aiPlayer, blockedFn, protectedStones);
      if (target) return { cardId, target };
    }
    // 대상을 못 찾은 카드뿐이라도, 일단 하나를 골라서 시도는 해봐요(무한 루프보다는 나아요).
    return { cardId: hand[0] };
  }

  const opponentThreat = findOpponentWinningCell(board, aiPlayer, winLength);
  const forcingCell = opponentThreat ? null : findOpponentForcingCell(board, aiPlayer, state.ruleFlags);
  const urgentFlanks = (opponentThreat || forcingCell)
    ? []
    : opponentOpenThreeFlanks(board, aiPlayer).filter((c) => board[c.y][c.x] === 0 && !blockedFn(c.x, c.y));
  const hasUrgentThreat = !!opponentThreat || !!forcingCell || urgentFlanks.length > 0;

  // 1) 상대가 바로 이길 수 있는 상황이면, 막을 수 있는 카드부터 우선 사용 (난이도에 따라 놓칠 수도 있음)
  if (opponentThreat && Math.random() < blockChance) {
    for (const cardId of ['barrier', 'freezeCell', 'destroy', 'destroyChain', 'mark', 'coinFlip', 'dice', 'lightning', 'tsunami']) {
      if (hand.includes(cardId)) {
        const target = AI_CARD_HANDLERS[cardId](board, aiPlayer, blockedFn, protectedStones);
        if (target) return { cardId, target };
      }
    }
    if (hand.includes('erosion')) return { cardId: 'erosion' };
    if (hand.includes('winShield')) return { cardId: 'winShield' };
  }

  // 1.5) 상대가 한 수로 사(四)를 2개 만들거나 사+삼을 만들어 강제로 이기게 되는 자리가
  //      있으면, 카드로 미리 막을 수 있으면 막아요
  if (!opponentThreat && forcingCell && Math.random() < blockChance) {
    for (const cardId of ['barrier', 'freezeCell']) {
      if (hand.includes(cardId)) return { cardId, target: forcingCell };
    }
    const pick = pickDestroyLikeCard(hand, board, aiPlayer, protectedStones);
    if (pick) return pick;
  }

  // 2) 상대가 열린 삼(다음다음 수에 못 막는 위협이 될 수 있는 자리)을 만들었으면 미리 막아요
  if (!opponentThreat && !forcingCell && urgentFlanks.length > 0 && Math.random() < blockChance) {
    for (const cardId of ['barrier', 'freezeCell']) {
      if (hand.includes(cardId)) {
        return { cardId, target: urgentFlanks[0] };
      }
    }
    const pick = pickDestroyLikeCard(hand, board, aiPlayer, protectedStones);
    if (pick) return pick;
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

  // 3.5) 프리액션(턴 안 넘김) 준비 카드는 급하지 않아도 이득이면 바로 써요 - 밑질 게 없어요.
  if (!hasUrgentThreat) {
    // 감시자: 아직 안 걸려있으면 미리 발동해둬요 (상대 파괴/연금술 1회 무효화)
    if (hand.includes('watcher') && !state.watcherActive?.[aiPlayer]) {
      return { cardId: 'watcher' };
    }
    // 수호천사: 감시자와 별개로, 아직 안 걸려있으면 미리 발동해둬요
    if (hand.includes('guardian') && !state.guardianActive?.[aiPlayer]) {
      return { cardId: 'guardian' };
    }
    // 반사: 아직 안 걸려있으면 미리 발동해둬요 (상대 파괴류를 오히려 되돌려줘요)
    if (hand.includes('reflect') && !state.reflectActive?.[aiPlayer]) {
      return { cardId: 'reflect' };
    }
    // 복구: 최근에 내 돌이 파괴/변환당한 기록이 있으면 되살려요
    if (hand.includes('restore') && (state.stoneLossLog || []).some((e) => e.owner === aiPlayer)) {
      return { cardId: 'restore' };
    }
    // 재림: 이번 판에서 잃은 돌이 있으면 30% 확률에 걸어봐요 (복구보다 우선순위는 낮게)
    if (hand.includes('resurrection') && (state.stoneLossLog || []).some((e) => e.owner === aiPlayer)) {
      return { cardId: 'resurrection' };
    }
    // 침식: 프리액션이라 밑질 게 없어서, 상대 돌이 있으면 바로 써요
    if (hand.includes('erosion')) {
      let oppHasStone = false;
      outerErosionCheck: for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board.length; x++) {
          if (board[y][x] === otherPlayer(aiPlayer)) { oppHasStone = true; break outerErosionCheck; }
        }
      }
      if (oppHasStone) return { cardId: 'erosion' };
    }
    // 머릿수 싸움: 내 돌이 상대보다 적을 때만 의미 있어서, 그럴 때만 써요
    if (hand.includes('headcount')) {
      let mine = 0, theirs = 0;
      for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board.length; x++) {
          if (board[y][x] === aiPlayer) mine++;
          else if (board[y][x] === otherPlayer(aiPlayer)) theirs++;
        }
      }
      if (mine < theirs) return { cardId: 'headcount' };
    }
  }

  // 4) 위협 상황이 아니라 진짜로 여유 있을 때만 카드를 써요. 위협을 막을 카드가 마침 없어서
  //    1~2번에서 대응 못 했더라도, 여기서 엉뚱한 카드를 쓰며 턴을 낭비하면 안 되니 확실히 막아요.
  if (hasUrgentThreat) return null;

  const opponentHand = state.draft?.hands?.[otherPlayer(aiPlayer)] ?? [];
  const developCandidates = ['fourToWin', 'bomb', 'doubleMove', 'randomSummon', 'miracle', 'duplicate', 'allowOverline', 'shortWin', 'longWin', 'lottery']
    .filter((id) => hand.includes(id));
  // 침묵은 상대에게 아직 쓸 카드가 남아있을 때만 의미가 있어요
  if (hand.includes('silence') && opponentHand.length > 0) developCandidates.push('silence');
  // 거래/리롤은 다른 쓸만한 카드가 없을 때만 손패를 갈아엎는 최후 수단으로 써요
  if (developCandidates.length === 0) {
    if (hand.includes('trade')) developCandidates.push('trade');
    else if (hand.includes('reroll')) developCandidates.push('reroll');
  }

  // 난이도가 높을수록 카드를 더 똑똑하고 적극적으로 판단해요 (임계값을 낮춰서 더 잘 씀).
  const intensity = { easy: 1.3, normal: 1.0, hard: 0.85, hell: 0.7, impossible: 0.55 }[difficulty] ?? 1.0;

  const targetedCandidates = [];
  if (hand.includes('reinforce')) {
    const t = findMostConnectedStoneWithScore(board, aiPlayer);
    if (t && t.score >= 40 * intensity) targetedCandidates.push({ cardId: 'reinforce', target: { x: t.x, y: t.y } });
  }
  // 돌 이동: 내 돌 하나를 더 강한 확장 위치로 옮겨요 (제일 강한 내 라인 근처에 여유가 있을 때).
  if (hand.includes('moveStone')) {
    const t = findMostConnectedStoneWithScore(board, aiPlayer);
    if (t && t.score >= 60 * intensity) targetedCandidates.push({ cardId: 'moveStone' });
  }
  if (hand.includes('sanctuary')) {
    const t = findMostConnectedStoneWithScore(board, aiPlayer);
    if (t && t.score >= 120 * intensity) targetedCandidates.push({ cardId: 'sanctuary', target: { x: t.x, y: t.y } });
  }
  if (hand.includes('corrupt')) {
    const t = findMostConnectedStoneWithScore(board, otherPlayer(aiPlayer));
    if (t && t.score >= 120 * intensity) targetedCandidates.push({ cardId: 'corrupt', target: { x: t.x, y: t.y } });
  }
  if (hand.includes('sealLine')) {
    const t = findMostConnectedStoneWithScore(board, otherPlayer(aiPlayer));
    if (t && t.score >= 350 * intensity) targetedCandidates.push({ cardId: 'sealLine', target: { x: t.x, y: t.y } });
  }
  if (hand.includes('mark') && !targetedCandidates.some((c) => c.cardId === 'mark')) {
    const t = findMostConnectedStoneWithScore(board, otherPlayer(aiPlayer));
    if (t && t.score >= 350 * intensity) targetedCandidates.push({ cardId: 'mark', target: { x: t.x, y: t.y } });
  }
  if (hand.includes('thornTrap')) {
    const t = AI_CARD_HANDLERS.thornTrap(board, aiPlayer, blockedFn);
    if (t) targetedCandidates.push({ cardId: 'thornTrap', target: t });
  }
  if (hand.includes('purify') && Object.keys(state.blockedCells || {}).length >= Math.max(1, Math.round(3 * intensity))) {
    targetedCandidates.push({ cardId: 'purify' });
  }
  if (hand.includes('blackhole')) {
    const t = findMostConnectedStoneWithScore(board, otherPlayer(aiPlayer));
    if (t && t.score >= 250 * intensity) targetedCandidates.push({ cardId: 'blackhole', target: { x: t.x, y: t.y } });
  }
  if (hand.includes('alchemy')) {
    const t = findMostConnectedStoneWithScore(board, otherPlayer(aiPlayer));
    if (t && t.score >= 250 * intensity) targetedCandidates.push({ cardId: 'alchemy', target: { x: t.x, y: t.y } });
  }
  if (hand.includes('overwrite')) {
    const t = findMostConnectedStoneWithScore(board, otherPlayer(aiPlayer));
    if (t && t.score >= 350 * intensity) targetedCandidates.push({ cardId: 'overwrite', target: { x: t.x, y: t.y } });
  }
  // 방어형: 상대가 노리는 자리를 미리 막아요. 상대 위협이 꽤 뚜렷할 때만 (아까워서 아무 때나 안 써요).
  for (const cardId of ['freezeCell', 'barrier', 'ward']) {
    if (hand.includes(cardId)) {
      const best = findBestEmptyCellForOpponent(board, aiPlayer, blockedFn);
      if (best && best.score >= 350 * intensity) targetedCandidates.push({ cardId, target: { x: best.x, y: best.y } });
    }
  }
  // 방해형: 상대가 유리한 흐름을 타고 있을 때(연결 점수가 높을 때) 흐름을 끊어요.
  for (const cardId of ['provoke', 'confuse']) {
    if (hand.includes(cardId)) {
      const t = findMostConnectedStoneWithScore(board, otherPlayer(aiPlayer));
      if (t && t.score >= 350 * intensity) targetedCandidates.push({ cardId, target: { x: t.x, y: t.y } });
    }
  }
  if (hand.includes('swap')) {
    const oppBest = findMostConnectedStoneWithScore(board, otherPlayer(aiPlayer));
    const myWorst = findMostConnectedStoneWithScore(board, aiPlayer);
    if (oppBest && oppBest.score >= 350 * intensity && myWorst) {
      targetedCandidates.push({ cardId: 'swap' });
    }
  }
  // 침묵: 상대 손에 카드가 있을 때, 여유 있으면 미리 봉인해둬요.
  if (hand.includes('silence')) {
    const opponentHand = state.draft?.hands?.[otherPlayer(aiPlayer)] ?? [];
    if (opponentHand.length >= Math.max(1, Math.round(2 * intensity))) targetedCandidates.push({ cardId: 'silence' });
  }
  // 연속 공격 차단: 상대가 열린 삼을 만들어서 사(四)로 발전시킬 수 있는 상황이면 미리 막아요.
  if (hand.includes('comboBlock')) {
    const t = findMostConnectedStoneWithScore(board, otherPlayer(aiPlayer));
    if (t && t.score >= 1200 * intensity) targetedCandidates.push({ cardId: 'comboBlock' });
  }
  // 3-3 해제: 내가 흑이면(3-3 금수가 나한테 적용되면) 여유 있을 때 미리 풀어둬요.
  if (hand.includes('release33') && aiPlayer === BLACK) {
    targetedCandidates.push({ cardId: 'release33' });
  }

  // 발전용 카드는 예전보다 덜 헤프게, 대상이 뚜렷한 카드는 조금 더 적극적으로 써요
  if (targetedCandidates.length > 0 && Math.random() < cardUseChance) {
    const pick = targetedCandidates[Math.floor(Math.random() * targetedCandidates.length)];
    return pick;
  }
  if (developCandidates.length > 0 && Math.random() < cardUseChance * 0.5) {
    return { cardId: developCandidates[0] };
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
  destroyChain: 6, restore: 5, watcher: 6, duplicate: 5, vortex: 3,
  trade: 4, mark: 5, purify: 4, echo: 3,
  erosion: 6, lightning: 7, tsunami: 7, blackhole: 5, reflect: 5,
  guardian: 6, resurrection: 4, lottery: 4, dice: 6,
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

export function computeAITarget(cardId, board, aiPlayer, blockedFn = () => false, protectedStones = {}, pending = []) {
  const handler = AI_CARD_HANDLERS[cardId];
  if (!handler) return null;
  return handler(board, aiPlayer, blockedFn, protectedStones, pending);
}

export { BOARD_SIZE };
