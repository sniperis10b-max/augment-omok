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
import { CARDS, drawRandomCards } from './cards.js';

const STANDALONE = new Set([
  'destroy', 'alchemy', 'swap', 'moveStone', 'reinforce', 'barrier', 'ward',
  'freezeCell', 'corrupt', 'sealLine', 'overwrite', 'shrinkBoard', 'undoLast',
  'timeReset', 'chaosShift', 'release33',
  'thornTrap', 'comboBlock', 'randomSummon', 'provoke', 'confuse', 'steal',
  'winShield', 'wildcard', 'silence',
]);
const PLACEMENT_BUFF = new Set(['fourToWin', 'allow44', 'doubleMove', 'bomb']);

// 상대에게 직접 뭔가를 하는 '수'가 아니라 내 쪽 준비/설치 동작에 가까운 카드들.
// 턴을 넘기지 않고 곧바로 이어서 돌을 놓거나 다른 카드를 쓸 수 있게 해요.
const FREE_ACTION = new Set([
  'reinforce', 'release33',
  'destroy', 'corrupt', 'moveStone', 'freezeCell', 'ward', 'sealLine',
  'thornTrap', 'comboBlock', 'randomSummon', 'provoke', 'confuse', 'steal',
  'winShield', 'wildcard', 'silence',
]);

const key = (x, y) => `${x},${y}`;

function isBlocked(state, x, y) {
  const k = key(x, y);
  const expire = state.blockedCells[k];
  if (expire === undefined) return false;
  return expire === Infinity || state.ply < expire;
}

export function createInitialState() {
  const order = [BLACK, WHITE, BLACK, WHITE, BLACK, WHITE];
  return {
    phase: 'setup',
    aiPlayer: null,
    aiDifficulty: 'normal',
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
    silencedTurns: { [BLACK]: 0, [WHITE]: 0 },
    skipNextTurn: { [BLACK]: false, [WHITE]: false },
    lastUsedCard: { [BLACK]: null, [WHITE]: null },
    history: [],
    ruleFlags: { noDoubleThree: false, ignoreDoubleFourOnce: false },
    buffs: { doubleMoveRemaining: 0, fourToWinActive: false, bombArmed: false },
    winner: null,
    message: '카드를 뽑는 중이에요.',
    draft: {
      pool: CARDS.map((c) => c.id),
      hands: { [BLACK]: [], [WHITE]: [] },
      order,
      currentIndex: 0,
      options: drawRandomCards(CARDS.map((c) => c.id), 3),
    },
    activeCard: null,
  };
}

function cloneBoard(board) {
  return board.map((row) => row.slice());
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

  return endIfStalemated(next);
}

function finishTurnAfterPlacement(state, placingPlayer) {
  let next = { ...state, ply: state.ply + 1 };
  next = explodeBombs(next);

  if (placingPlayer === BLACK) {
    next.ruleFlags = { ...next.ruleFlags, ignoreDoubleFourOnce: false };
  }

  if (next.buffs.doubleMoveRemaining > 0) {
    next.buffs = { ...next.buffs, doubleMoveRemaining: next.buffs.doubleMoveRemaining - 1, fourToWinActive: false, bombArmed: false };
    next.message = '한 번 더 놓을 수 있어요.';
    next = endIfStalemated(next);
  } else {
    next.buffs = { doubleMoveRemaining: 0, fourToWinActive: false, bombArmed: false };
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

  let nextState = { ...workingState, board: nextBoard };
  nextState.history = [...workingState.history, nextBoard];

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

  const winLength = workingState.buffs.fourToWinActive ? 4 : 5;
  const won = checkWin(nextBoard, x, y, player, { winLength, sealedLines: workingState.sealedLines });

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
  const board = cloneBoard(next.board);

  switch (cardId) {
    case 'destroy': {
      const [t] = targets;
      if (next.protectedStones[key(t.x, t.y)]) { next.message = '강화된 돌이라 파괴할 수 없어요.'; return next; }
      board[t.y][t.x] = 0;
      break;
    }
    case 'alchemy': {
      const [t] = targets;
      if (next.protectedStones[key(t.x, t.y)]) { next.message = '강화된 돌이라 변환할 수 없어요.'; return next; }
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

  const boardChanged = ['destroy', 'alchemy', 'swap', 'overwrite', 'moveStone', 'wildcard'].includes(cardId);
  if (boardChanged) {
    next.history = [...next.history, board];
  }

  if (cardId === 'overwrite') {
    const won = checkWin(board, targets[0].x, targets[0].y, player, { sealedLines: next.sealedLines });
    if (won) {
      next.phase = 'over';
      next.winner = player;
      next.message = `${player === BLACK ? '흑' : '백'} 승리!`;
      return next;
    }
    if (isBoardFull(board)) {
      next.phase = 'over';
      next.winner = null;
      next.message = '무승부예요.';
      return next;
    }
    return finishTurnAfterPlacement(next, player);
  }

  if (cardId === 'wildcard') {
    const t = targets[0];
    const blackWon = checkWin(board, t.x, t.y, BLACK, { sealedLines: next.sealedLines });
    const whiteWon = !blackWon && checkWin(board, t.x, t.y, WHITE, { sealedLines: next.sealedLines });
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
    return endIfStalemated(next);
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

  switch (cardId) {
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
      const allIds = CARDS.map((c) => c.id);
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
    default:
      break;
  }

  next.board = board;
  next = removeFromHand(next, player, cardId);
  next.activeCard = null;

  const boardChanged = ['undoLast', 'timeReset', 'chaosShift'].includes(cardId);
  if (boardChanged) {
    next.history = [...next.history, board];
  }

  if (FREE_ACTION.has(cardId)) {
    next.message = next.message === '상대가 아직 사용한 카드가 없어요.'
      ? next.message
      : `${player === BLACK ? '흑' : '백'} 차례예요. 이어서 돌을 놓거나 다른 카드를 쓸 수 있어요.`;
    return endIfStalemated(next);
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

  if (cardId === 'fourToWin') {
    next.buffs = { ...next.buffs, fourToWinActive: true };
    next.message = '이번에 4목만 완성해도 승리해요. 돌을 놓으세요.';
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

  return next;
}

const TARGET_STEPS = {
  destroy: ['enemyStone'],
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
      return action.state;

    case 'START_GAME': {
      const { aiPlayer, difficulty } = action;
      return {
        ...state,
        phase: 'draft',
        aiPlayer: aiPlayer || null,
        aiDifficulty: difficulty || 'normal',
        message: '카드를 뽑는 중이에요.',
      };
    }

    case 'DRAFT_PICK': {
      const { cardId } = action;
      const player = state.draft.order[state.draft.currentIndex];
      const pool = state.draft.pool.filter((id) => id !== cardId);
      const hands = { ...state.draft.hands, [player]: [...state.draft.hands[player], cardId] };
      const currentIndex = state.draft.currentIndex + 1;

      if (currentIndex >= state.draft.order.length) {
        return {
          ...state,
          phase: 'play',
          message: '흑 차례예요.',
          draft: { ...state.draft, pool, hands, currentIndex, options: [] },
        };
      }

      return {
        ...state,
        draft: { ...state.draft, pool, hands, currentIndex, options: drawRandomCards(pool, 3) },
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

export { BLACK, WHITE, WILD, isBlocked };
