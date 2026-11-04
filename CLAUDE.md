# 나의 골프 스코어북 — Claude Code 작업 메모

아이폰 홈 화면에서 쓰는 개인용 골프 스코어북 PWA. 자세한 기능·데이터 설명은 `README.md`, 디자인 기준은 `design/v3/HANDOFF.md`.

## 구조
- 앱 전체가 `index.html` 한 파일(빌드 도구 없음). 외부 라이브러리는 Firebase·글꼴(Pretendard)만.
- `sw.js`: 오프라인 캐시. `firebase-config.js`: 공개되어도 되는 Firebase 웹 설정(진짜 비밀 아님).
- `tools/`: 개발용 점검 도구(배포 안 됨). `tools/ics-worker/`: Cloudflare Worker(캘린더 .ics).

## 꼭 지킬 것
- 사용자와는 한국어로, 쉬운 말로. 코드 주석도 한국어.
- **저장 형식 변경 금지**: 새 기능은 기존 라운드·코스 데이터로 계산. 기기 전용 값만 `localStorage`.
- 라운드 중 입력 속도가 최우선: 평범한 홀은 "다음 홀" 한 번. 연출이 입력을 막으면 안 됨.
- 좌타 기준(구질·방향). 9홀 라운드는 통계에서 제외.
- 애니메이션은 transform/opacity만, `prefers-reduced-motion`이면 생략. 라이트/다크 모두, 폭 375–430px, 터치 44px 이상.
- 화면을 바꾸는 요청은 **시안(스크린샷)을 먼저** 보여 주고 확인받은 뒤 반영.
- 기본 코스에 골프장을 추가하면 `CLUB_LOC` 좌표도 함께 넣고 `COURSES_SEED_VERSION`을 1 올림.

## 점검
```sh
node tools/flow-test.mjs        # 홀 입력 흐름 회귀 테스트
node tools/calc-check.mjs       # 분석 숫자 손계산 대조
node tools/shot.mjs shots --only=home,stats   # 화면 스크린샷 (라이트/다크)
```

## 배포
`main`에 푸시하면 GitHub Pages로 자동 배포된다. 절차는 `/deploy` 스킬(`.claude/skills/deploy/SKILL.md`)을 따른다.

## 비밀 파일
`.env`·키 파일(`*.pem`, `*.key`, `.dev.vars`, 서비스 계정 JSON 등)은 커밋·삭제하지 않는다.
`.claude/hooks/guard-secrets.py`가 Bash의 `git add`/`git commit`/`rm` 등을 검사해 막는다.
