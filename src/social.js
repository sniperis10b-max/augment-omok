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
  // set()이 아니라 update()를 써요. set()은 이 경로 전체를 통째로 덮어써서
  // customPhoto(프로필 사진)처럼 여기 같이 저장된 다른 필드를 매번 지워버려요.
  await update(ref(db, `users/${user.uid}/profile`), {
    displayName: user.displayName || '이름 없음',
    email: user.email || null,
    photoURL: user.photoURL || null,
    updatedAt: serverTimestamp(),
  });
  if (user.email) {
    await set(ref(db, `usersByEmail/${emailKey(user.email)}`), user.uid);
  }
}

// ---------- 프로필 사진 ----------
// 별도의 Firebase Storage 없이, 작게 리사이즈한 이미지를 base64로 DB에 직접 저장해요.
// Auth의 photoURL(구글 로그인 사진 등)과는 별개의 필드(customPhoto)라서, 다른 곳에서
// user.photoURL을 다시 저장해도 이 값은 그대로 남아있어요.

export async function uploadProfilePhoto(uid, dataUrl) {
  const db = getDb();
  await update(ref(db, `users/${uid}/profile`), { customPhoto: dataUrl });
}

export async function removeProfilePhoto(uid) {
  const db = getDb();
  await update(ref(db, `users/${uid}/profile`), { customPhoto: null });
}

export async function getMyProfilePhoto(uid) {
  const db = getDb();
  const snap = await get(ref(db, `users/${uid}/profile/customPhoto`));
  return snap.exists() ? snap.val() : null;
}

export async function isFriend(myUid, otherUid) {
  const db = getDb();
  const snap = await get(ref(db, `users/${myUid}/friends/${otherUid}`));
  return snap.exists();
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

// 이메일 대신 uid로 바로 친구 요청을 보내요 (순위표나 프로필 화면처럼 이메일을 모르는
// 상태에서, 상대의 uid만 알고 있을 때 써요).
export async function sendFriendRequestByUid(myUser, targetUid) {
  const db = getDb();
  if (!targetUid) return { ok: false, reason: 'not-found' };
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

// 순위표에 저장해둔 닉네임/레이팅/랭크점수/칭호/티어/장착 스킨을 한 번에 모아 보여주는
// "다른 사람 프로필" 조회예요. leaderboard와 rankLeaderboard 둘 다 공개적으로 읽을 수
// 있게 설계돼 있어서(이메일 등 민감 정보 없음), 이 둘만 합쳐서 보여줘요.
export async function getPublicProfile(uid) {
  const db = getDb();
  const [lbSnap, rlSnap] = await Promise.all([
    get(ref(db, `leaderboard/${uid}`)),
    get(ref(db, `rankLeaderboard/${uid}`)),
  ]);
  const lb = lbSnap.val() || {};
  const rl = rlSnap.val() || {};
  const found = lbSnap.exists() || rlSnap.exists();
  if (!found) return null;
  return {
    uid,
    displayName: lb.displayName || rl.displayName || '이름 없음',
    isDev: !!(lb.isDev || rl.isDev),
    titleName: lb.titleName || rl.titleName || null,
    tierBadgeId: lb.tierBadgeId || rl.tierBadgeId || null,
    rating: lb.rating ?? null,
    rankPoints: rl.points ?? null,
    boardSkinId: lb.boardSkinId || rl.boardSkinId || null,
    stoneSkinId: lb.stoneSkinId || rl.stoneSkinId || null,
  };
}

// 지금 장착 중인 바둑판/바둑돌 스킨을 순위표에도 복사해둬요 (다른 사람 프로필이나
// 대국 시작 화면에서 상대 스킨을 보여줄 수 있게). 스킨은 원래 브라우저 로컬 설정이라
// 이 값들만 "장착 중인 스킨을 알려주는 용도"로 최소한만 공개해요.
export async function syncEquippedSkinsToLeaderboard(uid, boardSkinId, stoneSkinId) {
  const db = getDb();
  await update(ref(db), {
    [`leaderboard/${uid}/boardSkinId`]: boardSkinId || null,
    [`leaderboard/${uid}/stoneSkinId`]: stoneSkinId || null,
    [`rankLeaderboard/${uid}/boardSkinId`]: boardSkinId || null,
    [`rankLeaderboard/${uid}/stoneSkinId`]: stoneSkinId || null,
  }).catch((err) => {
    // 여기서 실패가 조용히 묻히면 "장착 스킨이 프로필에 안 뜨는" 버그를 진단할 방법이
    // 없어지니, 콘솔에는 남겨둬요 (Firebase 보안 규칙이 새 필드를 막고 있을 수 있어요).
    console.warn('장착 스킨을 순위표에 동기화하지 못했어요:', err);
  });
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

export async function quickMatch(timeLimitSec, cardsPerPlayer, hostUid, ranked = false) {
  const db = getDb();
  const queueKey = `${ranked ? 'ranked' : 'casual'}_${timeLimitSec || 0}_${cardsPerPlayer || 3}`;
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
      return { role: 'guest', code: existingVal.code, hostColor: existingVal.hostColor, queueKey, ranked };
    }
    // 다른 사람이 먼저 가져갔으면 아래로 내려가서 새로 방을 만들어요.
  }

  const hostColor = Math.random() < 0.5 ? BLACK : WHITE;
  const code = await createRoom(hostColor, timeLimitSec, cardsPerPlayer, hostUid, ranked);

  const claim = await runTransaction(waitingRef, (current) => {
    if (current && current.at && now - current.at < STALE_MS) {
      return current; // 같은 설정으로 누가 이미 기다리고 있으면 그대로 둠(내가 만든 방은 버려짐)
    }
    return { code, hostColor, at: Date.now() };
  });

  if (claim.committed && claim.snapshot.val() && claim.snapshot.val().code === code) {
    return { role: 'host', code, hostColor, queueKey, ranked };
  }

  // 경합에서 밀렸으면, 그 사이 자리를 차지한 사람의 방으로 게스트 참가
  const latest = await get(waitingRef);
  const latestVal = latest.val();
  if (latestVal) {
    await runTransaction(waitingRef, (current) => (current && current.code === latestVal.code ? null : current));
    return { role: 'guest', code: latestVal.code, hostColor: latestVal.hostColor, queueKey, ranked };
  }

  // 극히 드문 경우: 그냥 내가 만든 방으로 다시 시도
  return { role: 'host', code, hostColor, queueKey, ranked };
}

export async function cancelQuickMatch(code, queueKey) {
  const db = getDb();
  const waitingRef = ref(db, `matchmaking/waiting/${queueKey || 'casual_0_3'}`);
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
