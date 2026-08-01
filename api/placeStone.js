// Vercel 서버리스 함수예요 (POST /api/placeStone).
// ⚠️ 1단계 구현이에요. "착수(돌 놓기)"의 기본 규칙(내 턴인지, 빈 칸인지, 렌주 금수인지,
// 승리 판정)만 서버에서 다시 검증해요. 카드 효과(파괴/변환/봉인 등)와 룰렛/챌린지의 특수
// 규칙은 아직 서버에서 검증하지 않고 클라이언트를 그대로 믿어요.

import { getDb, getUidFromRequest } from './_lib/firebaseAdmin.js';
import { validatePlacement } from './_lib/validators.js';

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

  try {
    const db = getDb();
    const roomSnap = await db.ref(`rooms/${roomCode}`).get();
    const room = roomSnap.exists() ? roomSnap.val() : null;

    const result = validatePlacement(room, uid, x, y);
    // 검증 실패도 정상 응답(200, ok:false)으로 돌려줘요. 그래야 클라이언트가 "서버가
    // 실제로 거부한 것"과 "API를 아예 못 부른 것"(네트워크 오류, 배포 전 등)을 명확히
    // 구분할 수 있어요.
    res.status(200).json(result.ok ? { ok: true, wouldWin: result.wouldWin } : { ok: false, message: result.message });
  } catch (err) {
    res.status(500).json({ ok: false, message: `서버 오류: ${err.message}` });
  }
}
