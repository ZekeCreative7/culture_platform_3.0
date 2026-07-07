# Next Build Guardrails

Purpose: 다음 큰 개발이나 다음 빌드에서 Codex가 먼저 읽고 따라야 하는 최소 준수문이다. 이 문서는 Culture Platform 3.0의 문서, Git 히스토리, 기존 포스트모템, 안정화 리뷰를 바탕으로 작성했다.

## 먼저 확인한 근거

- `git log` 기준 2026-06-15부터 2026-07-07까지의 주요 커밋 흐름
- `REACT_MIGRATION_PLAN.md`
- `post_mortem_analysis.md`
- `STABILITY_IMPROVEMENT_REVIEW_2026-07-07.md`
- `webapp/APP_STRUCTURE.md`
- `feedback/KNOWN_WORK_SUMMARY.md`
- `feedback/NEXT_AGENT_WORKFLOW.md`
- 각종 `HANDOFF_*.md`

## 플랫폼이 완성된 과정

1. 2026-06-15: Streamlit/초기 앱에서 정적 브라우저 웹앱으로 전환했다.
2. 2026-06-16~20: Firebase/Firestore, QR 설문, 공개 설문, 교차 기기 응답 저장, 인증, 모바일/리포트/Pulse 기능을 빠르게 붙였다.
3. 2026-06-17~23: Survey, Analytics, Report, Dashboard, Org, Pulse가 커졌고 PDF, 모바일, 캐시, 데이터 누락 문제가 반복됐다.
4. 2026-06-27~30: 반복 오류를 포스트모템으로 정리했다. 핵심 진단은 `React/Vanilla hybrid + source of truth 불명확 + 실제 실행 경로 검증 부족`이었다.
5. 2026-07-03~04: `REACT_MIGRATION_PLAN.md`를 기준으로 React 전환을 단계화했다. 화면별 이관, 액션 추출, `app.js` 퇴역까지 완료했다.
6. 2026-07-05~06: 남은 window/global/HTML bridge/Firestore adapter 호환층을 작은 커밋으로 줄였다. PDF readiness, smoke preview, operational guardrail을 추가했다.
7. 2026-07-07: `organizationId`, Firestore Rules, response listener cleanup, 운영 패널, source guardrail, build budget을 보강했다.

## 실제로 반복된 Critical Error

1. Source of truth drift
   - 수정한 파일과 브라우저가 실제 로드한 파일이 달랐다.
   - `state.js?cacheKey` 같은 query-string import가 singleton state를 쪼갤 수 있었다.
   - 중복 경로, stale asset, GitHub Pages cache 때문에 "고쳤는데 안 고쳐진" 상태가 반복됐다.

2. React/Vanilla hybrid 사고
   - React 컴포넌트, Vanilla HTML string, `window.*` action, `dangerouslySetInnerHTML`이 섞였다.
   - build가 통과해도 missing import, undefined identifier, live route crash가 남았다.
   - `app.js` dead branch와 side-effect import가 실제 전환 완료 판단을 흐렸다.

3. 검증 명령과 실제 제품 검증의 분리
   - `npm run check`가 한때 깨진 스크립트를 가리켰다.
   - test/build가 통과해도 Dashboard, Pulse, Report 같은 live route crash를 못 잡았다.
   - PDF, public survey, mobile, deploy path는 코드 리뷰만으로 검증되지 않았다.

4. Data contract/security gap
   - 공개 설문 응답에 `organizationId`가 빠져 회수/백업/조직 스코프 분석에서 누락될 수 있었다.
   - Firestore Rules가 approved user만 보고 organization scope를 충분히 강제하지 못했다.
   - CSV upload 응답이 survey card에서 사라지는 등 저장 위치와 조회 조건이 어긋났다.
   - Organization은 단일 `appState/main` 문서 기반이라 `saveState()`만으로는 부족하고 `persistOrganization()`이 빠지면 DB sync가 조용히 깨질 수 있었다.

5. Listener/loading 상태 문제
   - response listener가 session/survey 변경마다 불필요하게 teardown될 수 있었다.
   - Dashboard action queue가 모든 데이터 준비 전 partial value를 보여 operationally misleading했다.
   - cleanup ownership이 명확하지 않으면 logout, org switch, hot reload에서 문제가 난다.

6. PDF/report 산출물 문제
   - html2pdf/canvas/export clone/popup/print flow가 여러 번 바뀌었다.
   - 화면상 정상이어도 PDF 오른쪽 edge clipping, stale markup, duplicate export id가 발생했다.
   - Report는 아직 남은 HTML bridge가 가장 큰 안정성 표면이다.

7. Deploy/routing/cache 문제
   - GitHub Pages에서 BrowserRouter refresh 404, BASE_URL 이미지 경로, stale module skew가 반복됐다.
   - public QR 경로는 `/survey.html`뿐 아니라 legacy `/webapp/survey.html`도 제품 계약이다.
   - build 산출물과 실제 배포 asset commit이 다르면 로컬 검증이 맞아도 운영 화면은 다를 수 있다.

8. Handoff/execution mismatch
   - handoff가 코드 목표만 담고 portable Node, plugin version, sandbox approval, preview URL을 빠뜨리면 다음 창에서 같은 실패를 반복한다.
   - `node`/`npm` 전역 명령을 믿지 말고 이 repo의 `node_portable` 경로를 기준으로 기록한다.

9. 제품 언어와 분석 신뢰도 문제
   - Pulse/Report가 "판정"처럼 보이거나 근거보다 강한 결론을 낼 위험이 있었다.
   - mock/sample/benchmark/추정값 표시가 약하면 경영진 신뢰를 잃는다.
   - FGD/IDI/root-cause 흐름 없이 점수만 강조하면 과잉진단이 된다.

## 다음 빌드에서 반드시 지킬 것

1. 시작 전에 10분 브리프를 고정한다.
   - 목표
   - 사용자
   - 수정 화면
   - 사용할 데이터
   - 이번 개발 포함/제외
   - 완료 기준
   - 검증 환경

2. 먼저 actual source of truth를 확인한다.
   - 현재 브라우저가 어떤 파일/commit/build tag를 로드하는지 확인한다.
   - public survey, GitHub Pages, preview server, local dev server 중 어느 경로인지 적는다.
   - duplicate path, mirrored tree, stale cache, query-string import를 먼저 의심한다.

3. 한 번에 하나의 vertical slice만 끝낸다.
   - "전체를 좋게" 하지 않는다.
   - 데이터 저장, 화면 표시, 새로고침 유지, report/export 영향까지 한 조각으로 닫는다.
   - 새 범위가 생기면 `이번 개발`과 `다음 개발`로 분리한다.

4. Red-capable loop 없이 큰 수정을 시작하지 않는다.
   - 고치려는 버그가 실패하는 테스트, smoke, 브라우저 경로, 수동 체크 중 하나를 먼저 정한다.
   - 구현 후 같은 루프로 다시 확인한다.
   - "코드상 맞다"는 완료가 아니다.

5. 새 legacy surface를 만들지 않는다.
   - 새 `window.*` action 금지.
   - 새 inline handler 금지.
   - 새 unreviewed `dangerouslySetInnerHTML` 금지.
   - 새 query-string source import 금지.
   - 새 UI는 React component + direct action import가 기본이다.

6. Data contract가 UI polish보다 먼저다.
   - 저장 doc에는 필요한 ownership field, 특히 `organizationId`를 넣는다.
   - Firestore Rules, migration, recovery/export path까지 같이 본다.
   - Organization mutation은 `persistOrganization()`까지 포함됐는지 확인한다.
   - migration은 idempotent해야 한다.

7. Report/PDF/mobile/public survey는 산출물로 검증한다.
   - Report 수정은 브라우저 화면만 보지 말고 PDF/export readiness도 본다.
   - public survey는 `/survey.html`과 legacy `/webapp/survey.html` 경로를 둘 다 본다.
   - 모바일 레이아웃은 데스크톱 완료 후 "나중에" 보지 않는다.

8. 문서와 guardrail을 같이 갱신한다.
   - routing, listener startup, state ownership, Firestore adapter, Rules, compatibility surface가 바뀌면 `webapp/APP_STRUCTURE.md`를 갱신한다.
   - 장기 계획이나 완료 로그가 바뀌면 `REACT_MIGRATION_PLAN.md` 또는 해당 handoff 문서에 남긴다.

9. 검증 전에는 완료 선언하지 않는다.
   - 최소 검증 세트는 아래 명령과 브라우저 smoke다.
   - 실패하면 실패 원인을 "코드 결함 / 환경 제약 / sandbox 권한 / stale asset"으로 분리해서 기록한다.

10. 컨텍스트가 커지면 새 창용 handoff를 먼저 쓴다.
    - 최근 커밋
    - 마지막 검증 상태
    - 현재 source of truth
    - 다음 slice
    - 정확한 명령
    - 필요한 runtime/PATH/sandbox 승인 조건
    - 남은 리스크

## 기본 검증 명령

`webapp`에서 portable Node를 기준으로 실행한다.

```bash
PATH=/Users/zekedongwookrho/Desktop/Culture\ Platform\ 3.0/node_portable/bin:$PATH ../node_portable/bin/node ../node_portable/lib/node_modules/npm/bin/npm-cli.js run check
PATH=/Users/zekedongwookrho/Desktop/Culture\ Platform\ 3.0/node_portable/bin:$PATH ../node_portable/bin/node ../node_portable/lib/node_modules/npm/bin/npm-cli.js run smoke
PATH=/Users/zekedongwookrho/Desktop/Culture\ Platform\ 3.0/node_portable/bin:$PATH ../node_portable/bin/node ./node_modules/vitest/vitest.mjs run
PATH=/Users/zekedongwookrho/Desktop/Culture\ Platform\ 3.0/node_portable/bin:$PATH ../node_portable/bin/node ../node_portable/lib/node_modules/npm/bin/npm-cli.js run build
git diff --check
```

Preview server를 띄운 뒤에는:

```bash
PATH=/Users/zekedongwookrho/Desktop/Culture\ Platform\ 3.0/node_portable/bin:$PATH ../node_portable/bin/node ../node_portable/lib/node_modules/npm/bin/npm-cli.js run smoke:preview -- http://127.0.0.1:4174/culture_platform_3.0/
```

## 브라우저 Smoke 최소 기준

- Dashboard가 JS error overlay 없이 뜬다.
- Sessions edit drawer가 열린다.
- Survey card, QR/link action, public survey entry가 열린다.
- Upload가 CSV를 parse하고 preview/validation을 보여준다.
- Analytics와 Report가 실제 session 기준으로 렌더된다.
- Report/PDF export readiness가 stale/empty/duplicate id를 막는다.
- Pulse Report가 mock/sample/benchmark/추정값을 과장하지 않는다.
- `/webapp/survey.html?surveyId=...`가 `/survey.html?surveyId=...`로 query/hash를 보존해 이동한다.
- public survey submit 결과 doc에 `organizationId`가 들어간다.

## Cold Review Gate

새 창 또는 독립 리뷰 관점에서 아래 질문에 답하지 못하면 아직 완료가 아니다.

1. 사용자가 실제로 누르는 경로가 무엇인가?
2. 이 화면이 읽는 데이터와 저장하는 데이터의 source of truth는 무엇인가?
3. 내가 수정한 파일이 실제 빌드/브라우저에서 로드되는 파일인가?
4. test/build가 못 잡는 live route, PDF, mobile, deploy 위험은 무엇인가?
5. 이번 수정이 새 legacy surface를 만들었는가?
6. 실패하면 운영자가 복구할 수 있는가, 아니면 조용히 사라지는가?
7. 문서와 guardrail이 현재 코드와 맞는가?

## 다음 Codex에게 주는 짧은 지시

이 파일을 먼저 읽어라. 범위를 좁히고, source of truth를 확인하고, red-capable loop를 잡고, 한 조각을 끝낸 뒤 실제 브라우저/산출물로 검증하라. 검증 없이 완료라고 말하지 말고, 호환층을 늘리지 말고, 변경한 ownership은 문서에 남겨라.
