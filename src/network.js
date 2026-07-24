// 온라인 대전(친구와 플레이)을 위한 실시간 동기화 모듈.
// 전략: 매 착수/카드 사용마다 "전체 게임 상태"를 그대로 방(room)에 덮어써서 공유해요.
// 각자의 리듀서가 계산한 난수(카드 드로우 등)가 서로 달라도, 상태 자체를 통째로
// 동기화하기 때문에 어긋날 일이 없어요.

import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, get, update, onValue, onChildAdded, off, push, serverTimestamp } from 'firebase/database';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig.js';
import { getClientId } from './settings.js';
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

// 헷갈리는 0/O, 1/I는 빼고, 영문 대문자 + 숫자로 6자리 코드를 만들어요.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// 방을 만들고 코드를 반환해요. hostColor: 방장이 플레이할 색(BLACK|WHITE 숫자값)
export async function createRoom(hostColor, timeLimitSec, cardsPerPlayer) {
  const db = getDb();
  const code = generateRoomCode();
  await set(ref(db, `rooms/${code}`), {
    status: 'waiting',
    hostColor,
    timeLimitSec: timeLimitSec || 0,
    cardsPerPlayer: cardsPerPlayer || 3,
    hostClientId: getClientId(),
    guestClientId: null,
    createdAt: serverTimestamp(),
    state: null,
  });
  return code;
}

// 참가하기 전에 방장의 색/시간제한/카드 개수를 미리 확인만 해요 (참가 처리는 안 함).
export async function peekRoom(code) {
  const db = getDb();
  const snap = await get(ref(db, `rooms/${code}`));
  if (!snap.exists()) return { ok: false, reason: 'not-found' };
  const data = snap.val();
  return {
    ok: true,
    hostColor: data.hostColor,
    timeLimitSec: data.timeLimitSec || 0,
    cardsPerPlayer: data.cardsPerPlayer || 3,
    status: data.status,
  };
}

// 코드로 방에 참가해요.
// - 예전에 이 방의 호스트/게스트였던 기기(clientId 일치)가 다시 들어오면 "재접속"으로
//   원래 자기 색을 그대로 돌려줘요.
// - 처음 보는 기기인데 방이 대기 중이면 게스트로 참가해요.
// - 처음 보는 기기인데 이미 대국 중이면 관전자로 참가해요.
export async function joinRoom(code) {
  const db = getDb();
  const roomRef = ref(db, `rooms/${code}`);
  const snap = await get(roomRef);
  if (!snap.exists()) return { ok: false, reason: 'not-found' };
  const data = snap.val();
  const myId = getClientId();

  if (data.hostClientId === myId) {
    return { ok: true, hostColor: data.hostColor, localColor: data.hostColor, rejoin: true };
  }
  if (data.guestClientId && data.guestClientId === myId) {
    const guestColor = data.hostColor === BLACK ? WHITE : BLACK;
    return { ok: true, hostColor: data.hostColor, localColor: guestColor, rejoin: true };
  }

  if (data.status === 'waiting') {
    await update(roomRef, { status: 'active', guestClientId: myId });
    return { ok: true, hostColor: data.hostColor, asSpectator: false };
  }

  return { ok: true, hostColor: data.hostColor, asSpectator: true };
}

// 방 전체(상태 포함)를 구독해요. onUpdate(roomData)가 변경마다 호출돼요.
// state는 JSON 문자열로 저장돼있어서, 여기서 미리 파싱해서 넘겨줘요.
export function subscribeRoom(code, onUpdate) {
  const db = getDb();
  const roomRef = ref(db, `rooms/${code}`);
  const handler = (snap) => {
    if (!snap.exists()) return;
    const data = snap.val();
    let parsedState = null;
    if (typeof data.state === 'string') {
      try {
        parsedState = JSON.parse(data.state);
      } catch {
        parsedState = null;
      }
    }
    onUpdate({ ...data, state: parsedState });
  };
  onValue(roomRef, handler);
  return () => off(roomRef, 'value', handler);
}

// 게임 상태 전체를 방에 덮어써요. 객체를 그대로 저장하면 Firebase가 숫자로 된 키를
// 배열로 바꾸거나 빈 배열/객체 값을 통째로 지워버리는 문제가 있어서, 문자열로 통째로 저장해요.
export async function pushGameState(code, state) {
  const db = getDb();
  await update(ref(db, `rooms/${code}`), { state: JSON.stringify(state), updatedAt: serverTimestamp() });
}

export async function leaveRoom(code) {
  try {
    const db = getDb();
    await set(ref(db, `rooms/${code}`), null);
  } catch {
    // 방이 이미 없거나 설정이 안 된 경우는 조용히 무시
  }
}

// 채팅 메시지 하나를 방에 추가해요.
export async function sendChatMessage(code, sender, text, isDev = false) {
  const db = getDb();
  await push(ref(db, `rooms/${code}/chat`), { sender, text, at: Date.now(), isDev });
}

// 채팅 메시지가 새로 추가될 때마다 호출돼요.
export function subscribeChat(code, onMessage) {
  const db = getDb();
  const chatRef = ref(db, `rooms/${code}/chat`);
  const handler = (snap) => {
    const val = snap.val();
    if (val) onMessage({ id: snap.key, ...val });
  };
  onChildAdded(chatRef, handler);
  return () => off(chatRef, 'child_added', handler);
}

export { isFirebaseConfigured };
