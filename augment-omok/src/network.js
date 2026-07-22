// 온라인 대전(친구와 플레이)을 위한 실시간 동기화 모듈.
// 전략: 매 착수/카드 사용마다 "전체 게임 상태"를 그대로 방(room)에 덮어써서 공유해요.
// 각자의 리듀서가 계산한 난수(카드 드로우 등)가 서로 달라도, 상태 자체를 통째로
// 동기화하기 때문에 어긋날 일이 없어요.

import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, get, update, onValue, off, serverTimestamp } from 'firebase/database';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig.js';

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
export async function createRoom(hostColor) {
  const db = getDb();
  const code = generateRoomCode();
  await set(ref(db, `rooms/${code}`), {
    status: 'waiting',
    hostColor,
    createdAt: serverTimestamp(),
    state: null,
  });
  return code;
}

// 코드로 방에 참가해요. 성공하면 방장의 색 정보를 반환해요.
export async function joinRoom(code) {
  const db = getDb();
  const roomRef = ref(db, `rooms/${code}`);
  const snap = await get(roomRef);
  if (!snap.exists()) return { ok: false, reason: 'not-found' };
  const data = snap.val();
  if (data.status !== 'waiting') return { ok: false, reason: 'full' };
  await update(roomRef, { status: 'active' });
  return { ok: true, hostColor: data.hostColor };
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

export { isFirebaseConfigured };
