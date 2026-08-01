// ⚠️ 1단계 구현이에요. "착수(돌 놓기)"의 기본 규칙(내 턴인지, 빈 칸인지, 렌주 금수인지,
// 승리 판정)만 서버에서 다시 검증해요. 카드 효과(파괴/변환/봉인 등)와 룰렛/챌린지의 특수
// 규칙은 아직 서버에서 검증하지 않고 클라이언트를 그대로 믿어요 — 이 부분이 진짜 "완전한
// 서버 권위 구조"가 되려면 다음 단계로 카드 효과들도 하나씩 이식해야 해요.
//
// 클라이언트는 아직 이 함수를 호출하도록 바뀌지 않았어요 (src/network.js가 여전히
// state를 통째로 Firebase에 직접 씀). 클라이언트를 이 함수를 호출하는 구조로 바꾸는 것도
// 다음 단계예요.

import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { BLACK, WHITE, checkWin, isForbiddenMove } from './gameLogic.js';

function isBlockedCell(blockedCells, x, y, ply) {
  const expire = blockedCells?.[`${x},${y}`];
  if (expire === undefined || expire === null) return false;
  return expire === Infinity || expire === 'Infinity' || ply < expire;
}

// 순수 함수로 분리해둔 핵심 검증 로직이에요 (Firebase 없이도 직접 테스트할 수 있어요).
// room: { hostUid, guestUid, hostColor, state } / uid: 요청한 사람 / x,y: 두려는 좌표
// 반환: { ok: true, wouldWin, myColor } 또는 { ok: false, code, message }
export function validatePlacement(room, uid, x, y) {
  if (!uid) return { ok: false, code: 'unauthenticated', message: '로그인 후에 대국을 할 수 있어요.' };
  if (!room) return { ok: false, code: 'not-found', message: '존재하지 않는 방이에요.' };

  const state = room.state;
  if (!state) return { ok: false, code: 'failed-precondition', message: '아직 대국이 시작되지 않았어요.' };

  let myColor = null;
  if (room.hostUid && room.hostUid === uid) myColor = room.hostColor;
  else if (room.guestUid && room.guestUid === uid) myColor = room.hostColor === BLACK ? WHITE : BLACK;
  if (!myColor) return { ok: false, code: 'permission-denied', message: '이 방의 참가자가 아니에요.' };

  if (state.phase !== 'play') return { ok: false, code: 'failed-precondition', message: '지금은 착수할 수 있는 상태가 아니에요.' };
  if (state.turn !== myColor) return { ok: false, code: 'failed-precondition', message: '내 턴이 아니에요.' };

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

initializeApp();

export const placeStone = onCall(async (request) => {
  const uid = request.auth?.uid;
  const { roomCode, x, y } = request.data || {};
  if (typeof roomCode !== 'string') {
    // 이건 클라이언트 버그에 가까운 잘못된 호출이라 예외로 던져요.
    throw new HttpsError('invalid-argument', 'roomCode가 필요해요.');
  }

  const db = getDatabase();
  const roomSnap = await db.ref(`rooms/${roomCode}`).get();
  const room = roomSnap.exists() ? roomSnap.val() : null;

  const result = validatePlacement(room, uid, x, y);
  // 중요: 검증 실패를 HttpsError로 "던지지" 않고 정상 응답(ok:false)으로 돌려줘요.
  // 이 함수가 아직 배포되지 않았거나 네트워크 문제가 있을 때 발생하는 진짜 예외와,
  // "서버가 이 수를 실제로 거부한 것"을 클라이언트가 명확히 구분할 수 있게 하기 위해서예요
  // (배포 전에는 permission-denied 같은 에러 코드가 똑같이 찍혀서 구분이 안 됐어요).
  if (!result.ok) {
    return { ok: false, code: result.code, message: result.message };
  }
  // 여기까지 통과하면 서버 기준으로도 "유효한 착수"예요. 실제 보드 반영/승리 판정은
  // 아직 클라이언트가 계산한 state를 그대로 신뢰하고 있어요(카드 효과 포함 여부 때문에) —
  // 지금은 "이 요청 자체가 유효한지"만 검증하는 1단계 게이트예요.
  return { ok: true, wouldWin: result.wouldWin };
});
