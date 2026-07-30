// 앱 전역 설정(테마, 효과음, 시간제한, 카드 개수)을 로컬 스토리지에 저장해요.
// 게임 하나의 상태가 아니라, 이 브라우저에서 계속 유지되는 사용자 취향이에요.

const KEY = 'augment-omok-settings';

// "업데이트 소식" 팝업 관련. version을 올릴 때마다 새 소식이 다시 한 번 노출돼요.
// (사용자가 "다시 보지 않기"를 눌렀어도, 새 버전이 나오면 다시 보여줘요)
export const LATEST_UPDATE = {
  version: 23,
  title: '새로운 업데이트가 있어요!',
  items: [
    '5단 계단 챌린지 버그 수정: 재대국으로 이어가도 다음 단계로 제대로 진행되고, 전부 클리어하면 투명 돌 스킨 조건도 정확히 인식해요.',
    'ERROR 스킨(판·돌) 이미지와 글리치 애니메이션을 다듬었어요.',
    '로비 화면에 스킨(판/돌/착수 이펙트) 선택 전용 버튼을 추가했어요.',
    '프로필 화면 추가: 레이팅, 랭크 티어, 전적, 장착 중인 스킨, 챌린지 클리어 현황을 한눈에 볼 수 있어요.',
    '순위표에서 다른 사람 이름을 누르면 그 사람 프로필을 볼 수 있고, 친구 추가 버튼도 생겼어요.',
    '온라인 대국을 시작하면 상대/내 닉네임과 프로필 사진, 스킨이 반씩 보였다가 내 스킨으로 바뀌는 매치 인트로가 떠요.',
    '프로필 사진을 직접 올리고 바꿀 수 있어요 (계정 화면에서 설정).',
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
