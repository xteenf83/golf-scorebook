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

## 9홀 라운드
새 라운드에서 "9홀"을 고르면 9개 홀만 입력합니다(홀별 또는 총타만). 9홀 라운드는 기록 목록에 "9홀" 표시로만 남고 평균·베스트·추이·분포·퍼팅·적중률·구질 등 모든 통계에서 빠집니다.

## 과거 기록 가져오기 (더보기 → 기록 가져오기)
아래 형식의 JSON 파일을 고르면 라운드를 한 번에 추가합니다. 날짜·골프장·총타가 같은 라운드가 이미 있으면 건너뜁니다.
홀별 파를 모르면 `par`를 `null`로 두고 `d`(파 대비 점수)만 넣으면 됩니다. `holes`를 빼고 `total`만 넣으면 총타만 기록한 라운드가 됩니다.

```json
{"format":"golf-scorebook-import-v1","rounds":[
  {"date":"2023-03-26","club":"강화웰빙CC","front":{"course":"웰빙"},"back":null,"holesPlayed":9,"tee":"White",
   "holes":[{"par":null,"d":2},{"par":null,"d":2},{"par":null,"d":3},{"par":null,"d":1},{"par":null,"d":3},
            {"par":null,"d":0},{"par":null,"d":1},{"par":null,"d":1},{"par":null,"d":2}],
   "total":51,"par":36}
]}
```
