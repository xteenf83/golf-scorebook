# 나의 골프 스코어북 (PWA)

아이폰 홈 화면에서 쓰는 개인용 골프 스코어북입니다.

- 주소: https://xteenf83.github.io/golf-scorebook/
- 로그인·저장: Firebase (구글 로그인 + Cloud Firestore, 오프라인 저장 지원)
- 배포: `main` 브랜치에 올라가면 GitHub Actions가 자동으로 GitHub Pages에 배포

## 파일
| 파일 | 역할 |
|---|---|
| `index.html` | 앱 전체 (화면·기능) |
| `firebase-config.js` | Firebase 설정값 |
| `manifest.webmanifest`, `icons/` | 홈 화면 앱 이름·아이콘 |
| `sw.js` | 오프라인에서도 앱이 열리도록 하는 캐시 |
| `firestore.rules` | Firebase 콘솔에 붙여넣을 보안 규칙 (본인 데이터만 읽기/쓰기) |
| `reference/golf-scorebook-v5.html` | 이전(claude.ai 아티팩트) 버전 원본 |

## 새 골프장 기본 등록
`index.html`의 `DEFAULT_COURSES` 목록에 추가하면, 다음에 앱을 열 때 자동으로 내 코스 목록에 등록됩니다.
