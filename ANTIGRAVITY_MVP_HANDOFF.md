# Culture Platform — MVP 마무리 개발 지시서 (Antigravity Handoff)

> 작성: 코드 전수 리뷰 기반. 모든 `file:line`은 리뷰 시점(commit `2b1fdfb`) 기준이며,
> Antigravity는 작업 전 해당 심볼을 grep으로 재확인할 것.
> 우선순위: **P0 = 지금 바로**, P1 = MVP 내, P2 = 확장 단계.

대상 코드: `webapp/` (정적 SPA, Firebase Firestore/Auth/App Check).
주요 파일: `src/app.js`(4,699줄), `src/state.js`(483줄), `src/styles.css`(4,202줄),
`src/dashboard/`, `src/pulse/`, `src/report/`, `src/qual/`.

핵심 아키텍처 한 줄 요약:
**단일 전역 `state` → `subscribe/notify` → `requestAnimationFrame(render)` → `canvas.innerHTML = renderView()` 전체 재렌더 → `bindCanvasEvents()`로 리스너 재부착.** 데이터는 localStorage + Firestore 이중 보관.

---

## PART 1 — 코드 정리 (불필요/중복/지워지다 만 코드)

### 1.1 [P0] 레거시 정성분석 모달 클러스터 완전 삭제 (~180줄, 죽은 코드)
구버전 "프롬프트 복사 → ChatGPT 붙여넣기 → 결과 다시 붙여넣기" 수동 흐름. 현재는
`openQualAnalysisModal`/`renderQualAnalysisModal`(자동 AI 분석, `saveQualSignalToFirestore` →
`QualSignal` 컬렉션 + `state.qualSignals`)으로 **완전히 대체됨**. 아래는 호출자가 전혀 없음(검증 완료).

삭제 대상 (`src/app.js`):
- `renderQualModal()` — `4419-4474` (호출처 0)
- `buildQualPrompt()` — `4477-4568` (오직 `renderQualModal`만 호출)
- `window.openQualModal` — `4570-4574` (호출처 0)
- `window.closeQualModal` — `4576-4580` (죽은 모달 HTML에서만 참조)
- `window.copyQualPrompt` — `4582-4588` (죽은 모달 HTML에서만 참조)
- `window.saveQualAnalysisFromModal` — `4590-4599` (죽은 모달 HTML에서만 참조)

삭제 대상 (`src/state.js`) — `state.qualAnalysis`는 **live reader가 0개**(위 죽은 코드만 읽고 씀):
- `blankState`의 `qualAnalysis: {}` — `91`
- `saveState`/persist payload의 `qualAnalysis` — `193`, `206`
- `uploadStateToDb`의 `qualAnalysis` — `429`
- `loadState`의 `if (data.qualAnalysis) ...` — `453` (하위호환만, 제거 가능)
- 미사용 state 필드 `showQualModal`, `activeQualKey` (오직 죽은 함수에서만 set)

**검증(Acceptance):** 삭제 후 `grep -rn "qualAnalysis\|QualModal\|copyQualPrompt\|buildQualPrompt" webapp/src`
결과가 0. 앱 로드/콘솔 에러 없음. 세션 화면 "정성 분석" 버튼(=`openQualAnalysisModal`, 신버전)은 정상.

### 1.2 [P0] 미사용 window 핸들러 삭제
- `window.updateAnalyticsFilter` — `src/app.js:4662-4666` (참조 0)
- `window.updateReportFilter` — `src/app.js:4668-4672` (참조 0)
필터 UI는 `applyAnalyticsFilter`/`apply-...` 버튼 핸들러(`bindReport`)로 동작하므로 무관.

### 1.3 [P0] 미사용 import / 함수 삭제
- `src/app.js:26` import 목록에서 **`saveSurveyToFirestore` 제거** (직전 설문 생성 리팩터에서
  `updateSurveyInFirestore`로 교체되어 더 이상 사용 안 함).
- `src/state.js:311-318` `saveSurveyToFirestore()` 정의도 제거(다른 참조 없음).

### 1.4 [P1] 중복 CSS 규칙 정리
- `.dashboard-wrapper .signal-gauge-track` / `.signal-gauge-bar` 가 **두 번** 정의됨:
  `src/styles.css:3467-3474` 와 `3862-3870`. 뒤(3862~)가 `!important`로 앞을 덮어 앞 블록은 죽은 규칙 →
  앞 블록 삭제.
- 전반적으로 같은 셀렉터가 여러 번 등장(예: `.canvas`×6, `.dashboard-kpi-grid`×4, `.topbar`×3 등).
  미디어쿼리/의도된 override가 아닌 중복은 통합. (기계적 일괄삭제 금지 — 시각 회귀 확인하며 진행.)

### 1.5 [P1] CSS의 인라인 스타일 → 클래스화 (유지보수/성능)
`src/app.js`의 렌더 문자열에 인라인 `style="..."`가 광범위(특히 `renderReport`, `renderAnalytics`,
`renderSurveyCreator`). 반복되는 인라인 스타일은 클래스로 추출해 렌더 문자열 길이와 파싱 비용을 줄임.
(P1: 점진적으로. 새로 만지는 컴포넌트부터.)

---

## PART 2 — 성능 (가장 중요)

### 2.1 [P0] 벤더 JS 1.86MB을 지연 로드로 전환 — **초기 로딩 최대 효과**
`webapp/index.html:100-101`에서 다음을 **동기/블로킹**으로 매 페이지 로드마다 받음:
- `xlsx.full.min.js` — **952KB**
- `html2pdf.bundle.min.js` — **906KB**

둘 다 **Report 화면의 엑셀/PDF 내보내기에서만** 필요. 현재는 모든 사용자가 첫 화면(홈)에서도
1.86MB를 파싱/실행함.

**지시:** 두 `<script>` 태그를 제거하고, 내보내기 시점에 동적 로드.
```js
// 예시: report/reportExport.js 진입부
async function ensureXlsx() {
  if (window.XLSX) return window.XLSX;
  await import(/* @vite-ignore */ '../vendor/xlsx.full.min.js'); // 또는 동적 <script> 주입
  return window.XLSX;
}
```
- 빌드 도구가 없으므로(정적 호스팅), 동적 `<script>` 주입 헬퍼(`loadScriptOnce(src)`)로 구현.
- 버튼 클릭 시 "내보내기 준비 중…" 로딩 상태 표시 후 로드 → 실행.

**Acceptance:** 홈 최초 로드 시 네트워크에서 xlsx/html2pdf가 **요청되지 않음**. Report에서 내보내기 클릭
시 1회 로드되어 정상 동작. (Lighthouse TBT/JS 실행시간 대폭 감소 기대.)

### 2.2 [P1] 전체 재렌더 구조 개선
`src/app.js:655 render()` → `canvas.innerHTML = renderView()` (703) 로 **활성 뷰 전체 DOM을 매번 폐기/재생성**,
이어서 `bindCanvasEvents()`(762)가 **모든 이벤트 리스너를 매번 재부착**. 상태 변경/실시간 수신마다 발생.

문제:
- 큰 문자열 빌드 + innerHTML 파싱 + 리스너 churn → 입력/스크롤 끊김, 깜빡임.
- 이미 이전 작업에서 "입력 중 포커스 소실" 버그의 근본 원인이었음(=`saveStateQuiet`로 우회).

권장(점진적):
1. **뷰 단위 가드:** 데이터만 바뀌고 뷰가 동일하면, 전체 교체 대신 영향 영역만 갱신
   (예: 대시보드 KPI 숫자, 응답 카운트 등은 노드 textContent만 패치 — 이미 `render()` 상단 토글/카운트
   패치에서 쓰는 패턴 확장).
2. **이벤트 위임:** `bindCanvasEvents` 대신 `.canvas`에 위임 리스너 1벌을 부착(`data-action` 속성),
   재렌더마다 재부착 제거.
3. (확장) 경량 렌더 라이브러리(예: lit-html/morphdom류) 도입은 P2.

**Acceptance:** 실시간 응답 수신 중에도 입력/스크롤이 끊기지 않음. 같은 뷰 내 데이터 갱신 시 전체 DOM 교체
횟수가 측정상 감소.

### 2.3 [P1] Firestore 실시간 리스너 범위 축소
`src/app.js:4364-4415` 에서 컬렉션 **전체**를 구독:
- `onSnapshot(collection(db,'surveys'))`
- `onSnapshot(collection(db,'responses'))` — 수신마다 **모든 응답 재매핑 + 재정렬**(4377-4396)
- `onSnapshot(collection(db,'QualSignal'))`

데이터가 쌓일수록(연도×기수×세션×인원) 매 제출마다 전체 컬렉션 다운로드/재처리 → 비용·지연 급증.

권장:
- `responses`를 **활성 스코프로 쿼리**: `where('sessionId','in', 활성세션ids)` 또는 화면에서 보는 세션만
  구독. 전역 집계가 필요하면 별도 **집계 문서**(2.5 참고)로 분리.
- 정렬은 `orderBy('createdAt','desc')` + `limit(n)`로 서버 위임.
- 화면을 벗어나면 해당 리스너 `unsubscribe`.

### 2.4 [P1] localStorage 전체 직렬화 빈도/크기 축소
`src/state.js:170 saveState()`가 호출될 때마다 `sessions+responses+surveys+qualSignals` 등 **전체**를
`JSON.stringify` 후 저장. `saveState`는 거의 모든 인터랙션에서 호출됨(app.js 내 호출 수십 곳).

권장:
- **서버 소유 컬렉션(`responses`)은 localStorage에서 제외** — Firestore 실시간으로 다시 받음. 캐시가
  필요하면 별도 키로 분리.
- `saveState`를 **디바운스**(예: 150ms) 또는 "hot(UI 상태) / cold(데이터)" 분리 저장.
- `normalizeAppState`가 매 저장마다 `sessions/surveys` 전체 재매핑(`state.js:183`) → **로드 시 1회만** 수행하도록
  이동.

**Acceptance:** 응답 수백 건 상황에서 입력/탭 전환 시 메인 스레드 long task 감소.

### 2.5 [P2] 대시보드 집계의 사전계산
홈 KPI/신호/퍼널은 매 렌더마다 전체 배열을 순회 계산(`dashboard/dashboardEngine.js`). 데이터 증가 시
무거워짐 → 제출 시점에 갱신되는 **집계 문서**(`stats/summary` 등)로 이동 또는 메모이즈.

### 2.6 [P2] 폰트 가중치 축소
`index.html:11` Outfit 6종 + Plus Jakarta 8종 로드 → 실제 사용하는 weight만 남겨 폰트 트래픽 절감.

---

## PART 3 — UI/UX 디렉터 제안 (한 끗 차이)

전제: 운영자 1인용 조직문화 운영 콘솔. "입력 신뢰 ↑, 인지 부하 ↓, 한눈에 의사결정".

### 3.1 인포그래픽화 (출력 직관성)
현 자산: KPI 카드, 운영 루프 노드, 기초체력 5신호 게이지, 신뢰 퍼널, 레이더 차트(`renderRadarChart` 2040),
사전/사후 막대(`renderChart` 2649). 추가 제안(우선순위순):

1. **[P1] 사전→사후 "변화 화살표(slope) 차트":** 현재는 막대+델타 배지. 두 시점을 잇는
   slope/덤벨 차트로 바꾸면 *방향과 폭*이 한눈에. 차원별 한 줄씩 → 개선/악화 즉시 인지.
2. **[P1] 기초체력 5신호 → 레이더 오버레이(전년 vs 올해 2겹):** 막대 비교(방금 색 분리함) 위에,
   레이더 2겹 오버레이를 추가하면 "전반 형태 변화"를 직관 인지. (`renderRadarChart` 재사용)
3. **[P1] N<3 마스킹의 시각 언어 통일:** 현재 텍스트 "N<3 마스킹". 마스킹 셀은 **빗금 패턴 + 자물쇠
   아이콘 + 회색** 같은 일관된 시각 토큰으로. 보고서 신뢰도↑.
4. **[P2] 운영 루프를 진행률 링(progress ring)으로:** 진단→듣기→응답→실행→재진단 각 단계 완료율을
   원형 게이지로. 지금은 노드+화살표라 "현재 어디까지 왔는지"가 약함.
5. **[P2] 세션 캘린더 히트맵:** 회차 밀도/공백을 월 히트맵으로 → 일정 과부하 구간 인지.

### 3.2 입력 직관성 (데이터 입력)
1. **[P0/저비용] 설문 생성 폼: 단계 표시(stepper) + 인라인 검증:** 제목/세션/시점/문항을 1·2·3 단계로
   시각화하고, "배포 및 QR 생성" 활성 조건(필수값)을 실시간 체크리스트로 표시. (현재는 클릭 후 alert.)
2. **[P1] CSV 업로드 프리뷰 강화:** 이미 프리뷰 존재(`renderUploadPreview` 2604). 컬럼 매핑이 틀리면
   "예상 `[q1]`…`[q11]` vs 실제 헤더"를 **시각 대조표 + 자동매핑 제안**으로. 개인식별자 검출 시 빨간 배지.
3. **[P1] 조직 선택기:** 현재 division→hq→team 드롭다운 체인. **검색형 단일 입력(타이핑→경로 자동완성)**
   추가로 클릭 수 감소(`renderOrgPopup` 1110 기반).
4. **[P2] 기본값/최근값 기억:** 새 설문 시 직전 세션/시점 프리필.

### 3.3 출력 직관성 (인지/이해)
1. **[P0/저비용] 모든 델타에 "의미 라벨":** `+0.32 ↑` 옆에 "유의미 개선/변화 미미/주의" 같은 한 단어
   해석을 색과 함께. (이미 임계값 로직 있음: `app.js:2312` `< 3.5` 등 → 라벨로 노출.)
2. **[P1] 경영진 1페이지 요약 카드:** Report 상단에 "이번 분기 핵심 3문장 + 신호등 3개"를 고정.
   세부 표는 접힘. 의사결정자용.
3. **[P1] 빈 상태(empty state) 일관화:** "데이터 없음" 문구가 화면마다 제각각 → 동일 컴포넌트(아이콘+한 줄
   설명+다음 행동 버튼)로 통일. 신규 운영자 온보딩 체감↑.
4. **[P2] 툴팁 → 인라인 마이크로카피:** 물음표 호버 대신, 중요한 지표는 카드 안에 1줄 설명 상시 노출.

---

## PART 4 — DB / 아키텍처

현 Firestore 컬렉션: `sessions`, `surveys`, `responses`, `pulseResults`, `pulseCommitments`,
`QualSignal`, `accessRequests`, `appState`, `mail`.

### 4.1 [P1] `appState/main` 단일 메가도큐먼트 위험
`src/state.js:424` `uploadStateToDb`가 `sessions+surveys+orgUnits+orgMembers(+qualAnalysis)`를 **한 문서**에
통째로 저장. Firestore **문서 1MB 한도** + 동시쓰기 충돌 위험. 조직/세션 증가 시 한도 도달 가능.
- 권장: 백업 용도라면 명확히 "수동 스냅샷"으로 한정하고, **실데이터의 정본은 개별 컬렉션**으로 유지
  (이미 sessions/surveys 컬렉션 존재). `orgUnits/orgMembers`도 개별 컬렉션 or Storage JSON로 이전 검토.

### 4.2 [P1] `responses` 스키마/쿼리 설계
- 현재 평면 컬렉션 + 전체 구독. 응답 문서에 **`year`/`cohort`/`sessionId`/`phase`/`surveyId`**를 쓰기 시점에
  denormalize(이미 일부 존재) → **복합 인덱스**로 스코프 쿼리:
  - `where('sessionId','==',id).orderBy('createdAt','desc')`
  - 대시보드 집계는 `where('year','==',Y)` 등.
- 필요한 composite index를 `firestore.indexes.json`으로 정의(현재 미존재로 추정 → 추가).

### 4.3 [P1] 보안 규칙 점검 (`firestore.rules`)
- `accessRequests` 승인 흐름·App Check가 있으나, 규칙 파일이 리포에 있는지 확인 후
  컬렉션별 read/write 권한(특히 `responses` 익명 제출 경로, `appState` 관리자 전용)을 명시.
- 익명 폰 제출(`survey.html`) 경로의 write 범위를 `responses`에만 최소 권한으로 제한.

### 4.4 [P2] 집계/리포트 분리
대시보드·리포트 수치는 `stats/{year}` 또는 `sessions/{id}/summary` 같은 **사전계산 문서**로 분리해
읽기 1~수 회로 끝나게. 클라이언트 전수 집계 의존 제거.

### 4.5 [P2] 스키마 문서화
`docs/DATA_MODEL.md`에 컬렉션별 필드/타입/관계/인덱스/규칙을 1곳에 정리(신규 합류 개발자·Antigravity용).

---

## 실행 순서 제안 (Antigravity)
1. **P0 묶음** (반나절): PART1.1~1.3 죽은 코드 제거 → PART2.1 벤더 지연로드 → PART3.2.1 / 3.3.1 저비용 UX.
   → 회귀: 앱 로드, 홈/세션/설문/리포트 각 화면 콘솔 에러 0, 설문 QR·내보내기 동작.
2. **P1 묶음**: PART2.2(이벤트 위임)·2.3(리스너 스코프)·2.4(localStorage) → PART4.1~4.3(DB) → PART3 인포그래픽.
3. **P2 묶음**: 집계 문서화·렌더 라이브러리·폰트/문서화.

## 작업 규약
- 캐시 무효화: `webapp/index.html`의 `?v=` 쿼리와 `app.js`의 `state.js?v=` import 쿼리를 변경분마다 갱신.
- 게이트/스타일 회귀는 브라우저에서 시각 확인(로컬: `cd webapp && python3 -m http.server 4173`).
- N<3 마스킹·개인식별자 미저장 가드(프로젝트 규칙)는 절대 완화 금지.
- 변경마다 작은 단위 커밋. 기본 브랜치는 `main`(GitHub Pages 배포원).
