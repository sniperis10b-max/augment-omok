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
  DIRECTIONS,
} from './gameLogic.js';
import { CARDS, drawRandomCards, poolForPlayer } from './cards.js';
import { DESTROY_CARD_IDS, DEFENSE_CARD_IDS, LADDER_LEVELS, PROB_CARD_IDS, CHALLENGES_5, CHALLENGES_6 } from './challenges.js';
import { pickRandomRouletteRule, rollingWinLength, getRouletteRuleById } from './roulette.js';

const STANDALONE = new Set([
  'destroy', 'alchemy', 'swap', 'moveStone', 'reinforce', 'barrier', 'ward',
  'freezeCell', 'corrupt', 'sealLine', 'overwrite', 'shrinkBoard', 'undoLast',
  'timeReset', 'chaosShift', 'release33',
  'thornTrap', 'comboBlock', 'randomSummon', 'provoke', 'confuse', 'steal',
  'winShield', 'wildcard', 'silence', 'miracle',
  'destroyChain', 'restore', 'watcher', 'duplicate', 'vortex',
  'trade', 'mark', 'purify', 'echo',
  'sanctuary', 'headcount', 'reroll', 'allowOverline', 'reverseForbidden', 'shortWin', 'longWin', 'coinFlip',
  'erosion', 'reflect', 'guardian', 'resurrection', 'lottery',
  'lightning', 'tsunami', 'blackhole', 'dice',
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
  'erosion', 'reflect', 'guardian',
]);

const key = (x, y) => `${x},${y}`;

// 업적 집계용: player가 파괴 계열 카드로 실제로 없앤 상대 돌 개수를 누적해요.
function bumpDestroyCount(next, player, amount = 1) {
  next.stoneDestroyCount = {
    ...next.stoneDestroyCount,
    [player]: (next.stoneDestroyCount?.[player] || 0) + amount,
  };
  // 룰렛 "파괴전 승리": 상대 돌 10개를 파괴하면 오목과 무관하게 즉시 승리해요.
  if (next.rouletteRule === 'destroyWin' && next.phase !== 'over' && next.stoneDestroyCount[player] >= 10) {
    next.phase = 'over';
    next.winner = player;
    next.message = `상대 돌 10개를 파괴해서 ${player === BLACK ? '흑' : '백'} 승리!`;
  }
}

// 업적 집계용: player가 사용한 확률형 카드의 성공/실패를 누적해요.
function bumpProbTally(next, player, success) {
  const cur = next.probCardTally?.[player] || { success: 0, fail: 0 };
  next.probCardTally = {
    ...next.probCardTally,
    [player]: { success: cur.success + (success ? 1 : 0), fail: cur.fail + (success ? 0 : 1) },
  };
}

// 업적 집계용: defender(감시자를 발동해둔 쪽)가 상대의 파괴/연금술을 몇 번 무효화했는지 누적해요.
function bumpWatcherBlock(next, defender) {
  next.watcherBlockCount = {
    ...next.watcherBlockCount,
    [defender]: (next.watcherBlockCount?.[defender] || 0) + 1,
  };
}

// 상대 돌 하나를 노리는 효과(파괴류)를 쓰기 전에 호출해요. 감시자 -> 수호천사 -> 반사 순으로
// 확인해서, 그중 하나라도 걸려있으면 그걸 소모하고 { message } 를 돌려줘요 (원래 효과는 취소).
// 반사는 대신 공격자(player)의 가장 최근 돌 하나를 파괴해요. 아무것도 안 걸려있으면 null.
function tryDefend(next, board, player, target) {
  const defender = otherPlayer(player);
  if (next.watcherActive[defender]) {
    next.watcherActive = { ...next.watcherActive, [defender]: false };
    bumpWatcherBlock(next, defender);
    return { message: `${defender === BLACK ? '흑' : '백'}의 감시자가 효과를 무효화했어요!` };
  }
  if (next.guardianActive[defender]) {
    next.guardianActive = { ...next.guardianActive, [defender]: false };
    return { message: `${defender === BLACK ? '흑' : '백'}의 수호천사가 효과를 무효화했어요!` };
  }
  if (next.reflectActive[defender]) {
    next.reflectActive = { ...next.reflectActive, [defender]: false };
    const mine = next.moveLog.filter((m) => m.type === 'place' && m.player === player).slice().reverse();
    for (const m of mine) {
      if (board[m.y][m.x] === player && !next.protectedStones[key(m.x, m.y)]) {
        next.stoneLossLog = [...next.stoneLossLog, { owner: player, x: m.x, y: m.y, ply: next.ply }];
        board[m.y][m.x] = 0;
        return { message: `${defender === BLACK ? '흑' : '백'}이 효과를 반사했어요! 오히려 내 돌이 파괴됐어요.` };
      }
    }
    return { message: `${defender === BLACK ? '흑' : '백'}이 반사를 시도했지만 반사할 대상이 없었어요.` };
  }
  return null;
}

function isBlocked(state, x, y) {
  const k = key(x, y);
  const expire = state.blockedCells[k];
  if (expire === undefined) return false;
  return expire === Infinity || state.ply < expire;
}

// 챌린지 "외통수 강요"용 간단한 평가 함수: player가 그 칸에 두면 얼마나 좋을지
// (4방향 연결 길이 기반) 대충 점수 매겨서, 가장 좋은 빈 칸을 찾아요.
function simpleLineScore(board, x, y, player) {
  const size = board.length;
  let score = 0;
  for (const [dx, dy] of DIRECTIONS) {
    let count = 1;
    for (const sign of [1, -1]) {
      let nx = x + dx * sign, ny = y + dy * sign;
      while (nx >= 0 && nx < size && ny >= 0 && ny < size && board[ny][nx] === player) {
        count++;
        nx += dx * sign;
        ny += dy * sign;
      }
    }
    score += count * count;
  }
  return score;
}

// 챌린지 "이중 증명"/"결정적 순간"용: (x,y)에서 완성된 targetLength 길이의 줄이 있다면
// 그 줄을 이루는 좌표들을 전부 찾아서 돌려줘요 (없으면 null).
function findLineCells(board, x, y, player, targetLength, markedStones = {}) {
  const size = board.length;
  for (const [dx, dy] of DIRECTIONS) {
    const cells = [{ x, y }];
    for (let step = 1; step < 8; step++) {
      const nx = x + dx * step, ny = y + dy * step;
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) break;
      if (markedStones[`${nx},${ny}`]) break;
      if (board[ny][nx] !== player && board[ny][nx] !== WILD) break;
      cells.push({ x: nx, y: ny });
    }
    for (let step = 1; step < 8; step++) {
      const nx = x - dx * step, ny = y - dy * step;
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) break;
      if (markedStones[`${nx},${ny}`]) break;
      if (board[ny][nx] !== player && board[ny][nx] !== WILD) break;
      cells.unshift({ x: nx, y: ny });
    }
    if (cells.length >= targetLength) return cells;
  }
  return null;
}

function findBestEmptyCellForPlayer(state, player) {
  const { board } = state;
  const size = board.length;
  let best = null;
  let bestScore = -Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[y][x] !== 0 || isBlocked(state, x, y)) continue;
      const score = simpleLineScore(board, x, y, player);
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
  }
  return best;
}

// 챌린지 "완전 무작위"용: 지금 둘 수 있는(비어있고 안 막힌) 칸 중 무작위로 n개를 뽑아요.
// zone이 있으면(도발 카드로 강제된 영역과 겹칠 때) 그 영역 안에서만 뽑아요 - 안 그러면
// 무작위로 뽑힌 칸들이 전부 도발 영역 밖에 있어서 아예 둘 곳이 없어지는 문제가 생겨요.
function pickRandomEmptyCells(state, n, zone = null) {
  const { board } = state;
  const size = board.length;
  const options = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (zone && (x < zone.x0 || x > zone.x1 || y < zone.y0 || y > zone.y1)) continue;
      if (board[y][x] === 0 && !isBlocked(state, x, y)) options.push({ x, y });
    }
  }
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options.slice(0, n);
}

// 챌린지 세트 5, 6에서 사람/AI 둘 다 못 쓰게 막는 카드들 (승리 조건을 바꿔버려서 그
// 세트들의 챌린지와 충돌해요).
const WIN_CONDITION_BANNED_CARDS = new Set(['fourToWin', 'miracle', 'shortWin', 'longWin']);
// 챌린지 "기적의 연속"에서 사람/AI 둘 다 못 쓰게 막는 카드들 (착수 성공률 자체를 우회할
// 수 있는 카드라서 막아요).
const MIRACLE_STREAK_BANNED_CARDS = new Set(['alchemy', 'overwrite']);

function isWinConditionChallenge(challengeId) {
  return CHALLENGES_5.some((c) => c.id === challengeId) || CHALLENGES_6.some((c) => c.id === challengeId);
}

// poolForPlayer(player)의 결과에 챌린지5/6/기적의 연속 카드 금지를 적용해요. 드래프트뿐
// 아니라 "머릿수 싸움"/"재수정"/"무작위 소환"/"복권"처럼 게임 도중에 무작위 카드를
// 얻는 카드 효과들도 전부 이 함수를 거쳐야, 그 효과들로 금지된 카드가 몰래 들어오는 걸
// 막을 수 있어요.
function poolForPlayerFiltered(player, state) {
  let pool = poolForPlayer(player);
  if (state?.challengeId && isWinConditionChallenge(state.challengeId)) {
    pool = pool.filter((id) => !WIN_CONDITION_BANNED_CARDS.has(id));
  }
  if (state?.challengeId === 'miracleStreak') {
    pool = pool.filter((id) => !MIRACLE_STREAK_BANNED_CARDS.has(id));
  }
  return pool;
}

// 챌린지의 "파괴 금지"/"방어 금지" 같은 카드 제한을 사람 플레이어의 드래프트 풀에만 적용해요.
// 단, 챌린지 세트 5/6의 승리조건 카드 금지(사목 승리/기적/단축 승리/연장 승리)와 "기적의
// 연속"의 연금술/관통 금지는 사람/AI 양쪽 모두에게 적용돼요 - 안 그러면 AI가 그 카드로
// 챌린지 취지를 무력화할 수 있어요.
function draftPoolForChallenge(pool, player, state) {
  let filtered = pool;
  if (state.challengeId && isWinConditionChallenge(state.challengeId)) {
    filtered = filtered.filter((id) => !WIN_CONDITION_BANNED_CARDS.has(id));
  }
  if (state.challengeId === 'miracleStreak') {
    filtered = filtered.filter((id) => !MIRACLE_STREAK_BANNED_CARDS.has(id));
  }
  if (!state.challengeCardBan || player !== state.humanColor) return filtered;
  return filtered.filter((id) => !state.challengeCardBan[id]);
}

// 룰렛 "파괴전": 드래프트 풀을 파괴 계열 카드로만 제한해요 (챌린지와 달리 양쪽 다 적용돼요).
function draftPoolForRoulette(pool, state) {
  if (state.rouletteRule !== 'destroyOnly') return pool;
  const filtered = pool.filter((id) => DESTROY_CARD_IDS.has(id));
  return filtered.length > 0 ? filtered : pool;
}

// 게임 중 카드 효과(머릿수 싸움/리롤/복제 등)가 무작위로 카드를 뽑을 때도, 룰렛
// "파괴전"이 켜져 있으면 그 풀 안에서만 뽑히게 해요.
function effectivePool(player, state) {
  return draftPoolForRoulette(poolForPlayer(player), state);
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
    guardianActive: { [BLACK]: false, [WHITE]: false },
    reflectActive: { [BLACK]: false, [WHITE]: false },
    echoActive: { [BLACK]: false, [WHITE]: false },
    echoResult: null,
    shortWinResult: null,
    longWinResult: null,
    coinFlipResult: null,
    resurrectionResult: null,
    lotteryResult: null,
    diceResult: null,
    markedStones: {},
    stoneLossLog: [],
    stoneDestroyCount: { [BLACK]: 0, [WHITE]: 0 },
    watcherBlockCount: { [BLACK]: 0, [WHITE]: 0 },
    probCardTally: {
      [BLACK]: { success: 0, fail: 0 },
      [WHITE]: { success: 0, fail: 0 },
    },
    silencedTurns: { [BLACK]: 0, [WHITE]: 0 },
    skipNextTurn: { [BLACK]: false, [WHITE]: false },
    lastUsedCard: { [BLACK]: null, [WHITE]: null },
    history: [],
    moveLog: [],
    ruleFlags: { noDoubleThree: false, ignoreDoubleFourOnce: false, allowOverline: false, forceForbiddenFor: null, noDiagonalFor: null },
    winLengthOverride: { [BLACK]: null, [WHITE]: null },
    humanColor: null,
    challengeId: null,
    challengeCardBan: {},
    rouletteRule: null,
    pendingPhase: null,
    cardUsedThisTurn: { [BLACK]: false, [WHITE]: false },
    stoneBirthPly: {},
    canyonRing: 0,
    scatteredFogCells: {}, // 챌린지 "흩어진 시야": 항상 안 보이는 무작위 칸들 (렌더링 전용, 착수 자체는 가능)
    humanCardUsedCount: 0, // 챌린지 "카드 한 방 승부": 내가 이번 판에 카드를 몇 번 썼는지
    misfireOriginalCard: null, // 챌린지 "카드 감별 실패": 실제로 손에서 빠져야 할 원래 카드 id
    provenWinCount: 0, // 챌린지 "이중 증명": 지금까지 완성한(서로 다른) 5목 줄 개수
    allowedCells: null, // 챌린지 "완전 무작위": 이번 내 턴에 둘 수 있는 칸 3개 (null이면 제한 없음)
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
  // 룰렛 "점점 짧아지는 시간": 한 수마다 0.5초씩 줄어들고, 최소 1초는 보장돼요.
  const effectiveSec = state.rouletteRule === 'shrinkingTime'
    ? Math.max(1, state.timeLimitSec - state.ply * 0.5)
    : state.timeLimitSec;
  return { ...state, turnDeadline: Date.now() + effectiveSec * 1000 };
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

  // 룰렛 "강제 카드 턴": 새로 턴을 받는 쪽의 "이번 턴에 카드 썼는지" 표시를 초기화해요.
  if (next.rouletteRule === 'forceCardTurn') {
    next.cardUsedThisTurn = { ...next.cardUsedThisTurn, [next.turn]: false };
  }

  // 룰렛 "매턴 카드 자동 지급": 새로 턴을 받는 쪽에게 무작위 카드 1장을 자동으로 줘요.
  if (next.rouletteRule === 'autoCardPerTurn') {
    const pool = effectivePool(next.turn, next);
    if (pool.length > 0) {
      const randomId = pool[Math.floor(Math.random() * pool.length)];
      next.draft = { ...next.draft, hands: { ...next.draft.hands, [next.turn]: [...next.draft.hands[next.turn], randomId] } };
    }
  }

  // 챌린지 "완전 무작위": 내(사람) 턴이 시작될 때마다 둘 수 있는 칸 5개를 새로 뽑아요.
  // (도발 카드로 강제 영역이 걸려있으면, 그 영역 밖의 칸이 뽑혀서 둘 곳이 없어지는 일이
  // 없도록 그 영역 안에서만 뽑아요.)
  if (next.challengeId === 'randomThreeCells') {
    if (next.turn === next.humanColor) {
      const zone = next.forcedZone && next.forcedZone.player === next.humanColor ? next.forcedZone : null;
      next.allowedCells = pickRandomEmptyCells(next, 5, zone);
    } else {
      next.allowedCells = null;
    }
  }

  // 챌린지 "카드 폭풍": AI 차례가 되면 카드를 2장씩 자동으로 받아요 (나는 평소대로 드래프트).
  if (next.challengeId === 'cardStormAI' && next.aiPlayer && next.turn === next.aiPlayer) {
    const pool = poolForPlayer(next.aiPlayer);
    if (pool.length > 0) {
      const drawn = [pool[Math.floor(Math.random() * pool.length)], pool[Math.floor(Math.random() * pool.length)]];
      next.draft = { ...next.draft, hands: { ...next.draft.hands, [next.aiPlayer]: [...next.draft.hands[next.aiPlayer], ...drawn] } };
    }
  }

  return withDeadline(endIfStalemated(next));
}

function finishTurnAfterPlacement(state, placingPlayer) {
  let next = { ...state, ply: state.ply + 1 };
  next = explodeBombs(next);

  // 챌린지 "무한 굴레": 10수마다 판 위의 내(사람) 돌이 전부 사라져요 (AI 돌은 그대로예요).
  if (next.challengeId === 'infiniteLoop' && next.humanColor && next.ply % 10 === 0 && next.ply > 0) {
    const size = next.board.length;
    const clearedBoard = next.board.map((row) => row.slice());
    let cleared = 0;
    for (let cy = 0; cy < size; cy++) {
      for (let cx = 0; cx < size; cx++) {
        if (clearedBoard[cy][cx] === next.humanColor) { clearedBoard[cy][cx] = 0; cleared++; }
      }
    }
    if (cleared > 0) {
      next.board = clearedBoard;
      next.message = `무한 굴레! 내 돌 ${cleared}개가 전부 사라졌어요. ${next.message || ''}`;
    }
  }

  // 챌린지 "변질": 내(사람)가 수를 둘 때마다, 판 위의 내 돌 전부가 각각 80% 확률로
  // 상대 색으로 바뀌어요.
  if (next.challengeId === 'corruption' && next.humanColor && placingPlayer === next.humanColor) {
    const size = next.board.length;
    const opponent = otherPlayer(next.humanColor);
    const corruptedBoard = next.board.map((row) => row.slice());
    let corrupted = 0;
    for (let cy = 0; cy < size; cy++) {
      for (let cx = 0; cx < size; cx++) {
        if (corruptedBoard[cy][cx] === next.humanColor && Math.random() < 0.8) {
          corruptedBoard[cy][cx] = opponent;
          corrupted++;
        }
      }
    }
    if (corrupted > 0) {
      next.board = corruptedBoard;
      next.message = `변질! 내 돌 ${corrupted}개가 상대 색으로 바뀌었어요. ${next.message || ''}`;
    }
  }

  if (placingPlayer === BLACK) {
    next.ruleFlags = { ...next.ruleFlags, ignoreDoubleFourOnce: false };
  }
  if (next.ruleFlags.forceForbiddenFor === placingPlayer) {
    next.ruleFlags = { ...next.ruleFlags, forceForbiddenFor: null };
  }

  // 룰렛 "번개 결착": 40수 안에 승부가 안 나면 무조건 무승부로 끝나요.
  if (next.rouletteRule === 'suddenDeath' && next.phase === 'play' && next.ply >= 40) {
    next.phase = 'over';
    next.winner = null;
    next.message = '번개 결착! 40수 안에 승부가 나지 않아 무승부로 끝났어요.';
    return next;
  }

  // 챌린지 "유한한 인내": 30수 안에 승부를 못 내면 그 즉시 패배해요.
  if (next.challengeId === 'finitePatience' && next.phase === 'play' && next.ply >= 30 && next.humanColor) {
    next.phase = 'over';
    next.winner = otherPlayer(next.humanColor);
    next.message = '유한한 인내가 바닥났어요... 30수 안에 승부를 내지 못해 패배했어요.';
    return next;
  }

  // 룰렛 "협곡 붕괴": 10수마다 판 바깥 테두리를 한 줄씩 영구히 막아요.
  if (next.rouletteRule === 'canyonCollapse' && next.ply % 10 === 0) {
    const size = next.board.length;
    const ring = next.canyonRing + 1;
    if (ring * 2 < size) {
      const blockedCells = { ...next.blockedCells };
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (x < ring || x >= size - ring || y < ring || y >= size - ring) {
            blockedCells[key(x, y)] = Infinity;
          }
        }
      }
      next.blockedCells = blockedCells;
      next.canyonRing = ring;
      next.message = `협곡이 붕괴돼서 바깥 ${ring}줄이 막혔어요! ${next.message}`;
    }
  }

  // 챌린지 "짧아지는 판": 5수마다 판 바깥 테두리를 한 줄씩 영구히 막아요 (협곡 붕괴의 빠른 버전).
  if (next.challengeId === 'shrinkingBoard' && next.ply % 5 === 0 && next.ply > 0) {
    const size = next.board.length;
    const ring = next.canyonRing + 1;
    if (ring * 2 < size) {
      const blockedCells = { ...next.blockedCells };
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (x < ring || x >= size - ring || y < ring || y >= size - ring) {
            blockedCells[key(x, y)] = Infinity;
          }
        }
      }
      next.blockedCells = blockedCells;
      next.canyonRing = ring;
      next.message = `판이 좁아져서 바깥 ${ring}줄이 막혔어요! ${next.message}`;
    }
  }

  // 챌린지 "유령 돌": 내(사람) 돌 중 놓은 지 10수가 지난 건 사라져요.
  if (next.challengeId === 'ghostStones' && next.humanColor) {
    const size = next.board.length;
    const birth = next.stoneBirthPly || {};
    const decayed = [];
    let changed = false;
    const newBoard = next.board.map((row) => row.slice());
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (newBoard[y][x] !== next.humanColor) continue;
        const k = key(x, y);
        const bornAt = birth[k];
        if (bornAt != null && next.ply - bornAt >= 10) {
          newBoard[y][x] = 0;
          decayed.push(k);
          changed = true;
        }
      }
    }
    if (changed) {
      next.board = newBoard;
      const newBirth = { ...birth };
      for (const k of decayed) delete newBirth[k];
      next.stoneBirthPly = newBirth;
      next.message = `유령이 된 내 돌이 사라졌어요! ${next.message}`;
    }
  }

  // 챌린지 "외통수 강요": AI가 자기 수를 두고 나면, 내(사람) 급소가 될 만한 빈 칸을 하나 더 막아요.
  if (next.challengeId === 'forcedCheckmate' && placingPlayer === next.aiPlayer && next.humanColor) {
    const target = findBestEmptyCellForPlayer(next, next.humanColor);
    if (target) {
      next.blockedCells = { ...next.blockedCells, [key(target.x, target.y)]: Infinity };
      next.message = `AI가 당신의 급소를 미리 막았어요! ${next.message}`;
    }
  }

  // 룰렛 "자동 소멸": 놓은 지 12수가 지난 돌은 사라져요.
  if (next.rouletteRule === 'autoDecay') {
    const size = next.board.length;
    const birth = next.stoneBirthPly || {};
    const decayed = [];
    let changed = false;
    const newBoard = next.board.map((row) => row.slice());
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (newBoard[y][x] === 0) continue;
        const k = key(x, y);
        const bornAt = birth[k];
        if (bornAt != null && next.ply - bornAt >= 12) {
          newBoard[y][x] = 0;
          decayed.push(k);
          changed = true;
        }
      }
    }
    if (changed) {
      next.board = newBoard;
      const newBirth = { ...birth };
      for (const k of decayed) delete newBirth[k];
      next.stoneBirthPly = newBirth;
      next.message = `오래된 돌이 자동으로 사라졌어요! ${next.message}`;
    }
  }

  // 룰렛 "색깔 교대전": 10수마다 판 위 모든 돌의 흑/백이 뒤바뀌어요.
  if (next.rouletteRule === 'colorSwap' && next.ply % 10 === 0) {
    next.board = next.board.map((row) => row.map((v) => (v === BLACK ? WHITE : v === WHITE ? BLACK : v)));
    next.message = `색깔이 서로 뒤바뀌었어요! ${next.message}`;
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

  // 룰렛 "강제 카드 턴": 손에 카드가 있는데 아직 이번 턴에 카드를 안 썼으면 착수를 거부해요.
  if (
    workingState.rouletteRule === 'forceCardTurn'
    && !workingState.cardUsedThisTurn[player]
    && workingState.draft.hands[player].length > 0
  ) {
    return { ...workingState, message: '이번 턴엔 카드를 먼저 써야 착수할 수 있어요.' };
  }

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

  // 챌린지 "완전 무작위": 내 턴엔 미리 제시된 5칸 중 하나에만 둘 수 있어요.
  if (
    workingState.challengeId === 'randomThreeCells'
    && player === workingState.humanColor
    && Array.isArray(workingState.allowedCells)
    && !workingState.allowedCells.some((c) => c.x === x && c.y === y)
  ) {
    return { ...workingState, message: '지금은 제시된 5칸 중 한 곳에만 둘 수 있어요.' };
  }

  const forbidden = isForbiddenMove(board, x, y, player, workingState.ruleFlags);
  if (forbidden) {
    const label = forbidden === 'overline' ? '육목' : forbidden === 'double-three' ? '3-3' : '4-4';
    return { ...workingState, message: `금수 자리예요 (${label}). 다른 칸을 선택하세요.` };
  }

  // 챌린지 "도박수": 내가 두는 수는 30% 확률로만 실제로 놓이고, 실패하면 그냥 턴이 넘어가요.
  // (실제로 돌을 놓은 게 아니라서 ply는 그대로 두고, 턴만 상대에게 넘겨요.)
  if (workingState.challengeId === 'gambitMove' && player === workingState.humanColor && Math.random() >= 0.3) {
    const res = advanceTurn(workingState, player);
    res.message = `도박 실패! 이번 수는 놓이지 않고 턴이 넘어갔어요. ${res.message}`;
    return res;
  }
  // 챌린지 "도박 인생": 내가 두는 수는 5% 확률로만 실제로 놓여요.
  if (workingState.challengeId === 'gambleLife' && player === workingState.humanColor && Math.random() >= 0.05) {
    const res = advanceTurn(workingState, player);
    res.message = `도박 실패! 이번 수는 놓이지 않고 턴이 넘어갔어요. ${res.message}`;
    return res;
  }
  // 챌린지 "기적의 연속": 내가 두는 수는 1% 확률로만 실제로 놓여요.
  if (workingState.challengeId === 'miracleStreak' && player === workingState.humanColor && Math.random() >= 0.01) {
    const res = advanceTurn(workingState, player);
    res.message = `실패! 이번 수는 놓이지 않고 턴이 넘어갔어요. ${res.message}`;
    return res;
  }
  // 챌린지 "고립무원": 내(사람) 돌은 상대 돌과 8방향으로 붙어있는 칸에는 놓을 수 없어요.
  if (workingState.challengeId === 'isolation' && player === workingState.humanColor) {
    const size = board.length;
    const opponent = otherPlayer(player);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < size && ny >= 0 && ny < size && board[ny][nx] === opponent) {
          return { ...workingState, message: '상대 돌과 붙어있는 칸에는 둘 수 없어요.' };
        }
      }
    }
  }

  const nextBoard = cloneBoard(board);

  // 룰렛 "배신": 50% 확률로 방금 놓은 돌이 상대 돌로 바뀌어요.
  let placedColor = player;
  let betrayed = false;
  if (workingState.rouletteRule === 'betrayal' && Math.random() < 0.5) {
    placedColor = otherPlayer(player);
    betrayed = true;
  }
  // 챌린지 "무작위 배신": 내(사람)가 놓는 돌은 75% 확률로 AI 색으로 바로 뒤바뀌어요.
  if (workingState.challengeId === 'randomBetrayal' && player === workingState.humanColor && Math.random() < 0.75) {
    placedColor = otherPlayer(player);
    betrayed = true;
  }
  nextBoard[y][x] = placedColor;

  let nextState = { ...workingState, board: nextBoard, lastMove: { x, y } };
  nextState.history = [...workingState.history, nextBoard];
  nextState = pushMoveLog(nextState, { type: 'place', player, placedColor, x, y, board: nextBoard });

  // 룰렛 "자동 소멸"을 위해 이 칸이 언제(몇 수째) 놓였는지 기억해둬요.
  if (workingState.rouletteRule === 'autoDecay') {
    nextState.stoneBirthPly = { ...workingState.stoneBirthPly, [key(x, y)]: workingState.ply };
  }
  // 챌린지 "유령 돌": 내(사람) 돌이 언제 놓였는지 기억해뒀다가 5수 후 반투명, 10수 후 소멸시켜요.
  if (workingState.challengeId === 'ghostStones' && placedColor === workingState.humanColor) {
    nextState.stoneBirthPly = { ...workingState.stoneBirthPly, [key(x, y)]: workingState.ply };
  }

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

  const winLength = workingState.rouletteRule === 'rollingWin'
    ? rollingWinLength(workingState.ply)
    : (workingState.buffs.fourToWinActive ? 4 : (workingState.winLengthOverride?.[placedColor] ?? 5));
  const isBonusMove = !!workingState.buffs.doubleMoveBonusPending;
  const excludeDiagonal = workingState.ruleFlags?.noDiagonalFor === placedColor;
  // 챌린지 "대각선만": 내(사람) 승리만 대각선 방향으로만 인정돼요 (AI는 제한 없음).
  const onlyDiagonal = workingState.challengeId === 'diagonalOnlyPlayer' && placedColor === workingState.humanColor;

  // 룰렛 "연속 두기 상시": 이번 수가 이 턴의 첫 수라면, 언제나 한 번 더 놓을 수 있게 예약해요.
  if (workingState.rouletteRule === 'doubleMoveAlways' && !isBonusMove) {
    nextState.buffs = { ...nextState.buffs, doubleMoveRemaining: 1 };
  }
  // 챌린지 "2연속 착수": AI만 매 턴 2수씩 둬요. AI의 두 번째 수로도 승리가 인정돼요.
  if (workingState.challengeId === 'aiDoubleMove' && player === workingState.aiPlayer && !isBonusMove) {
    nextState.buffs = { ...nextState.buffs, doubleMoveRemaining: 1 };
  }
  // 챌린지 "삼중 공세": AI만 매 턴 3수씩 둬요 (보너스 2번 = 총 3수). 어느 수로도 승리 인정.
  if (workingState.challengeId === 'tripleAssault' && player === workingState.aiPlayer && !isBonusMove) {
    nextState.buffs = { ...nextState.buffs, doubleMoveRemaining: 2 };
  }
  // 챌린지 "AI의 반란": AI만 매 턴 4수씩 둬요 (보너스 3번 = 총 4수). 어느 수로도 승리 인정.
  if (workingState.challengeId === 'aiRebellion' && player === workingState.aiPlayer && !isBonusMove) {
    nextState.buffs = { ...nextState.buffs, doubleMoveRemaining: 3 };
  }
  const winBlockedByBonusMove = isBonusMove && workingState.challengeId !== 'aiDoubleMove' && workingState.challengeId !== 'tripleAssault' && workingState.challengeId !== 'aiRebellion';

  const won = !winBlockedByBonusMove && checkWin(nextBoard, x, y, placedColor, { winLength, sealedLines: workingState.sealedLines, markedStones: workingState.markedStones, excludeDiagonal, onlyDiagonal });

  // 챌린지 "이중 증명": 사람(나)이 5목을 완성해도, 서로 다른 위치에서 3번째로 완성한
  // 것이 아니면 승리 처리하지 않고 그 라인을 "낙인" 처리해서(재사용 방지) 계속 진행해요.
  if (won && workingState.challengeId === 'doubleProof' && placedColor === workingState.humanColor) {
    const line = findLineCells(nextBoard, x, y, placedColor, winLength, workingState.markedStones);
    const provenCount = (workingState.provenWinCount || 0) + 1;
    if (provenCount < 3) {
      const newMarked = { ...nextState.markedStones };
      if (line) for (const c of line) newMarked[key(c.x, c.y)] = true;
      nextState.markedStones = newMarked;
      nextState.provenWinCount = provenCount;
      const res = finishTurnAfterPlacement(nextState, player);
      res.message = `5목을 완성했지만 아직 부족해요! (${provenCount}/3) ${res.message}`;
      return res;
    }
    nextState.provenWinCount = provenCount;
  }

  // 챌린지 "거짓 승리": 사람(나)이 5목을 완성해도, 그 라인의 어느 칸이든 AI 돌과 8방향으로
  // 인접해 있으면 승리로 인정하지 않고 계속 진행해요.
  if (won && workingState.challengeId === 'falseVictory' && placedColor === workingState.humanColor) {
    const line = findLineCells(nextBoard, x, y, placedColor, winLength, workingState.markedStones);
    const opponent = otherPlayer(placedColor);
    const size = nextBoard.length;
    let touchesEnemy = false;
    if (line) {
      outerFalseVictory: for (const c of line) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = c.x + dx, ny = c.y + dy;
            if (nx >= 0 && nx < size && ny >= 0 && ny < size && nextBoard[ny][nx] === opponent) {
              touchesEnemy = true;
              break outerFalseVictory;
            }
          }
        }
      }
    }
    if (touchesEnemy) {
      const res = finishTurnAfterPlacement(nextState, player);
      res.message = `5목을 완성했지만 상대 돌과 인접해 있어서 무효예요! ${res.message}`;
      return res;
    }
  }

  // 챌린지 "승리 방지": 사람(나)이 5목을 완성하면 99% 확률로 무효 처리되고 그 즉시 내 돌이
  // 전부 사라져요. 1% 확률로만 진짜 승리로 인정돼요.
  if (won && workingState.challengeId === 'winDenied' && placedColor === workingState.humanColor && Math.random() >= 0.01) {
    const size = nextBoard.length;
    const shatteredBoard = nextBoard.map((row) => row.slice());
    for (let sy = 0; sy < size; sy++) {
      for (let sx = 0; sx < size; sx++) {
        if (shatteredBoard[sy][sx] === placedColor) shatteredBoard[sy][sx] = 0;
      }
    }
    const shatteredState = { ...nextState, board: shatteredBoard };
    const res = finishTurnAfterPlacement(shatteredState, player);
    res.message = `5목을 완성했지만 승리가 무효 처리되고 내 돌이 전부 사라졌어요! ${res.message}`;
    return res;
  }

  if (won) {
    // 룰렛 "역전 오목": 완성한 쪽이 오히려 패배해요.
    const winner = workingState.rouletteRule === 'reverseWin' ? otherPlayer(placedColor) : placedColor;
    const shieldHolder = otherPlayer(winner);
    if (nextState.winShield[shieldHolder]) {
      nextState.winShield = { ...nextState.winShield, [shieldHolder]: false };
      const res = finishTurnAfterPlacement(nextState, player);
      res.message = `${shieldHolder === BLACK ? '흑' : '백'}의 방어 카드가 승리를 무효화했어요! ${res.message}`;
      return res;
    }
    // 룰렛 "승리 무효 룰렛": 50% 확률로 승리가 무효 처리되고 대국이 계속돼요.
    if (workingState.rouletteRule === 'voidWinRoulette' && Math.random() < 0.5) {
      const res = finishTurnAfterPlacement(nextState, player);
      res.message = `오목을 완성했지만 룰렛 판정으로 무효 처리됐어요! ${res.message}`;
      return res;
    }
    nextState.phase = 'over';
    nextState.winner = winner;
    nextState.message = betrayed
      ? `배신으로 돌이 뒤바뀌면서 ${winner === BLACK ? '흑' : '백'} 승리!`
      : `${winner === BLACK ? '흑' : '백'} 승리!`;
    nextState = explodeBombs(nextState);
    return nextState;
  }

  if (isBoardFull(nextBoard)) {
    nextState.phase = 'over';
    nextState.winner = null;
    nextState.message = '무승부예요.';
    return nextState;
  }

  // 챌린지 "결정적 순간": 사람(나)이 4목을 만들면, 그 라인의 돌 중 무작위 하나가 파괴돼요.
  if (!won && workingState.challengeId === 'criticalMoment' && placedColor === workingState.humanColor) {
    const line = findLineCells(nextBoard, x, y, placedColor, 4, workingState.markedStones);
    if (line && line.length >= 4) {
      const target = line[Math.floor(Math.random() * line.length)];
      const destroyedBoard = nextBoard.map((row) => row.slice());
      destroyedBoard[target.y][target.x] = 0;
      nextState.board = destroyedBoard;
      nextState.stoneLossLog = [...nextState.stoneLossLog, { owner: placedColor, x: target.x, y: target.y, ply: nextState.ply }];
      nextState.message = '4목을 완성했지만, 그 라인의 돌 하나가 파괴됐어요!';
    }
  }

  // 챌린지 "삭제": 내(사람)가 돌을 놓을 때마다, 판 위의 내 기존 돌(이번에 놓은 것 제외)이
  // 각각 독립적으로 50% 확률로 파괴돼요.
  if (workingState.challengeId === 'erasure' && placedColor === workingState.humanColor) {
    const size = nextState.board.length;
    const erasedBoard = nextState.board.map((row) => row.slice());
    const erasedCells = [];
    for (let ey = 0; ey < size; ey++) {
      for (let ex = 0; ex < size; ex++) {
        if (ex === x && ey === y) continue;
        if (erasedBoard[ey][ex] === placedColor && Math.random() < 0.5) {
          erasedBoard[ey][ex] = 0;
          erasedCells.push({ x: ex, y: ey });
        }
      }
    }
    if (erasedCells.length > 0) {
      nextState.board = erasedBoard;
      nextState.stoneLossLog = [
        ...nextState.stoneLossLog,
        ...erasedCells.map((c) => ({ owner: placedColor, x: c.x, y: c.y, ply: nextState.ply })),
      ];
      nextState.message = `대가로 내 돌 ${erasedCells.length}개가 사라졌어요!`;
    }
  }

  if (winBlockedByBonusMove && checkWin(nextBoard, x, y, placedColor, { winLength, sealedLines: workingState.sealedLines, markedStones: workingState.markedStones, excludeDiagonal, onlyDiagonal })) {
    const res = finishTurnAfterPlacement(nextState, player);
    res.message = `연속 두기의 두 번째 수로는 승리할 수 없어요! ${res.message}`;
    return res;
  }

  return finishTurnAfterPlacement(nextState, player);
}

function removeFromHand(state, player, cardId) {
  let next = state;

  // 챌린지 "카드 감별 실패": 실제로는 손에 있던 원래 카드를 빼야 해요 (발동된 카드가 아니라).
  const actualCardId = next.misfireOriginalCard || cardId;
  if (next.misfireOriginalCard) {
    next = { ...next, misfireOriginalCard: null };
  }

  // 챌린지 "카드 한 방 승부": 내가 카드를 썼다는 걸 기록해요.
  if (next.challengeId === 'oneCardDuel' && player === next.humanColor) {
    next = { ...next, humanCardUsedCount: (next.humanCardUsedCount || 0) + 1 };
  }

  // 룰렛 "카드 강탈": 상대가 카드를 쓰면 나도 같은 카드를 하나 더 얻어요.
  if (next.rouletteRule === 'cardSteal') {
    const opponent = otherPlayer(player);
    next = {
      ...next,
      draft: { ...next.draft, hands: { ...next.draft.hands, [opponent]: [...next.draft.hands[opponent], cardId] } },
    };
  }

  // 룰렛 "강제 카드 턴": 이번 턴에 카드를 썼다고 기록해요.
  if (next.rouletteRule === 'forceCardTurn') {
    next = { ...next, cardUsedThisTurn: { ...next.cardUsedThisTurn, [player]: true } };
  }

  // 챌린지 "침묵의 규칙": 내가 카드를 쓰면 내 다음 턴이 자동으로 스킵돼요.
  if (next.challengeId === 'silentRule' && player === next.humanColor) {
    next = { ...next, skipNextTurn: { ...next.skipNextTurn, [player]: true } };
  }

  // 룰렛 "카드 소모 없음": 손에서 실제로 빼지 않아요.
  if (next.rouletteRule === 'noCardConsumption') {
    return next;
  }

  // 챌린지 "그림자 전쟁": AI는 카드를 써도 손에서 사라지지 않아요 (진짜 무제한).
  if (next.challengeId === 'shadowWar' && next.aiPlayer && player === next.aiPlayer) {
    return next;
  }

  const hand = next.draft.hands[player].filter((id, idx, arr) => {
    const firstIdx = arr.indexOf(actualCardId);
    return !(idx === firstIdx && id === actualCardId);
  });
  return { ...next, draft: { ...next.draft, hands: { ...next.draft.hands, [player]: hand } } };
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
    case 'lightning': {
      const [t] = targets;
      const defender = otherPlayer(player);
      const defense = tryDefend(next, board, player, t);
      if (defense) { next.message = defense.message; break; }
      const size = board.length;
      const candidates = [];
      for (let y = 0; y < size; y++) {
        if (board[y][t.x] === defender && !next.protectedStones[key(t.x, y)]) candidates.push({ x: t.x, y });
      }
      candidates.sort((a, b) => Math.abs(a.y - t.y) - Math.abs(b.y - t.y));
      const toRemove = candidates.slice(0, 3);
      toRemove.forEach((c) => {
        next.stoneLossLog = [...next.stoneLossLog, { owner: defender, x: c.x, y: c.y, ply: next.ply }];
        board[c.y][c.x] = 0;
        bumpDestroyCount(next, player, 1);
      });
      next.message = toRemove.length > 0 ? `낙뢰가 내리쳐서 상대 돌 ${toRemove.length}개가 사라졌어요!` : '그 세로줄엔 제거할 상대 돌이 없어요.';
      break;
    }
    case 'tsunami': {
      const [t] = targets;
      const defender = otherPlayer(player);
      const defense = tryDefend(next, board, player, t);
      if (defense) { next.message = defense.message; break; }
      const size = board.length;
      const candidates = [];
      for (let x = 0; x < size; x++) {
        if (board[t.y][x] === defender && !next.protectedStones[key(x, t.y)]) candidates.push({ x, y: t.y });
      }
      candidates.sort((a, b) => Math.abs(a.x - t.x) - Math.abs(b.x - t.x));
      const toRemove = candidates.slice(0, 3);
      toRemove.forEach((c) => {
        next.stoneLossLog = [...next.stoneLossLog, { owner: defender, x: c.x, y: c.y, ply: next.ply }];
        board[c.y][c.x] = 0;
        bumpDestroyCount(next, player, 1);
      });
      next.message = toRemove.length > 0 ? `해일이 휩쓸어서 상대 돌 ${toRemove.length}개가 사라졌어요!` : '그 가로줄엔 제거할 상대 돌이 없어요.';
      break;
    }
    case 'blackhole': {
      const [t] = targets;
      let removedMine = 0;
      let removedTheirs = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = t.x + dx, ny = t.y + dy;
          if (!inBounds(board, nx, ny)) continue;
          const owner = board[ny][nx];
          if (owner === 0) continue;
          if (next.protectedStones[key(nx, ny)]) continue;
          if (owner === BLACK || owner === WHITE) {
            next.stoneLossLog = [...next.stoneLossLog, { owner, x: nx, y: ny, ply: next.ply }];
            if (owner === player) removedMine++; else removedTheirs++;
          }
          board[ny][nx] = 0;
        }
      }
      if (removedTheirs > 0) bumpDestroyCount(next, player, removedTheirs);
      next.message = `블랙홀이 돌 ${removedMine + removedTheirs}개를 삼켰어요 (내 돌 ${removedMine}개, 상대 돌 ${removedTheirs}개). 감시자/수호천사/반사로는 막을 수 없어요.`;
      break;
    }
    case 'dice': {
      const [t] = targets;
      if (next.protectedStones[key(t.x, t.y)]) { next.message = '강화된 돌이라 파괴할 수 없어요.'; return next; }
      const defender = otherPlayer(player);
      const defense = tryDefend(next, board, player, t);
      if (defense) { next.message = defense.message; break; }
      const roll = 1 + Math.floor(Math.random() * 6);
      next.diceResult = roll;
      if (roll <= 2) {
        next.message = `주사위 눈 ${roll}... 아무 효과도 없었어요.`;
      } else if (roll <= 4) {
        next.stoneLossLog = [...next.stoneLossLog, { owner: defender, x: t.x, y: t.y, ply: next.ply }];
        board[t.y][t.x] = 0;
        bumpDestroyCount(next, player, 1);
        next.message = `주사위 눈 ${roll}! 소파괴로 상대 돌 1개를 제거했어요.`;
      } else {
        next.stoneLossLog = [...next.stoneLossLog, { owner: defender, x: t.x, y: t.y, ply: next.ply }];
        board[t.y][t.x] = 0;
        bumpDestroyCount(next, player, 1);
        let extra = 0;
        outerDice: for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = t.x + dx, ny = t.y + dy;
            if (!inBounds(board, nx, ny)) continue;
            if (board[ny][nx] !== defender) continue;
            if (next.protectedStones[key(nx, ny)]) continue;
            next.stoneLossLog = [...next.stoneLossLog, { owner: defender, x: nx, y: ny, ply: next.ply }];
            board[ny][nx] = 0;
            bumpDestroyCount(next, player, 1);
            extra++;
            if (extra >= 2) break outerDice;
          }
        }
        next.message = `주사위 눈 ${roll}! 대파괴로 상대 돌 ${1 + extra}개를 제거했어요.`;
      }
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
      const defender = otherPlayer(player);
      let attemptCount = 0;
      let successCount = 0;
      let destroyedCount = 0;
      let blockedByDefense = false;

      for (const t of targets) {
        if (next.protectedStones[key(t.x, t.y)]) continue; // 강화된 돌은 애초에 던질 수 없어요
        attemptCount++;
        const success = Math.random() < 0.5;
        bumpProbTally(next, player, success);
        if (!success) continue;
        successCount++;
        const defense = tryDefend(next, board, player, t);
        if (defense) {
          blockedByDefense = true;
        } else {
          next.stoneLossLog = [...next.stoneLossLog, { owner: defender, x: t.x, y: t.y, ply: next.ply }];
          board[t.y][t.x] = 0;
          bumpDestroyCount(next, player, 1);
          destroyedCount++;
        }
      }

      next.coinFlipResult = successCount > 0 ? 'success' : 'fail';

      if (attemptCount === 0) {
        next.message = '고른 돌이 전부 강화된 돌이라 동전을 던질 수 없었어요.';
      } else if (successCount === 0) {
        next.message = attemptCount === 2 ? '동전 던지기 2번 다 실패... 아무 돌도 파괴하지 못했어요.' : '동전 던지기 실패... 아무 일도 일어나지 않았어요.';
      } else if (destroyedCount === 0) {
        next.message = `동전 던지기 ${successCount}번 성공! 하지만 방어 효과로 무효화됐어요.`;
      } else if (successCount === 1) {
        next.message = '동전 던지기 1번 성공! 상대 돌 1개가 파괴됐어요.';
      } else {
        next.message = '동전 던지기 2번 다 성공! 상대 돌 2개가 파괴됐어요.';
      }
      if (blockedByDefense && destroyedCount > 0) {
        next.message += ' (일부는 방어로 막혔어요.)';
      }
      break;
    }
    case 'destroy': {
      const [t] = targets;
      if (next.protectedStones[key(t.x, t.y)]) { next.message = '강화된 돌이라 파괴할 수 없어요.'; return next; }
      const defender = otherPlayer(player);
      const defense = tryDefend(next, board, player, t);
      if (defense) { next.message = defense.message; break; }
      next.stoneLossLog = [...next.stoneLossLog, { owner: defender, x: t.x, y: t.y, ply: next.ply }];
      board[t.y][t.x] = 0;
      bumpDestroyCount(next, player, 1);
      break;
    }
    case 'destroyChain': {
      const [t] = targets;
      if (next.protectedStones[key(t.x, t.y)]) { next.message = '강화된 돌이라 파괴할 수 없어요.'; return next; }
      const defender = otherPlayer(player);
      const defense = tryDefend(next, board, player, t);
      if (defense) { next.message = `${defense.message} (연쇄 파괴 무효화됨)`; break; }
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
      const defense = tryDefend(next, board, player, t);
      if (defense) { next.message = defense.message; break; }
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

  // 룰렛 "파괴전 승리"가 방금 발동해서 게임이 끝났으면, 아래의 턴 진행 로직으로
  // 넘어가지 않고 여기서 바로 반환해요 (안 그러면 advanceTurn이 승리 메시지를 덮어써요).
  if (next.phase === 'over') return next;

  // 챌린지 "하나의 생명": 내(사람) 돌이 이번 카드로 하나라도 파괴/변환당했으면 그 즉시 패배해요.
  if (next.challengeId === 'oneLife' && next.humanColor && next.stoneLossLog.length > state.stoneLossLog.length) {
    const newLosses = next.stoneLossLog.slice(state.stoneLossLog.length);
    if (newLosses.some((l) => l.owner === next.humanColor)) {
      next.phase = 'over';
      next.winner = otherPlayer(next.humanColor);
      next.message = '내 돌이 파괴/변환당했어요... "하나의 생명" 챌린지는 그 즉시 패배예요.';
      return next;
    }
  }

  // 챌린지 "유리 심장": 판 위의 어떤 돌이든(내 것이든 상대 것이든) 하나라도 파괴/변환당하면
  // 내(사람) 돌 전부가 즉시 사라져요.
  if (next.challengeId === 'glassHeart' && next.humanColor && next.stoneLossLog.length > state.stoneLossLog.length) {
    const size = next.board.length;
    const shatteredBoard = next.board.map((row) => row.slice());
    let shattered = 0;
    for (let sy = 0; sy < size; sy++) {
      for (let sx = 0; sx < size; sx++) {
        if (shatteredBoard[sy][sx] === next.humanColor) { shatteredBoard[sy][sx] = 0; shattered++; }
      }
    }
    if (shattered > 0) {
      next.board = shatteredBoard;
      next.message = `유리 심장이 깨졌어요! 내 돌 ${shattered}개가 전부 사라졌어요.`;
    }
  }

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
    // 챌린지 "이중 증명": 사람(나)이 5목을 완성해도, 3번째로 완성한 게 아니면 승리 처리
    // 안 하고 그 라인을 낙인 처리해서(재사용 방지) 계속 진행해요.
    if (winner && next.challengeId === 'doubleProof' && winner === next.humanColor) {
      const line = findLineCells(board, t.x, t.y, winner, 5, next.markedStones);
      const provenCount = (next.provenWinCount || 0) + 1;
      if (provenCount < 3) {
        const newMarked = { ...next.markedStones };
        if (line) for (const c of line) newMarked[key(c.x, c.y)] = true;
        next.markedStones = newMarked;
        next.provenWinCount = provenCount;
        if (isBoardFull(board)) {
          next.phase = 'over';
          next.winner = null;
          next.message = '무승부예요.';
          return next;
        }
        const res = finishTurnAfterPlacement(next, player);
        res.message = `5목을 완성했지만 아직 부족해요! (${provenCount}/3) ${res.message}`;
        return res;
      }
      next.provenWinCount = provenCount;
    }
    // 챌린지 "거짓 승리": 사람(나)이 완성한 라인의 어느 칸이든 AI 돌과 8방향으로 인접해
    // 있으면 승리로 인정하지 않아요.
    if (winner && next.challengeId === 'falseVictory' && winner === next.humanColor) {
      const line = findLineCells(board, t.x, t.y, winner, 5, next.markedStones);
      const opponent = otherPlayer(winner);
      const size = board.length;
      let touchesEnemy = false;
      if (line) {
        outerWildcardFalseVictory: for (const c of line) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = c.x + dx, ny = c.y + dy;
              if (nx >= 0 && nx < size && ny >= 0 && ny < size && board[ny][nx] === opponent) {
                touchesEnemy = true;
                break outerWildcardFalseVictory;
              }
            }
          }
        }
      }
      if (touchesEnemy) {
        const res = finishTurnAfterPlacement(next, player);
        res.message = `5목을 완성했지만 상대 돌과 인접해 있어서 무효예요! ${res.message}`;
        return res;
      }
    }
    // 챌린지 "승리 방지": 사람(나)이 완성하면 99% 확률로 무효 처리되고 내 돌이 전부 사라져요.
    if (winner && next.challengeId === 'winDenied' && winner === next.humanColor && Math.random() >= 0.01) {
      const size = board.length;
      const shatteredBoard = board.map((row) => row.slice());
      for (let sy = 0; sy < size; sy++) {
        for (let sx = 0; sx < size; sx++) {
          if (shatteredBoard[sy][sx] === winner) shatteredBoard[sy][sx] = 0;
        }
      }
      const shatteredState = { ...next, board: shatteredBoard };
      const res = finishTurnAfterPlacement(shatteredState, player);
      res.message = `5목을 완성했지만 승리가 무효 처리되고 내 돌이 전부 사라졌어요! ${res.message}`;
      return res;
    }
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
        const pool = poolForPlayerFiltered(player, next);
        const pickedCards = [];
        let hand = next.draft.hands[player];
        for (let i = 0; i < 2; i++) {
          const randomId = pool[Math.floor(Math.random() * pool.length)];
          hand = [...hand, randomId];
          const picked = CARDS.find((c) => c.id === randomId);
          pickedCards.push(picked ? picked.name : randomId);
        }
        next.draft = {
          ...next.draft,
          hands: { ...next.draft.hands, [player]: hand },
        };
        next.message = `돌 개수가 더 적어서 '${pickedCards[0]}', '${pickedCards[1]}' 카드를 얻었어요!`;
      } else {
        next.message = '돌 개수가 상대보다 적지 않아서 효과가 발동하지 않았어요.';
      }
      break;
    }
    case 'reroll': {
      const count = next.draft.hands[player].length;
      const pool = poolForPlayerFiltered(player, next).filter((id) => id !== 'reroll');
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
      const allIds = poolForPlayerFiltered(player, next);
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
    case 'guardian': {
      next.guardianActive = { ...next.guardianActive, [player]: true };
      next.message = '수호천사를 발동했어요. 다음 파괴 위기를 자동으로 무효화해줘요.';
      break;
    }
    case 'reflect': {
      next.reflectActive = { ...next.reflectActive, [player]: true };
      next.message = '반사를 발동했어요. 다음에 나를 노리는 파괴 효과를 상대에게 그대로 되돌려줘요.';
      break;
    }
    case 'erosion': {
      const opponent = otherPlayer(player);
      const defense = tryDefend(next, board, player, null);
      if (defense) { next.message = defense.message; break; }
      const placements = next.moveLog.filter((m) => m.type === 'place' && m.player === opponent);
      let target = null;
      for (const m of placements) {
        if (board[m.y][m.x] === opponent && !next.protectedStones[key(m.x, m.y)]) { target = m; break; }
      }
      if (target) {
        next.stoneLossLog = [...next.stoneLossLog, { owner: opponent, x: target.x, y: target.y, ply: next.ply }];
        board[target.y][target.x] = 0;
        bumpDestroyCount(next, player, 1);
        next.message = '상대의 가장 오래된 돌을 침식시켰어요.';
      } else {
        next.message = '침식시킬 수 있는 상대 돌이 없어요.';
      }
      break;
    }
    case 'resurrection': {
      const success = Math.random() < 0.3;
      next.resurrectionResult = success ? 'success' : 'fail';
      bumpProbTally(next, player, success);
      if (success) {
        const mine = next.stoneLossLog.filter((e) => e.owner === player && board[e.y][e.x] === 0);
        mine.forEach((e) => { board[e.y][e.x] = player; });
        next.stoneLossLog = next.stoneLossLog.filter((e) => !mine.includes(e));
        next.message = mine.length > 0 ? `재림 성공! 잃어버린 돌 ${mine.length}개를 전부 되돌렸어요!` : '재림은 성공했지만 되돌릴 돌이 없었어요.';
      } else {
        next.message = '재림 실패... (30% 확률) 카드는 소모됐어요.';
      }
      break;
    }
    case 'lottery': {
      const success = Math.random() < 0.4;
      next.lotteryResult = success ? 'success' : 'fail';
      bumpProbTally(next, player, success);
      if (success) {
        const pool = poolForPlayerFiltered(player, next);
        const picks = [pool[Math.floor(Math.random() * pool.length)], pool[Math.floor(Math.random() * pool.length)]];
        next.draft = { ...next.draft, hands: { ...next.draft.hands, [player]: [...next.draft.hands[player], ...picks] } };
        next.message = '복권 당첨! 무작위 카드 2장을 얻었어요!';
      } else {
        next.message = '복권 낙첨... (40% 확률) 카드는 소모됐어요.';
      }
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

  // 챌린지 "하나의 생명": 내(사람) 돌이 이번 카드로 하나라도 파괴/변환당했으면 그 즉시 패배해요.
  if (next.challengeId === 'oneLife' && next.humanColor && next.stoneLossLog.length > state.stoneLossLog.length) {
    const newLosses = next.stoneLossLog.slice(state.stoneLossLog.length);
    if (newLosses.some((l) => l.owner === next.humanColor)) {
      next.phase = 'over';
      next.winner = otherPlayer(next.humanColor);
      next.message = '내 돌이 파괴/변환당했어요... "하나의 생명" 챌린지는 그 즉시 패배예요.';
      return next;
    }
  }

  // 챌린지 "유리 심장": 판 위의 어떤 돌이든(내 것이든 상대 것이든) 하나라도 파괴/변환당하면
  // 내(사람) 돌 전부가 즉시 사라져요.
  if (next.challengeId === 'glassHeart' && next.humanColor && next.stoneLossLog.length > state.stoneLossLog.length) {
    const size = next.board.length;
    const shatteredBoard = next.board.map((row) => row.slice());
    let shattered = 0;
    for (let sy = 0; sy < size; sy++) {
      for (let sx = 0; sx < size; sx++) {
        if (shatteredBoard[sy][sx] === next.humanColor) { shatteredBoard[sy][sx] = 0; shattered++; }
      }
    }
    if (shattered > 0) {
      next.board = shatteredBoard;
      next.message = `유리 심장이 깨졌어요! 내 돌 ${shattered}개가 전부 사라졌어요.`;
    }
  }

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
  coinFlip: ['enemyStone', 'enemyStone'],
  lightning: ['emptyOrAnyCell'],
  tsunami: ['emptyOrAnyCell'],
  blackhole: ['emptyOrAnyCell'],
  dice: ['enemyStone'],
};

// 카드 감별 실패 챌린지용: 같은 "상호작용 형태"(대상 필요 없음/버프/특정 대상 시퀀스)의
// 카드끼리만 서로 대체돼야 대상 선택 흐름이 깨지지 않아요.
function cardShapeKey(cardId) {
  if (PLACEMENT_BUFF.has(cardId)) return 'buff';
  if (STANDALONE.has(cardId) && !TARGET_STEPS[cardId]) return 'standalone';
  const steps = TARGET_STEPS[cardId];
  return steps ? steps.join(',') : 'unknown';
}

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
      const { difficulty, timeLimitSec, cardsPerPlayer, challengeId, rouletteMode } = action;
      const fresh = createInitialState();
      // '흑백 역전' 챌린지는 색 선택과 무관하게 항상 내가 백이 돼요 (AI가 흑).
      const aiPlayer = challengeId === 'colorReverse' ? BLACK : action.aiPlayer;
      const humanColor = aiPlayer ? otherPlayer(aiPlayer) : null;

      const challengeCardBan = {};
      let ruleFlags = { ...fresh.ruleFlags };
      let winLengthOverride = { ...fresh.winLengthOverride };
      let blockedCells = { ...fresh.blockedCells };

      if (challengeId === 'fourVsFive' && aiPlayer) {
        winLengthOverride = { ...winLengthOverride, [aiPlayer]: 4 };
      }
      if (challengeId === 'sixInRow' && humanColor) {
        winLengthOverride = { ...winLengthOverride, [humanColor]: 6 };
        // 흑이 6목을 만들어야 하는데 렌주 금수(장목/육목)가 그대로면 정작 6목을
        // 완성하는 수 자체가 금수로 막혀서 승리가 불가능해지므로 이 챌린지에서는 해제해요.
        ruleFlags = { ...ruleFlags, allowOverline: true };
      }
      if (challengeId === 'noDiagonal' && humanColor) {
        ruleFlags = { ...ruleFlags, noDiagonalFor: humanColor };
      }
      if (challengeId === 'noDestroy') {
        for (const id of DESTROY_CARD_IDS) challengeCardBan[id] = true;
      }
      if (challengeId === 'noDefense') {
        for (const id of DEFENSE_CARD_IDS) challengeCardBan[id] = true;
      }
      if (challengeId === 'narrowVision') {
        const size = fresh.board.length;
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            if (x < 3 || x >= size - 3 || y < 3 || y >= size - 3) blockedCells[key(x, y)] = Infinity;
          }
        }
      }
      if (challengeId === 'doubleForbidden') {
        const size = fresh.board.length;
        let placed = 0;
        let guard = 0;
        while (placed < 10 && guard < 500) {
          guard++;
          const rx = Math.floor(Math.random() * size);
          const ry = Math.floor(Math.random() * size);
          const k = key(rx, ry);
          if (!blockedCells[k]) { blockedCells[k] = Infinity; placed++; }
        }
      }
      if (challengeId === 'gambler') {
        for (const c of CARDS) {
          if (!PROB_CARD_IDS.has(c.id)) challengeCardBan[c.id] = true;
        }
      }
      // 챌린지 세트 5(10목의 저주, 이중 증명 등)는 승리 조건 자체를 다루는 챌린지들이라,
      // 승리 조건을 바꿔버리는 카드들(사목 승리/기적/단축 승리/연장 승리)과 충돌해요.
      // 그래서 세트 5의 모든 챌린지에서 이 4개 카드는 아예 못 뽑게 막아요.
      if (CHALLENGES_5.some((c) => c.id === challengeId)) {
        challengeCardBan.fourToWin = true;
        challengeCardBan.miracle = true;
        challengeCardBan.shortWin = true;
        challengeCardBan.longWin = true;
      }
      if (challengeId === 'narrowVision5') {
        const size = fresh.board.length;
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            if (x < 5 || x >= size - 5 || y < 5 || y >= size - 5) blockedCells[key(x, y)] = Infinity;
          }
        }
      }
      if (challengeId === 'quadForbidden') {
        const size = fresh.board.length;
        let placed = 0;
        let guard = 0;
        while (placed < 20 && guard < 800) {
          guard++;
          const rx = Math.floor(Math.random() * size);
          const ry = Math.floor(Math.random() * size);
          const k = key(rx, ry);
          if (!blockedCells[k]) { blockedCells[k] = Infinity; placed++; }
        }
      }
      if (challengeId === 'colorReverse') {
        // 렌주 금수가 흑이 아니라 백(=나)에게 적용돼요.
        ruleFlags = { ...ruleFlags, forbiddenColor: WHITE };
      }
      if (challengeId === 'sevenInRow' && humanColor) {
        winLengthOverride = { ...winLengthOverride, [humanColor]: 7 };
        // 7목을 완성하는 수 자체가 장목 금수로 막히지 않도록 해제해요 (6목 챌린지와 같은 이유).
        ruleFlags = { ...ruleFlags, allowOverline: true };
      }
      if (challengeId === 'diagonalHell' && humanColor) {
        // 대각선 승리 불가 + 6목이어야 승리 (6목 완성 수 자체가 장목 금수로 막히지 않게 해제).
        ruleFlags = { ...ruleFlags, noDiagonalFor: humanColor, allowOverline: true };
        winLengthOverride = { ...winLengthOverride, [humanColor]: 6 };
      }
      if (challengeId === 'curseOfTen' && humanColor) {
        // 10목이어야 승리 (장목 금수 해제).
        ruleFlags = { ...ruleFlags, allowOverline: true };
        winLengthOverride = { ...winLengthOverride, [humanColor]: 10 };
      }
      if (challengeId === 'boardIsEnemy') {
        const size = fresh.board.length;
        let placed = 0;
        let guard = 0;
        while (placed < 25 && guard < 800) {
          guard++;
          const rx = Math.floor(Math.random() * size);
          const ry = Math.floor(Math.random() * size);
          const k = key(rx, ry);
          if (!blockedCells[k]) { blockedCells[k] = Infinity; placed++; }
        }
      }

      // 챌린지 "흩어진 시야": 항상 안 보이는 무작위 15칸을 미리 뽑아둬요 (누구 돌인지 무관).
      let scatteredFogCells = {};
      if (challengeId === 'scatteredVision') {
        const size = fresh.board.length;
        let placed = 0;
        let guard = 0;
        while (placed < 15 && guard < 500) {
          guard++;
          const rx = Math.floor(Math.random() * size);
          const ry = Math.floor(Math.random() * size);
          const k = key(rx, ry);
          if (!scatteredFogCells[k]) { scatteredFogCells[k] = true; placed++; }
        }
      }

      // 룰렛 모드: 챌린지와는 함께 쓰지 않고, 켜져 있으면 이번 판에 적용할 특수 규칙을 하나 뽑아요.
      // 개발자 계정 전용: 특정 규칙으로 결과를 고정할 수 있어요 (없거나 잘못된 id면 무작위).
      const rouletteRule = (rouletteMode && !challengeId)
        ? (getRouletteRuleById(action.forcedRouletteRule) ? action.forcedRouletteRule : pickRandomRouletteRule())
        : null;

      const base = {
        ...fresh,
        aiPlayer: aiPlayer || null,
        // '10연승' 챌린지는 반드시 최고 난이도(불가능) AI와 대결해요.
        aiDifficulty: challengeId === 'tenWinStreak' ? 'impossible' : (difficulty || 'normal'),
        // '속전속결' 챌린지는 15초, '얼어붙은 시간'은 1초, '찰나'는 0.5초, '10연승'은
        // 10초로 무조건 고정돼요.
        timeLimitSec: challengeId === 'speedRun' ? 15
          : challengeId === 'frozenTime' ? 1
          : challengeId === 'instant' ? 0.5
          : challengeId === 'tenWinStreak' ? 10
          : (timeLimitSec || 0),
        humanColor,
        challengeId: challengeId || null,
        challengeCardBan,
        ruleFlags,
        winLengthOverride,
        blockedCells,
        rouletteRule,
        scatteredFogCells,
        board: challengeId === 'smallBoard' ? createEmptyBoard(11)
          : challengeId === 'wideHell' ? createEmptyBoard(19)
          : challengeId === 'unlimitedExpansion' ? createEmptyBoard(21)
          : fresh.board,
      };

      // 챌린지 "첫 수 양보": AI가 먼저 3수를 두고 시작해요. 서로 위협 라인이 안 되도록
      // 멀찍이 떨어뜨려서 3곳에 둬요.
      if (challengeId === 'firstMoveConcession' && aiPlayer && humanColor) {
        const size = base.board.length;
        const mid = Math.floor(size / 2);
        const spots = [
          { x: mid, y: mid },
          { x: Math.min(size - 1, mid + 3), y: Math.max(0, mid - 3) },
          { x: Math.max(0, mid - 3), y: Math.min(size - 1, mid + 3) },
        ];
        const concessionBoard = base.board.map((row) => row.slice());
        for (const s of spots) concessionBoard[s.y][s.x] = aiPlayer;
        base.board = concessionBoard;
        base.ply = 3;
        base.turn = humanColor;
      }

      // 챌린지 "완전 무작위": 사람이 흑(선공)이면 첫 턴부터도 3칸이 미리 있어야 해요.
      if (challengeId === 'randomThreeCells' && humanColor === BLACK) {
        base.allowedCells = pickRandomEmptyCells(base, 5);
      }

      // 무카드/손 없이 두기 챌린지는 드래프트 자체를 건너뛰고 바로 대국을 시작해요.
      if (challengeId === 'noCards' || challengeId === 'handlessPlay') {
        return {
          ...base,
          phase: 'play',
          turn: BLACK,
          message: challengeId === 'handlessPlay'
            ? '손 없이 두기! 나도 AI도 카드 없이 순수 실력으로 승부해요.'
            : '무카드 챌린지! 카드 없이 순수 실력으로 승부해요.',
          draft: { pool: [], hands: { [BLACK]: [], [WHITE]: [] }, order: [], currentIndex: 0, options: [] },
        };
      }

      // '불가능' 챌린지: 나는 카드를 한 장도 못 받고, AI는 카드 30장을 갖고 시작해요.
      if (challengeId === 'impossibleHandicap' && aiPlayer) {
        const aiPool = poolForPlayer(aiPlayer);
        const aiHand = Array.from({ length: 30 }, () => aiPool[Math.floor(Math.random() * aiPool.length)]);
        return {
          ...base,
          phase: 'play',
          turn: BLACK,
          message: '불가능 챌린지! 나는 카드 없이, AI는 카드 30장으로 시작해요.',
          draft: {
            pool: [],
            hands: { [BLACK]: [], [WHITE]: [], [aiPlayer]: aiHand },
            order: [],
            currentIndex: 0,
            options: [],
          },
        };
      }

      // 챌린지 "그림자 전쟁": 나는 카드를 아예 못 쓰고, AI는 모든 카드를 다 가진 채로
      // 시작해요 (카드를 써도 손에서 안 사라져서 사실상 무제한이에요).
      if (challengeId === 'shadowWar' && aiPlayer) {
        const aiHand = poolForPlayerFiltered(aiPlayer, base);
        return {
          ...base,
          phase: 'play',
          turn: BLACK,
          message: '그림자 전쟁! 나는 카드를 쓸 수 없고, AI는 모든 카드를 다 가지고 있어요.',
          draft: {
            pool: [],
            hands: { [BLACK]: [], [WHITE]: [], [aiPlayer]: aiHand },
            order: [],
            currentIndex: 0,
            options: [],
          },
        };
      }

      // 룰렛 "매턴 카드 자동 지급"도 드래프트를 건너뛰고, 대신 매 턴마다 카드를 자동으로 받아요.
      // (선공인 흑도 형평성 있게 첫 턴에 카드 1장을 미리 받아요 - 안 그러면 advanceTurn을
      // 한 번도 안 거치는 첫 턴만 카드 없이 시작해서 백보다 불리해요.)
      if (rouletteRule === 'autoCardPerTurn') {
        const firstPool = draftPoolForRoulette(poolForPlayer(BLACK), base);
        const firstCard = firstPool.length > 0 ? firstPool[Math.floor(Math.random() * firstPool.length)] : null;
        return {
          ...base,
          phase: 'roulette',
          pendingPhase: 'play',
          turn: BLACK,
          message: '룰렛으로 특수 규칙이 정해졌어요!',
          draft: {
            pool: [],
            hands: { [BLACK]: firstCard ? [firstCard] : [], [WHITE]: [] },
            order: [],
            currentIndex: 0,
            options: [],
          },
        };
      }

      const order = buildDraftOrder(cardsPerPlayer);
      const draftPool = draftPoolForRoulette(draftPoolForChallenge(poolForPlayer(order[0]), order[0], base), base);
      const draft = {
        pool: draftPool,
        hands: { [BLACK]: [], [WHITE]: [] },
        order,
        currentIndex: 0,
        options: drawRandomCards(draftPool, 3),
      };

      if (rouletteRule) {
        return {
          ...base,
          phase: 'roulette',
          pendingPhase: 'draft',
          message: '룰렛으로 특수 규칙이 정해졌어요!',
          draft,
        };
      }

      return {
        ...base,
        phase: 'draft',
        message: '카드를 뽑는 중이에요.',
        draft,
      };
    }

    case 'ROULETTE_CONTINUE': {
      if (state.phase !== 'roulette') return state;
      return {
        ...state,
        phase: state.pendingPhase || 'draft',
        pendingPhase: null,
      };
    }

    case 'REQUEST_REMATCH': {
      if (state.phase !== 'over') return state;
      const voter = action.player;
      if (!voter) return state;
      const votes = { ...state.rematchVotes, [voter]: true };

      if (votes[BLACK] && votes[WHITE]) {
        const cardsPerPlayer = state.draft.order.length / 2;
        const fresh = createInitialState();
        // 5단 계단 챌린지는 재대국해도 같은 난이도를 반복하면 안 되고, 이겼으면 다음 단계로,
        // 졌거나 비겼으면 1단계로 되돌아가야 해요. (안 그러면 5단계를 다 이겨도 매번 처음
        // 난이도만 재대국으로 반복하게 되어 최종 클리어 판정이 절대 안 나는 버그가 생겨요.)
        let nextAiDifficulty = state.aiDifficulty;
        if (state.challengeId === 'ladder') {
          const won = state.winner != null && state.winner === state.humanColor;
          const curIndex = Math.max(0, LADDER_LEVELS.indexOf(state.aiDifficulty));
          if (won) {
            nextAiDifficulty = curIndex >= LADDER_LEVELS.length - 1
              ? LADDER_LEVELS[0]
              : LADDER_LEVELS[curIndex + 1];
          } else {
            nextAiDifficulty = LADDER_LEVELS[0];
          }
        }
        // 룰렛 모드로 진행한 판이었다면, 재대국에서도 새로 규칙을 하나 뽑아요.
        const wasRoulette = !!state.rouletteRule;
        const rouletteRule = wasRoulette ? pickRandomRouletteRule() : null;

        const base = {
          ...fresh,
          aiPlayer: state.aiPlayer,
          aiDifficulty: nextAiDifficulty,
          timeLimitSec: state.timeLimitSec,
          humanColor: state.humanColor,
          challengeId: state.challengeId,
          challengeCardBan: state.challengeCardBan || {},
          rouletteRule,
          ruleFlags: {
            ...fresh.ruleFlags,
            noDiagonalFor: state.ruleFlags?.noDiagonalFor || null,
            // 6목/7목 챌린지는 재대국해도 계속 이 챌린지이므로 장목 금수 해제를 유지해요.
            allowOverline: (state.challengeId === 'sixInRow' || state.challengeId === 'sevenInRow' || state.challengeId === 'diagonalHell' || state.challengeId === 'curseOfTen') ? true : fresh.ruleFlags.allowOverline,
            forbiddenColor: state.challengeId === 'colorReverse' ? WHITE : undefined,
          },
          // '단축 승리'/'연장 승리' 카드 효과는 "이번 판 끝까지"만 적용되는 일회성 효과라
          // 재대국하면 초기화돼야 해요. 챌린지(6목/7목/4목 승리) 자체의 규칙만 재대국에도 이어져요.
          winLengthOverride: ['sixInRow', 'sevenInRow', 'fourVsFive', 'diagonalHell', 'curseOfTen'].includes(state.challengeId)
            ? { ...state.winLengthOverride }
            : fresh.winLengthOverride,
          blockedCells: ['narrowVision', 'narrowVision5', 'doubleForbidden', 'quadForbidden', 'boardIsEnemy'].includes(state.challengeId)
            ? { ...state.blockedCells }
            : fresh.blockedCells,
          board: state.challengeId === 'smallBoard' ? createEmptyBoard(11)
            : state.challengeId === 'wideHell' ? createEmptyBoard(19)
            : state.challengeId === 'unlimitedExpansion' ? createEmptyBoard(21)
            : fresh.board,
        };

        // 챌린지 "흩어진 시야": 재대국이어도 안 보이는 칸을 새로 뽑아요.
        if (state.challengeId === 'scatteredVision') {
          const size = base.board.length;
          const cells = {};
          let placed = 0;
          let guard = 0;
          while (placed < 15 && guard < 500) {
            guard++;
            const rx = Math.floor(Math.random() * size);
            const ry = Math.floor(Math.random() * size);
            const k = key(rx, ry);
            if (!cells[k]) { cells[k] = true; placed++; }
          }
          base.scatteredFogCells = cells;
        }

        // 챌린지 "첫 수 양보": 재대국해도 AI가 먼저 3수를 두고 시작해요.
        if (state.challengeId === 'firstMoveConcession' && state.aiPlayer && state.humanColor) {
          const size = base.board.length;
          const mid = Math.floor(size / 2);
          const spots = [
            { x: mid, y: mid },
            { x: Math.min(size - 1, mid + 3), y: Math.max(0, mid - 3) },
            { x: Math.max(0, mid - 3), y: Math.min(size - 1, mid + 3) },
          ];
          const concessionBoard = base.board.map((row) => row.slice());
          for (const s of spots) concessionBoard[s.y][s.x] = state.aiPlayer;
          base.board = concessionBoard;
          base.ply = 3;
          base.turn = state.humanColor;
        }

        // 챌린지 "완전 무작위": 재대국에서도 사람이 흑이면 첫 턴부터 3칸이 필요해요.
        if (state.challengeId === 'randomThreeCells' && state.humanColor === BLACK) {
          base.allowedCells = pickRandomEmptyCells(base, 5);
        }

        if (state.challengeId === 'noCards' || state.challengeId === 'handlessPlay') {
          return {
            ...base,
            phase: 'play',
            turn: base.turn || BLACK,
            message: state.challengeId === 'handlessPlay'
              ? '손 없이 두기! 나도 AI도 카드 없이 순수 실력으로 승부해요.'
              : '무카드 챌린지! 카드 없이 순수 실력으로 승부해요.',
            draft: { pool: [], hands: { [BLACK]: [], [WHITE]: [] }, order: [], currentIndex: 0, options: [] },
          };
        }

        if (state.challengeId === 'impossibleHandicap' && state.aiPlayer) {
          const aiPool = poolForPlayer(state.aiPlayer);
          const aiHand = Array.from({ length: 30 }, () => aiPool[Math.floor(Math.random() * aiPool.length)]);
          return {
            ...base,
            phase: 'play',
            turn: BLACK,
            message: '불가능 챌린지! 나는 카드 없이, AI는 카드 30장으로 시작해요.',
            draft: {
              pool: [],
              hands: { [BLACK]: [], [WHITE]: [], [state.aiPlayer]: aiHand },
              order: [],
              currentIndex: 0,
              options: [],
            },
          };
        }

        if (state.challengeId === 'shadowWar' && state.aiPlayer) {
          const aiHand = poolForPlayerFiltered(state.aiPlayer, base);
          return {
            ...base,
            phase: 'play',
            turn: BLACK,
            message: '그림자 전쟁! 나는 카드를 쓸 수 없고, AI는 모든 카드를 다 가지고 있어요.',
            draft: {
              pool: [],
              hands: { [BLACK]: [], [WHITE]: [], [state.aiPlayer]: aiHand },
              order: [],
              currentIndex: 0,
              options: [],
            },
          };
        }

        if (rouletteRule === 'autoCardPerTurn') {
          const firstPool = draftPoolForRoulette(poolForPlayer(BLACK), base);
          const firstCard = firstPool.length > 0 ? firstPool[Math.floor(Math.random() * firstPool.length)] : null;
          return {
            ...base,
            phase: 'roulette',
            pendingPhase: 'play',
            turn: BLACK,
            message: '룰렛으로 특수 규칙이 정해졌어요!',
            draft: {
              pool: [],
              hands: { [BLACK]: firstCard ? [firstCard] : [], [WHITE]: [] },
              order: [],
              currentIndex: 0,
              options: [],
            },
          };
        }

        const order = buildDraftOrder(cardsPerPlayer);
        const draftPool = draftPoolForRoulette(draftPoolForChallenge(poolForPlayer(order[0]), order[0], base), base);
        const draft = {
          pool: draftPool,
          hands: { [BLACK]: [], [WHITE]: [] },
          order,
          currentIndex: 0,
          options: drawRandomCards(draftPool, 3),
        };

        if (rouletteRule) {
          return {
            ...base,
            phase: 'roulette',
            pendingPhase: 'draft',
            message: '룰렛으로 특수 규칙이 정해졌어요!',
            draft,
          };
        }

        return {
          ...base,
          phase: 'draft',
          message: '카드를 뽑는 중이에요.',
          draft,
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
          message: `${state.turn === BLACK ? '흑' : '백'} 차례예요.`,
          draft: { ...state.draft, hands, currentIndex, options: [], lastPick },
        });
      }

      const nextDrafter = state.draft.order[currentIndex];
      const nextPool = draftPoolForRoulette(draftPoolForChallenge(poolForPlayer(nextDrafter), nextDrafter, state), state);
      return {
        ...state,
        draft: { ...state.draft, hands, currentIndex, options: drawRandomCards(nextPool, 3), lastPick },
      };
    }

    case 'ACTIVATE_CARD': {
      let { cardId } = action;
      if (state.phase !== 'play') return state;
      const player = state.turn;

      if (state.silencedTurns[player] > 0) {
        return { ...state, message: '침묵 상태라 카드를 사용할 수 없어요.' };
      }

      // 챌린지 "카드 한 방 승부": 나는 이번 판에 카드를 딱 1번만 쓸 수 있어요.
      if (state.challengeId === 'oneCardDuel' && player === state.humanColor && (state.humanCardUsedCount || 0) >= 1) {
        return { ...state, message: '이번 판엔 카드를 이미 다 썼어요 (딱 1번만 가능해요).' };
      }

      // 챌린지 "침묵의 시작": 처음 10수 동안 나는 카드를 쓸 수 없어요.
      if (state.challengeId === 'silentStartPlayer' && player === state.humanColor && state.ply < 10) {
        return { ...state, message: `아직 침묵 중이에요 (${10 - state.ply}수 후 카드를 쓸 수 있어요).` };
      }

      // 챌린지 "그림자 전쟁": 나는 카드를 아예 쓸 수 없어요.
      if (state.challengeId === 'shadowWar' && player === state.humanColor) {
        return { ...state, message: '이 챌린지에서는 카드를 쓸 수 없어요.' };
      }

      let misfireOriginalCard = null;
      // 챌린지 "카드 감별 실패": 내가 고른 카드가 아니라, 같은 형태의 무작위 다른 카드가 발동돼요.
      if (state.challengeId === 'cardMisfire' && player === state.humanColor) {
        const shape = cardShapeKey(cardId);
        const candidates = CARDS.filter((c) => c.id !== cardId && cardShapeKey(c.id) === shape);
        if (candidates.length > 0) {
          misfireOriginalCard = cardId;
          cardId = candidates[Math.floor(Math.random() * candidates.length)].id;
        }
      }

      const withMisfire = misfireOriginalCard ? { ...state, misfireOriginalCard } : state;

      if (PLACEMENT_BUFF.has(cardId)) return activatePlacementBuff(withMisfire, cardId);
      if (STANDALONE.has(cardId) && !TARGET_STEPS[cardId]) return resolveStandaloneNoTarget(withMisfire, cardId);
      return {
        ...withMisfire,
        activeCard: { id: cardId, pending: [] },
        message: misfireOriginalCard ? '어라, 뭔가 다른 카드가 나온 것 같아요... 대상을 선택하세요.' : '대상을 선택하세요.',
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
        if (pending.some((p) => p.x === x && p.y === y)) {
          return { ...state, message: '이미 선택한 칸이에요. 다른 칸을 선택하세요.' };
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
