// 친구 추가/초대, 그리고 완전 랜덤으로 상대를 매칭해주는 기능이에요.
// 로그인(계정)이 되어있어야 친구 기능을 쓸 수 있어요. 랜덤 매칭은 로그인 없이도 가능해요.

import { initializeApp, getApps } from 'firebase/app';
import {
  getDatabase, ref, set, get, update, remove, onValue, off, runTransaction, onDisconnect, serverTimestamp,
} from 'firebase/database';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig.js';
import { createRoom } from './network.js';
import { BLACK, WHITE } from './gameLogic.js';

let dbInstance = null;

function getDb() {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase 설정이 비어있어요. firebaseConfig.js를 채워주세요.');
  }
  if (!dbInstance) {
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    dbInstance = getDatabase(app);
  }
  return dbInstance;
}

// Realtime Database 키에는 '.', '#', '$', '[', ']'를 쓸 수 없어서 이메일을 안전한 키로 바꿔요.
function emailKey(email) {
  return email.trim().toLowerCase().replace(/[.#$[\]]/g, '_');
}

// 로그인할 때마다 내 프로필을 저장해요 (다른 사람이 나를 찾을 수 있도록).
export async function upsertUserProfile(user) {
  const db = getDb();
  await set(ref(db, `users/${user.uid}/profile`), {
    displayName: user.displayName || '이름 없음',
    email: user.email || null,
    photoURL: user.photoURL || null,
    updatedAt: serverTimestamp(),
  });
  if (user.email) {
    await set(ref(db, `usersByEmail/${emailKey(user.email)}`), user.uid);
  }
}

// ---------- 친구 요청 ----------

export async function sendFriendRequestByEmail(myUser, targetEmail) {
  const db = getDb();
  const key = emailKey(targetEmail);
  const snap = await get(ref(db, `usersByEmail/${key}`));
  if (!snap.exists()) return { ok: false, reason: 'not-found' };
  const targetUid = snap.val();
  if (targetUid === myUser.uid) return { ok: false, reason: 'self' };

  const friendSnap = await get(ref(db, `users/${myUser.uid}/friends/${targetUid}`));
  if (friendSnap.exists()) return { ok: false, reason: 'already-friend' };

  await set(ref(db, `users/${targetUid}/friendRequests/${myUser.uid}`), {
    displayName: myUser.displayName || '이름 없음',
    photoURL: myUser.photoURL || null,
    at: serverTimestamp(),
  });
  return { ok: true };
}

export function subscribeFriendRequests(uid, onChange) {
  const db = getDb();
  const r = ref(db, `users/${uid}/friendRequests`);
  const handler = (snap) => {
    const val = snap.val() || {};
    onChange(Object.entries(val).map(([fromUid, data]) => ({ fromUid, ...data })));
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

export async function acceptFriendRequest(myUid, fromUid) {
  const db = getDb();
  await update(ref(db), {
    [`users/${myUid}/friends/${fromUid}`]: true,
    [`users/${fromUid}/friends/${myUid}`]: true,
    [`users/${myUid}/friendRequests/${fromUid}`]: null,
  });
}

export async function declineFriendRequest(myUid, fromUid) {
  const db = getDb();
  await remove(ref(db, `users/${myUid}/friendRequests/${fromUid}`));
}

export function subscribeFriends(uid, onChange) {
  const db = getDb();
  const r = ref(db, `users/${uid}/friends`);
  const handler = async (snap) => {
    const val = snap.val() || {};
    const uids = Object.keys(val);
    const profiles = await Promise.all(
      uids.map(async (fuid) => {
        const pSnap = await get(ref(db, `users/${fuid}/profile`));
        return { uid: fuid, ...(pSnap.val() || { displayName: '(알 수 없음)' }) };
      })
    );
    onChange(profiles);
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

// ---------- 대국 초대 ----------

export async function inviteFriendToGame(myUser, friendUid, hostColor, timeLimitSec, cardsPerPlayer) {
  const code = await createRoom(hostColor, timeLimitSec, cardsPerPlayer);
  const db = getDb();
  await set(ref(db, `users/${friendUid}/invites/${myUser.uid}`), {
    code,
    displayName: myUser.displayName || '이름 없음',
    timeLimitSec: timeLimitSec || 0,
    cardsPerPlayer: cardsPerPlayer || 3,
    at: serverTimestamp(),
  });
  return code;
}

export function subscribeInvites(uid, onChange) {
  const db = getDb();
  const r = ref(db, `users/${uid}/invites`);
  const handler = (snap) => {
    const val = snap.val() || {};
    onChange(Object.entries(val).map(([fromUid, data]) => ({ fromUid, ...data })));
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

export async function clearInvite(myUid, fromUid) {
  const db = getDb();
  await remove(ref(db, `users/${myUid}/invites/${fromUid}`));
}

// ---------- 완전 랜덤 매칭 ----------
// matchmaking/waiting 한 자리를 두고, 먼저 온 사람이 방을 만들어 자리를 차지하고,
// 다음 사람이 그 자리를 발견하면 방에 참가한 뒤 자리를 비워요. 트랜잭션으로 동시 접속을
// 안전하게 처리해요.

export async function quickMatch(timeLimitSec, cardsPerPlayer) {
  const db = getDb();
  const queueKey = `${timeLimitSec || 0}_${cardsPerPlayer || 3}`;
  const waitingRef = ref(db, `matchmaking/waiting/${queueKey}`);

  // 오래된(2분 이상) 대기 정보는 무효로 취급해서 매칭이 영영 막히지 않게 해요.
  const now = Date.now();
  const STALE_MS = 120000;

  const existing = await get(waitingRef);
  const existingVal = existing.val();

  if (existingVal && existingVal.at && now - existingVal.at < STALE_MS) {
    // 같은 설정으로 이미 기다리는 사람이 있으면 게스트로 참가
    const result = await runTransaction(waitingRef, (current) => {
      if (current && current.code === existingVal.code) {
        return null; // 내가 이 자리를 소비
      }
      return current;
    });

    if (result.committed && !result.snapshot.val()) {
      return { role: 'guest', code: existingVal.code, hostColor: existingVal.hostColor, queueKey };
    }
    // 다른 사람이 먼저 가져갔으면 아래로 내려가서 새로 방을 만들어요.
  }

  const hostColor = Math.random() < 0.5 ? BLACK : WHITE;
  const code = await createRoom(hostColor);

  const claim = await runTransaction(waitingRef, (current) => {
    if (current && current.at && now - current.at < STALE_MS) {
      return current; // 같은 설정으로 누가 이미 기다리고 있으면 그대로 둠(내가 만든 방은 버려짐)
    }
    return { code, hostColor, at: Date.now() };
  });

  if (claim.committed && claim.snapshot.val() && claim.snapshot.val().code === code) {
    return { role: 'host', code, hostColor, queueKey };
  }

  // 경합에서 밀렸으면, 그 사이 자리를 차지한 사람의 방으로 게스트 참가
  const latest = await get(waitingRef);
  const latestVal = latest.val();
  if (latestVal) {
    await runTransaction(waitingRef, (current) => (current && current.code === latestVal.code ? null : current));
    return { role: 'guest', code: latestVal.code, hostColor: latestVal.hostColor, queueKey };
  }

  // 극히 드문 경우: 그냥 내가 만든 방으로 다시 시도
  return { role: 'host', code, hostColor, queueKey };
}

export async function cancelQuickMatch(code, queueKey) {
  const db = getDb();
  const waitingRef = ref(db, `matchmaking/waiting/${queueKey || '0_3'}`);
  await runTransaction(waitingRef, (current) => (current && current.code === code ? null : current));
}

// ---------- 접속 상태(온라인/오프라인) ----------
// Firebase의 .info/connected + onDisconnect를 이용해, 연결이 끊기면(창을 닫는 등)
// 자동으로 "오프라인"으로 바뀌게 해요.
export function setupPresence(uid) {
  const db = getDb();
  const statusRef = ref(db, `users/${uid}/status`);
  const connectedRef = ref(db, '.info/connected');
  const handler = onValue(connectedRef, (snap) => {
    if (snap.val() === false) return;
    onDisconnect(statusRef)
      .set({ state: 'offline', lastActive: serverTimestamp() })
      .then(() => set(statusRef, { state: 'online', lastActive: serverTimestamp() }));
  });
  return () => off(connectedRef, 'value', handler);
}

export function subscribeUserStatus(uid, onChange) {
  const db = getDb();
  const r = ref(db, `users/${uid}/status`);
  const handler = (snap) => onChange(snap.val() || { state: 'offline' });
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

// ---------- 개인 전적 ----------
export async function recordGameResult(uid, result) {
  // result: 'win' | 'loss' | 'draw'
  const db = getDb();
  const field = result === 'win' ? 'wins' : result === 'loss' ? 'losses' : 'draws';
  await runTransaction(ref(db, `users/${uid}/stats/${field}`), (cur) => (cur || 0) + 1);
}

export function subscribeStats(uid, onChange) {
  const db = getDb();
  const r = ref(db, `users/${uid}/stats`);
  const handler = (snap) => onChange(snap.val() || { wins: 0, losses: 0, draws: 0 });
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

// ---------- 회원 탈퇴 시 데이터 정리 ----------
export async function deleteUserData(uid, email) {
  const db = getDb();
  const friendsSnap = await get(ref(db, `users/${uid}/friends`));
  const friends = friendsSnap.val() || {};
  const updates = {};
  for (const fuid of Object.keys(friends)) {
    updates[`users/${fuid}/friends/${uid}`] = null;
  }
  updates[`users/${uid}`] = null;
  if (email) updates[`usersByEmail/${emailKey(email)}`] = null;
  await update(ref(db), updates);
}
