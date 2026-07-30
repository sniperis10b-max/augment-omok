// 앱 전역 설정(테마, 효과음, 시간제한, 카드 개수)을 로컬 스토리지에 저장해요.
// 게임 하나의 상태가 아니라, 이 브라우저에서 계속 유지되는 사용자 취향이에요.

const KEY = 'augment-omok-settings';

// "업데이트 소식" 팝업 관련. version을 올릴 때마다 새 소식이 다시 한 번 노출돼요.
// (사용자가 "다시 보지 않기"를 눌렀어도, 새 버전이 나오면 다시 보여줘요)
export const LATEST_UPDATE = {
  version: 24,
  title: '새로운 업데이트가 있어요!',
  items: [
    '로그인할 때마다 프로필 사진이 초기화되던 버그를 고쳤어요.',
    '매치 인트로에 돌 스킨 대신 프로필 사진(없으면 기본 아바타)이 뜨도록 바꿨어요.',
    '바둑판·바둑돌 스킨 20종 추가: 벚꽃놀이, 먹물, 심해, 사이버펑크, 양피지 지도, 균열 유리, 열대우림, 서리꽃 창문, 화산재, 도서관 서고, 해와 달, 잉크방울, 보석 원석, 자기장, 별자리, 용의 비늘, 찻잎, 자수정, 오로라 실크, 타임랩스.',
  ],
};

const DEFAULTS = {
  theme: 'light', // 'light' | 'dark'
  soundEnabled: true,
  timeLimitSec: 0, // 0 = 제한 없음
  cardsPerPlayer: 3,
  whatsNewSeenVersion: 0, // 사용자가 "다시 보지 않기"를 누른 마지막 업데이트 버전
  boardSkin: 'classic', // 바둑판 스킨 (지금은 개발자 계정만 바꿀 수 있어요)
  stoneSkin: 'classic', // 바둑돌 스킨 (지금은 개발자 계정만 바꿀 수 있어요)
  placementEffect: 'none', // 착수 이펙트 (지금은 개발자 계정 전용)
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // 저장 실패해도 게임 진행에는 지장 없음
  }
}

// 이 브라우저(기기)를 구분하는 고유 ID. 온라인 방에 재접속할 때 "원래 그 사람"인지
// 확인하는 데 써요.
const CLIENT_ID_KEY = 'augment-omok-client-id';

export function getClientId() {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}
