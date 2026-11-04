---
name: deploy
description: 골프 스코어북 앱을 배포한다(버전 올리기 → 점검 → main 푸시 → GitHub Pages 자동 배포 확인). 사용자가 "반영해줘", "배포해줘", "올려줘"라고 하거나 확정된 변경을 앱에 내보낼 때 사용.
---

# 배포 절차

배포 = `main` 브랜치에 푸시. `.github/workflows/pages.yml`이 `index.html manifest.webmanifest sw.js firebase-config.js icons images`만 GitHub Pages(https://xteenf83.github.io/golf-scorebook/)로 올린다.

## 1. 버전 올리기 (앱 화면·동작이 바뀐 경우 반드시)
- `index.html`의 `const APP_VERSION = "vNN";` 과 `sw.js`의 `const CACHE = "golf-scorebook-vNN";` 숫자를 **같이** 1 올린다.
  둘 중 하나만 올리면 폰의 홈 화면 앱이 옛 파일을 계속 쓴다.
- 새 이미지·파일을 추가했다면 `sw.js`의 캐시 목록에 넣는다(오프라인 동작 유지).
  최상위에 새 파일/폴더를 만들었다면 `pages.yml`의 `cp` 줄에도 넣어야 배포된다.
- 바뀐 기능은 `README.md`의 해당 설명도 고친다.

## 2. 점검 (실패하면 배포하지 않는다)
```sh
node tools/flow-test.mjs      # "모두 통과"
node tools/calc-check.mjs     # "모두 일치"
node tools/shot.mjs <스크래치폴더>/shots --only=<바꾼 화면>   # 오류·가로 넘침 메시지가 없어야 함
```
바꾼 화면은 스크린샷을 직접 열어 라이트/다크 모두 확인한다. 서비스워커를 건드렸으면 `node tools/offline-test.mjs`도.

## 3. 커밋·푸시
- 커밋 메시지: `영역: 바뀐 점 요약; vNN` (예: `골프 지도: 점을 누르면 방문 기록; v94`). 한국어.
- 작업 브랜치에 푸시한 뒤, `origin/main`이 작업 브랜치의 조상인지 확인하고(`git fetch origin main && git merge-base --is-ancestor origin/main HEAD`) `git push origin HEAD:main`.
  조상이 아니면 먼저 `origin/main` 위로 리베이스하고 점검을 다시 돌린다. 강제 푸시 금지.
- 비밀 파일(.env, 키)이 섞이지 않았는지 `git status`로 확인(훅이 막지만 한 번 더).

## 4. 배포 확인
- GitHub Actions의 "Deploy to GitHub Pages" 실행이 성공했는지 확인(`mcp__github__actions_list` 등).
- `tools/ics-worker/`를 바꿨다면 Cloudflare가 main 푸시로 자동 배포한다(대시보드 연결). 따로 할 일 없음.
- `firestore.rules`를 바꿨다면 자동 배포되지 않는다 → 사용자에게 Firebase 콘솔 → Firestore → 규칙에 붙여 넣어 달라고 안내.

## 5. 사용자에게 알리기
반영한 버전(vNN), 바뀐 점, 점검 결과를 짧게 전하고 "홈 화면 앱을 한 번 껐다 켜면 새 버전"이라고 안내한다.
