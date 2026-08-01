# 증강 오목 (프로토타입)

18일 개발 계획의 1~3일차 목표: 오목 핵심 로직만 있는 버전이에요.
- 15x15 보드
- 클릭으로 돌 놓기 (흑/백 번갈아)
- 가로/세로/대각선 5목 승리 판정
- 무승부(보드가 가득 찬 경우) 판정
- 다시 시작 버튼

카드 시스템은 아직 없어요. 다음 단계에서 `src/gameLogic.js`를 건드리지 않고
카드 효과를 별도 모듈로 추가하는 걸 추천해요.

## 로컬에서 실행하기

1. [Node.js](https://nodejs.org) 설치 (LTS 버전 권장)
2. 이 폴더에서 터미널을 열고 아래 명령어 실행:

```bash
npm install
npm run dev
```

3. 터미널에 나오는 주소(보통 http://localhost:5173)를 브라우저에서 열면 바로 플레이 가능해요.

## Vercel로 배포하기 (실제 웹사이트로 만들기)

**방법 A: 드래그 앤 드롭 (가장 쉬움)**
1. `npm run build` 실행 → `dist` 폴더가 생성돼요.
2. https://vercel.com 접속 후 로그인
3. 대시보드에서 `dist` 폴더를 드래그 앤 드롭
4. 몇 초 후 `프로젝트이름.vercel.app` 주소가 생성돼요.

**방법 B: GitHub 연동 (이후 수정마다 자동 배포, 추천)**
1. 이 폴더를 GitHub 저장소에 업로드
2. https://vercel.com 에서 "New Project" → 방금 만든 저장소 선택
3. 별도 설정 없이 "Deploy" 클릭 (Vite 프로젝트는 자동 인식돼요)
4. 이후 코드를 수정해서 GitHub에 다시 올릴 때마다 사이트가 자동으로 업데이트돼요.

## 다음 단계 (계획 4~5일차)
- 보드/돌 디자인 다듬기, 애니메이션 추가
- 카드 데이터 구조 설계 및 드래프트 로직 (6~10일차)

## 온라인 대전 설정하기 ("친구와 플레이")

온라인 대전은 두 기기 사이에서 실시간으로 데이터를 주고받을 곳이 필요해요. 이 프로젝트는
무료로 쓸 수 있는 **Firebase Realtime Database**를 사용해요. 아래 순서대로 한 번만 설정하면 돼요.

1. https://console.firebase.google.com 접속 후 구글 계정으로 로그인
2. "프로젝트 추가" → 프로젝트 이름 아무거나 입력 → 애널리틱스는 꺼도 됨 → 프로젝트 생성
3. 왼쪽 메뉴에서 "빌드 > Realtime Database" 선택 → "데이터베이스 만들기"
   - 위치는 아무 곳이나 선택
   - 보안 규칙은 우선 **테스트 모드**로 시작 (나중에 아래 규칙으로 바꾸는 걸 추천해요)
4. 프로젝트 개요 옆 톱니바퀴 → "프로젝트 설정" → 아래로 스크롤해서 "내 앱" → 웹 아이콘(`</>`) 클릭 → 앱 등록
5. 화면에 나오는 `firebaseConfig` 객체 값을 복사해서, 이 프로젝트의 `src/firebaseConfig.js` 파일에 그대로 붙여넣기
6. Realtime Database 메뉴의 "규칙" 탭에서 아래 규칙을 붙여넣기 (프로젝트 루트의 `database.rules.json` 파일과 같은 내용이에요. 로그인한 사용자만 접근 가능하고, 각자 자기 데이터만 쓸 수 있도록 제한한 규칙이에요):
   ```json
   {
     "rules": {
       ".read": false,
       ".write": false,

       "users": {
         ".read": "auth != null && auth.token.email === 'sniperis10b@gmail.com'",
         "$uid": {
           ".read": "auth != null && auth.uid === $uid",
           ".write": "auth != null && auth.uid === $uid",

           "profile": {
             "customPhoto": { ".read": "auth != null" }
           },
           "friends": {
             "$otherUid": { ".write": "auth != null && (auth.uid === $uid || auth.uid === $otherUid)" }
           },
           "friendRequests": {
             "$fromUid": { ".write": "auth != null && (auth.uid === $uid || auth.uid === $fromUid)" }
           },
           "invites": {
             "$fromUid": { ".write": "auth != null && (auth.uid === $uid || auth.uid === $fromUid)" }
           },
           "titles": {
             "$titleId": { ".write": "auth != null && (auth.uid === $uid || auth.token.email === 'sniperis10b@gmail.com')" }
           },
           "equippedTitle": {
             ".write": "auth != null && (auth.uid === $uid || auth.token.email === 'sniperis10b@gmail.com')"
           },
           "reachedTierBadges": {
             "$tierId": { ".write": "auth != null && (auth.uid === $uid || auth.token.email === 'sniperis10b@gmail.com')" }
           },
           "equippedTierId": {
             ".write": "auth != null && (auth.uid === $uid || auth.token.email === 'sniperis10b@gmail.com')"
           },
           "grantedBoardSkins": {
             "$skinId": { ".write": "auth != null && (auth.uid === $uid || auth.token.email === 'sniperis10b@gmail.com')" }
           },
           "grantedStoneSkins": {
             "$skinId": { ".write": "auth != null && (auth.uid === $uid || auth.token.email === 'sniperis10b@gmail.com')" }
           },
           "blockedBoardSkins": {
             "$skinId": { ".write": "auth != null && auth.token.email === 'sniperis10b@gmail.com'" }
           },
           "blockedStoneSkins": {
             "$skinId": { ".write": "auth != null && auth.token.email === 'sniperis10b@gmail.com'" }
           }
         }
       },

       "usersByEmail": {
         "$emailKey": {
           ".read": "auth != null",
           ".write": "auth != null && (newData.val() === auth.uid || (!newData.exists() && data.val() === auth.uid))"
         }
       },

       "rooms": {
         "$code": { ".read": "auth != null", ".write": "auth != null" }
       },

       "matchmaking": {
         "waiting": {
           "$queueKey": { ".read": "auth != null", ".write": "auth != null" }
         }
       },

       "leaderboard": {
         ".read": true,
         ".indexOn": ["rating"],
         "$uid": {
           ".write": "auth != null && auth.uid === $uid",
           "titleName": { ".write": "auth != null && (auth.uid === $uid || auth.token.email === 'sniperis10b@gmail.com')" },
           "tierBadgeId": { ".write": "auth != null && (auth.uid === $uid || auth.token.email === 'sniperis10b@gmail.com')" }
         }
       },

       "rankLeaderboard": {
         ".read": true,
         ".indexOn": ["points"],
         "$uid": {
           ".write": "auth != null && auth.uid === $uid",
           "tierBadgeId": { ".write": "auth != null && (auth.uid === $uid || auth.token.email === 'sniperis10b@gmail.com')" }
         }
       },

       "titleCounts": {
         ".read": true,
         "$titleId": { ".write": "auth != null" }
       },

       "cardStats": {
         ".read": "auth != null",
         "$cardId": { ".write": "auth != null" }
       }
     }
   }
   ```
   (`users`는 로그인한 사람만, 그것도 원칙적으로 자기 데이터만 쓸 수 있어요. 칭호/스킨/티어뱃지처럼 개발자 계정이 다른 사람에게 지급/회수해주는 항목만 예외로 열어뒀고, 그 이메일은 `sniperis10b@gmail.com`으로 고정해서 검사해요 — 다른 이메일로 개발자 계정을 바꾸고 싶다면 이 부분을 전부 바꿔야 해요. `rooms`/`matchmaking`은 로그인한 사람이면 누구나 쓸 수 있는데, 이건 온라인 대전이 지금 클라이언트가 만든 게임 상태를 그대로 믿고 저장하는 구조라 "수가 유효한지" 자체는 서버가 검사 안 해요 — 브라우저 콘솔로 직접 조작하는 것까진 막지 못하니, 완전히 막으려면 나중에 Cloud Functions로 이동하는 게 좋아요.)

   ⚠️ 이 규칙은 실제 라이브 Firebase 프로젝트에 올려서 테스트해본 게 아니라(샌드박스에서 에뮬레이터 실행이 막혀있어요), 문법과 로직을 꼼꼼히 검토는 했지만 **적용 전에 Firebase 콘솔의 "규칙 재생(Rules Playground)" 기능으로 한 번 시뮬레이션**해보길 권장해요. 특히 온라인 대전, 친구 추가, 스킨/칭호 지급이 다 잘 되는지 직접 확인해보세요.
7. `npm run dev`로 실행 후 "친구와 플레이"를 눌러 방을 만들고, 다른 브라우저 탭(또는 다른 사람)이 코드를 입력해서 참가하면 돼요.

설정을 안 해도 로컬 2인 대국과 AI 대국은 그대로 잘 작동해요. "친구와 플레이"만 이 설정이 필요해요.

## 계정(로그인) 설정하기

시작 화면 오른쪽 위 사람 아이콘을 누르면 로그인 화면이 나와요. 구글 로그인과
이메일/비밀번호(가입 시 인증 메일 발송) 두 가지를 지원해요. 온라인 대전과 같은
Firebase 프로젝트를 쓰기 때문에, 위 온라인 대전 설정을 이미 마치셨다면 아래 과정만
추가로 하면 돼요.

1. Firebase 콘솔(https://console.firebase.google.com) 에서 만든 프로젝트로 들어가기
2. 왼쪽 메뉴에서 "빌드 > Authentication" 선택 → "시작하기"
3. "Sign-in method" 탭에서 아래 두 가지를 각각 켜기:
   - **이메일/비밀번호**: 그냥 사용 설정 켜기만 하면 돼요
   - **Google**: 사용 설정을 켜고, 프로젝트 지원 이메일을 하나 선택
4. (구글 로그인용) "설정" 탭 아래쪽 "승인된 도메인"에 실제 배포한 주소(예:
   `augment-omok-seven.vercel.app`)가 등록되어 있는지 확인하고, 없으면 추가

로컬 개발 중(`localhost`)에는 별도 설정 없이도 구글 로그인이 잘 작동해요. 배포한
주소에서 구글 로그인이 안 될 때만 4번 항목을 확인하면 돼요.

계정 없이도 게임은 그대로 다 할 수 있어요. 로그인하면 온라인 대전 채팅에 닉네임이
표시되는 정도의 차이가 있어요. 프로필 사진은 별도 업로드 없이 모두 기본 아이콘으로
표시돼요.

## 서버 측 착수 검증 (Vercel 서버리스 함수)

지금까지는 온라인 대전에서 클라이언트(브라우저)가 계산한 게임 상태를 그대로 믿고
Firebase에 저장했어요. 즉, 브라우저 개발자도구 콘솔로 직접 Firebase에 값을 써서
"내가 이겼다"고 조작하는 것도 이론적으로 가능한 구조였어요.

원래 Firebase Cloud Functions로 만들었었는데, **Cloud Functions는 Blaze(종량제)
요금제가 필수라서**, Spark(무료) 요금제를 쓰는 이 프로젝트에서는 배포할 수 없었어요.
그래서 이미 이 프로젝트를 배포하고 있는 **Vercel의 서버리스 함수**(`api/` 폴더)로
옮겼어요 — Vercel Hobby(무료) 요금제로도 충분히 쓸 수 있어요.

- `api/_lib/gameLogic.js`, `api/_lib/tiers.js`: `src/gameLogic.js`, `src/tiers.js`를
  그대로 복사한 파일이에요 (승리 판정, 렌주 금수 규칙, 랭크 티어별 감점량). 이 로직을
  서버에서도 똑같이 돌려서 검증하기 위해 필요해요. **원본 파일을 고치면 이 복사본도
  반드시 같이 고쳐주세요** (자동 동기화 안 돼요).
- `api/_lib/validators.js`: 착수/결과 검증의 핵심 로직이에요.
- `api/_lib/firebaseAdmin.js`: Firebase Admin SDK 초기화 + 요청의 로그인 토큰 검증.
- `api/placeStone.js`: 방 코드/좌표를 받아서 — 내 턴이 맞는지, 빈 칸인지, 막힌 칸은
  아닌지, 렌주 금수는 아닌지, 승리인지 — 서버에서 다시 검증해요.
- `api/reportGameResult.js`: 대국이 끝나면 서버가 **최종 보드 상태를 다시 스캔해서
  "그 색이 정말로 승리 조건(5목 등)을 만족하는지"를 검증**한 뒤에만 레이팅/랭크
  포인트를 반영해요. 조작된 승리 선언(예: 콘솔로 `winner` 값만 바꿔치기)은 이제
  여기서 걸러져요. 호스트/게스트 둘 다 호출해도 안전하도록 트랜잭션으로 "한 번만
  반영"되게 처리했어요.

**진행 상황**
- ✅ 두 API 모두 완성됐고, `src/serverValidation.js`가 온라인 대전에서 두 API를 호출해요.
  - 평범한 돌 놓기 → `/api/placeStone` 호출 후 통과해야 착수
  - 대국 종료 → `/api/reportGameResult` 호출, 서버가 검증/반영한 결과를 그대로 화면에 반영
  두 경우 모두 **API를 못 부르면(아직 배포 전, 네트워크 문제 등) 안전하게 통과 처리**돼서
  게임이 막히지 않아요. 서버가 명확히 거부한 경우(가짜 승리 등)만 실제로 막혀요.
- ❌ 카드 효과(파괴·변환·봉인 등 60개 이상)와 룰렛/챌린지의 특수 규칙은 아직 서버에서
  검증하지 않아요. 순수 "돌 하나 놓기"와 "최종 승리 판정"만 검증 대상이에요. 카드까지
  전부 서버로 옮기는 건 훨씬 큰 작업이라 다음 단계로 남겨뒀어요.
- ❌ 그래서 지금은 `database.rules.json`에서 `rooms`와 레이팅/랭크 관련 필드를 여전히
  로그인한 사람이면 직접 쓸 수 있게 열어뒀어요 — 카드 로직 이식과 서버 함수 배포·검증이
  끝나기 전에 먼저 막아버리면 카드 효과와 폴백 경로가 전부 깨져요.

**개발 중 실제로 잡은 버그**: 처음엔 서버가 "이 수는 안 돼요"를 예외(에러)로 던지는
방식으로 만들었는데, 함수를 아직 배포하지 않았을 때 발생하는 "함수가 없음" 에러와
실제 거부 사유가 **똑같은 에러 코드**로 찍혀서 구분이 안 됐어요. 그 상태로 클라이언트를
연결했다면 배포하기 전까지 온라인 대전 전체가 막혀버렸을 거예요. 그래서 서버가 거부
사유를 예외 대신 **정상 응답의 필드 값**으로 돌려주는 방식으로 다시 만들어서, "서버가
진짜로 거부한 것"과 "API를 아예 못 부른 것"을 명확히 구분하도록 고쳤어요.

**두 번째로 잡은 버그 (타이밍 경쟁)**: 실제 배포 후, 상대방이 방금 둔 수가 Firebase에
다 반영되기 전에 서버가 그 "한 박자 전" 상태를 읽어버려서, 정상적인 착수인데도
"내 턴이 아니에요"로 오판해 막아버리는 문제가 있었어요. 그래서 `validatePlacement`/
`validateGameResult`가 턴/진행상태 관련 판정만 별도 코드(`stale-state`)로 구분하게
하고, 서버가 이 코드를 받으면 **곧바로 거부하지 않고 짧게 기다렸다가 최신 상태를
다시 읽어 재검증**하도록 고쳤어요 (최대 4번, 250ms 간격). 여러 번 재시도해도 여전히
애매하면 그때는 안전하게 통과시켜요. "이미 돌이 있음"/"금수"처럼 타이밍과 무관한
진짜 규칙 위반은 재시도 없이 곧바로, 확실하게 막아요.

### 배포하려면

1. **Firebase 서비스 계정 키 만들기**
   - Firebase 콘솔(https://console.firebase.google.com) → `augment-omok` 프로젝트 →
     왼쪽 아래 톱니바퀴 → "프로젝트 설정" → "서비스 계정" 탭
   - "새 비공개 키 생성" 클릭 → JSON 파일 다운로드 (이 파일은 **절대 Git에 올리지
     마세요** — 이미 `.gitignore`에 `*.json` 서비스 계정 패턴을 넣어두는 걸 권장해요)

2. **Vercel에 환경변수 등록**
   - Vercel 대시보드 → 이 프로젝트 → Settings → Environment Variables
   - 아래 4개를 추가 (다운로드한 JSON 파일 안의 값들을 그대로 옮기면 돼요):
     - `FIREBASE_PROJECT_ID` = JSON의 `project_id`
     - `FIREBASE_CLIENT_EMAIL` = JSON의 `client_email`
     - `FIREBASE_PRIVATE_KEY` = JSON의 `private_key` (줄바꿈이 포함된 긴 문자열 그대로 붙여넣기)
     - `FIREBASE_DATABASE_URL` = `src/firebaseConfig.js`에 있는 `databaseURL` 값과 동일하게
       (예: `https://augment-omok-default-rtdb.firebaseio.com`)

3. **재배포**
   - 환경변수를 추가한 뒤에는 Vercel에서 재배포해야 적용돼요 (Deployments 탭에서
     최신 배포 옆 "..." → Redeploy, 또는 그냥 새 커밋을 푸시)

배포되면 `https://내도메인.vercel.app/api/placeStone`, `/api/reportGameResult`가
자동으로 서버리스 함수로 동작해요 (별도 CLI 로그인/배포 명령 없이, git push만으로
Vercel이 알아서 `api/` 폴더를 함수로 인식해서 배포해요).
