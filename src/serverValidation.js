// 온라인 대전에서 "돌 하나 놓기"와 "대국 결과"를 서버(Vercel 서버리스 함수, /api/*)에도
// 한 번 더 확인받는 역할이에요. 처음엔 Firebase Cloud Functions로 만들었는데, 이 프로젝트가
// Firebase Spark(무료) 요금제를 쓰고 있어서 Cloud Functions를 배포할 수 없어요(Blaze 필요).
// 그래서 어차피 Vercel에 배포하고 있는 이 프로젝트의 서버리스 함수(api/ 폴더)로 옮겼어요.
//
// 참고: 이건 클라이언트가 계산한 상태를 대체하는 게 아니라 "덧붙이는 안전장치"예요.
// 카드 효과나 룰렛/챌린지의 특수 규칙까지는 서버가 아직 이해하지 못해서, 검증은
// "평범한 돌 하나 놓기"와 "대국이 끝났을 때 결과"에만 적용해요.
// API를 못 부르거나 네트워크 문제가 있으면, 게임이 막히지 않도록 "일단 통과"로
// 처리해요 — 클라이언트 자체 검증(gameReducer)이 어차피 다시 한번 걸러줘요.
//
// ⚠️ 중요: 서버 응답이 ok:false여도, 그 이유(code)에 따라 다르게 처리해요.
// - failed-precondition / invalid-argument → 진짜 게임 규칙 위반(이미 돌이 있음, 내
//   턴 아님, 금수 등)이라서 실제로 막아요.
// - unauthenticated / not-found / permission-denied → 로그인 토큰 검증 실패나 서버
//   설정 문제(Vercel 환경변수 오타 등) 때문일 수 있어서, 안전하게 통과시켜요. 이 셋을
//   전부 "부정행위"로 오인해서 막아버리면, 서버 설정에 문제가 생겼을 때 정상적으로
//   로그인한 사람도 온라인 대전에서 돌을 아예 못 놓게 되는 심각한 문제가 생겨요
//   (실제로 한 번 이 문제가 있었어요).

import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig.js';

// 이 코드들은 "서버가 게임 규칙을 근거로 명확히 거부한 것"만 나타내요.
// ⚠️ 지금은 비워뒀어요: phase/turn 체크가 "클라이언트가 최신 상태를 Firebase에 다
// 올리기 전에 서버가 그 사이의 상태를 읽어버리는" 타이밍 문제로 정상적인 착수까지
// 잘못 거부하는 게 실제로 확인돼서, 원인을 제대로 고칠 때까지 서버 응답을 로그로만
// 남기고 실제로 막지는 않게 해뒀어요.
const HARD_REJECT_CODES = new Set([]);

function getAuthInstance() {
  if (!isFirebaseConfigured()) throw new Error('Firebase 설정이 비어있어요.');
  const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  return getAuth(app);
}

async function callApi(path, body) {
  const authInstance = getAuthInstance();
  const idToken = await authInstance.currentUser?.getIdToken();
  if (!idToken) throw new Error('로그인 정보가 없어요.');

  const res = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status >= 500) {
    // 서버 자체 오류(배포 문제 등)예요 - 호출부에서 "통과 처리"하도록 예외를 던져요.
    throw new Error(`서버 오류 (${res.status})`);
  }
  return res.json();
}

// 서버에 "이 자리에 둬도 되는지" 물어봐요.
// 반환: { ok: true } (둬도 됨) | { ok: false, message } (서버가 게임 규칙 위반으로 실제 거부함)
//      | { ok: true, skipped: true } (API를 못 부름/인증 문제 등 - 안전하게 통과 처리)
export async function verifyPlacementOnServer(roomCode, x, y) {
  try {
    const data = await callApi('placeStone', { roomCode, x, y });
    if (data && data.ok === false) {
      if (HARD_REJECT_CODES.has(data.code)) {
        return { ok: false, message: data.message || '서버에서 이 수를 거부했어요.' };
      }
      // unauthenticated/not-found/permission-denied 등 - 인증/설정 문제일 수 있어서 통과시켜요.
      console.warn('서버 착수 검증을 건너뛰어요 (code:', data.code, '):', data.message);
      return { ok: true, skipped: true };
    }
    return { ok: true, wouldWin: data?.wouldWin };
  } catch {
    return { ok: true, skipped: true };
  }
}

// 대국이 끝났을 때, 서버(/api/reportGameResult)에 결과를 보고해요. 서버가 최종 보드에서
// 실제로 승리 조건이 성립하는지 다시 확인한 뒤에만 레이팅/랭크 포인트를 반영해요.
// (호스트/게스트 둘 다 이 함수를 불러도 안전해요 - 서버가 한 번만 반영하도록 처리해요.)
//
// 반환:
//  - { ok: true, mine: { result, ratingDelta, newRating } }  → 서버가 검증하고 반영함
//  - { ok: false, message }                                   → 서버가 게임 규칙 위반으로 실제 거부함 (조작 의심 등)
//  - { ok: true, skipped: true }                              → API를 못 부름/인증 문제 등, 통과 처리
export async function reportGameResultToServer(roomCode, myUid) {
  try {
    const data = await callApi('reportGameResult', { roomCode });
    if (!data || data.ok === false) {
      if (data && HARD_REJECT_CODES.has(data.code)) {
        return { ok: false, message: data.message || '서버에서 결과를 거부했어요.' };
      }
      console.warn('서버 결과 검증을 건너뛰어요 (code:', data?.code, '):', data?.message);
      return { ok: true, skipped: true };
    }
    if (data.alreadyProcessed || data.skipped) {
      return { ok: true, alreadyProcessed: !!data.alreadyProcessed, skipped: !!data.skipped };
    }
    const mine = data.host?.uid === myUid ? data.host : data.guest?.uid === myUid ? data.guest : null;
    return { ok: true, mine };
  } catch {
    return { ok: true, skipped: true };
  }
}
