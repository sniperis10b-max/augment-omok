// 순수 함수로 분리해둔 핵심 검증 로직이에요 (Firebase Admin 없이도 직접 테스트할 수 있어요).
import { BLACK, WHITE, WILD, checkWin, isForbiddenMove } from './gameLogic.js';
import { getTierForRating } from './tiers.js';

// ⚠️ 중요: 클라이언트(src/network.js)는 rooms/{code}/state를 객체가 아니라
// JSON.stringify()한 "문자열"로 Firebase에 저장해요 (읽을 때는 JSON.parse로 되돌려요).
// 이걸 모르고 room.state.board처럼 곧바로 접근하면 항상 undefined만 나와서, 검증이
// 실제로는 한 번도 제대로 동작하지 않고 매번 "정보가 이상함"으로 취급되며 그냥
// 통과되기만 했을 거예요. 그래서 항상 이 함수를 통해서만 state를 꺼내요 (이미 객체로
// 들어오는 경우 — 테스트에서 순수 객체를 바로 넣는 경우 — 도 그대로 지원해요).
export function parseRoomState(room) {
  if (!room) return null;
  const raw = room.state;
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

function isBlockedCell(blockedCells, x, y, ply) {
  const expire = blockedCells?.[`${x},${y}`];
  if (expire === undefined || expire === null) return false;
  return expire === Infinity || expire === 'Infinity' || ply < expire;
}

// room: { hostUid, guestUid, hostColor, state } / uid: 요청한 사람 / x,y: 두려는 좌표
// 반환: { ok: true, myColor, wouldWin } 또는 { ok: false, code, message }
export function validatePlacement(room, uid, x, y) {
  if (!uid) return { ok: false, code: 'unauthenticated', message: '로그인 후에 대국을 할 수 있어요.' };
  if (!room) return { ok: false, code: 'not-found', message: '존재하지 않는 방이에요.' };

  const state = parseRoomState(room);
  if (!state) return { ok: false, code: 'failed-precondition', message: '아직 대국이 시작되지 않았어요.' };

  let myColor = null;
  if (room.hostUid && room.hostUid === uid) myColor = room.hostColor;
  else if (room.guestUid && room.guestUid === uid) myColor = room.hostColor === BLACK ? WHITE : BLACK;
  if (!myColor) return { ok: false, code: 'permission-denied', message: '이 방의 참가자가 아니에요.' };

  if (state.phase !== 'play') return { ok: false, code: 'stale-state', message: '지금은 착수할 수 있는 상태가 아니에요.' };
  if (state.turn !== myColor) return { ok: false, code: 'stale-state', message: '내 턴이 아니에요.' };

  const board = state.board;
  const size = board.length;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= size || y < 0 || y >= size) {
    return { ok: false, code: 'invalid-argument', message: '판 밖의 좌표예요.' };
  }
  if (board[y][x] !== 0) return { ok: false, code: 'failed-precondition', message: '이미 돌이 있는 칸이에요.' };
  if (isBlockedCell(state.blockedCells, x, y, state.ply)) {
    return { ok: false, code: 'failed-precondition', message: '지금은 놓을 수 없는 칸이에요.' };
  }
  const forbidden = isForbiddenMove(board, x, y, myColor, state.ruleFlags || {});
  if (forbidden) return { ok: false, code: 'failed-precondition', message: `금수 자리예요 (${forbidden}).` };

  const winLength = state.winLengthOverride?.[myColor] ?? 5;
  const nextBoard = board.map((row) => row.slice());
  nextBoard[y][x] = myColor;
  const won = checkWin(nextBoard, x, y, myColor, {
    winLength,
    excludeDiagonal: state.ruleFlags?.noDiagonalFor === myColor,
  });

  return { ok: true, myColor, wouldWin: won };
}

// 룰렛 "색깔 교대전"(10수마다 보드 전체 흑/백 반전), "자동 소멸"(오래된 돌 자동 제거)처럼
// 착수 외의 순간에도 보드가 바뀌는 규칙이 있어요. 이런 경우 착수 하나에 여러 칸이 달라지는
// 게 정상이라, 엄격한 "딱 1칸만 바뀜" 검증을 적용하면 정상 승리까지 오탐지해서 막아버려요.
// 그래서 이런 규칙이 활성화된 게임은 완화된 검증(그 칸에 정확한 색이 실제로 놓였는지만
// 확인)을 쓰고, 그 외의 평범한 게임만 엄격하게 검증해요.
const BOARD_MUTATING_ROULETTE_RULES = new Set(['colorSwap', 'autoDecay']);

// state.moveLog는 한 수 한 수마다 그 시점의 보드 스냅샷을 같이 기록해둬요. 이걸 이용해서,
// "돌 놓기(place)" 타입 기록들이 실제로 매번 딱 한 칸만, 그것도 기록된 사람의 색으로,
// 원래 비어있던 곳에 놓인 게 맞는지 하나하나 대조해요. 카드 효과(파괴/변환 등)로 인한
// 변화까지는 검증하지 않지만(그건 별도의 큰 작업이에요), 이 정도만으로도 콘솔에서
// 보드 배열을 직접 통째로 바꿔치기하는 식의 "빠르고 티 나는" 조작은 걸러낼 수 있어요.
function validateMoveLogIntegrity(moveLog, rouletteRule) {
  const strict = !BOARD_MUTATING_ROULETTE_RULES.has(rouletteRule);
  if (!Array.isArray(moveLog) || moveLog.length === 0) {
    return { ok: false, message: '대국 기록이 없어요.' };
  }
  let prevBoard = null;
  for (const entry of moveLog) {
    if (!entry || !Array.isArray(entry.board)) {
      return { ok: false, message: '대국 기록의 보드 정보가 이상해요.' };
    }
    if (prevBoard && entry.type === 'place') {
      const size = entry.board.length;
      if (prevBoard.length !== size) {
        return { ok: false, message: '대국 기록 중 판 크기가 갑자기 바뀌었어요.' };
      }
      const expectedColor = entry.placedColor ?? entry.player;
      if (!strict) {
        // 완화된 검증: 기록된 좌표에 실제로 정확한 색이 놓여있기만 하면 통과해요.
        if (entry.board[entry.y]?.[entry.x] !== expectedColor) {
          return { ok: false, message: `${entry.seq}번째 기록의 좌표에 기록된 색이 실제로 없어요.` };
        }
        prevBoard = entry.board;
        continue;
      }
      let diffCount = 0;
      let diffCell = null;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (entry.board[y][x] !== prevBoard[y][x]) {
            diffCount++;
            diffCell = { x, y, before: prevBoard[y][x], after: entry.board[y][x] };
          }
        }
      }
      if (diffCount !== 1) {
        return { ok: false, message: `${entry.seq}번째 기록에서 한 수에 여러 칸이 동시에 바뀌었어요.` };
      }
      if (diffCell.before !== 0) {
        return { ok: false, message: `${entry.seq}번째 기록이 이미 돌이 있던 칸에 놓인 것으로 되어 있어요.` };
      }
      if (diffCell.after !== expectedColor) {
        return { ok: false, message: `${entry.seq}번째 기록의 돌 색이 실제 놓인 색과 달라요.` };
      }
      if (diffCell.x !== entry.x || diffCell.y !== entry.y) {
        return { ok: false, message: `${entry.seq}번째 기록의 좌표가 실제 변화 위치와 달라요.` };
      }
    } else if (prevBoard && entry.type === 'card') {
      const size = entry.board.length;
      if (prevBoard.length === size) {
        const diffs = [];
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            if (entry.board[y][x] !== prevBoard[y][x]) {
              diffs.push({ x, y, before: prevBoard[y][x], after: entry.board[y][x] });
            }
          }
        }
        const mover = entry.player;
        const opponent = mover === BLACK ? WHITE : BLACK;
        const cardId = entry.cardId;

        // 위험도가 높은 카드들(상대 돌 제거/전환, 위치 조작)은 실제 효과 모양까지 정확히 대조해요.
        if (cardId === 'destroy') {
          if (diffs.length !== 1 || diffs[0].before !== opponent || diffs[0].after !== 0) {
            return { ok: false, message: `${entry.seq}번째 '파괴' 카드 기록이 실제 효과와 안 맞아요.` };
          }
        } else if (cardId === 'destroyChain') {
          if (diffs.length < 1 || diffs.length > 2 || diffs.some((d) => d.before !== opponent || d.after !== 0)) {
            return { ok: false, message: `${entry.seq}번째 '연쇄 파괴' 카드 기록이 실제 효과와 안 맞아요.` };
          }
        } else if (cardId === 'alchemy') {
          if (diffs.length !== 1 || diffs[0].before !== opponent || diffs[0].after !== mover) {
            return { ok: false, message: `${entry.seq}번째 '연금술' 카드 기록이 실제 효과와 안 맞아요.` };
          }
        } else if (cardId === 'swap') {
          const validSwap = diffs.length === 2 && (
            (diffs[0].before === mover && diffs[0].after === opponent && diffs[1].before === opponent && diffs[1].after === mover)
            || (diffs[0].before === opponent && diffs[0].after === mover && diffs[1].before === mover && diffs[1].after === opponent)
          );
          if (!validSwap) {
            return { ok: false, message: `${entry.seq}번째 '위치 교환' 카드 기록이 실제 효과와 안 맞아요.` };
          }
        } else if (cardId === 'overwrite') {
          if (diffs.length !== 1 || diffs[0].before === 0 || diffs[0].after !== mover) {
            return { ok: false, message: `${entry.seq}번째 '관통' 카드 기록이 실제 효과와 안 맞아요.` };
          }
        } else if (cardId === 'wildcard') {
          if (diffs.length !== 1 || diffs[0].before !== 0 || diffs[0].after !== WILD) {
            return { ok: false, message: `${entry.seq}번째 '와일드카드' 기록이 실제 효과와 안 맞아요.` };
          }
        } else if (diffs.length > size) {
          // 그 외 카드는 정확한 로직까지는 검증 못 하지만(더 큰 작업이에요), 한 번에 너무
          // 많은 칸이 한꺼번에 바뀌는 건 상식적으로 이상해서 최소한으로 걸러요.
          return { ok: false, message: `${entry.seq}번째 카드 기록에서 한 번에 너무 많은 칸(${diffs.length}개)이 바뀌었어요.` };
        }
      }
    }
    prevBoard = entry.board;
  }
  return { ok: true };
}

// 보드 전체를 훑어서, player가 실제로 승리 조건(연속 돌)을 만족하는 자리가 있는지 확인해요.
function boardHasWinFor(board, player, options) {
  const size = board.length;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[y][x] !== player) continue;
      if (checkWin(board, x, y, player, options)) return true;
    }
  }
  return false;
}

// 반환: { ok: true, myColor, hostColor, guestColor } 또는 { ok: false, code, message }
export function validateGameResult(room, uid) {
  if (!uid) return { ok: false, code: 'unauthenticated', message: '로그인 후에 대국을 할 수 있어요.' };
  if (!room) return { ok: false, code: 'not-found', message: '존재하지 않는 방이에요.' };

  const state = parseRoomState(room);
  if (!state) return { ok: false, code: 'failed-precondition', message: '대국 정보가 없어요.' };

  let myColor = null;
  if (room.hostUid && room.hostUid === uid) myColor = room.hostColor;
  else if (room.guestUid && room.guestUid === uid) myColor = room.hostColor === BLACK ? WHITE : BLACK;
  if (!myColor) return { ok: false, code: 'permission-denied', message: '이 방의 참가자가 아니에요.' };

  if (state.phase !== 'over') return { ok: false, code: 'stale-state', message: '아직 대국이 끝나지 않았어요.' };

  const winner = state.winner;
  if (winner !== null && winner !== BLACK && winner !== WHITE) {
    return { ok: false, code: 'failed-precondition', message: '승자 값이 이상해요.' };
  }

  if (winner !== null) {
    const winLength = state.winLengthOverride?.[winner] ?? 5;
    const hasWin = boardHasWinFor(state.board, winner, {
      winLength,
      excludeDiagonal: state.ruleFlags?.noDiagonalFor === winner,
    });
    if (!hasWin) {
      return { ok: false, code: 'failed-precondition', message: '보드 상태에서 실제로 승리 조건을 확인할 수 없어요.' };
    }
    // 보드 모양이 진짜 승리 조건이어도, 그 모양이 실제로 정상적인 수순으로 만들어졌는지도
    // 이동 기록으로 한 번 더 대조해요 (콘솔로 보드를 직접 바꿔치기하는 조작을 잡기 위해서).
    // 이동 기록의 마지막 스냅샷과 실제로 제출된 최종 보드가 같은지도 확인해요.
    // (여기가 없으면, 기록 자체는 멀쩡해도 마지막에 최종 board만 몰래 바꿔치기하는 걸 못 잡아요.)
    const lastEntry = Array.isArray(state.moveLog) ? state.moveLog[state.moveLog.length - 1] : null;
    if (lastEntry && Array.isArray(lastEntry.board)) {
      const size = state.board.length;
      let mismatch = lastEntry.board.length !== size;
      if (!mismatch) {
        outer: for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            if (state.board[y][x] !== lastEntry.board[y][x]) { mismatch = true; break outer; }
          }
        }
      }
      if (mismatch) {
        return { ok: false, code: 'failed-precondition', message: '최종 보드가 이동 기록의 마지막 상태와 달라요.' };
      }
    }

    const integrity = validateMoveLogIntegrity(state.moveLog, state.rouletteRule);
    if (!integrity.ok) {
      return { ok: false, code: 'failed-precondition', message: `대국 기록이 실제 보드와 안 맞아요: ${integrity.message}` };
    }

    // 연금술/위치 교환/관통/돌 이동은 카드 설명에 "이 카드로는 승리를 완성할 수 없어요"라고
    // 명시되어 있어요. 마지막 기록이 이런 카드였다면(=그 카드로 승리 모양이 막 만들어진
    // 거라면) 거부해요.
    const NO_WIN_CARDS = new Set(['alchemy', 'swap', 'overwrite', 'moveStone']);
    if (lastEntry && lastEntry.type === 'card' && NO_WIN_CARDS.has(lastEntry.cardId)) {
      return { ok: false, code: 'failed-precondition', message: '이 카드로는 승리를 완성할 수 없어요.' };
    }
  }

  const hostColor = room.hostColor;
  const guestColor = hostColor === BLACK ? WHITE : BLACK;
  return { ok: true, myColor, hostColor, guestColor };
}

// src/rating.js의 computeRatingDelta와 동일한 로직이에요 (레이팅 변동폭 계산).
export function computeRatingDelta(myRating, opponentRating, result) {
  const diff = Math.abs(myRating - opponentRating);
  const amHigher = myRating >= opponentRating;
  let table;
  if (diff <= 100) {
    table = { win: 10, draw: 0, loss: -10 };
  } else if (diff <= 300) {
    table = amHigher ? { win: 7, draw: -1, loss: -13 } : { win: 13, draw: 1, loss: -7 };
  } else {
    table = amHigher ? { win: 5, draw: -2, loss: -15 } : { win: 15, draw: 2, loss: -5 };
  }
  return table[result] ?? 0;
}

// src/rankpoints.js의 computeRankPointsDelta와 동일한 로직이에요 (랭크 포인트 변동폭 계산).
export function computeRankPointsDelta(myPointsBefore, result) {
  if (result === 'win') return 100;
  if (result === 'loss') return -getTierForRating(myPointsBefore).lossAmount;
  return 0;
}

export const DEFAULT_RATING = 1000;
export const DEFAULT_RANK_POINTS = 0;
