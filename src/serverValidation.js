// 온라인 대전에서 "돌 하나 놓기"가 유효한지 서버(Cloud Functions)에도 한 번 더
// 물어보는 역할이에요. functions/index.js의 placeStone 함수를 호출해요.
//
// 참고: 이건 클라이언트가 계산한 상태를 대체하는 게 아니라 "덧붙이는 안전장치"예요.
// 카드 효과나 룰렛/챌린지의 특수 규칙까지는 서버가 아직 이해하지 못해서, 검증은
// "평범한 돌 하나 놓기"에만 적용해요 (카드 사용/타겟 선택에는 적용 안 해요).
// 서버 함수를 못 부르거나 네트워크 문제가 있으면, 게임이 막히지 않도록 "일단 통과"로
// 처리해요 — 클라이언트 자체 검증(gameReducer)이 어차피 다시 한번 걸러줘요.

import { initializeApp, getApps } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig.js';

let functionsInstance = null;
function getFunctionsInstance() {
  if (!isFirebaseConfigured()) throw new Error('Firebase 설정이 비어있어요.');
  if (!functionsInstance) {
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    functionsInstance = getFunctions(app);
  }
  return functionsInstance;
}

// 서버에 "이 자리에 둬도 되는지" 물어봐요.
// 반환: { ok: true } (둬도 됨) | { ok: false, message } (서버가 실제로 거부함)
//      | { ok: true, skipped: true } (함수를 못 부름 - 아직 배포 전이거나 네트워크 문제라 통과 처리)
//
// 주의: placeStone 함수는 "거부"를 예외(throw)가 아니라 정상 응답(ok:false)으로 돌려줘요.
// 그래야 "서버가 실제로 거부한 것"과 "함수가 아직 배포되지 않아서 생기는 예외"를 명확히
// 구분할 수 있어요 (배포 전에는 두 경우 모두 비슷한 에러 코드가 찍혀서 구분이 안 됐어요 —
// 실제로 이 문제 때문에 배포 전에는 온라인 대전 전체가 막힐 뻔한 적이 있어요).
export async function verifyPlacementOnServer(roomCode, x, y) {
  try {
    const fn = httpsCallable(getFunctionsInstance(), 'placeStone');
    const res = await fn({ roomCode, x, y });
    if (res.data && res.data.ok === false) {
      return { ok: false, message: res.data.message || '서버에서 이 수를 거부했어요.' };
    }
    return { ok: true, wouldWin: res.data?.wouldWin };
  } catch {
    // 함수를 아예 호출하지 못한 경우(아직 배포 전, 네트워크 문제 등)예요. 게임이 막히지
    // 않도록 통과시켜요 — 클라이언트 자체 검증(gameReducer)이 어차피 다시 한번 걸러줘요.
    return { ok: true, skipped: true };
  }
}
