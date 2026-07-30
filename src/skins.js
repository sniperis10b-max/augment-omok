// 바둑판과 바둑돌의 겉모습을 바꾸는 스킨 카탈로그예요. 지금은 개발자 계정에서만 고를 수 있어요
// (settings 자체는 이 브라우저에만 저장되는 로컬 설정이라, Firebase 계정 데이터와는 별개예요 -
// "내 계정만 열어준다"는 건 UI에서 개발자 계정일 때만 선택 가능하게 막아둔다는 뜻이에요).

import { CARDS } from './cards.js';
import { CHALLENGES } from './challenges.js';

// background-image는 색상값(#fff 같은)을 그대로 못 받아서, 단색 스킨은 그라데이션으로 감싸줘요.
// (실제 게임판/돌 렌더링과 설정 화면의 미리보기 스와치 둘 다 이 함수로 통일해서 써요.)
export function toBgImage(value) {
  return /gradient|url\(/.test(value) ? value : `linear-gradient(${value}, ${value})`;
}

export const BOARD_SKINS = [
  {
    id: 'classic',
    name: '클래식 나무',
    background: '#dcb35c',
    border: '#b8903f',
    line: 'rgba(0, 0, 0, 0.35)',
    questDesc: '기본 제공',
  },
  {
    id: 'darkWalnut',
    name: '다크 월넛',
    background: 'linear-gradient(135deg, #6b4a2f, #4a3120)',
    border: '#3a2718',
    line: 'rgba(255, 255, 255, 0.18)',
    questDesc: 'AI 대전 50판 완료',
  },
  {
    id: 'marble',
    name: '대리석',
    background: 'linear-gradient(135deg, #f2f0ea, #dedad0)',
    border: '#c7c2b4',
    line: 'rgba(0, 0, 0, 0.25)',
    questDesc: '무승부 10판 달성 (AI+온라인 누적)',
  },
  {
    id: 'deepBlue',
    name: '딥 블루',
    background: 'linear-gradient(135deg, #1e3a5f, #0f2138)',
    border: '#0a1826',
    line: 'rgba(255, 255, 255, 0.2)',
    questDesc: '온라인 대전(친선+랭크 합산) 20판 완료',
  },
  {
    id: 'emeraldFelt',
    name: '에메랄드 펠트',
    background: 'linear-gradient(135deg, #1f5c42, #123a29)',
    border: '#0d2a1d',
    line: 'rgba(255, 255, 255, 0.18)',
    questDesc: '랭크전 골드 티어 최초 도달',
  },
  {
    id: 'roseGold',
    name: '로즈 골드',
    background: 'linear-gradient(135deg, #e8b4a8, #c98a7a)',
    border: '#a8695a',
    line: 'rgba(0, 0, 0, 0.25)',
    questDesc: '서로 다른 친구 5명과 각각 온라인 대전 1판 이상',
  },
  {
    id: 'midnight',
    name: '미드나잇',
    background: 'linear-gradient(135deg, #2a2a30, #121216)',
    border: '#08080a',
    line: 'rgba(255, 255, 255, 0.18)',
    questDesc: '자정~새벽 4시 사이 대국 5판 (AI+온라인)',
  },
  {
    id: 'pastelMint',
    name: '파스텔 민트',
    background: 'linear-gradient(135deg, #d5f0e0, #b8e0cc)',
    border: '#9bcbb2',
    line: 'rgba(0, 0, 0, 0.2)',
    questDesc: '온라인 대전에서 무승부 제안으로 5판 마무리',
  },
  {
    id: 'aurora',
    name: '오로라',
    background: 'linear-gradient(135deg, #7bf1c9, #7b9df1, #c97bf1)',
    border: '#5a8fd6',
    line: 'rgba(255, 255, 255, 0.2)',
    questDesc: '랭크전 티어 승급 15회',
  },
  {
    id: 'lavastone',
    name: '용암석',
    background: 'linear-gradient(135deg, #ff6a3d, #7a1f0d)',
    border: '#4a1206',
    line: 'rgba(255, 220, 180, 0.3)',
    questDesc: '파괴 계열 카드로 상대 돌 30개 파괴',
  },
  {
    id: 'galaxy',
    name: '은하수',
    background: 'radial-gradient(circle at 30% 30%, #4b3f8a, #0a0a2a)',
    border: '#1a1a3a',
    line: 'rgba(255, 255, 255, 0.25)',
    questDesc: '온라인 대전에서 완벽한 승부(카드 없이 승리) 10회',
  },
  {
    id: 'ancientRuins',
    name: '고대 유적',
    background: 'linear-gradient(135deg, #b8ab8a, #8a7a5a)',
    border: '#6b5d42',
    line: 'rgba(0, 0, 0, 0.3)',
    questDesc: '100수 이상 대국 10판 진행 (승패 무관)',
  },
  {
    id: 'chessboard',
    name: '체스판',
    background: 'repeating-conic-gradient(#2a2a2a 0% 25%, #f2f2f2 0% 50%)',
    border: '#1a1a1a',
    line: 'rgba(255, 0, 0, 0.3)',
    questDesc: '온라인 대전(친선전+랭크전) 총 100판 진행',
  },
  {
    id: 'glacier',
    name: '빙하',
    background: 'linear-gradient(135deg, #dff6ff, #8fd3f4)',
    border: '#5fb0d8',
    line: 'rgba(0, 60, 90, 0.25)',
    questDesc: "'얼리기' 카드 100회 사용",
  },
  {
    id: 'desertStorm',
    name: '사막의 폭풍',
    background: 'linear-gradient(135deg, #e8c27a, #b8862f)',
    border: '#8a6320',
    line: 'rgba(60, 30, 0, 0.3)',
    questDesc: "'소용돌이' 카드 100회 사용",
  },
  {
    id: 'goldenTemple',
    name: '황금 사원',
    background: 'linear-gradient(135deg, #ffe27a, #a67c1a)',
    border: '#7a5a10',
    line: 'rgba(80, 50, 0, 0.35)',
    questDesc: '랭크전 200판 진행 (승패 무관)',
  },
  {
    id: 'dawn',
    name: '여명',
    background: 'linear-gradient(135deg, #ffd6a5, #ff9a8b, #a5c8ff)',
    border: '#e08a6a',
    line: 'rgba(80, 40, 30, 0.25)',
    questDesc: '오전 5시~8시 사이 대국 30판',
  },
  {
    id: 'ruinedBattlefield',
    name: '폐허가 된 전장',
    background: 'linear-gradient(135deg, #5a5248, #2a2620)',
    border: '#1a1712',
    line: 'rgba(255, 120, 60, 0.25)',
    questDesc: '상대에게 돌 5개 이상 파괴당한 판에서도 승리 10회',
  },
  {
    id: 'nebula',
    name: '네뷸러',
    background: 'radial-gradient(circle at 40% 40%, #ff7ae0, #4a1a8a, #0a0a2a)',
    border: '#3a1a6a',
    line: 'rgba(255, 255, 255, 0.25)',
    questDesc: '확률형 카드 성공 누적 150회',
  },
  {
    id: 'firstSnow',
    name: '첫눈',
    background: 'linear-gradient(135deg, #ffffff, #dce8f0)',
    border: '#c0d4e0',
    line: 'rgba(80, 100, 120, 0.2)',
    questDesc: '무승부로 대국 50판 마무리',
  },
  {
    id: 'alchemistBench',
    name: '연금술사의 작업대',
    background: 'linear-gradient(135deg, #6a4a2a, #3a2a14)',
    border: '#2a1c0e',
    line: 'rgba(180, 220, 120, 0.3)',
    questDesc: "'연금술' 카드 100회 사용",
  },
  {
    id: 'plagueGround',
    name: '역병지대',
    background: 'linear-gradient(135deg, #4a5a2a, #1a2a0a)',
    border: '#0e1a06',
    line: 'rgba(140, 200, 60, 0.3)',
    questDesc: "'오염' 카드 100회 사용",
  },
  {
    id: 'errorBoard',
    name: 'ERROR',
    background:
      'linear-gradient(88deg, #ff2ec4, #ff2ec4), ' +
      'linear-gradient(93deg, #7ee8fa, #7ee8fa), ' +
      'linear-gradient(85deg, #4a6cff, #4a6cff), ' +
      'linear-gradient(97deg, #a855f7, #a855f7), ' +
      'linear-gradient(90deg, #ff6ec7, #ff6ec7), ' +
      'linear-gradient(82deg, #2ee6ff, #2ee6ff), ' +
      'linear-gradient(95deg, #ff2ec4, #ff2ec4), ' +
      'linear-gradient(80deg, #7ee8fa, #7ee8fa), ' +
      'linear-gradient(89deg, #4a6cff, #4a6cff), ' +
      'linear-gradient(91deg, #a855f7, #a855f7), ' +
      'linear-gradient(84deg, #ff6ec7, #ff6ec7), ' +
      'linear-gradient(150deg, #2a0a3a, #180620)',
    backgroundPosition:
      '2% 3%, 55% 9%, 0% 19%, 30% 25%, 100% 33%, 10% 44%, ' +
      '60% 51%, 0% 60%, 40% 68%, 100% 78%, 15% 88%, 0 0',
    backgroundSize:
      '22% 2px, 15% 3px, 130% 2px, 10% 5%, 140% 3px, 25% 2px, ' +
      '18% 4px, 12% 3%, 20% 2px, 135% 2px, 28% 3px, 100% 100%',
    border: '#3a1450',
    line: 'rgba(255, 46, 196, 0.25)',
    questDesc: '???',
  },
];

export const STONE_SKINS = [
  {
    id: 'classic',
    name: '클래식',
    black: '#1a1a1a',
    white: '#fbfaf6',
    whiteBorder: '#8a8678',
    questDesc: '기본 제공',
  },
  {
    id: 'onyxPearl',
    name: '오닉스 & 진주',
    black: 'linear-gradient(160deg, #2a2a2a, #050505)',
    white: 'linear-gradient(160deg, #fffdf5, #e8e2cf)',
    whiteBorder: '#c9bfa0',
    questDesc: '흑으로 10승 + 백으로 10승 모두 달성',
  },
  {
    id: 'neon',
    name: '네온',
    black: 'linear-gradient(160deg, #ff2e93, #7a0f47)',
    white: 'linear-gradient(160deg, #39f3ff, #0b8b96)',
    whiteBorder: '#0b8b96',
    questDesc: "'메아리' 카드 성공 2회",
  },
  {
    id: 'goldSilver',
    name: '골드 & 실버',
    black: 'linear-gradient(160deg, #caa243, #7a5c14)',
    white: 'linear-gradient(160deg, #f2f2f2, #b9b9b9)',
    whiteBorder: '#9c9c9c',
    questDesc: '랭크전 플래티넘 티어 최초 도달',
  },
  {
    id: 'pastel',
    name: '파스텔',
    black: 'linear-gradient(160deg, #9d8ce0, #6a58b8)',
    white: 'linear-gradient(160deg, #fff3b0, #ffe27a)',
    whiteBorder: '#e0c460',
    questDesc: '친선전(랜덤 매칭+친구와 플레이) 30판 완료',
  },
  {
    id: 'woodTone',
    name: '우드톤',
    black: 'linear-gradient(160deg, #6b4226, #3d2314)',
    white: 'linear-gradient(160deg, #e8c9a0, #cca774)',
    whiteBorder: '#a98552',
    questDesc: '100수 이상 대국에서 승리 5회',
  },
  {
    id: 'rubySapphire',
    name: '루비 & 사파이어',
    black: 'linear-gradient(160deg, #c22b3d, #6e1420)',
    white: 'linear-gradient(160deg, #4d7ee0, #1f4a9e)',
    whiteBorder: '#1f4a9e',
    questDesc: '랭크전 루비 티어 최초 도달',
  },
  {
    id: 'monochrome',
    name: '모노크롬 그라데이션',
    black: 'linear-gradient(160deg, #4a4a4a, #0a0a0a)',
    white: 'linear-gradient(160deg, #ffffff, #cfcfcf)',
    whiteBorder: '#aaaaaa',
    questDesc: '칭호 10개 이상 해금',
  },
  {
    id: 'crystal',
    name: '크리스탈',
    black: 'linear-gradient(160deg, #3a2f6b, #1a1440)',
    white: 'linear-gradient(160deg, #d8f0ff, #9fd6f5)',
    whiteBorder: '#7fc0e8',
    questDesc: "'낙인' 카드 50회 사용",
  },
  {
    id: 'phoenix',
    name: '불사조',
    black: 'linear-gradient(160deg, #ff8c3d, #c22b1a)',
    white: 'linear-gradient(160deg, #ffe27a, #ff9d3d)',
    whiteBorder: '#e08a2a',
    questDesc: "'복구' 카드 50회 사용",
  },
  {
    id: 'shadow',
    name: '그림자',
    black: 'linear-gradient(160deg, #1a1a1a, #000000)',
    white: 'linear-gradient(160deg, #6a6a6a, #2a2a2a)',
    whiteBorder: '#3a3a3a',
    questDesc: '감시자로 상대 효과 50회 무효화',
  },
  {
    id: 'hologram',
    name: '홀로그램',
    black: 'linear-gradient(160deg, #3df1ff, #9d3dff)',
    white: 'linear-gradient(160deg, #ffffff, #b3f5ff)',
    whiteBorder: '#7fe0f0',
    questDesc: '모든 카드를 각각 10번씩 사용',
  },
  {
    id: 'windSpirit',
    name: '바람의 정령',
    black: 'linear-gradient(160deg, #a8d8c8, #4a8a7a)',
    white: 'linear-gradient(160deg, #f0fff8, #c8ecdf)',
    whiteBorder: '#a0d8c0',
    questDesc: "'봉인' 카드 100회 사용",
  },
  {
    id: 'steel',
    name: '강철',
    black: 'linear-gradient(160deg, #5a6470, #2a3038)',
    white: 'linear-gradient(160deg, #e8ecef, #b8c2ca)',
    whiteBorder: '#9aa5ad',
    questDesc: "'강화' 카드 100회 사용",
  },
  {
    id: 'mirror',
    name: '거울',
    black: 'linear-gradient(160deg, #cfd8e0, #8fa0ac)',
    white: 'linear-gradient(160deg, #ffffff, #dfe8ee)',
    whiteBorder: '#c0ccd6',
    questDesc: "'복제' 카드 100회 사용",
  },
  {
    id: 'cursedDoll',
    name: '저주받은 인형',
    black: 'linear-gradient(160deg, #4a1a2a, #1a0a12)',
    white: 'linear-gradient(160deg, #d8a8b8, #8a4a5a)',
    whiteBorder: '#6a3a48',
    questDesc: "'낙인' 200회 누적 사용",
  },
  {
    id: 'obelisk',
    name: '오벨리스크',
    black: 'linear-gradient(160deg, #6a5a3a, #2a2214)',
    white: 'linear-gradient(160deg, #e8d8a8, #b8a068)',
    whiteBorder: '#9a8850',
    questDesc: "'성역' 카드 100회 사용",
  },
  {
    id: 'crown',
    name: '왕관',
    black: 'linear-gradient(160deg, #3a2a0a, #1a1005)',
    white: 'linear-gradient(160deg, #ffe27a, #d4af37)',
    whiteBorder: '#b8952a',
    questDesc: '불가능 난이도 AI 20연승',
  },
  {
    id: 'invisible',
    name: '투명 돌',
    black: 'transparent',
    white: 'transparent',
    whiteBorder: 'transparent',
    questDesc: '모든 챌린지(핸디캡) 클리어',
  },
  {
    id: 'twins',
    name: '쌍둥이',
    black: 'linear-gradient(160deg, #8a8aff, #3a3a9a)',
    white: 'linear-gradient(160deg, #ffffff, #c0c0ff)',
    whiteBorder: '#a0a0e0',
    questDesc: "'복제' 카드 30회 사용",
  },
  {
    id: 'frostbite',
    name: '동결',
    black: 'linear-gradient(160deg, #2a4a5a, #0a1a2a)',
    white: 'linear-gradient(160deg, #d8f0ff, #a0d8ec)',
    whiteBorder: '#8ac8e0',
    questDesc: "'얼리기' 카드 50회 사용",
  },
  {
    id: 'swappedFate',
    name: '뒤바뀐 운명',
    black: 'linear-gradient(160deg, #e8e8e8, #2a2a2a)',
    white: 'linear-gradient(160deg, #2a2a2a, #e8e8e8)',
    whiteBorder: '#8a8a8a',
    questDesc: "'위치 교환' 카드 100회 사용",
  },
  {
    id: 'taxidermy',
    name: '박제',
    black: 'linear-gradient(160deg, #6a5a4a, #2a2018)',
    white: 'linear-gradient(160deg, #e0d0b8, #b0987a)',
    whiteBorder: '#9a8262',
    questDesc: "'낙인' 카드 30회 사용",
  },
  {
    id: 'reverseEngineer',
    name: '역설계',
    black: 'linear-gradient(160deg, #4a4a5a, #16161e)',
    white: 'linear-gradient(160deg, #b8c8e0, #7888a8)',
    whiteBorder: '#647092',
    questDesc: "'관통' 카드 100회 사용",
  },
  {
    id: 'errorStone',
    name: 'ERROR',
    black: 'url(data:image/webp;base64,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)',
    blackPosition: 'center',
    blackSize: '100% 100%',
    white: 'url(data:image/webp;base64,UklGRoJAAABXRUJQVlA4WAoAAAAQAAAAxwAAxwAAQUxQSJsIAAABsG1r2yK30ftDlaxWJIOOgndAhrXkAbc1zCFlTOFbYHnZZ5bhxLkE5kTxMI+WJQ9YQ0lGdzCkI2PbbXfV9//feyDurvp7eEXEBKBSvbdY/uF9+/bve7xD5WoD5/cd3PfIvp1Y3nuHFDUu8wCGGlve/OD9M9zQy++///4LjeFBAJm3Ji2cx9KHJk62WzdIMsjStaks5dL2jcsHJnYAgPEmFYzLgKwxOX2Gy4qIcENVRCKXtt47s7cBILOm/pwHgF0TZ9skpQyqyu5UVSlJSvvExBYAxpt6y4CscXj6MkkVYderCEn+YXq8AcDVlvEW2DVxtk2yjMpe1VCSZfvExGbA+1pyAEbfapFUUfZ2EJL8aHII8LZujAc2Txxvk2VUVqGGkrx06AEAvlY8MDT5EUlRVmeIJL+718Db2rDA8KELZBmU1aqlUGcfAGDqIcPQ5EdkDKxiIfndcQNffc4Cuy+RJSs7CsPsMOBNtVlg9K2rDIFVLsqPXhwCTIUZg+2nrpPKqo/khUMjcJXl4fa2SFFWf4jk+a3IbDU5DM8GCuuy5I1jgKsgO4AX/0RV1mcgv9fEQOU44BgZWasq7IzBmGoZQPN7jIF1W/Dq24PIKsQYjHUorGEl54bhKsNi8O2rLFjLWvCjF5GbanAYmSOVdR3JY4CrAOOw5Tw7yvoOwqODsL3ncewGI2tdAy/vRtZjJsdRMrDuA1tN+N7ymGKhrP/IzhiyHjI5jlCYhCG2mvC94zHFQtOAkZ0xZD1ichyhMBlDbDXhe8NjioWmAyM7Y8h6wOQ4QmFShthqwnefxxQLTQtGdsaQdZvDUQqTM8RWE667vJtioenByM4ea7vJYohRmaIFZ7DJdI/FyGwRmKZSHIPtGuM3zzMwVSOP5r5bNuEVFkxWvcnPI+8Oh+ZioenCGM8NwHSDtXs6VKZs4NytuemCAcywYNre5FPIN87jWCFMXJWrY3Ab5fEMI5M36tW7vdsYm40sSEgfljwNvzEO5xmYwsJn4DfCYTcDkzjIwkhm18/Zu6+WMY0YeB4bYU5TmMqBTdj1MnaUqskkcSbP1yvDy0GYzmXxefj1cdnexaAJFXluszPrYSyuMTKlha8gWw+PZ6IwqbVYvNu4tRl/64KGtKLw9Hp49zRLJrYqR41ZizG4oJpalPAysrV4PKOBya2yeLdxqzP+roUUo/ClfA0Z7mfBBFclYFblzIkoadbeA7saY0ZJTTEKZ/JsNRleDsI0L4vPw6/k7GcWgyZa5LmGMStk+CYLJrqSwArGNM5qTDWG4rD1KwCkJlvJ7yFfztvDRWCya/jLZ6xbJsf3WKYbC34T2RJnP/OXoAkX9WzDGAAZvsmCCa8kYABjGmc1phxDcdh6wACkJl3J7yEHPCaLwKRX+ctu65DhJ5S0Y8n98Mjch+mnB+A9Hg4lE195+RZ4fJV9wA3AuZOU5NNOExgiNfUo/AmwqdUXvA1safcFHzq8SWH6S5jAdH/A/XivT3jEfdgnPD4RhH1hZz/7BO77l8MjfcPjfUOH/2936Bv6x3lqn/BVSp9wsG/Y1zd8W/uE8Bj7BH76b0H7AOU83qD0AcKv2vf6Az2AH/UHfAwvhJB+Gv72aeA6NfmEbwDDN/uCMxaNS33Bm/A4oGXqKa9tgcd+9gEchLO7/x408SLnBgwyvE5JvDJ+ER6Z/UX68XF4WDTbqkkX4q9vdwYGINOu5A+QA3D5iSgpp9oeNxZAhvtZJB0JGADG3fXrGBJO4oncYWmOH7BMuIL3I1vGmvG2arKF+Ou7nFnGAGS6lfwBcizv8hNRUk21PW7sChnuZ5FuBMwKxt+1oCHRhC/lDit7PJNqKot3m9UYi4vUJBO+ggyr9e5RlimmvLnNmtXh/iLN4sVNWB0yPxMlwUo+BY/VWzQZ0yvowq3erAEWc4wJ9gw81urt54sytVQvwJg1IctnoiRWyaedx9otmgxpFWThVm/WARbnGZJK+Aw81iUbWYghoYSn4bG+Hs9oQqks3u3dOhmDC1GTScLLyLDe3j3NMpWUHDVm3Yy7dbYMiSTFlHFYf4shUpNIOIMMG+ndVCEppOHKHms3BBlmWCTQTT4Fj421dk+HmjyBc7fmZoPg0FwsNHFiPDcAgw3fhFdYJE6Hn0eOjTd+ZJ4haYRHc49utGZkQULClDwNi+7M8AzLdAmxdbd3XQKPYwypouyMwaFrcxwJkiZaLDbh0b3G4jpjkhR8BZvQzS7f24ohQUrOb/amq+Aw1mFMDuHcMCy63KPZiiExSs4PwKLrM4x1GJNCODdsHXrQo9mKISFKzg/AoiczjHUYk0E4N2wdetSj2YohEUrOD8CiZzOMdRiTQDg3bB162KPZikX9aYfzA7Do6QxjHUrdKTk3bB163KP5PcZ6C7z69iAset4BU+zEGivZGYMxqEA7gCNkqK3AVhMDqEiL++fYqafY4antyFCZHgPzVK2hQB4FLCo0x8jBGyxrp8O5+2EdKtUAzRZDrBVRzg/Ao2pNju0nyVgfKrxxcAQ5KtgCk3+iSj2okN9tAgaVbB2GZwMl1oCQ7SnAG1S1hxn/LilacTGw9dYoMosKNwAemCOl0kry5HbAouJthsG3W6RoRYVIfjQJZKhBb7D95HVSKkhZkhcODcNZ1GMGjL7VIinVokLyo8khwKM2nQW2n7omlFghQrYvHBwGvEGtZsDQ3u+SVNEKCEKy9fZoA/CoXWcBPDB7nWQZtac0lGR57dR2AN6glq2HbxyevkxSRXskCEn+YXp8CMhgUNseAHZNnG2TLEW1u1SjlGTZPjGxBYB1qHfjMiBrHJ6+wqUi0h0qIlz6h+nxBoDMGiSg8wCwY+LA5baSDCKyMSoiJHm9PfvQvmEAxhsko3EZgFsazQ/eOcOuvPz+9JtbGhZAZg0S03mPZR/ev+/xDnXdAuf3Hdi3E8t6b1CZAFZQOCDANwAAUI8AnQEqyADIAD49FolDIiEhGSo+qCADxLYGUV2gB/ABnng4/K/xm68jK3Sfyy9ifkPrG9d/bP138otHd5J/F8kr4jvlf43/wf4//H/AH85/8z+9fAF+nv/E/wHta/1P7ae5n+if6D/0/sd8BP5Z/Y/+t/ev99/+PnK9C/+b9QD+x/77//9gf+8nsD/t56aH/x/4v/Q+Uf+0/7r/2f6z9//oh/bD/1ewB/1fa7/gH/o4jz+Ueezwi/HfjN+5nqn+R/SP5f8zv8T7eOLfrr1I/nX43/lf4z0E/6n+H8VfzP9b/4HqEfjX82/zP9n/dz/D+7P8J/3f8n3g+c/4T/sf5D2CPXH6D/sf7l/m//j/kv2q+j77zzd+1vsAfrv/2/LG8JL8x/0fYF/qH+T/4/3XfTF/b/+T/X/mh7sPz3/Pf9j/N/vb/jfsM/m/9q/4n+M/eH/O////r+Uz9qvZK/ZR1ujlEwLbJRoyX0ugUu+9ATvZpkpgEMW34NA0rIaVpa7Fu2kwr9iZ/tuAsnx9eu0HK7nULdYOLUukS2KkVvjdrKeDhI9v5rUdCpLKlZQ4nlsPfppNcJN351cr5nqJ2h4LsLxNFNaduoCVUycOogCicT8eGaEu64mEBAKpNWw+fNqLMncvvTNMzrTf1xDEXFRTIv2vj5Dpdlz/3dtnFl9kDr1eaV0+PVOodns2z3u2aXyqo4fzb/tgs74ywLSg6qEYq8JwscrCYBb+oDVSNcsIiVOlbm/JVSFm/Ihp8TNrceZOGM8+Pnh5HQKTuA7sbgHKOKDS1eUxiTKyf/S6zuWzAZCPVWGDBtEuGx4EFEhCddSGNe6cVrZwn27ruV7fNa3FFxo9ia149Ls2c2fihns7eJnN+W+iWA0CvjLIj+dlRl8AOjPnJM9g4SncWFsThlpfry5/6X0vyYFrtDT/pKzL21GiPo2XEGcTPVm7+ur9Opvo9E+5zhTPfudOAWAbWi2mxWLuHgnPph7xnp4ZUWSLqRxyCz36+e7AXxANAm9nUF0FYneDIh9+unHPoEGLdrUhlG+4BZvLZiVVTN4Vs5CWiAcxIh5Lm8YTPcuqwkn1lIXczLhmgyiILIRuNzrUi9WRX3rpyfrvSfDg0DqDLOew3UFs4ucCKeGRT0Xf/ngg5b4YU8YTpTt95pTl3EqzGLBlPE07ZeQWYfrF8xCo/bk+e0f6wDwU54csRkW6wLG+ekTTwXkJaJZXz5DQEExmGi3kLb4LXQuS6t3zim2FlUQPksQrTJvGmZ9J6DmuGEtd5t3Z7kOSnDO3SWTwB3Efp/Jt9Js6X1FcE2BtseTG+wIZOOGvEUAgQgAvnQUbenpFS6qFRtLyxjappgZDdWLFxvkmbM37achjDgyNHIobgqNzuyAR1MxDdyeHOdVWM7hjckh8Ufny6iIvefUx/d3wnigM05hPPBFdDPv3ojkiZ83BIbKCF96da37T5FE7Zlcn9eAYxQPD24PilgzF4bprp//COQ5C6TsBJKQFOAAe3qcyjUaPYiKbt1oSzk6XdHmj4K8wqO0gAP64ODCG0X04Vh35BI/RQydWmGXp4SXScenCsGXLfR6+rbKazhk9QjU7smAGHEMcK333tzPTJOuYmwJSzTpehPJ4LbDo/qqhVeaAqjIUspvC8eEhvTQl4DXyTi2QqnvMbrJ8AxLwz1IWtRfJpoeYYOUYEwMjPrMjirzOq444uVCuWOFIIJPLCo6pHc4QTpk8LXNvfeg9NFGcnebpx4cGW6QXLRh1kzJr15Y2EeRZaqDdT7TI2xnWYvNWtvtkmYKVrveykBZnC99RRxs8h9UcKf7SlY8Mj9EI5RU8aiIOBnyQ00t8JYIn5G0S0pHiDYmmRzBYZqrkU70pBEiFssXC3PLJ7rk8irJAHmMS9Scg2xvza008uY3lu1X7YMLluWVpGVS2bX/9FBpZ2gsTPyRc+Sb1ve5SCgozE8pxqEJY69C9OBkMc9PQFuvHwatHbJvIrNw1fyx9UGQHFBz/kRb2STfgVhilXsiVPK4Nwk1lqsY5LVCh5Yp6tfs1OKiD3VLaViSUflTzpvqPNthoMTUv24zV8Z04kfsF1VBfBTFRV1jRGiSkxU0rjsRExMPz5o+D17WB8ozC7vhFpV78yRTKioArf43+UZmh7C/ZX5u6EGISxDYGfxGFoPOL4/jE2y57gLJZ/29BgUlbGcvRCBSiepKnIVDuz6aP8pm7Uo3m6NY6hs3QzocLJcheqt2s8Nvck8lhg9ZNAhMIGVRY5tVdcsC3SgdoadVUMOgg7mZ7ch6jyEqbhAiOxo4p1CIE6nRqhSDPWD+Rnab9u9OVI2dCSthsWnwz4Bj6SLNdiS8KarnC0boFjF0kfin/8No8SngbAjzI5s6kdKg/kYF0/kkZqljXQQBfKPb4eIgIw6Hq/Pc7fhdMm0kyX9K9bVuHPGwPT0r2f+1A1d7eGMwdpVfD+kPDFI2OCVnGqhzC22I+ookjqve3PPQ/51CqxEiTVzYTzwAmVpMhrLmp1pfoMUkHYC67cGNLn+05E9sWPOybgs+5X7Ue9Ub3rcJwmEVeuXx0/qLZh8Lsq+Cu28Ewhrj5QJizctJaPVHJZ8vaZpxl3cyIVWFB62ASKdUXmiXSso59urlKUgDOKhTAuGZ5f5Rnm62Y6QArGafscjSVc3GW4QytW0eD+RGyGFQkUGEb+DgXZddQaPdP9cEJFTqXEpl0cVvSYNLygrCNWukoTeSaEjUEhxpcTR5G+Fu/20HVVq6sVNl21RzqrZerky5nVtAsGKu7lB0BvLPTR6QGt754/wwmM6arkdopnN9LpsPdFhDOGKdOhMKQWMOwDTFw0ICH9NmQ96nil2HjmoKt3kilM9pi+cC4mrWtQI4Ze75bo6kONlJS5V5HdWxadrmCVGm1NnG3jnKnEcWZAa++4cryEGWnQMhXgKLX9uweEIR4svtUi+XtD2Ubc3tz9SyK2TW9MX/jQhUtro5ksoFbnzgOMWy86czLOkEkDAb8OcT0pGuWMg+AI8P06gpv490lWkkFSfOW69AswjPIXK45MGugNU2chmGpVITfJtcjLAXtqZ34tujJ4xScMInPzucCUeyRz4mz4CM7e8EEQqOjd9rXIgpXk7OF0EXgRiZesMlsg8RH1KlCuEon1ysfVx0HVaeLmcFTv8xX/jNP43MEFwTEB0UDgEt38xvCcPazrCTE2vm6l69Yo8gZ2To9uL0+o8EKxpuO3NEbRtdvxFNOtVpxl2qoQDfka+Qq6ZAWQ7gATbbLtvxO4IIxywd1MBw0PRH0v9TFzRB0lhV0ievR4VD2ol/9G/O03oVLdzjxq9hfukb6i9LM/+xaRQGr5Fvsmw9pUcbH5ZXEyFAzuEWFerMqT5BLXe+5CDNirVQ4aA65sJg7xJnWK54s9MsNTSa5JSdMNG4+1/z085d3UZdshXxx8DKyM4OszXLbwG8zJJ6dHhE5cNaZoBlVcb8EsUnZAzaddQ+LAIIbNiFtv9v5CrebwBTDVfQMDu0RYvSKt0tDr2pmRbWdlZTIsrIUsX9ssN/pNDbXmfDQIyUGUrlq1yDEuPpIHmB+OVi0sNBJbM9TRzKcK+qHuU3pErgAC/WLK9uUckZZK8Iffv+otdK/psBG+yIKg6oDm4zdN1M2qkaJkDCqcfJjbFG4yn+TsaFnzxUOyFJRoRX+TMG8VnDMDouKTCVTLmDf9F+JC/en4IuY0VUmp29nRundSn0x5Bzpc7fkrg336MppiQmai/0U4xiBztvwXljyTYSMowQ6rv/UVDY+J/v8V8x1rs6SlcGcXrNR3euse1Jp1BQbqXRR26BnsFtdharDA5CP/PuTBRp69X4OJjYP9OM5VcKVei51oEOyr9m73P21ULFjlCgRURcWq+AviZ6O7l/sKrMGHpeqyGJ+S0G5PNccLyGda6nfSRkLhQIIbBATVfn8uh+R94GMPDg8A6x4isJXVD/qZ6aoSXALn4zavOiajS7yfMkDZR/WsyZWNdBUC7pkcTCWdMGIofhPuE3iUbZx/yuaFId9MAyx5fZ7MTF8jnhHtJe7El2iTTTZDE20GUpzvBPFk2jvGRjxTga+Z81crQFTOGDYUghKwQo16pVJGFYZyvzHpgDkM4WW/0aX2hjhsIELRCEvlO22aecJtoMOSRhSYwA0d5H2lhfvPfDsjewzPUmYgWU/z53BQ2XmUAxA2fAKkUdJYyuKWBPMOgkcPLeye68U7AFEnSOwg8zBCvOrMcpEouZ5Mv1LPRMk3jZLAwK9tZ+oqt9QckaL9M+Hu9uaJFnDNGSiirJeamtT7DJpOJF9145Uq13wWXS7zazOEUrORVzNLTKEj1gNYkOxyAIGvtRndDyudR+eZ06JWzZx6jJZCJ+Iohf2+xJfGVFhmIZj6JFqyRY8hK8rLi99ORClFFXvrXhhdgWr/q7/V4Mjs2ak/CIfiiZRAhQohhYp+1zQjhiWRa3LRReDIuLRF2kCvlC23suqDZatm8K7Q6K4hiL4MSvLdl1tNJRBUTxJe7vgJ7r4yPSpMzP+9uaSKj2ma3qYp0Ph49sUWRoZnN/crewW3Lx/3478QFcOKuVdGBxMAx64dCVtSfkdkl4hycnZQC9eV9AKFPFtZ+qk7OvwgroBvVWqhvRWjg508RiorKTX7XN7CTvChCkxvZhNg8US83sVeMj+Od7mxOxKFiMUhwz+bzwyiAddD4gexVGzI0AfXkKeWN9nwHVaDD9JamGgybUOiq0T9wLuJ30BxMEyhpeQ1idhyu33H3gM28py4abITpzqq+rGPrRd2gI+d9YkK8a+EKNlCGxtoUM6bLp9JanW1QO/JWcovt/s4i5PmrLSH7uRsmcukDPY5Z7BSqegIv+rldhb1bla49eU4jPXrJ7IRZ9GCaZ7t0sS+kJducx8BCKQNO8wGSsrS4WDhVgGg+YwiD/5bcIe0HZDa5xXTdtYC3iIN10LFWeWSgQj02zdiiVHWfEuwgzsPA+axsFSZ25T/KR6DD/fK2x0QXZ3NxajlHOy7q9M0XdIkWIBjWl5360J9cA9b8l0DHBWO1OykL3toaizZZHDIOVfOPeu/ZHJJD5CVVlxep3cyLFM+TvAex2tOdIU6P/tQcjbFeds/6qWfAr6QskdXf+JF7Ee1lUP5vJ5VEPq4NTgoxR9ssgee03TsSBKiGNylPqzLExcJHKZcpVmBrZZpmS9AQuylKtMX22bKFCg3Ft4+7QhJyU03XEZBXm11VnbEfuayzFWHKogVAxDewdl3l2iRHA4gipJUnziSc+1wts7OGTU4smKMOnXLpTtcG/dicHFZwLoxHs40d4OyUPvApWtR9Et0BX1Up175LxbJCLUtv2bBIDof5n1ZfIZ+Sh6rCH5nIDMdnpabWHp8NDqlRFpkMNyC9llamue0XnkDKWeV6vkpmXgNCmdIu1KoG1d+saUR8faxqOHzvKmrLm9TnDFcOTsGIbd2HyKkVLKb4fpnF95kLaIyIAHpjaDg/KiHGDOrrQvPYXgyTZDbPa2fPhM1NL4w0RKa25YEYA7YrvgbbGvFWsFxPL3Ms4mvsw+TJInOp8gN5XW0IlDYaY4ha4yTr0theQr4f2cWVMjgAlrzXaT2/skm/yXK+4UNKpM9TTG7QDViy7joVWHxk6ZzPHhFcPyN5PXu1g9/8iSS4pkDp3v0Lbr2ydj7WNUY8ja6AJaszKA8fljH7p31dQYJBlxXfAmjBDQ0OGZ8M0MyPXeRW1iPBuU9SnqAoNnFF+PlEok4amxnTtRQtfYmVEs0ynIsbWE2FjTrDlGMVpVS77+/+nCy67EFnOjqGSew9/zptGt3Q1brIMwIFZb6jSI1npXWPT0zu2U14GGF5Mj8DMpXZvfHHWNurHrs9WwMGmgHHvHGyT9HfL8VeXIKru5+JL+0lyl11ANm7Iies7xjQ3okRb2mjrg2GQZ77KQRR/ACzrsldWBGKYrw32Cfsj+ntSUaOWDokwnl9l3chGDoM3FlSiIloV2ckPrzuGvMrFf3MNbC2bItcY1x1rzBvUGmfDnd9JeF3nR0fcMdCBsdpsZpaH7X8nz89jCIImr7G1gPLoGcSa2UnpUsGkgp8d4WL/foe2xWkzwA5zybTupVghoyrAcXIw5BS6eTiwhpfJDk/Fdk8HjXq6IkLTbtwZU1yyMkMhXGhbiKxigP7/vbvKok6DfLfkNFYvV7aOsNlECMjIqUwDCBrzIDncO0PvGYaB+LYqBk8kyqAvW+Xg8R56/dIooKRhgAPqHN91UjlT43nZofneVgO9m8V5bq4GYatC/87eexD5RGp+QZSL2hG1yAW6OAIky6OMZrRiP8MYPni4MiWRo3AMsDoMN+O+rPQ67HApAy42RaVBtpm7ZwaxVtoNd8tMpvz1+FrCVnZSBjxMr0yuZgiDvE6F3OrXYuReRB6y275xFv+hyCeQ8JQSbSOTeYQ308zyCRtw6K1UE1STIndbN0DGW5+l+Zt0DNabLTwIThDw0FW/y+8Y+eXlLnAFcrs+liFRRvENsKbCXJ4KA1CwpSiyzSEEVXKU3UUC99jCZlguNjXGdCILQPfoXyJZuTkD/BHG6fo58zcGxPrb5em/GQIfLb3Esx49EflNxVFlz8mZYvdTgWxVeGEm7/VEU1/7iopWF0CDUcCK6msvaQsrdrYxgeDImXV9CgF49r9XfS4Jul0WcVK2BgwplyTQvP5t3LjGuFBg4nojx0iYQlbnnTSAzneyrlf/l4vcz53gyaP4lQFtAJ3AnIebYxVrbSK3SVK+GPOlbABgG0ga2SPuChtShhVutf6GUP+vSQwEKzBmuWcRj/510kCGu4LbP/665uoQM411MZD7ctrEuQHE2XWa4PRxQgGEVCrdR9WJYc3ZoAnEePYz+NCqTTXdIkGBZil/7R5LSlJGx5sYbT0Cygn6S/OEO9tbtc5RxbdxHhPBnAqTqFqvj0lloQ3MvEVe9c2P2dHTcM3QZ43RfjfWuGjhIKKPLclJ1427SkbtVcUaRVC0CPSIb36wMqTy9LVf6rWs2A3EvceskRUYwFFrQiu7JkemwCs4c8EKBnu3sRKRzsbE59rgsRFwi6lTRlphBnezFwMPhfJghMVF/wZ2df3Mt2oidn8moL2b8jR342TvKJPccwoTFVVKb87PlwH2my7x/WtZTvo5ybrfgXg6kpJJ4RgBMkayLHDvxYDESpbqg8r8D0Xv1wOQAtDy7RNeTyskA9h5Ffq3jhzCdXaZQZG0QokNa+CEBYkMosTY06LTWF4eH7bg7lQ8Qm/FdXQXc1F7OsLA/wJH16kFYYmoSmAXYQbYQQMh0gugDHNpFvbhQo9MXgD62MDBMbuJbXRAW7WFHuKSdEdITou4Zn/qcqNldEhSFZpe1ZUjKQoaD8ALNJVIqBecEnSblBpS21CCqbRH3V4ZdusWHdASmW+0cZjpERoJjj5OOtjCrncS7YBsB5q4SY7vtk6nZt7Hh6hTo/1+UYbwbwHAVUKdLrJFjN0muTHc7S4d2mEAPXqpdpcCGsfX6cLX7i6GVZOF7SCb9/SeUW7xUk9MYxZGtVHgscg3zvNJGW0l1tlaStLtPKe8y6INO4jaIh2wx3rZuFVZK987sTc3IaZ3rV6/8x+vMWoP1crYThFKkqxxP18HzEcXZ5zUPVDOua01fWZejvYXpJw9DniHaJxpkcFJ3KGgBnPO6PSzNggcREI1OsWat7Bn4Cvm948BgapQVHpoV3YYnhMCQWHXIr2oiLpF1MyURIJ447SsYZkGyshA56epyEjuvKARiJtCGgHSaXCtp8/gGsPfU0fFIrM4DF6qURfBJ8zwsbXTeypoKxGE8jD47A0VFjhVlpNECu4qVHOFgmcsF3cPRurrDX1VYPcHnnvfHm4C1lAIpUih8l/zTXVVFbqZ1nAJfSPwAVRQKoqhmWa/rLUOdNtI24vZx1XMDWQM9CwdlD68Q4UVdLlAwwXxEmXXwLsP8XU0Hgvbfy6a5Rz7WiHam3QWD2k6IQSHu2Lv0WAtUUilGU7ju23Y4s4DcEw9WCTgF6fqkEtJICW4784ebrUbgucbPkhYT05Okm2Dm+MqRpYIhw619VINiBWrr264poRUN1ZfYOvD+YWJxj86ZcFZSQ8bF35uT/COCOLymIOFVfNCSLvXo0VqaWvJybCOYQQaEqvmPc0jLIf1vnKzJh9a53SXOk8Nyo6WuFbwQg7c68AW51gOI9vAxwent62rB7fv18qycrGi0TFC7Cp8RL2pwg6AJPRsJcuGweYek5DIcG0n+VTiye5mijCQ92YeFvJ3Lde3jEuUFWzGTWGsjY/Zd18LysBLWPzdDPPNbyfLinrE16n2lMcppdfks3sUq5ZRoTtN228/+ZDaHIJY9QlwDt36ShctasGLq3aq7+aFtSSjyKPIBYqtwwwRe1Mt9j7SAg+Ad0/mjloBdlaqp3daA0ZrpNiRw45eZJScMnIEZUeyh8LJBTWfHIAFq1Q22pH41ZlrqQg05O5GR5510XuzRl2Kg6aCOEIC+Tr7/6bYoeShhyHbdoVq/jnvO5zG6zUu4/EssxgYc4LamtsaFHDpUvev1fiV166xj8VGtWK65zWUjNed6HcYhfrAbqqVJj/i7lKOHw255sIvoQnV1svErEMSYq0c9dgSb2/1A3nhm/dmTxnQJsAr5qVRWxCzFopT6bxpRz58IR00op9nmpozxns83s2vtw+lBNAsM0HCwmx/jeSYpAHQO26nObBspUD8W2H2/Vs3QI8qqvsIgBneFKh9/jaoZfRW5WYsoI4RRI6jx+7lxQMdYZzBIq3CDYnjaq55u0SmzWG0Nc2REreap+jaX5xRNnXA6OQ2DbMzLOAfFm9E+XmQjuAEmLg0e3RyFXOw4dUqjYC+gWOSOz3hGPJp5fmifaAGM7+88cde3a9+vN86toK4Gp0X6jfoJK1OUyB8l7JX16T/hvH40qFQK0eyNTt478hwLTw3WEKOgiGz5ekQYRe284oz9XLCeVrIMLuU2/EjJTwqMppFzo0bFr/X6NTjVvvLjkyB8Gv7wP60vzkKidjtK9+h8BceGRjgCUnhqnCCw+eTj43cwEHtElmzhrWMFkj/5KIlfRGckASo5Nlh8DA3nbXtW/j+L26j1+HNDnQ8TMTDdH7PAYwTKSZbBA8FUqUInHGvSiO15QjkQbrkS7C9oNrqft586HwjKrSW3LU2zSTD9uUssMa9+vImut+H4ydor+7b1WpxLJHw6BXpHuMiuA/AvzyQCONWE/TbUdhs2wzia2+4X7DQp25ADVfMcmlaKg8J3Cll+kdcAI0f6MPACeC1Ky1SoyjDUc8dnEsEgunsY5obfCN6BI2qw6ChWQpIfE9kuqQ2QEvuZXuMeQ2peLzOQbhXTAwEUdquQ6jHFDuF/KI85sQzqdUGBty0yEvgINpea3nUOQILGDEOJxRYcscBuKsMnPkYk0IiwUTqDd0DfjPMrWYAYG48O+3htblmOWGmi0bnJRRZX7NsTV89EPVyJE9fZpVPkACFc/eQbr5oXQStGoh/mzWW1rsfvWvUG8WsdtH3COJ7he2lb/lXw2W2acZG7rZ4wwA6zMo8NqkIC8k5cb/pMTCQVoeR1aXppU+/UsbBwbz0e9YC4rU0J4mPIOLuaY5t2CRrWguBjwtOpsr4qrmV5O4SD+ZgWFBc7e9FQMXj1R5aZWE0XnxZscR57X0Fr95KwwCnYSopGL8MfHTlPHRwdEOaNq9KIQZLvF+KTf20x+Kieo/PSuvWq9TqkV1zS97wbLvmP1UajX2YrzQcf6c7N7dTMr1aCUDBleTqUxkHAMNI0UH66SrZqgRNGQBFaUzjbtEEiQ1JUR3sKy0TJUjcDQoST1DyufdFvBYYcjPdZhhS/LIpWKXxuWkZuFFSvzH/O0WV2Z7KhstVhYmf4trmwhT0/r8usJbsH/yScsjIPNIayba5IKPx32GlADlGozaJOuMHORjfR4YU+Q9n1QtvGgz4cZCxr35bqI4ZuZqaTc3z7lpLsDI3X32IU7jJPnMgHYAVSpBpDUz4gCCofiky9jqTFwUcCCDZcNZwjf8eIIoCGP/TsR+0jUrKiyOR+wKRKxRbFpqeYQ+XvGs9i143MrNcRW0+RENdLsCqd2ogo1Pyp08Hudn8xEohrwb27ApjnqRsMJiay2nr7KA+8Qz45Qq+a9tzfRr/KugYoGnwlrQhReDHH5kz+10qx4FltI9qNsOf/EufLW91z8n4gJVZK1wCCm8z1yp5kgWJRqIHc2kvDwSshzE1I/Xk1fQpw54dmJ7nhedbG3DH7cMo8s7l099CC40hlO0HrUx+lkKq+RGiHnbioHwZOX3J6V4ZZ4rsFCAqk/PmS/XcNMO/0fjSiABZq9ojpcxfgpFWTov37SXn5CPbQtBIYesQyt8hklvCkKuGuctAsOwTlrw0gFF9BCyIWWfgTpghIvj4GtucMvjUsE3DGLzK8kv4WCRLMFrFvEtQMHyUCYOcuCNIJMC8fJeWu2gsjp7UBEK1eGQOQ+q1lTlnRR/edrzQCXEyProiTlHnb+7bS9SKD+NVaHKQAo3q1tuzr3h/k9PlZURwM0jiLaFWXYxQ/7S/Ui+ixVYhE7kHgxkVuWiw+S8+wvV6DCi1gIgqGOBOrRWokny4+Y8U+m6/cyLZeW+MBRn2Mf5zU5Nfluf96tU+zeoo+YyszfZSwfwse89UveseKRqQraML+cRroqltGNrFJFhw9z5NG5qXFCaOUeXi1z6mNI33uRwInC3RTMY/WZQ9IQ53lbVENuUg/D+/ZYqUfpCAVqTMcyTHFKecLkYu8T7YvW1nH/DNYvKwh2K2W2vIubwXh6+jJ6vOLZ4MrkpyBMVlLybanMdTDdAzqAQLqPVijqzipk8S42UPopi6Bmcm7WsFGw+qAxKDOd4FyzLH4/tuRuvWCYAzDOA23jv6AgsqvGL0yT7qJMvcyNE1vgkbXV7ah29C6/GOx77Q5VMMr8Kx1fm+wdxP4S/l9pqkRa8dKP1EjiGM8JcLkfXl1Qtli6dyFomrJ+V5tlDKoVJLpSXeydfhU1oiOvrBzMl5JRFKSZPk04ArtAEVYFe/xB57QYMhlBpSqKiGmIa9NFnpgQksTcR7o71A4LyKtjrBPO5XAI3xzwdH/U2xX1rEQcnFtiPWO4IIl6HCry8cqHW2z+P0vaGCnwVxEHSgzTK/U5VT/nyO7P8RvlXgyT4N28u5BDTabB1ENVe+8IP1XJQhxWwAnDtfbBuWeaDeEjLM195u2lxV/y1AU8FZ1BLJZGiFkbbGpJkZiEWMeqpPGAdtay004q1SqGrKE5yMIlu68c5dLN7yzJF4zdFsqLSeO6ZIUWm2lXrXOxK7jrN84BPPJCy2yROhlJwydbVJqmqSnvdSYrH7cqrUe9QcrRrnA2l2wjYvPVVToEAptH84b09VT92NPG+ZUXB2is+E+9E+jIqrHI4yqC7CS77UFdJXoQRwi5BMaoRLkO2LvUS09iOKgLaAdIK+MVoXVtWMoiJ3wL+uvpjOIVCMyDMMioWzntLad93SftapUsuELsjAGVjyDAdd94DdjJGzfVyGYsrbLAbtS0nJHOIhGNeFwE55qyxNYqKdQGHuCZzv+nwVTUQORTL9mmGQ/lICxqgh5t1SFco+qsXGiN1Gn4TfeLifh90a6wUm+GWYwRPHMqqbM3S/N6Dv1p4ziHFmWhmNz+utqc/6/x9+ZpeNk1DdVCbdhppHkYlMwYT6o0cLqDl/YGlg9Ni59dwQ4YZpEMnRppQb/ILGd4tcNGN9bqU1ryU0q8mAiUc06U5V0/wh1BDzBfIDXiz9mPkLagObtX0lWx1DOtCvJGMmQ8ihPSNfbFIhecYFcFoIMmfWzRzxmIOHmSmRGUvXji8mbdcHRg+kq+tv/HEyJnZ5/hzzerAiy/Ukl8brKNkkFoYRSdkLmzJtG72uJrCHha6ZIaSu+ICQECEMUPLrk9F1I1H2BKH7KEWDKaqwyVlnsHvyD1UJP8fh3Ak7DW1B6KtO/SY8Jd93DK/RVURllUX/Xe4LXskJThCxsHBcWnim0BvN2mFnr4Qrzz6j+ElgPcrm4g9mhQlCs3tZMzCktUgAvg9GCvCeulR/HGA4Aml67SWOq7nIX8mZWnrJIjRsjp3qrFdrpm99o0Z0owz/qDBSyV3PfAaetD5S+IkjqZRck7OTchs5eF5W2/KVNBphrEb2UfrWYTC9aTQ2Bb/zEgXdPj80qWM8oEnBJ+ziB6sWX0bzBxaBbAeWrhs2P/kV/HbBTb6hyYp4qTsHZaLDS21a8nzv7dBmeX7MNxAMuxkWbXotW+bQWcozw3/akNbw+nff79E3KLWRpSw3ATQAgbUMJOQssAc43XGHwszKHTs4JiTo7mbUqo3k+nNz/9iCqvmEP0m8tVebb4j6tKBC7rxEXsRqLCMavzWAbV0Y7k7J5jVGYP/XH0twnma0m1Mpacd5X3Jb8iWENy4lR6Q7kNZLt1wfXpbqPojnjuIt6iVc5EAPUcQv4u+BEiR82oDSYuuwAnFF3yJoGpn+d8yi/0tR7OV0wrszbSWDI9q/DUDy3PB9FWN1aAL3WWOa3yO8s7GyDK7xEU7HGzQ9tsGxN6su8Ux+YbdC2AoFM/Anr/TTTEWV7UjcxJ1MeJ1EUzzSjdWocwnwphEpvYa7eU5WrFVS2Rmezc/I4tZGwPuxxDaMgwud5AZndcBWLE7RXuaJmvXP9xrHIFrf2HAezQN5GU4UvLTl3sKlHWMMj9CWqbP+s3avQacFBWRKCCVno9HjtQY0Yu/B1qzr1khCTzPXspNWt2K8CSCoPW/hq5NYcSYxQTOlh/YqWzZE3po14P7ErM7KfVnSneaGptYoyx3jOWCssRwoYEyEbhgaFh5pg5V0zypPPkbbUyqebIyUSFfOF39ngYPAQ0Y2H/EEXt0XNdn9wOsJ9PSu8QuBdfvYxPmLPKr9FlqnInn6MGWRIzngwON1bWTPyLjGj+Mkc7iI/1zrPQcNuE6LxRDMGIqfOL9r4wQShv5DkwkIUrMPUR/kFkrbPYudiUCHrBg1G367Gqa5vsk19Z8pZQpChCrcmQbJvK/LCZLRDUAx3jfiohZjltKZlRsu9hLgHUaz808zAulaDgaJRmUrHiz8VGB0mQEss9icLTNMOteZVFmCo8i+DGZbD7VMOGSoYKDnhvpVRTI+TWWzRvBVgn1kV5UwcaOHYkvEQEl4Pwen/4wvUHsTyM55hE7JdoF95aAv6BYnFXE4AVVhHbfHtruwzpIFOhciFDz8nwdDMGJPtQ+RGeO8k7MXK/7BIkg3bwYB3wSHJDLRE+yCtWPWOMAE19bQG5bI2fsNH/apxLrI3vCNWjvjPR5pXdVBdXFSKaBuIIP9NEgCkoD1McZdHYzOtq3v5wl9UlOqFm2IEQokXVVLuaeuEnaxeAf5O+lhyCP846xlqu5dh1A5o4+/5Or38DDqWrZS39koOA11M899A/hSIA+caHd8C0Pbukc+SJkOIftjOTkIN+hlfPz7gxWcfXkqPCWx8MuvkormqjP42OTeAzjOcseLlLAyRE3bMMx5z7e9E1f28/A2rT54R1huQTbwXR0rBGFbQRB9omSfBhR3Vyd7BDOkgkQ6sGr6e+yQ1jPe2y0NXW2Rrkem6RUx97yTz5C0bwReB49rosypXwYIRI6+woLXr3bab3/xW1liOrNpdFcmWWqgvlbaiBNZ6ZOx2fiARw550Afyrt57XyYf9GtLJMX/4HnpMYtCb1ujHORj+8zvTLit+gNuy36ctLJPW4hl2ec1JiOfgXOx6zDM6/5Ng5IeqW0feCvzsq0L3Diu5TAfEQkGJKKsJZwYVQfSXw97hxwYmwwxUuC7k8VYCl9Pys5RfNxqeTKqFXFjkGI8HM3WDDs88RTUfAefwW6vnkCoxVNIMppWT4XixO3cNT5Xub+F7m+BcTvM8+EFGUdpJZ9AMtn3l9MV+FpkZ/Tk2sHoxXOtIu6c13+DXPECc2Fwk0X+sTYBXO9Ys7azUPZ7fNGo3hlUe9GjTfsD1VVM1o8YRhazpsfu+EU70VHVwKHt5WgkSuFw2rytcWRJbR7Ij1iy1W23R+k9b/KN09f7xifWEGyX6fj0GjaUTWj8mrXni9qL0UQFZcp6V/nMZOyfjun31FVXOL/2uASl3ThAbdw00hdosCw8Lt+wnV+ONWnGrc38j2ozjKIgyNMZX+5lEsRHx1p8lTuQLimf/23maWdG3LTZKNR4zw7LZBY+HEXYukHb5uEpp0IffGKPhOezevDc+NyUrsQBkL0wj7GOXOZCAE0VNMT9JlVPvBy54VrDhwGfyQxjsgGDy8aE6Kj2aytCveEOdtk2zaSoDP2TNui84XqVlK72/KMoJXsyDwyfBg94AkurTf6fiQFDx3dTvzeWjhdWwdrBDGfagk7nznRyDjwfpGNf58y1by75CjqtoBpd+SRhmjf63Uo8HyeaSdpAKNeTNI26xpfblIBWjkO0Ir6emjm/1AfJeeFSMBbwSGe7F/N1qHkDv4plEF8Q4EfRIu+8rI78iCayYFnn1Y5GGYQJXYnWrMB9bHDlgSgw/6OCqTyUojjNfrE+juL4P7exWDO3zs5XGfhbrkgXoH35a5qjfwiwEzBXOAWQYhANAfUrTcIhfQEUH0Vj1Le39+flMEPznuADCHvSrWktR4FFSUaa50yf3IHNcHpAMUahQ8mWTry5sYfdyTAKTIzEskkOkjqaOV/ZCeKZOC4QgSp3DEVqaNd/BENFSn1Tkf86LZIzUmEnoglSBlsH5EEgdzw4blSiOs9f/VmO6lnULzLselm5MnzAZLFk9ZwqQujL9KcQjO1DHWSyv2Cw/5isM35fhaoXymfVfTTXpvrcROGlIkr7E7s+4475tM2CyWMwUXSs1NgdA0gvsGNqsBEP9OIyqgllSnjVRUF/YyXiHvoYrHxg0WyHarnVb7iIlf0WKFd2NB+5a8OoaA01yWSx4rVr2MM38WMDY0FWcVdMsc2EICGjWz5ot1M09BAJ726SUtWOS2MikvXfd372RkmKh+k0ltjjfkHbP+lL+fFNVDM0VdHVAtJb7vVozkRRobI3VijMnxZI6Y1RRotXyAkLTu/uX3OaqKonWaVwMUsboPXWcLpGic5zBSBwG8Smz2xYi43Vgdpv317qex+2c+8rrowZe0vCHAwXsrEjuaY61R0PvFxRV5klu0ORw7GRW/AYd6WJhZePQ1jNvvn0OOxoAtm1F8a2T4Jxhf5TvExgxoUeDsxlrB0CGnM/McOQAna8vT+baWEqeskE8/EZI/lWLPeQGfTNgua6ePC1ZaDanH3PgOm1cfxuOEyDiUe5cArRDzBU2N3SagimV5UHfMQkKkwR30TMwCqhxDILmJCyLcKNM1+Lah413/T5aBVn+StpSSQktFZRj5tn4CpaHd1LNXhm75Jns3BgzUdHsLraaTPIkEpt9LE7kSmSSBdjt/kslVGeOmly923E0BO021RGGYefbNsJ7qAc7FXwxJncm0ZBPpM9NN1St926octXvUpdGpdXGgtb9Y0DBGWJvvL64L9j3+UhboEqwVHA1g07nmQyi67d407ZVmf5P8aUvpM+keEC/kGkEVDx8l6ZrocQfVKQxZiVO8flQ/aquFGE+4HrCpjQj1JVQ/sxeUepzYN6JPCQTpUe41bK41T50mn//8sBFR8zGpbme6/tU7e3BXoDUzJQTZ+wAmIAyumUYVOyt/dynJ6poc5Ly8tNtvkM5tD0uVhig1k3YxXkazUBieb/MHrdAzfSdVrm8XD0z6wQ8+tkRs0fJ8T6bWA3fgX9nCuPDGqgqa5RnQIJE9m/rJQH1Vk6q6hVxWx3gXanzjmmsx1QWSG+s203Y+/MFBBB1N0nvUjw6rYX8gsl40+LkK6se2mMgyQrQWZzchtSZB6/mZWwhILneL460AfiAa1Uuuovo0LGvUpahakLTE2DakfYNGjvmKzLMle6n8mIJ48JQFoofMszOtf4cM0kbUKq0N66aiAoX+mYdM5LLPYZn/Iidg6sSff3zkvpxNrElkORUAXvNxDxBu2uTZO3adOGT/WmO5lqaBITI3JFPsGSP15c5xVLBNltTlvXNap2ySQoT3TXVvrxU2IZCbUIamflNettiupeKJA3+PcdU8C2S3w/EQPXPdKO+Rpc8WBE0u9eK344NzZ3VLWJ/H4rMU/XJa0Gw03h6P6AMuy+TvSg0TVz4fBIxdpqlUwOLEpuLmekZ18VOKeYxYP41ziKuqhYcDZM0D0W4PaO2DZMdj8LbvajGlPbjeb4aB9kr38FdqA6ZqQWnqhPFNDn6/l8dpeoR+aR28JuHxq5sWLC89Fu090cyvYLwfR0AFrPJH7EXUI8p2yUhjmWHxoXQhjiJsonq1PtwttHyZyZgO/WWHt9LOca9uwgVvo1uifUrMWn3uRFZzjrj/ZvsP3bihbI0iPHB/mgFVgmeM9lUg5qs2GbqSvcH+rAQfIMySaaDSRFQBimnDKIaayglS3lnQjFoJxEtUfqr1bymaXSizKcN8sGTpisUNce989leD62tkUSmEOERP4s+FfzqP9jg35gNjghweg50QGjZpbjiFgubypNiVMy1NtdAYRh+rBid/mKJ+viTnZ+FdaJDj47B2pwfNMVU7pVlMsYPzQPsyKM4zeNqyH5uLEPQCMU69CX8NN8IIR1UpHYAKYtyL2NrYyHk5gFTg39zpa3Ga8gb5nk/y/mRVsNgODWbgL5anTwsNHRxQB83FbjmJZiz94KRde7Hx2p9G9apfXNVnq6aYEqixTHn+/s9R3fFuvSZdTpECCug2JKb08fobT/Nz0ZUGqh16ng018SQA1pqKbj319ByNg2M63wW3abCCtO810tem01awIFupow04yIb1e/vNiv9mSe5CiCFX/9CnfL+Klem5RsvfwfSlHyxv0rVnaYH+QqdLioS8TlHwMKQeyubPJGw1JCkF5H+Oc7RJzdK1og15b3Z1a4KaIzqF45YB5KD+rbZ04D/y8i4uu/1C7woacY9OafZNG048/G0DNb5aUS3mdGoq5WtCmqki+6pp3EfjLNpWDG8P2IzgzMwqxzkUCr+aJ+uH+r4cy9/JshUvAXQA23X6Ccx262YK/uQ+GcBQG+PQfiPqhLakACe1QOgzBaBhXTWCMgnoBVhRgAT2yqrwfpIw5Ggb3F+Wgy91DyrxUTABDa7KO1rceyVskOlgzZAuBK1fKRNAp1/umCefGGttvoICxHTCvTwLVS+fL1X1pzA2c1CsqfzgRZnziT1KK396/0KlKP1UA8HDBT0H0yfb+96ti2ZCZ6xPXwpnaIDaLy1hY0ZKtX+Z6/lU85WqQL3OvZPLPFji4Ifli9YqRAzsO5DvYP7dF6EclVFR8qOrNStWuroV66zPyKx/5FnrXCStae+uxy1+8m1rTe9ES1XZla6hDm3REqTrZ/BfkRen6UN2fzWYq7lDEx0wmLJiTTcynNS2fWgJGLUt4uqh6iFPzaDUE5EK1WeeoSlwlPvC+RMfDM2wXuNCfpqNlOHy5AVXOVesosdPi7swbw92gbLQj74Zkdu6Mcqf5Z40QjgCmqCxv4Grfj33wrxukDdMO2Q6ZyukPCDqXS7/+NnwoddxmafUCWavMAJTrOiX+3KTWkL+woNJ74yQjl/kHebKDqYGiFPH36FGm1c3++9R3fuuxuDHQSrrV6lN5XN1e/wuKbPiwr3uZRWx3GNMCDCb53QK317vF5iFSQUF2s/BKMpZIQinySNC66loEYpCsJqxgWsU7fB4saDdJNdzANJ8/TbhXRpLGXJPtx6oKfTfkvZBQHcvytRUvMF5sqtVqsmAHspNRexwl51MQ5kXurd9nl6eSXrxdtk8M885JTvlcWV/W27ZTjcHsTe1bp0sgWe35+UaZC7DZ4m7OY0lQLL4OzcsiuLz0wsEPPoaEKI6GoVAtJOYMYJ2IgVXxDtVzIbRwMiQPz+2WJCPp4UlX1Y4T1G1EcbzUu4mWfP4pZjfLEv7v64mVHPs/Mt9wO8162mc82KS0M6sMk12hVV1f/CEpwhxsgnz669P1PIZj21xGPD3ZTvrp3pK1sZOnlTmLkyVM1UReRVC65tfYSfkHFgb654uwVbzpRJ88Ylhp5K/8pIngpBmx6OVbc/d5dcpiuYG8Gv9GCZ0leu10SVqUwwL1wuFiFbdOKJHapUy63B2ZqiCYi1DyP9QhNCQ7hy6Chz0dkoeUvxLEA4LAy4vZfG0mYAQNYWMb634YQnKAWihhazGw+RPR6otvnrf8eh8EbiOTfGHO6vt4mJ2A29BF5tJ6VEU1ivcxGZZkx/P2o+2/nh+9FKBZFRi49l/IH42YPF7utdTLbN3CDeKyHXC/JMDKaNTGW1c3H5uAibJyLlvUclDjQeJJZayk7v7GEAEwnqtYL74IiRmipXZOcCR178AABBvdXdtodPuOOCFYqaVY6poAiqRkHqQAivg/DJFMvmgUOCqGUl4bxOpYCj7SjKi5Imho9xG0fqGdkvqG7I30BrKtq/3hHLT3jri+9iSadWsoUwZu/bb6krGVqqu/YT/PTMG7Bs5XTIMJ4eKiyCPYUNj1SgAYo4E0OmHPn8xUG4hRTt6hvkzqHhRRABv6ROk74o/z/9a4OjVtoRmwT3pVauxdANRRh66R/dQRHJ4UER36K7ZM0CRDjHSuc8jERa1FGKto/Xodnft/GN/gdAmd5frgCv3WR1aG1Ql8qsX8rFbK1WS3Iv5UY2Lgb8NLV3UX7xw3rn/EEVoivk2CoAtrpnhtWJn5NxzRYXMxbntckD6m75Xn44dI5uha5A4ctytZI+UYN+bdjxYbdAzQ+01q1n0s/39Ijo3lN4dP0bXmPR9c3zAtXK7QJK1+0NACkIFNXvORNIxVD2c7u8WEvXAjCbsjjluE7wqFRIipHeJAv/VLYFxbKH5BgbqgvyFfckDMd5jKLhcbrUZRsmoh+saZ2/PQGeR4oedNQ3m6PxJv1awPJW+PCqnwXM9Hd1AMg7ws9GhHWTqgFaLXEh/EhBjksYsHjME9bnL7NN//+mlE4FjCAAAAAAAA==)',
    whitePosition: 'center',
    whiteSize: '100% 100%',
    whiteBorder: '#d9b8ff',
    questDesc: '???',
  },
];

export function getBoardSkinById(id) {
  return BOARD_SKINS.find((s) => s.id === id) || BOARD_SKINS[0];
}

// -------- 관리자(개발자) 전용: 스킨을 퀘스트 조건 없이 직접 부여/회수 --------

import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, get, update } from 'firebase/database';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig.js';

let dbInstance = null;
function getDb() {
  if (!isFirebaseConfigured()) throw new Error('Firebase 설정이 비어있어요.');
  if (!dbInstance) {
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    dbInstance = getDatabase(app);
  }
  return dbInstance;
}

function emailToKey(email) {
  return email.trim().toLowerCase().replace(/[.#$[\]]/g, '_');
}

// 이 계정이 "퀘스트 조건 없이" 강제로 부여받은 스킨들이에요. isBoardSkinUnlocked/
// isStoneSkinUnlocked와 별개로, 이 목록에 있으면 무조건 사용 가능해요.
export async function getGrantedSkins(uid) {
  const db = getDb();
  const snap = await get(ref(db, `users/${uid}`));
  const data = snap.val() || {};
  return {
    board: data.grantedBoardSkins || {},
    stone: data.grantedStoneSkins || {},
  };
}

export async function adminGrantSkinsByEmail(email, boardSkinIds, stoneSkinIds) {
  const db = getDb();
  const uidSnap = await get(ref(db, `usersByEmail/${emailToKey(email)}`));
  if (!uidSnap.exists()) return { ok: false, reason: 'not-found' };
  const uid = uidSnap.val();
  const updates = {};
  for (const id of boardSkinIds || []) updates[`users/${uid}/grantedBoardSkins/${id}`] = true;
  for (const id of stoneSkinIds || []) updates[`users/${uid}/grantedStoneSkins/${id}`] = true;
  await update(ref(db), updates);
  return { ok: true, uid };
}

export async function adminRevokeSkins(uid, boardSkinIds, stoneSkinIds) {
  const db = getDb();
  const updates = {};
  for (const id of boardSkinIds || []) updates[`users/${uid}/grantedBoardSkins/${id}`] = null;
  for (const id of stoneSkinIds || []) updates[`users/${uid}/grantedStoneSkins/${id}`] = null;
  await update(ref(db), updates);
}

export function getStoneSkinById(id) {
  return STONE_SKINS.find((s) => s.id === id) || STONE_SKINS[0];
}

// 스킨 하나의 해금 조건을 확인해요. stats는 users/{uid}/achievementStats,
// ctx는 { peakTierIndex, friendsPlayedCount, titleCount } 처럼 다른 시스템 값들을 모아둔 값이에요.
export function isBoardSkinUnlocked(skinId, stats = {}, ctx = {}) {
  switch (skinId) {
    case 'classic': return true;
    case 'darkWalnut': return (stats.aiGames || 0) >= 50;
    case 'marble': return (stats.totalDraws || 0) >= 10;
    case 'deepBlue': return (stats.onlineGames || 0) >= 20;
    case 'emeraldFelt': return (ctx.peakTierIndex || 0) >= 2;
    case 'roseGold': return (ctx.friendsPlayedCount || 0) >= 5;
    case 'midnight': return (stats.midnightGames || 0) >= 5;
    case 'pastelMint': return (stats.drawOfferSuccesses || 0) >= 5;
    case 'aurora': return (stats.tierPromotions || 0) >= 15;
    case 'lavastone': return (stats.destroyKills || 0) >= 30;
    case 'galaxy': return (stats.flawlessVictories || 0) >= 10;
    case 'ancientRuins': return (stats.longGamesPlayed || 0) >= 10;
    case 'chessboard': return (stats.onlineGames || 0) >= 100;
    case 'glacier': return (stats.freezeCellUses || 0) >= 100;
    case 'desertStorm': return (stats.vortexUses || 0) >= 100;
    case 'goldenTemple': return (stats.rankedGamesPlayed || 0) >= 200;
    case 'dawn': return (stats.dawnGames || 0) >= 30;
    case 'ruinedBattlefield': return (stats.ruinedBattlefieldWins || 0) >= 10;
    case 'nebula': return (stats.probSuccess || 0) >= 150;
    case 'firstSnow': return (stats.totalDraws || 0) >= 50;
    case 'alchemistBench': return (stats.alchemyUses || 0) >= 100;
    case 'plagueGround': return (stats.corruptUses || 0) >= 100;
    case 'errorBoard': return (stats.tutorialClicks || 0) >= 100;
    default: return false;
  }
}

export function isStoneSkinUnlocked(skinId, stats = {}, ctx = {}) {
  switch (skinId) {
    case 'classic': return true;
    case 'onyxPearl': return (stats.blackWins || 0) >= 10 && (stats.whiteWins || 0) >= 10;
    case 'neon': return (stats.echoSuccesses || 0) >= 2;
    case 'goldSilver': return (ctx.peakTierIndex || 0) >= 3;
    case 'pastel': return (stats.casualGames || 0) >= 30;
    case 'woodTone': return (stats.longGameWins || 0) >= 5;
    case 'rubySapphire': return (ctx.peakTierIndex || 0) >= 5;
    case 'monochrome': return (ctx.titleCount || 0) >= 10;
    case 'crystal': return (stats.markUses || 0) >= 50;
    case 'phoenix': return (stats.restoreUses || 0) >= 50;
    case 'shadow': return (stats.watcherBlocks || 0) >= 50;
    case 'hologram': return CARDS.every((c) => (ctx.cardUseCounts?.[c.id] || 0) >= 10);
    case 'windSpirit': return (stats.sealLineUses || 0) >= 100;
    case 'steel': return (stats.reinforceUses || 0) >= 100;
    case 'mirror': return (stats.duplicateUses || 0) >= 100;
    case 'cursedDoll': return (stats.markUses || 0) >= 200;
    case 'obelisk': return (stats.sanctuaryUses || 0) >= 100;
    case 'crown': return (stats.impossibleWinStreak || 0) >= 20;
    case 'invisible': {
      const cleared = ctx.challengesCleared || {};
      return CHALLENGES.every((c) => cleared[c.id]);
    }
    case 'twins': return (stats.duplicateUses || 0) >= 30;
    case 'frostbite': return (stats.freezeCellUses || 0) >= 50;
    case 'swappedFate': return (stats.swapUses || 0) >= 100;
    case 'taxidermy': return (stats.markUses || 0) >= 30;
    case 'reverseEngineer': return (stats.overwriteUses || 0) >= 100;
    case 'errorStone': return (stats.timeLimit369Count || 0) >= 2;
    default: return false;
  }
}

function clampProgress(current, target) {
  const safeCurrent = Math.max(0, current || 0);
  const pct = target > 0 ? Math.min(100, Math.round((safeCurrent / target) * 100)) : 0;
  return { current: Math.min(safeCurrent, target), target, pct };
}

// 스킨 하나의 달성 진행률을 계산해요. 조건이 하나면 current/target을 주고,
// 조건이 여러 개(예: 흑 10승 + 백 10승)면 제일 뒤처진 쪽을 기준으로 퍼센트만 줘요
// (단위가 서로 달라서 하나의 x/y로 합칠 수 없어서예요 - current/target은 null이 돼요).
export function getBoardSkinProgress(skinId, stats = {}, ctx = {}) {
  switch (skinId) {
    case 'darkWalnut': return clampProgress(stats.aiGames, 50);
    case 'marble': return clampProgress(stats.totalDraws, 10);
    case 'deepBlue': return clampProgress(stats.onlineGames, 20);
    case 'emeraldFelt': return clampProgress(ctx.peakTierIndex, 2);
    case 'roseGold': return clampProgress(ctx.friendsPlayedCount, 5);
    case 'midnight': return clampProgress(stats.midnightGames, 5);
    case 'pastelMint': return clampProgress(stats.drawOfferSuccesses, 5);
    case 'aurora': return clampProgress(stats.tierPromotions, 15);
    case 'lavastone': return clampProgress(stats.destroyKills, 30);
    case 'galaxy': return clampProgress(stats.flawlessVictories, 10);
    case 'ancientRuins': return clampProgress(stats.longGamesPlayed, 10);
    case 'chessboard': return clampProgress(stats.onlineGames, 100);
    case 'glacier': return clampProgress(stats.freezeCellUses, 100);
    case 'desertStorm': return clampProgress(stats.vortexUses, 100);
    case 'goldenTemple': return clampProgress(stats.rankedGamesPlayed, 200);
    case 'dawn': return clampProgress(stats.dawnGames, 30);
    case 'ruinedBattlefield': return clampProgress(stats.ruinedBattlefieldWins, 10);
    case 'nebula': return clampProgress(stats.probSuccess, 150);
    case 'firstSnow': return clampProgress(stats.totalDraws, 50);
    case 'alchemistBench': return clampProgress(stats.alchemyUses, 100);
    case 'plagueGround': return clampProgress(stats.corruptUses, 100);
    case 'errorBoard': return null; // 조건이 비밀이라 진행률도 안 보여줘요
    default: return null;
  }
}

export function getStoneSkinProgress(skinId, stats = {}, ctx = {}) {
  switch (skinId) {
    case 'onyxPearl': {
      const p1 = clampProgress(stats.blackWins, 10).pct;
      const p2 = clampProgress(stats.whiteWins, 10).pct;
      return { current: null, target: null, pct: Math.min(p1, p2) };
    }
    case 'neon': return clampProgress(stats.echoSuccesses, 2);
    case 'goldSilver': return clampProgress(ctx.peakTierIndex, 3);
    case 'pastel': return clampProgress(stats.casualGames, 30);
    case 'woodTone': return clampProgress(stats.longGameWins, 5);
    case 'rubySapphire': return clampProgress(ctx.peakTierIndex, 5);
    case 'monochrome': return clampProgress(ctx.titleCount, 10);
    case 'crystal': return clampProgress(stats.markUses, 50);
    case 'phoenix': return clampProgress(stats.restoreUses, 50);
    case 'shadow': return clampProgress(stats.watcherBlocks, 50);
    case 'hologram': {
      const counts = ctx.cardUseCounts || {};
      let minCount = Infinity;
      for (const c of CARDS) minCount = Math.min(minCount, counts[c.id] || 0);
      return clampProgress(minCount === Infinity ? 0 : minCount, 10);
    }
    case 'windSpirit': return clampProgress(stats.sealLineUses, 100);
    case 'steel': return clampProgress(stats.reinforceUses, 100);
    case 'mirror': return clampProgress(stats.duplicateUses, 100);
    case 'cursedDoll': return clampProgress(stats.markUses, 200);
    case 'obelisk': return clampProgress(stats.sanctuaryUses, 100);
    case 'crown': return clampProgress(stats.impossibleWinStreak, 20);
    case 'invisible': {
      const cleared = ctx.challengesCleared || {};
      const count = CHALLENGES.filter((c) => cleared[c.id]).length;
      return clampProgress(count, CHALLENGES.length);
    }
    case 'twins': return clampProgress(stats.duplicateUses, 30);
    case 'frostbite': return clampProgress(stats.freezeCellUses, 50);
    case 'swappedFate': return clampProgress(stats.swapUses, 100);
    case 'taxidermy': return clampProgress(stats.markUses, 30);
    case 'reverseEngineer': return clampProgress(stats.overwriteUses, 100);
    case 'errorStone': return null; // 조건이 비밀이라 진행률도 안 보여줘요
    default: return null;
  }
}
