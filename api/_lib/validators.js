// 순수 함수로 분리해둔 핵심 검증 로직이에요 (Firebase Admin 없이도 직접 테스트할 수 있어요).
import { BLACK, WHITE, checkWin, isForbiddenMove } from './gameLogic.js';
import { getTierForRating } from './tiers.js';

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

  const state = room.state;
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

  const state = room.state;
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
