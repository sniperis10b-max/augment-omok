import {
  BLACK,
  WHITE,
  WILD,
  createEmptyBoard,
  otherPlayer,
  checkWin,
  isBoardFull,
  isForbiddenMove,
  inBounds,
  findOpenThreeFlankCells,
} from './gameLogic.js';
import { CARDS, drawRandomCards, poolForPlayer } from './cards.js';

const STANDALONE = new Set([
  'destroy', 'alchemy', 'swap', 'moveStone', 'reinforce', 'barrier', 'ward',
  'freezeCell', 'corrupt', 'sealLine', 'overwrite', 'shrinkBoard', 'undoLast',
  'timeReset', 'chaosShift', 'release33',
  'thornTrap', 'comboBlock', 'randomSummon', 'provoke', 'confuse', 'steal',
  'winShield', 'wildcard', 'silence', 'miracle',
  'destroyChain', 'restore', 'watcher', 'duplicate', 'vortex',
  'trade', 'mark', 'purify', 'echo',
  'sanctuary', 'headcount', 'reroll', 'allowOverline', 'reverseForbidden', 'shortWin', 'longWin', 'coinFlip',
]);
const PLACEMENT_BUFF = new Set(['fourToWin', 'allow44', 'doubleMove', 'bomb']);

// 상대에게 직접 뭔가를 하는 '수'가 아니라 내 쪽 준비/설치 동작에 가까운 카드들.
// 턴을 넘기지 않고 곧바로 이어서 돌을 놓거나 다른 카드를 쓸 수 있게 해요.
const FREE_ACTION = new Set([
  'reinforce', 'release33',
  'destroy', 'corrupt', 'moveStone', 'freezeCell', 'ward', 'sealLine',
  'thornTrap', 'comboBlock', 'randomSummon', 'provoke', 'confuse', 'steal',
  'winShield', 'wildcard', 'silence',
  'watcher', 'duplicate',
  'trade', 'mark',
  'headcount', 'coinFlip',
]);

const key = (x, y) => `${x},${y}`;

// 업적 집계용: player가 파괴 계열 카드로 실제로 없앤 상대 돌 개수를 누적해요.
function bumpDestroyCount(next, player, amount = 1) {
  next.stoneDestroyCount = {
    ...next.stoneDestroyCount,
    [player]: (next.stoneDestroyCount?.[player] || 0) + amount,
  };
}

// 업적 집계용: player가 사용한 확률형 카드의 성공/실패를 누적해요.
function bumpProbTally(next, player, success) {
  const cur = next.probCardTally?.[player] || { success: 0, fail: 0 };
  next.probCardTally = {
    ...next.probCardTally,
    [player]: { success: cur.success + (success ? 1 : 0), fail: cur.fail + (success ? 0 : 1) },
  };
}

function isBlocked(state, x, y) {
  const k = key(x, y);
  const expire = state.blockedCells[k];
  if (expire === undefined) return false;
  return expire === Infinity || state.ply < expire;
}

function buildDraftOrder(cardsPerPlayer) {
  const n = Math.max(1, cardsPerPlayer || 3);
  const order = [];
  for (let i = 0; i < n; i++) {
    order.push(BLACK, WHITE);
  }
  return order;
}

export function createInitialState() {
  const order = buildDraftOrder(3);
  return {
    phase: 'setup',
    aiPlayer: null,
    aiDifficulty: 'normal',
    timeLimitSec: 0, // 0이면 시간제한 없음
    turnDeadline: null,
    board: createEmptyBoard(),
    turn: BLACK,
    ply: 0,
    blockedCells: {},
    protectedStones: {},
    sealedLines: [],
    bombs: [],
    traps: {},
    forcedZone: null,
    confusion: null,
    winShield: { [BLACK]: false, [WHITE]: false },
    watcherActive: { [BLACK]: false, [WHITE]: false },
    echoActive: { [BLACK]: false, [WHITE]: false },
    echoResult: null,
    shortWinResult: null,
    longWinResult: null,
    coinFlipResult: null,
    markedStones: {},
    stoneLossLog: [],
    stoneDestroyCount: { [BLACK]: 0, [WHITE]: 0 },
    probCardTally: {
      [BLACK]: { success: 0, fail: 0 },
      [WHITE]: { success: 0, fail: 0 },
    },
    silencedTurns: { [BLACK]: 0, [WHITE]: 0 },
    skipNextTurn: { [BLACK]: false, [WHITE]: false },
    lastUsedCard: { [BLACK]: null, [WHITE]: null },
    history: [],
    moveLog: [],
    ruleFlags: { noDoubleThree: false, ignoreDoubleFourOnce: false, allowOverline: false, forceForbiddenFor: null },
    winLengthOverride: { [BLACK]: null, [WHITE]: null },
    buffs: { doubleMoveRemaining: 0, fourToWinActive: false, bombArmed: false, doubleMoveBonusPending: false },
    winner: null,
    rematchVotes: { [BLACK]: false, [WHITE]: false },
    drawOffer: null,
    drawByOffer: false,
    lastMove: null,
    message: '카드를 뽑는 중이에요.',
    draft: {
      pool: poolForPlayer(order[0]),
      hands: { [BLACK]: [], [WHITE]: [] },
      order,
      currentIndex: 0,
      options: drawRandomCards(poolForPlayer(order[0]), 3),
    },
    activeCard: null,
  };
}

function cloneBoard(board) {
  return board.map((row) => row.slice());
}

// 기보(착수/카드 사용 기록)에 한 줄을 추가해요. 실행 취소 카드가 history를
// 지워도 moveLog는 절대 지워지지 않아서, 게임 중 언제든 지금까지의 전체
// 기록을 되돌아볼 수 있어요.
function pushMoveLog(state, entry) {
  const seq = state.moveLog.length + 1;
  return {
    ...state,
    moveLog: [...state.moveLog, { seq, ply: state.ply, ...entry }],
  };
}

function explodeBombs(state) {
  let board = state.board;
  const remaining = [];
  const protectedStones = { ...state.protectedStones };
  let changed = false;

  for (const bomb of state.bombs) {
    if (state.ply >= bomb.triggerPly) {
      board = cloneBoard(board);
      changed = true;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = bomb.x + dx;
          const ny = bomb.y + dy;
          if (!inBounds(board, nx, ny)) continue;
          if (protectedStones[key(nx, ny)]) continue;
          board[ny][nx] = 0;
        }
      }
    } else {
      remaining.push(bomb);
    }
  }

  return changed ? { ...state, board, bombs: remaining } : state;
}

// 지금이 누군가 새로 행동할 차례가 됐을 때, 시간제한이 켜져있으면 새 데드라인을 계산해요.
function withDeadline(state) {
  if (state.phase !== 'play' || !state.timeLimitSec) {
    return { ...state, turnDeadline: null };
  }
  return { ...state, turnDeadline: Date.now() + state.timeLimitSec * 1000 };
}

// player가 지금 합법적으로 놓을 수 있는 칸이 하나라도 있는지 확인.
// 흑은 렌주 금수 때문에 극단적으로 빈 칸이 전부 막혀있을 수 있어요.
function hasLegalMove(state, player) {
  const { board } = state;
  const size = board.length;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[y][x] !== 0) continue;
      if (isBlocked(state, x, y)) continue;
      if (player === BLACK && isForbiddenMove(board, x, y, BLACK, state.ruleFlags)) continue;
      return true;
    }
  }
  return false;
}

function endIfStalemated(state) {
  if (state.phase !== 'play') return state;
  if (hasLegalMove(state, state.turn)) return state;
  const stuck = state.turn;
  return {
    ...state,
    phase: 'over',
    winner: otherPlayer(stuck),
    message: `${stuck === BLACK ? '흑' : '백'}이 둘 수 있는 자리가 없어요. ${otherPlayer(stuck) === BLACK ? '흑' : '백'} 승리!`,
  };
}

// 상대에게 턴이 넘어갈 때 가시밭(턴 스킵)과 침묵 지속시간을 함께 처리해요.
function advanceTurn(state, fromPlayer) {
  const candidate = otherPlayer(fromPlayer);
  let next = { ...state };

  if (next.silencedTurns[fromPlayer] > 0) {
    next.silencedTurns = { ...next.silencedTurns, [fromPlayer]: next.silencedTurns[fromPlayer] - 1 };
  }

  if (next.skipNextTurn[candidate]) {
    next.skipNextTurn = { ...next.skipNextTurn, [candidate]: false };
    next.turn = fromPlayer;
    next.message = `${candidate === BLACK ? '흑' : '백'}의 턴이 가시밭에 걸려 스킵됐어요! 다시 ${fromPlayer === BLACK ? '흑' : '백'} 차례예요.`;
  } else {
    next.turn = candidate;
    next.message = `${candidate === BLACK ? '흑' : '백'} 차례예요.`;
  }

  return withDeadline(endIfStalemated(next));
}

function finishTurnAfterPlacement(state, placingPlayer) {
  let next = { ...state, ply: state.ply + 1 };
  next = explodeBombs(next);

  if (placingPlayer === BLACK) {
    next.ruleFlags = { ...next.ruleFlags, ignoreDoubleFourOnce: false };
  }
  if (next.ruleFlags.forceForbiddenFor === placingPlayer) {
    next.ruleFlags = { ...next.ruleFlags, forceForbiddenFor: null };
  }

  if (next.buffs.doubleMoveRemaining > 0) {
    next.buffs = {
      ...next.buffs,
      doubleMoveRemaining: next.buffs.doubleMoveRemaining - 1,
      fourToWinActive: false,
      bombArmed: false,
      doubleMoveBonusPending: true,
    };
    next.message = '한 번 더 놓을 수 있어요. (이번 수로는 승리할 수 없어요)';
    next = withDeadline(endIfStalemated(next));
  } else {
    next.buffs = { doubleMoveRemaining: 0, fourToWinActive: false, bombArmed: false, doubleMoveBonusPending: false };
    next = advanceTurn(next, placingPlayer);
  }

  return next;
}

function tryPlaceStone(state, clickX, clickY) {
  const player = state.turn;
  let x = clickX;
  let y = clickY;
  let workingState = state;

  // 혼란: 클릭한 위치는 무시되고 지정된 anchor 주변 무작위 칸에 놓여요.
  if (workingState.confusion && workingState.confusion.player === player) {
    const { anchor } = workingState.confusion;
    const candidates = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = anchor.x + dx;
        const ny = anchor.y + dy;
        if (
          inBounds(workingState.board, nx, ny) &&
          workingState.board[ny][nx] === 0 &&
          !isBlocked(workingState, nx, ny)
        ) {
          candidates.push({ x: nx, y: ny });
        }
      }
    }
    if (candidates.length > 0) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      x = pick.x;
      y = pick.y;
    }
    workingState = { ...workingState, confusion: null };
  }

  // 도발: 지정된 영역 밖이면 착수를 거부해요.
  if (workingState.forcedZone && workingState.forcedZone.player === player) {
    const z = workingState.forcedZone;
    if (x < z.x0 || x > z.x1 || y < z.y0 || y > z.y1) {
      return { ...workingState, message: '도발당한 영역 안에만 놓을 수 있어요.' };
    }
  }

  const { board } = workingState;
  if (board[y][x] !== 0) return { ...workingState, message: '이미 돌이 있는 칸이에요.' };
  if (isBlocked(workingState, x, y)) return { ...workingState, message: '지금은 놓을 수 없는 칸이에요.' };

  const forbidden = isForbiddenMove(board, x, y, player, workingState.ruleFlags);
  if (forbidden) {
    const label = forbidden === 'overline' ? '육목' : forbidden === 'double-three' ? '3-3' : '4-4';
    return { ...workingState, message: `금수 자리예요 (${label}). 다른 칸을 선택하세요.` };
  }

  const nextBoard = cloneBoard(board);
  nextBoard[y][x] = player;

  let nextState = { ...workingState, board: nextBoard, lastMove: { x, y } };
  nextState.history = [...workingState.history, nextBoard];
  nextState = pushMoveLog(nextState, { type: 'place', player, x, y, board: nextBoard });

  if (nextState.forcedZone && nextState.forcedZone.player === player) {
    nextState.forcedZone = null;
  }

  if (workingState.buffs.bombArmed) {
    nextState.bombs = [...workingState.bombs, { x, y, owner: player, triggerPly: workingState.ply + 3 }];
  }

  // 가시밭: 상대가 심어둔 함정을 밟으면 내 다음 턴이 스킵돼요.
  const trapKey = key(x, y);
  if (nextState.traps[trapKey]) {
    const trapOwner = nextState.traps[trapKey].owner;
    const rest = { ...nextState.traps };
    delete rest[trapKey];
    nextState.traps = rest;
    if (trapOwner !== player) {
      nextState.skipNextTurn = { ...nextState.skipNextTurn, [player]: true };
    }
  }

  const winLength = workingState.buffs.fourToWinActive ? 4 : (workingState.winLengthOverride?.[player] ?? 5);
  const isBonusMove = !!workingState.buffs.doubleMoveBonusPending;
  const won = !isBonusMove && checkWin(nextBoard, x, y, player, { winLength, sealedLines: workingState.sealedLines, markedStones: workingState.markedStones });

  if (won) {
    const shieldHolder = otherPlayer(player);
    if (nextState.winShield[shieldHolder]) {
      nextState.winShield = { ...nextState.winShield, [shieldHolder]: false };
      const res = finishTurnAfterPlacement(nextState, player);
      res.message = `${shieldHolder === BLACK ? '흑' : '백'}의 방어 카드가 승리를 무효화했어요! ${res.message}`;
      return res;
    }
    nextState.phase = 'over';
    nextState.winner = player;
    nextState.message = `${player === BLACK ? '흑' : '백'} 승리!`;
    nextState = explodeBombs(nextState);
    return nextState;
  }

  if (isBoardFull(nextBoard)) {
    nextState.phase = 'over';
    nextState.winner = null;
    nextState.message = '무승부예요.';
    return nextState;
  }

  if (isBonusMove && checkWin(nextBoard, x, y, player, { winLength, sealedLines: workingState.sealedLines, markedStones: workingState.markedStones })) {
    const res = finishTurnAfterPlacement(nextState, player);
    res.message = `연속 두기의 두 번째 수로는 승리할 수 없어요! ${res.message}`;
    return res;
  }

  return finishTurnAfterPlacement(nextState, player);
}

function removeFromHand(state, player, cardId) {
  const hand = state.draft.hands[player].filter((id, idx, arr) => {
    const firstIdx = arr.indexOf(cardId);
    return !(idx === firstIdx && id === cardId);
  });
  return { ...state, draft: { ...state.draft, hands: { ...state.draft.hands, [player]: hand } } };
}

function resolveTargetedEffect(state, cardId, targets) {
  const player = state.turn;
  let next = { ...state, lastUsedCard: { ...state.lastUsedCard, [player]: cardId } };
  // 메아리는 대상 선택이 필요 없는 카드에만 중첩 발동돼요. 지금처럼 대상이 필요한 카드를
  // 쓰면 대기 중이던 메아리 효과는 그냥 소모돼요 (중첩 없이).
  if (next.echoActive[player]) {
    next.echoActive = { ...next.echoActive, [player]: false };
  }
  const board = cloneBoard(next.board);

  switch (cardId) {
    case 'mark': {
      const [t] = targets;
      next.markedStones = { ...next.markedStones, [key(t.x, t.y)]: true };
      next.message = '상대 돌 하나에 낙인을 찍었어요. 그 돌이 포함된 5목은 승리로 인정되지 않아요.';
      break;
    }
    case 'sanctuary': {
      const [t] = targets;
      const updates = {};
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = t.x + dx, ny = t.y + dy;
          if (inBounds(board, nx, ny)) updates[key(nx, ny)] = next.ply + 3;
        }
      }
      next.blockedCells = { ...next.blockedCells, ...updates };
      next.message = '주변 5x5 범위를 3턴 동안 아무도 놓을 수 없게 막았어요.';
      break;
    }
    case 'coinFlip': {
      const [t] = targets;
      if (next.protectedStones[key(t.x, t.y)]) { next.message = '강화된 돌이라 파괴할 수 없어요.'; return next; }
      const defender = otherPlayer(player);
      const success = Math.random() < 0.5;
      next.coinFlipResult = success ? 'success' : 'fail';
      bumpProbTally(next, player, success);
      if (success) {
        if (next.watcherActive[defender]) {
          next.watcherActive = { ...next.watcherActive, [defender]: false };
          next.message = `동전 던지기 성공! 하지만 ${defender === BLACK ? '흑' : '백'}의 감시자가 무효화했어요.`;
        } else {
          board[t.y][t.x] = 0;
          bumpDestroyCount(next, player, 1);
          next.message = '동전 던지기 성공! 상대 돌이 파괴됐어요.';
        }
      } else {
        next.message = '동전 던지기 실패... 아무 일도 일어나지 않았어요.';
      }
      break;
    }
    case 'destroy': {
      const [t] = targets;
      if (next.protectedStones[key(t.x, t.y)]) { next.message = '강화된 돌이라 파괴할 수 없어요.'; return next; }
      const defender = otherPlayer(player);
      if (next.watcherActive[defender]) {
        next.watcherActive = { ...next.watcherActive, [defender]: false };
        next.message = `${defender === BLACK ? '흑' : '백'}의 감시자가 파괴 효과를 무효화했어요!`;
        break;
      }
      next.stoneLossLog = [...next.stoneLossLog, { owner: defender, x: t.x, y: t.y, ply: next.ply }];
      board[t.y][t.x] = 0;
      bumpDestroyCount(next, player, 1);
      break;
    }
    case 'destroyChain': {
      const [t] = targets;
      if (next.protectedStones[key(t.x, t.y)]) { next.message = '강화된 돌이라 파괴할 수 없어요.'; return next; }
      const defender = otherPlayer(player);
      if (next.watcherActive[defender]) {
        next.watcherActive = { ...next.watcherActive, [defender]: false };
        next.message = `${defender === BLACK ? '흑' : '백'}의 감시자가 연쇄 파괴를 무효화했어요!`;
        break;
      }
      const removed = [{ x: t.x, y: t.y }];
      next.stoneLossLog = [...next.stoneLossLog, { owner: defender, x: t.x, y: t.y, ply: next.ply }];
      board[t.y][t.x] = 0;
      bumpDestroyCount(next, player, 1);
      const size = board.length;
      outer: for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = t.x + dx, ny = t.y + dy;
          if (!inBounds(board, nx, ny)) continue;
          if (board[ny][nx] !== defender) continue;
          if (next.protectedStones[key(nx, ny)]) continue;
          next.stoneLossLog = [...next.stoneLossLog, { owner: defender, x: nx, y: ny, ply: next.ply }];
          board[ny][nx] = 0;
          bumpDestroyCount(next, player, 1);
          removed.push({ x: nx, y: ny });
          break outer;
        }
      }
      if (removed.length > 1) {
        next.message = '연쇄 파괴로 상대 돌 2개가 사라졌어요!';
      } else {
        next.message = '인접한 상대 돌이 없어서 1개만 파괴됐어요.';
      }
      break;
    }
    case 'vortex': {
      const [t] = targets;
      const cells = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = t.x + dx, ny = t.y + dy;
          if (!inBounds(board, nx, ny)) continue;
          if (board[ny][nx] !== 0) cells.push({ x: nx, y: ny });
        }
      }
      const values = cells.map((c) => board[c.y][c.x]);
      for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
      }
      cells.forEach((c, i) => { board[c.y][c.x] = values[i]; });
      next.message = '소용돌이가 돌들을 뒤섞었어요!';
      break;
    }
    case 'alchemy': {
      const [t] = targets;
      if (next.protectedStones[key(t.x, t.y)]) { next.message = '강화된 돌이라 변환할 수 없어요.'; return next; }
      const defender = otherPlayer(player);
      if (next.watcherActive[defender]) {
        next.watcherActive = { ...next.watcherActive, [defender]: false };
        next.message = `${defender === BLACK ? '흑' : '백'}의 감시자가 연금술 효과를 무효화했어요!`;
        break;
      }
      next.stoneLossLog = [...next.stoneLossLog, { owner: defender, x: t.x, y: t.y, ply: next.ply }];
      board[t.y][t.x] = player;
      break;
    }
    case 'swap': {
      const [own, enemy] = targets;
      const tmp = board[own.y][own.x];
      board[own.y][own.x] = board[enemy.y][enemy.x];
      board[enemy.y][enemy.x] = tmp;
      break;
    }
    case 'overwrite': {
      const [t] = targets;
      if (next.protectedStones[key(t.x, t.y)]) { next.message = '강화된 돌이라 겹쳐 놓을 수 없어요.'; return next; }
      board[t.y][t.x] = player;
      break;
    }
    case 'moveStone': {
      const [from, to] = targets;
      board[to.y][to.x] = board[from.y][from.x];
      board[from.y][from.x] = 0;
      break;
    }
    case 'reinforce': {
      const [t] = targets;
      next.protectedStones = { ...next.protectedStones, [key(t.x, t.y)]: true };
      break;
    }
    case 'barrier': {
      const [t] = targets;
      next.blockedCells = { ...next.blockedCells, [key(t.x, t.y)]: Infinity };
      break;
    }
    case 'ward': {
      const [t] = targets;
      const updates = {};
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          const nx = t.x + dx, ny = t.y + dy;
          if (inBounds(board, nx, ny)) updates[key(nx, ny)] = next.ply + 2;
        }
      }
      next.blockedCells = { ...next.blockedCells, ...updates };
      break;
    }
    case 'freezeCell': {
      const [t] = targets;
      next.blockedCells = { ...next.blockedCells, [key(t.x, t.y)]: next.ply + 3 };
      break;
    }
    case 'corrupt': {
      const [t] = targets;
      const updates = {};
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = t.x + dx, ny = t.y + dy;
          if (inBounds(board, nx, ny)) updates[key(nx, ny)] = Infinity;
        }
      }
      next.blockedCells = { ...next.blockedCells, ...updates };
      break;
    }
    case 'sealLine': {
      const [t] = targets;
      next.sealedLines = [...next.sealedLines, { type: 'row', index: t.y }];
      break;
    }
    case 'thornTrap': {
      const [t] = targets;
      next.traps = { ...next.traps, [key(t.x, t.y)]: { owner: player } };
      break;
    }
    case 'provoke': {
      const [t] = targets;
      const size = board.length;
      const x0 = Math.max(0, Math.min(t.x, size - 4));
      const y0 = Math.max(0, Math.min(t.y, size - 4));
      next.forcedZone = { player: otherPlayer(player), x0, y0, x1: x0 + 3, y1: y0 + 3 };
      break;
    }
    case 'confuse': {
      const [t] = targets;
      next.confusion = { player: otherPlayer(player), anchor: { x: t.x, y: t.y } };
      break;
    }
    case 'wildcard': {
      const [t] = targets;
      board[t.y][t.x] = WILD;
      break;
    }
    default:
      break;
  }

  next.board = board;
  next = removeFromHand(next, player, cardId);
  next.activeCard = null;
  if (cardId === 'overwrite' || cardId === 'wildcard') {
    next.lastMove = { x: targets[0].x, y: targets[0].y };
  }

  const boardChanged = ['destroy', 'destroyChain', 'alchemy', 'swap', 'overwrite', 'moveStone', 'wildcard', 'vortex', 'coinFlip'].includes(cardId);
  if (boardChanged) {
    next.history = [...next.history, board];
  }
  next = pushMoveLog(next, { type: 'card', player, cardId, targets, board });

  if (cardId === 'overwrite') {
    const wouldWin = checkWin(board, targets[0].x, targets[0].y, player, { sealedLines: next.sealedLines, markedStones: next.markedStones });
    if (isBoardFull(board)) {
      next.phase = 'over';
      next.winner = null;
      next.message = '무승부예요.';
      return next;
    }
    const res = finishTurnAfterPlacement(next, player);
    if (wouldWin) {
      res.message = `관통으로는 승리할 수 없어요! ${res.message}`;
    }
    return res;
  }

  if (cardId === 'wildcard') {
    const t = targets[0];
    const blackWon = checkWin(board, t.x, t.y, BLACK, { sealedLines: next.sealedLines, markedStones: next.markedStones });
    const whiteWon = !blackWon && checkWin(board, t.x, t.y, WHITE, { sealedLines: next.sealedLines, markedStones: next.markedStones });
    const winner = blackWon ? BLACK : whiteWon ? WHITE : null;
    if (winner) {
      next.phase = 'over';
      next.winner = winner;
      next.message = `${winner === BLACK ? '흑' : '백'} 승리! (중립 돌로 완성됨)`;
      return next;
    }
    if (isBoardFull(board)) {
      next.phase = 'over';
      next.winner = null;
      next.message = '무승부예요.';
      return next;
    }
  }

  if (FREE_ACTION.has(cardId)) {
    next.message = `${player === BLACK ? '흑' : '백'} 차례예요. 이어서 돌을 놓거나 다른 카드를 쓸 수 있어요.`;
    return withDeadline(endIfStalemated(next));
  }

  next.ply += 1;
  next = explodeBombs(next);
  next = advanceTurn(next, player);
  return next;
}

function resolveStandaloneNoTarget(state, cardId) {
  const player = state.turn;
  let next = { ...state, lastUsedCard: { ...state.lastUsedCard, [player]: cardId } };
  let board = cloneBoard(next.board);

  // 메아리(echo)가 대기 중이었다면, 대상 선택이 필요 없는 이번 카드의 효과를 한 번 더 실행해요.
  // (echo 카드 자신은 스스로를 중첩시키지 않아요)
  const repeatCount = (cardId !== 'echo' && next.echoActive[player]) ? 2 : 1;
  if (next.echoActive[player]) {
    next.echoActive = { ...next.echoActive, [player]: false };
  }

  for (let rep = 0; rep < repeatCount; rep++) {
  switch (cardId) {
    case 'trade': {
      const myOtherCards = next.draft.hands[player].filter((id) => id !== 'trade');
      const opponent = otherPlayer(player);
      const opponentHand = next.draft.hands[opponent];
      if (myOtherCards.length === 0) {
        next.message = '거래할 카드가 손에 없어요.';
        break;
      }
      if (opponentHand.length === 0) {
        next.message = '상대에게 받을 카드가 없어서 거래가 성사되지 않았어요.';
        break;
      }
      const giveIdx = Math.floor(Math.random() * myOtherCards.length);
      const giveCard = myOtherCards[giveIdx];
      const takeIdx = Math.floor(Math.random() * opponentHand.length);
      const takeCard = opponentHand[takeIdx];

      const myHandAfterGive = [...next.draft.hands[player]];
      myHandAfterGive.splice(myHandAfterGive.indexOf(giveCard), 1);
      const opponentHandAfterGive = [...opponentHand, giveCard];

      const takeCardIdxInOpp = opponentHandAfterGive.indexOf(takeCard);
      opponentHandAfterGive.splice(takeCardIdxInOpp, 1);
      const myHandAfterTake = [...myHandAfterGive, takeCard];

      next.draft = {
        ...next.draft,
        hands: { ...next.draft.hands, [player]: myHandAfterTake, [opponent]: opponentHandAfterGive },
      };
      const gaveName = CARDS.find((c) => c.id === giveCard)?.name || giveCard;
      const tookName = CARDS.find((c) => c.id === takeCard)?.name || takeCard;
      next.message = `'${gaveName}'을(를) 주고 '${tookName}'을(를) 받았어요.`;
      break;
    }
    case 'purify': {
      next.blockedCells = {};
      next.message = '보드 위의 착수 불가 효과(장벽/결계/동결/오염/판 축소 등)를 모두 해제했어요.';
      break;
    }
    case 'echo': {
      const success = Math.random() < 0.5;
      next.echoResult = success ? 'success' : 'fail';
      bumpProbTally(next, player, success);
      if (success) {
        next.echoActive = { ...next.echoActive, [player]: true };
        next.message = '메아리가 발동했어요! 다음에 쓰는 카드(대상 선택 없는 카드)가 한 번 더 발동돼요.';
      } else {
        next.message = '메아리가 발동하지 않았어요... (50% 확률) 카드는 소모됐어요.';
      }
      break;
    }
    case 'headcount': {
      const opponent = otherPlayer(player);
      let myCount = 0, oppCount = 0;
      for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board.length; x++) {
          if (board[y][x] === player) myCount++;
          else if (board[y][x] === opponent) oppCount++;
        }
      }
      if (myCount < oppCount) {
        const pool = poolForPlayer(player);
        const randomId = pool[Math.floor(Math.random() * pool.length)];
        next.draft = {
          ...next.draft,
          hands: { ...next.draft.hands, [player]: [...next.draft.hands[player], randomId] },
        };
        const picked = CARDS.find((c) => c.id === randomId);
        next.message = `돌 개수가 더 적어서 '${picked ? picked.name : randomId}' 카드를 얻었어요!`;
      } else {
        next.message = '돌 개수가 상대보다 적지 않아서 효과가 발동하지 않았어요.';
      }
      break;
    }
    case 'reroll': {
      const count = next.draft.hands[player].length;
      const pool = poolForPlayer(player);
      const newHand = Array.from({ length: count }, () => pool[Math.floor(Math.random() * pool.length)]);
      next.draft = { ...next.draft, hands: { ...next.draft.hands, [player]: newHand } };
      next.message = '손패를 전부 버리고 새로 뽑았어요.';
      break;
    }
    case 'allowOverline': {
      next.ruleFlags = { ...next.ruleFlags, allowOverline: true };
      next.message = '이번 판 끝까지 흑의 장목(육목) 금수가 사라졌어요.';
      break;
    }
    case 'reverseForbidden': {
      next.ruleFlags = { ...next.ruleFlags, forceForbiddenFor: WHITE };
      next.message = '백의 다음 한 수에도 금수 규칙(3-3, 4-4, 육목)이 강제 적용돼요.';
      break;
    }
    case 'shortWin': {
      const success = Math.random() < 0.3;
      next.shortWinResult = success ? 'success' : 'fail';
      bumpProbTally(next, player, success);
      if (success) {
        next.winLengthOverride = { [BLACK]: 4, [WHITE]: 4 };
        next.message = '카드가 발동했어요! 이번 판 끝까지 승리 조건이 4목으로 낮아졌어요.';
      } else {
        next.message = '카드가 발동하지 않았어요... (30% 확률) 카드는 소모됐어요.';
      }
      break;
    }
    case 'longWin': {
      const success = Math.random() < 0.3;
      next.longWinResult = success ? 'success' : 'fail';
      bumpProbTally(next, player, success);
      if (success) {
        const opponent = otherPlayer(player);
        next.winLengthOverride = { ...next.winLengthOverride, [opponent]: 6 };
        next.message = `카드가 발동했어요! ${opponent === BLACK ? '흑' : '백'}은 이번 판 끝까지 6목을 완성해야 승리해요.`;
      } else {
        next.message = '카드가 발동하지 않았어요... (30% 확률) 카드는 소모됐어요.';
      }
      break;
    }
    case 'shrinkBoard': {
      const updates = {};
      const size = board.length;
      for (let i = 0; i < size; i++) {
        updates[key(i, 0)] = Infinity;
        updates[key(i, size - 1)] = Infinity;
        updates[key(0, i)] = Infinity;
        updates[key(size - 1, i)] = Infinity;
      }
      next.blockedCells = { ...next.blockedCells, ...updates };
      break;
    }
    case 'undoLast': {
      if (next.history.length > 0) {
        const prevBoards = next.history.slice(0, -1);
        board = prevBoards.length > 0 ? cloneBoard(prevBoards[prevBoards.length - 1]) : createEmptyBoard();
        next.history = prevBoards;
      }
      break;
    }
    case 'timeReset': {
      const idx = Math.max(0, next.history.length - 5);
      if (next.history.length > 0) {
        board = cloneBoard(next.history[idx]);
        next.history = next.history.slice(0, idx + 1);
      }
      break;
    }
    case 'chaosShift': {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
      const size = board.length;
      const newBoard = createEmptyBoard(size);
      const order = [];
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) order.push([x, y]);
      if (dx === 1) order.sort((a, b) => b[0] - a[0]);
      if (dx === -1) order.sort((a, b) => a[0] - b[0]);
      if (dy === 1) order.sort((a, b) => b[1] - a[1]);
      if (dy === -1) order.sort((a, b) => a[1] - b[1]);
      for (const [x, y] of order) {
        const v = board[y][x];
        if (v === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (inBounds(board, nx, ny)) newBoard[ny][nx] = v;
      }
      board = newBoard;
      break;
    }
    case 'release33': {
      next.ruleFlags = { ...next.ruleFlags, noDoubleThree: true };
      break;
    }
    case 'comboBlock': {
      const opponent = otherPlayer(player);
      const flanks = findOpenThreeFlankCells(board, opponent);
      const updates = {};
      for (const f of flanks) updates[key(f.x, f.y)] = next.ply + 1;
      next.blockedCells = { ...next.blockedCells, ...updates };
      break;
    }
    case 'randomSummon': {
      const allIds = poolForPlayer(player);
      const randomId = allIds[Math.floor(Math.random() * allIds.length)];
      next.draft = {
        ...next.draft,
        hands: { ...next.draft.hands, [player]: [...next.draft.hands[player], randomId] },
      };
      break;
    }
    case 'steal': {
      const opponent = otherPlayer(player);
      const lastCard = next.lastUsedCard[opponent];
      if (lastCard) {
        next.draft = {
          ...next.draft,
          hands: { ...next.draft.hands, [player]: [...next.draft.hands[player], lastCard] },
        };
      } else {
        next.message = '상대가 아직 사용한 카드가 없어요.';
      }
      break;
    }
    case 'winShield': {
      next.winShield = { ...next.winShield, [player]: true };
      break;
    }
    case 'silence': {
      const opponent = otherPlayer(player);
      next.silencedTurns = { ...next.silencedTurns, [opponent]: 2 };
      break;
    }
    case 'miracle': {
      const success = Math.random() < 0.01;
      next.miracleResult = success ? 'success' : 'fail';
      bumpProbTally(next, player, success);
      break;
    }
    case 'restore': {
      const RECENT_PLY_WINDOW = 5;
      const candidates = next.stoneLossLog.filter(
        (entry) => entry.owner === player
          && next.ply - entry.ply <= RECENT_PLY_WINDOW
          && board[entry.y][entry.x] === 0
      );
      if (candidates.length > 0) {
        const pick = candidates[candidates.length - 1]; // 가장 최근 것
        board[pick.y][pick.x] = player;
        next.stoneLossLog = next.stoneLossLog.filter((e) => e !== pick);
        next.message = '잃어버렸던 돌 1개를 되돌렸어요.';
      } else {
        next.message = '최근 5수 안에 되돌릴 수 있는 돌이 없어요. 카드는 소모됐어요.';
      }
      break;
    }
    case 'watcher': {
      next.watcherActive = { ...next.watcherActive, [player]: true };
      next.message = '감시자를 발동했어요. 다음에 상대가 파괴/연금술을 쓰면 무효화돼요.';
      break;
    }
    case 'duplicate': {
      const otherCards = next.draft.hands[player].filter((id) => id !== 'duplicate');
      if (otherCards.length > 0) {
        const pick = otherCards[Math.floor(Math.random() * otherCards.length)];
        next.draft = {
          ...next.draft,
          hands: { ...next.draft.hands, [player]: [...next.draft.hands[player], pick] },
        };
        const picked = CARDS.find((c) => c.id === pick);
        next.message = `'${picked ? picked.name : pick}' 카드를 복제했어요!`;
      } else {
        next.message = '복제할 다른 카드가 손에 없어요.';
      }
      break;
    }
    default:
      break;
  }
  if (cardId === 'miracle' && next.miracleResult === 'success') break; // 이미 성공했으면 더 굴리지 않아요
  if (cardId === 'shortWin' && next.shortWinResult === 'success') break;
  if (cardId === 'longWin' && next.longWinResult === 'success') break;
  }

  next.board = board;
  next = removeFromHand(next, player, cardId);
  next.activeCard = null;

  const boardChanged = ['undoLast', 'timeReset', 'chaosShift', 'restore'].includes(cardId);
  if (boardChanged) {
    next.history = [...next.history, board];
  }
  next = pushMoveLog(next, { type: 'card', player, cardId, targets: null, board });

  if (cardId === 'miracle' && next.miracleResult === 'success') {
    next.phase = 'over';
    next.winner = player;
    next.message = `기적이 일어났어요! ${player === BLACK ? '흑' : '백'} 즉시 승리!`;
    return next;
  }
  if (cardId === 'miracle') {
    next.message = '기적은 일어나지 않았어요... (1% 확률) 카드는 소모됐어요.';
  }

  if (FREE_ACTION.has(cardId)) {
    next.message = next.message === '상대가 아직 사용한 카드가 없어요.'
      ? next.message
      : `${player === BLACK ? '흑' : '백'} 차례예요. 이어서 돌을 놓거나 다른 카드를 쓸 수 있어요.`;
    return withDeadline(endIfStalemated(next));
  }

  next.ply += 1;
  next = explodeBombs(next);
  next = advanceTurn(next, player);
  return next;
}

function activatePlacementBuff(state, cardId) {
  const player = state.turn;
  let next = removeFromHand(state, player, cardId);
  next.lastUsedCard = { ...next.lastUsedCard, [player]: cardId };
  next.activeCard = null;
  if (next.echoActive[player]) {
    next.echoActive = { ...next.echoActive, [player]: false };
  }

  if (cardId === 'fourToWin') {
    const success = Math.random() < 0.3;
    bumpProbTally(next, player, success);
    if (success) {
      next.buffs = { ...next.buffs, fourToWinActive: true };
      next.message = '카드가 발동했어요! 이번에 4목만 완성해도 승리해요. 돌을 놓으세요.';
    } else {
      next.message = '카드가 발동하지 않았어요... (30% 확률) 카드는 소모됐어요.';
    }
  } else if (cardId === 'allow44') {
    next.ruleFlags = { ...next.ruleFlags, ignoreDoubleFourOnce: true };
    next.message = '이번 수는 4-4 금수가 적용되지 않아요. 돌을 놓으세요.';
  } else if (cardId === 'doubleMove') {
    next.buffs = { ...next.buffs, doubleMoveRemaining: 1 };
    next.message = '이번 턴엔 돌을 2개 놓을 수 있어요.';
  } else if (cardId === 'bomb') {
    next.buffs = { ...next.buffs, bombArmed: true };
    next.message = '다음에 놓는 돌이 시한폭탄이 돼요. 돌을 놓으세요.';
  }

  next = pushMoveLog(next, { type: 'card', player, cardId, targets: null, board: next.board });

  return withDeadline(next);
}

const TARGET_STEPS = {
  destroy: ['enemyStone'],
  destroyChain: ['enemyStone'],
  alchemy: ['enemyStone'],
  swap: ['ownStone', 'enemyStone'],
  overwrite: ['anyStoneCell'],
  moveStone: ['ownStone', 'emptyCell'],
  reinforce: ['ownStone'],
  barrier: ['emptyCell'],
  ward: ['emptyCell'],
  freezeCell: ['emptyCell'],
  corrupt: ['enemyStone'],
  sealLine: ['emptyOrAnyCell'],
  thornTrap: ['emptyCell'],
  provoke: ['emptyOrAnyCell'],
  confuse: ['emptyOrAnyCell'],
  wildcard: ['emptyCell'],
  vortex: ['emptyOrAnyCell'],
  mark: ['enemyStone'],
  sanctuary: ['ownStone'],
  coinFlip: ['enemyStone'],
};

function cellMatchesStep(state, x, y, step) {
  const player = state.turn;
  const v = state.board[y][x];
  if (step === 'enemyStone') return v === otherPlayer(player);
  if (step === 'ownStone') return v === player;
  if (step === 'emptyCell') return v === 0 && !isBlocked(state, x, y);
  if (step === 'anyStoneCell') return v !== 0;
  if (step === 'emptyOrAnyCell') return true;
  return false;
}

export function gameReducer(state, action) {
  switch (action.type) {
    case 'SET_STATE':
      // Firebase에 저장된 온라인 대전 상태는 업데이트 전에 만들어진 것일 수 있어요.
      // 이번에 새로 추가된 필드(watcherActive, stoneLossLog 등)가 없을 수 있으니,
      // 최신 초기 상태와 얕은 병합을 해서 누락된 필드는 기본값으로 채워줘요.
      return { ...createInitialState(), ...action.state };

    case 'START_GAME': {
      const { aiPlayer, difficulty, timeLimitSec, cardsPerPlayer } = action;
      const order = buildDraftOrder(cardsPerPlayer);
      const fresh = createInitialState();
      return {
        ...fresh,
        phase: 'draft',
        aiPlayer: aiPlayer || null,
        aiDifficulty: difficulty || 'normal',
        timeLimitSec: timeLimitSec || 0,
        message: '카드를 뽑는 중이에요.',
        draft: {
          pool: poolForPlayer(order[0]),
          hands: { [BLACK]: [], [WHITE]: [] },
          order,
          currentIndex: 0,
          options: drawRandomCards(poolForPlayer(order[0]), 3),
        },
      };
    }

    case 'REQUEST_REMATCH': {
      if (state.phase !== 'over') return state;
      const voter = action.player;
      if (!voter) return state;
      const votes = { ...state.rematchVotes, [voter]: true };

      if (votes[BLACK] && votes[WHITE]) {
        const cardsPerPlayer = state.draft.order.length / 2;
        const order = buildDraftOrder(cardsPerPlayer);
        const fresh = createInitialState();
        return {
          ...fresh,
          phase: 'draft',
          aiPlayer: state.aiPlayer,
          aiDifficulty: state.aiDifficulty,
          timeLimitSec: state.timeLimitSec,
          message: '카드를 뽑는 중이에요.',
          draft: {
            pool: poolForPlayer(order[0]),
            hands: { [BLACK]: [], [WHITE]: [] },
            order,
            currentIndex: 0,
            options: drawRandomCards(poolForPlayer(order[0]), 3),
          },
        };
      }

      return {
        ...state,
        rematchVotes: votes,
        message: `${voter === BLACK ? '흑' : '백'}이 재대국을 신청했어요. 상대의 동의를 기다리는 중...`,
      };
    }

    case 'DRAFT_PICK': {
      const { cardId } = action;
      const player = state.draft.order[state.draft.currentIndex];
      const hands = { ...state.draft.hands, [player]: [...state.draft.hands[player], cardId] };
      const currentIndex = state.draft.currentIndex + 1;
      const lastPick = { player, cardId, round: state.draft.currentIndex };

      if (currentIndex >= state.draft.order.length) {
        return withDeadline({
          ...state,
          phase: 'play',
          message: '흑 차례예요.',
          draft: { ...state.draft, hands, currentIndex, options: [], lastPick },
        });
      }

      const nextDrafter = state.draft.order[currentIndex];
      return {
        ...state,
        draft: { ...state.draft, hands, currentIndex, options: drawRandomCards(poolForPlayer(nextDrafter), 3), lastPick },
      };
    }

    case 'ACTIVATE_CARD': {
      const { cardId } = action;
      if (state.phase !== 'play') return state;
      const player = state.turn;

      if (state.silencedTurns[player] > 0) {
        return { ...state, message: '침묵 상태라 카드를 사용할 수 없어요.' };
      }

      if (PLACEMENT_BUFF.has(cardId)) return activatePlacementBuff(state, cardId);
      if (STANDALONE.has(cardId) && !TARGET_STEPS[cardId]) return resolveStandaloneNoTarget(state, cardId);
      return {
        ...state,
        activeCard: { id: cardId, pending: [] },
        message: '대상을 선택하세요.',
      };
    }

    case 'TIME_UP': {
      if (state.phase !== 'play') return state;
      const player = state.turn;
      let next = {
        ...state,
        activeCard: null,
        buffs: { doubleMoveRemaining: 0, fourToWinActive: false, bombArmed: false, doubleMoveBonusPending: false },
      };
      next = advanceTurn(next, player);
      next.message = `${player === BLACK ? '흑' : '백'}이 시간 초과로 턴을 넘겼어요. ${next.message}`;
      return next;
    }

    case 'RESIGN': {
      if (state.phase !== 'play' && state.phase !== 'draft') return state;
      const resigner = action.player ?? (state.phase === 'draft' ? state.draft.order[state.draft.currentIndex] : state.turn);
      const winner = otherPlayer(resigner);
      return {
        ...state,
        phase: 'over',
        winner,
        message: `${resigner === BLACK ? '흑' : '백'}이 기권했어요. ${winner === BLACK ? '흑' : '백'} 승리!`,
      };
    }

    case 'OFFER_DRAW': {
      if (state.phase !== 'play') return state;
      const offerer = action.player ?? state.turn;
      if (state.drawOffer) return state; // 이미 제안이 진행 중이면 무시
      return {
        ...state,
        drawOffer: { by: offerer },
        message: `${offerer === BLACK ? '흑' : '백'}이 무승부를 제안했어요.`,
      };
    }

    case 'RESPOND_DRAW': {
      if (state.phase !== 'play' || !state.drawOffer) return state;
      if (action.accept) {
        return {
          ...state,
          phase: 'over',
          winner: null,
          drawOffer: null,
          drawByOffer: true,
          message: '무승부에 합의했어요.',
        };
      }
      return {
        ...state,
        drawOffer: null,
        message: `${state.drawOffer.by === BLACK ? '흑' : '백'}이 제안한 무승부를 거절했어요.`,
      };
    }

    case 'CANCEL_CARD':
      return { ...state, activeCard: null, message: `${state.turn === BLACK ? '흑' : '백'} 차례예요.` };

    case 'SELECT_CELL': {
      const { x, y } = action;
      if (state.phase !== 'play') return state;

      if (state.activeCard) {
        const { id, pending } = state.activeCard;
        const steps = TARGET_STEPS[id];
        const stepIndex = pending.length;
        const step = steps[stepIndex];

        if (!cellMatchesStep(state, x, y, step)) {
          return { ...state, message: '유효하지 않은 대상이에요.' };
        }

        const nextPending = [...pending, { x, y }];
        if (nextPending.length < steps.length) {
          return { ...state, activeCard: { id, pending: nextPending }, message: '다음 대상을 선택하세요.' };
        }

        return resolveTargetedEffect(state, id, nextPending);
      }

      return tryPlaceStone(state, x, y);
    }

    case 'RESET_GAME':
      return createInitialState();

    default:
      return state;
  }
}

export { BLACK, WHITE, WILD, isBlocked, FREE_ACTION };
