// Vercel 서버리스 함수예요 (POST /api/reportGameResult).
// 대국이 끝나면 서버가 최종 보드 상태를 다시 스캔해서 "그 색이 정말로 승리 조건을
// 만족하는지" 검증한 뒤에만 레이팅/랭크 포인트를 반영해요.

import { getDb, getUidFromRequest, DEV_EMAIL, sleep, checkRateLimit } from './_lib/firebaseAdmin.js';
import { getAuth } from 'firebase-admin/auth';
import {
  BLACK, WHITE,
} from './_lib/gameLogic.js';
import {
  validateGameResult, computeRatingDelta, computeRankPointsDelta, DEFAULT_RATING, DEFAULT_RANK_POINTS, parseRoomState,
} from './_lib/validators.js';

// placeStone과 같은 이유예요: 클라이언트가 "대국이 끝났다"는 최신 상태를 Firebase에
// 다 올리기 전에 서버가 그 사이의 상태를 읽으면 "아직 안 끝났어요"로 오판할 수 있어서,
// 그 경우(code: 'stale-state')엔 짧게 기다렸다가 다시 읽어서 재검증해요.
async function validateResultWithRetry(db, roomCode, uid, attempts = 3, delayMs = 150) {
  let room;
  let check;
  for (let i = 0; i < attempts; i++) {
    const roomSnap = await db.ref(`rooms/${roomCode}`).get();
    room = roomSnap.exists() ? roomSnap.val() : null;
    check = validateGameResult(room, uid);
    if (check.ok || check.code !== 'stale-state') return { room, check };
    if (i < attempts - 1) await sleep(delayMs);
  }
  return { room, check };
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

  const { roomCode } = req.body || {};
  if (typeof roomCode !== 'string') {
    res.status(400).json({ ok: false, message: 'roomCode가 필요해요.' });
    return;
  }

  if (uid) {
    const withinLimit = await checkRateLimit(uid, 'reportGameResult', 10, 10000).catch(() => true);
    if (!withinLimit) {
      res.status(200).json({ ok: false, code: 'resource-exhausted', message: '너무 빠르게 요청하고 있어요. 잠시 후 다시 시도해주세요.' });
      return;
    }
  }

  try {
    const db = getDb();
    const { room, check } = await validateResultWithRetry(db, roomCode, uid);

    if (!check.ok) {
      res.status(200).json({ ok: false, code: check.code, message: check.message });
      return;
    }

    if (!room.hostUid || !room.guestUid) {
      res.status(200).json({ ok: true, skipped: 'no-both-players' });
      return;
    }

    // 이 방의 이번 대국 결과가 이미 처리됐으면 중복 반영하지 않아요 (양쪽이 동시에
    // 호출해도 딱 한 번만 반영되도록 트랜잭션으로 "선점"해요).
    // rooms/{code} 밖의 별도 경로에 둬요 - rooms 안에 두면 호스트/게스트의 쓰기 권한이
    // 자식 경로까지 그대로 캐스케이드돼서, 그 사람들이 이 값을 직접 초기화하고 같은
    // 결과를 또 반영시키는(레이팅 중복 획득) 게 가능해질 수 있어요.
    const claimTx = await db.ref(`gameResults/${roomCode}/claimed`).transaction((current) => {
      if (current) return; // 이미 있으면 그대로 두고 트랜잭션을 취소해요.
      return true;
    });
    if (!claimTx.committed) {
      res.status(200).json({ ok: true, alreadyProcessed: true });
      return;
    }

    const { hostUid, guestUid, hostColor } = room;
    const guestColor = hostColor === BLACK ? WHITE : BLACK;
    const winner = parseRoomState(room)?.winner;
    const hostResult = winner === null ? 'draw' : winner === hostColor ? 'win' : 'loss';
    const guestResult = winner === null ? 'draw' : winner === guestColor ? 'win' : 'loss';
    const ranked = !!room.ranked;

    const auth = getAuth(db.app);
    const [hostRatingSnap, guestRatingSnap, hostLbSnap, guestLbSnap, hostAuthUser, guestAuthUser] = await Promise.all([
      db.ref(`users/${hostUid}/rating`).get(),
      db.ref(`users/${guestUid}/rating`).get(),
      db.ref(`leaderboard/${hostUid}`).get(),
      db.ref(`leaderboard/${guestUid}`).get(),
      auth.getUser(hostUid).catch(() => null),
      auth.getUser(guestUid).catch(() => null),
    ]);

    const hostRating = hostRatingSnap.exists() ? hostRatingSnap.val() : DEFAULT_RATING;
    const guestRating = guestRatingSnap.exists() ? guestRatingSnap.val() : DEFAULT_RATING;
    const hostDelta = computeRatingDelta(hostRating, guestRating, hostResult);
    const guestDelta = computeRatingDelta(guestRating, hostRating, guestResult);
    const newHostRating = Math.max(0, hostRating + hostDelta);
    const newGuestRating = Math.max(0, guestRating + guestDelta);

    const hostName = hostLbSnap.val()?.displayName || hostAuthUser?.displayName || '이름 없음';
    const guestName = guestLbSnap.val()?.displayName || guestAuthUser?.displayName || '이름 없음';
    const hostIsDev = hostAuthUser?.email === DEV_EMAIL;
    const guestIsDev = guestAuthUser?.email === DEV_EMAIL;

    const updates = {
      [`users/${hostUid}/rating`]: newHostRating,
      [`leaderboard/${hostUid}/rating`]: newHostRating,
      [`leaderboard/${hostUid}/displayName`]: hostName,
      [`leaderboard/${hostUid}/isDev`]: hostIsDev,
      [`users/${guestUid}/rating`]: newGuestRating,
      [`leaderboard/${guestUid}/rating`]: newGuestRating,
      [`leaderboard/${guestUid}/displayName`]: guestName,
      [`leaderboard/${guestUid}/isDev`]: guestIsDev,
    };

    const hostRankResult = { uid: hostUid, result: hostResult, ratingDelta: hostDelta, newRating: newHostRating };
    const guestRankResult = { uid: guestUid, result: guestResult, ratingDelta: guestDelta, newRating: newGuestRating };

    if (ranked) {
      const [hostPtsSnap, guestPtsSnap] = await Promise.all([
        db.ref(`users/${hostUid}/rankPoints`).get(),
        db.ref(`users/${guestUid}/rankPoints`).get(),
      ]);
      const hostPts = hostPtsSnap.exists() ? hostPtsSnap.val() : DEFAULT_RANK_POINTS;
      const guestPts = guestPtsSnap.exists() ? guestPtsSnap.val() : DEFAULT_RANK_POINTS;
      const hostPtsDelta = computeRankPointsDelta(hostPts, hostResult);
      const guestPtsDelta = computeRankPointsDelta(guestPts, guestResult);
      const newHostPts = Math.max(0, hostPts + hostPtsDelta);
      const newGuestPts = Math.max(0, guestPts + guestPtsDelta);
      updates[`users/${hostUid}/rankPoints`] = newHostPts;
      updates[`rankLeaderboard/${hostUid}/points`] = newHostPts;
      updates[`rankLeaderboard/${hostUid}/displayName`] = hostName;
      updates[`rankLeaderboard/${hostUid}/isDev`] = hostIsDev;
      updates[`users/${guestUid}/rankPoints`] = newGuestPts;
      updates[`rankLeaderboard/${guestUid}/points`] = newGuestPts;
      updates[`rankLeaderboard/${guestUid}/displayName`] = guestName;
      updates[`rankLeaderboard/${guestUid}/isDev`] = guestIsDev;

      hostRankResult.rankPointsDelta = hostPtsDelta;
      hostRankResult.newRankPoints = newHostPts;
      guestRankResult.rankPointsDelta = guestPtsDelta;
      guestRankResult.newRankPoints = newGuestPts;
    }

    await db.ref().update(updates);

    res.status(200).json({ ok: true, host: hostRankResult, guest: guestRankResult });
  } catch (err) {
    res.status(500).json({ ok: false, message: `서버 오류: ${err.message}` });
  }
}
