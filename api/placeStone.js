// Vercel 서버리스 함수예요 (POST /api/placeStone).
// ⚠️ 1단계 구현이에요. "착수(돌 놓기)"의 기본 규칙(내 턴인지, 빈 칸인지, 렌주 금수인지,
// 승리 판정)만 서버에서 다시 검증해요. 카드 효과(파괴/변환/봉인 등)와 룰렛/챌린지의 특수
// 규칙은 아직 서버에서 검증하지 않고 클라이언트를 그대로 믿어요.

import { getDb, getUidFromRequest, sleep, checkRateLimit } from './_lib/firebaseAdmin.js';
import { validatePlacement } from './_lib/validators.js';

// 클라이언트가 방금 둔 수를 Firebase에 다 올리기 전에, 서버가 그 사이의(한 수 전) 상태를
// 읽어버리면 "내 턴이 아니에요"/"착수할 수 있는 상태가 아니에요" 같은 오판이 나요
// (validatePlacement가 이런 경우 code: 'stale-state'로 표시해요). 그래서 그 경우엔
// 곧바로 거부하지 않고, 아주 짧게 기다렸다가 최신 상태를 다시 읽어서 재검증해요.
// (재시도 간격/횟수를 크게 하면 그만큼 매 착수마다 체감 지연이 커져서, 최소한으로만 줘요.)
async function validateWithRetry(db, roomCode, uid, x, y, attempts = 2, delayMs = 80) {
  let result;
  for (let i = 0; i < attempts; i++) {
    const roomSnap = await db.ref(`rooms/${roomCode}`).get();
    const room = roomSnap.exists() ? roomSnap.val() : null;
    result = validatePlacement(room, uid, x, y);
    if (result.ok || result.code !== 'stale-state') return result;
    if (i < attempts - 1) await sleep(delayMs);
  }
  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'POST만 지원해요.' });
    return;
  }

  let uid;
  try {
    uid = await getUidFromRequest(req);
  } catch (err) {
    res.status(500).json({ ok: false, message: `서버 설정 오류: ${err.message}` });
    return;
  }

  const { roomCode, x, y } = req.body || {};
  if (typeof roomCode !== 'string') {
    res.status(400).json({ ok: false, message: 'roomCode가 필요해요.' });
    return;
  }

  if (uid) {
    // 짧은 시간에 너무 많이 부르면 거부해요(초당 여러 번 두는 정상 플레이는 넉넉히 허용).
    const withinLimit = await checkRateLimit(uid, 'placeStone', 40, 10000).catch(() => true);
    if (!withinLimit) {
      res.status(200).json({ ok: false, code: 'resource-exhausted', message: '너무 빠르게 요청하고 있어요. 잠시 후 다시 시도해주세요.' });
      return;
    }
  }

  try {
    const db = getDb();
    const result = await validateWithRetry(db, roomCode, uid, x, y);
    // 검증 실패도 정상 응답(200, ok:false)으로 돌려줘요. 그래야 클라이언트가 "서버가
    // 실제로 거부한 것"과 "API를 아예 못 부른 것"(네트워크 오류, 배포 전 등)을 명확히
    // 구분할 수 있어요. code도 같이 보내서, 클라이언트가 "진짜 게임 규칙 위반"(이미 돌이
    // 있음, 내 턴 아님 등)과 "인증/설정 문제"(unauthenticated, not-found, permission-denied -
    // 토큰 검증 실패나 서버 설정 오류일 가능성이 있음)를 구분해서, 후자는 안전하게
    // 통과시킬 수 있게 해요.
    res.status(200).json(result.ok ? { ok: true, wouldWin: result.wouldWin } : { ok: false, code: result.code, message: result.message });
  } catch (err) {
    res.status(500).json({ ok: false, message: `서버 오류: ${err.message}` });
  }
}
