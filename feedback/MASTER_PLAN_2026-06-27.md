# Culture Platform 3.0 — 마스터 플랜
**작성일:** 2026-06-27  
**포함 내용:** 제품 리뷰 + 기획 방향 + 개발 구현 계획

> 이 문서 한 장으로 현재 상태 진단, 개선 방향, 구현 계획을 모두 파악할 수 있습니다.  
> 새 대화창에서는 이 파일을 읽히고 시작하세요.

---

## 목차

1. [플랫폼 미션 & 현재 구조](#1-플랫폼-미션--현재-구조)
2. [현재 상태 진단 — Pro / Cons](#2-현재-상태-진단--pro--cons)
3. [설문 구조 문제 & 재설계](#3-설문-구조-문제--재설계)
4. [지표 체계 재설계](#4-지표-체계-재설계)
5. [개선 우선순위 — 기획 / UX / 개발](#5-개선-우선순위--기획--ux--개발)
6. [개발 구현 계획 — 작업별 상세](#6-개발-구현-계획--작업별-상세)
7. [완료된 작업](#7-완료된-작업)
8. [기술 참고](#8-기술-참고)

---

## 1. 플랫폼 미션 & 현재 구조

**미션:** 한 명의 OD 실무자가 금융사 조직문화 개입 프로그램을 설계·운영·측정하고, 그 결과를 경영진에게 데이터로 제시하는 운영 도구.

**사용자가 이 플랫폼을 만든 이유:**
1. 조직문화 활동을 서포트하고 다음 할 일을 알려준다
2. 변화+협업에 유연한 조직 상태를 파악한다 (현재 사일로·변화 둔감 금융사 조직)
3. 경영진 설득을 위해 모든 활동을 수치화하여 인덱스로 제시한다
4. Pulse Survey로 기초체력을 체크하고, 세션 운영 후 사전/사후로 변화를 센싱하고, 지속적으로 팔로우업한다

**현재 시스템 흐름:**
```
Pulse Survey (22문항, 글로벌 기업 운영 — 사용자 통제 불가)
    ↓ 도메인 분류 (심리적안전감 / 사일로해소 / 회복탄력성 / 전반분위기)
    ↓ RAG 위험 진단 + 세션 유형 자동 추천
세션 등록 및 운영 (팀빌딩 / 리더십 / 협업)
    ↓ 사전·중간·사후 설문 업로드 (CSV)
문항별 응답 분석 + 질적 시그널
    ↓
변화 리포트 (레이더 차트, 차원별 점수, PDF 출력)
```

**앱 위치:**
- 로컬: `http://localhost:4173/` (webapp 폴더 서빙)
- 배포: `https://zekecreative7.github.io/culture_platform_3.0/webapp/`
- 메인 파일: `webapp/src/app.js` (6123줄), `webapp/src/styles.css` (5942줄)

---

## 2. 현재 상태 진단 — Pro / Cons

### ✅ 잘 하고 있는 것

| 항목 | 평가 |
|---|---|
| 진단→개입→측정 파이프라인 | OD 방법론적으로 구조 자체는 올바름 |
| 도메인 분류 (4개) | 과도하지 않고 실무적으로 설명 가능 |
| 세션 유형 추천 엔진 | Pulse 진단 → 세션 타입 자동 제안. 경쟁 도구에 없는 실용적 기능 |
| N<3 마스킹 | 데이터 윤리 및 신뢰도 관리 잘 되어 있음 |
| 외부 벤치마크 비교 | Medallia / Chubb APAC 기준 제시 = 경영진 설득 레버 |
| 질적 시그널 분석 | `qual-signal.js` 존재 자체가 차별점 |
| 사전·사후 구조 | 방법론 상 타당한 변화 측정 설계 |

### ❌ 핵심 문제 5가지

**문제 1. "할 일 알려준다"는 목적이 구현되어 있지 않음 — 가장 심각**

플랫폼의 1번 목적이 "내가 할 일을 알려준다"인데, 현재 플랫폼은 100% 후행(retrospective) 시각화 도구다. "다음 주에 뭐 해야 하나"를 알려주는 기능이 없다. 세션 추천은 타입(팀빌딩/리더십)만 나오고, 실제 실행 준비사항·팔로우업 일정·후속 설문 발송 시점 등 실무자 TO-DO가 없다.

**문제 2. Pulse Survey 의존 구조의 취약성**

- 글로벌 HR이 문항 번호나 척도를 바꾸면 도메인 로직 전체가 깨짐
- 22문항이 OD 세션 효과 측정용이 아닌 참여도/만족도 측정 목적으로 설계됨
- Pulse와 세션 설문(사전/사후)이 별개 시스템 — 두 데이터 간 통계적 연결 없음
- 코드에 하드코딩: `"심리적안전감": [5, 17, 19]` → 문항 번호 변경 시 전체 분석 붕괴

**문제 3. 점수/가중치의 과학적 신뢰도 미검증**

```js
// webapp/src/pulse/pulseEngine.js
const W = { level: 0.5, unfav: 0.35, decline: 0.15 };
const T = { managerLow: 0.55, orgGap: 0.10 };
```

임의로 설정된 수치다. 경영진이 "이 위험 점수는 어떻게 계산됩니까?"라고 물으면 답하기 어렵다.

**문제 4. 경영진 설득용 인과 서사가 없음**

- "A팀 세션 후 심리적안전감 +0.4점" — 이게 유의미한 변화인지 맥락이 없음
- 개입 안 한 부서와의 비교(대조군) 없음
- 시계열 트렌드("2024년 대비 전체 조직문화 지수 변화") 없음
- PDF 리포트가 세션별 스냅샷이라 연간 누적 효과를 보여주는 뷰 없음

**문제 5. localStorage = 데이터 소실 위험**

모든 세션·분석·응답 데이터가 브라우저 localStorage에 있다. 브라우저 캐시 삭제, 기기 교체, 크롬 업데이트 시 전부 사라진다. 경영진 보고를 위한 증거 데이터가 이 상태로 저장되는 건 심각한 운영 리스크다.

---

## 3. 설문 구조 문제 & 재설계

### 현재 각 레이어 평가

**Pulse 22문항:** 연 1회 기초체력 진단으로는 괜찮다. Q17(두려움 없이 이슈 제기), Q19(설문 후 조치), Q20(포용), Q21(소속), Q22(협업)은 변화 트래커 방향과 잘 맞는다. 단, 너무 크고 느리다 — 연 1회 건강검진이라 "이번 주 나아지고 있나"를 느끼게 하기 어렵다.

**세션 사전/사후 문항:** 심리적안전감 3개, 사일로 3개, 회복탄력성 1개, 전반분위기 1개 (`webapp/src/utils.js:156` 기준). 세션 전후 비교에는 쓸 수 있지만 "무엇이 실제로 바뀌고 있는지"를 잡기엔 얇다.

### 부족한 센싱 5가지

1. **행동 변화** — 현재 문항은 느낌/인식 중심. "실제로 회의에서 말이 늘었는가", "부서 간 요청이 쉬워졌는가", "리더가 약속한 행동을 했는가"가 없다.
2. **전진 감각** — 운영자와 구성원이 "뭔가 조금씩 나아지고 있다"고 느끼는지 묻는 문항이 없다.
3. **약속 이행 체감** — Q19는 Pulse에 있지만 너무 큰 문항. 세션 단위로 별도로 물어야 한다.
4. **변화 지속성** — 사후 설문만 있으면 세션 직후 만족도에 가까워진다. 30/90일 후 확인이 필요하다.
5. **운영 마찰** — 금융사에서 중요한 승인·의사결정·우선순위 충돌 같은 구조적 마찰을 직접 묻는 문항이 약하다.

### 올바른 설문 레이어 구조

| 레이어 | 역할 | 주기 |
|---|---|---|
| **Pulse Survey** | 기초체력 진단 / 경영진 보고 / 리스크 탐지 | 연 1회 (현행 유지) |
| **세션 사전·사후 설문** | 개입 전후 변화 신호 측정 + 행동 변화 문항 추가 | 세션별 |
| **30일/90일 Follow-up** | 행동 변화 유지 여부 확인 | 세션 후 30일, 90일 |

### 추가 권장 문항

**행동 변화 (객관식, 사후/Follow-up에 추가):**
- "이번 세션 이후 우리 팀이 바로 시도할 행동이 명확하다."
- "세션에서 나온 의견이 실제 후속조치로 이어질 것이라고 믿는다."
- "최근 우리 팀에서는 불편한 이슈를 이전보다 더 안전하게 말할 수 있다."
- "리더가 세션에서 약속한 행동을 실제로 보여주고 있다."
- "부서 간 협업에서 막히는 지점이 이전보다 더 명확해졌다."
- "우리 팀은 작은 변화라도 실제로 만들 수 있다는 감각이 있다."
- "지난 2주 동안 팀/리더/조직에서 긍정적인 변화 신호를 본 적이 있다."

**정성 문항 (주관식, 현재 문항 대체 또는 추가):**
- "세션 이후 실제로 달라진 작은 장면이 있다면 무엇입니까?"
- "아직 바뀌지 않았지만 꼭 후속조치가 필요한 것은 무엇입니까?"
- "리더나 회사가 지키면 신뢰가 생길 작은 약속은 무엇입니까?"

---

## 4. 지표 체계 재설계

**핵심 원칙:** Outcome(점수)은 늦게 움직인다. Leading Signal을 먼저 보여줘야 운영자가 전진감을 잃지 않는다. 다이어트에서 체중보다 수면·컨디션·운동 수행력을 먼저 보는 것과 같다.

| 층 | 지표 예시 | 현재 여부 |
|---|---|---|
| **Input** | 세션 수, 약속 등록 수, 설문 배포 수 | ⚠️ 일부 있음 |
| **Process** | 참여율, 응답률, 약속 이행률, 후속 공유율 | ⚠️ 응답률만 있음 |
| **Leading Signal** | 발언 안전감, 정성 감정 변화, 리더 행동 변화, 협업 신호 | ❌ 없음 |
| **Outcome** | Pulse 변화, 사전/사후 점수 변화, 리스크 감소 추세 | ✅ 있음 |

**운영자가 매일 봐야 할 지표 (현재 없음):**
- 이번 주 닫힌 루프 수
- 약속 이행률
- 사후 설문까지 완료된 세션 수
- 정성 답변의 감정 변화 추세
- 점수는 낮지만 개선 신호가 있는 조직
- 점수는 높지만 신뢰도 의심/정체 조직

---

## 5. 개선 우선순위 — 기획 / UX / 개발

### 기획 방향 (P0 → P5)

**[P0] Firebase 마이그레이션 — 모든 기획 변경의 전제조건**  
`firebase.js`가 이미 있다. localStorage 위에 기획 기능을 쌓으면 데이터 날리고 처음부터 다시 하게 된다.

**[P1] Home을 "변화 진행감 트래커"로 재편**  
현재: 전체 부서 RAG 상태 테이블 (보는 것)  
목표: 오늘 할 일 + 이번 달 조직문화 변화 진행률 + 조직별 단계 상태

조직별 단계 흐름:
```
진단 완료 → 세션 진행 중 → 약속 등록 → 사후 설문 완료 → 변화 신호 확인 → 정체 경고
```

**[P2] 세션을 변화 가설 기반으로 재설계**  
세션 생성 시 추가 항목:
- 이 조직의 현재 리스크 (Pulse 자동 연동)
- 이번 세션의 변화 가설
- 바꾸고 싶은 행동
- 사전/사후 측정 문항 커스터마이징
- 30일 후 확인 항목
- 리더가 지킬 작은 약속

→ 세션이 이벤트가 아닌 **변화 실험**이 된다.

**[P3] Change Evidence Report 신설**  
현재 리포트명 "운영 결과" → "Change Evidence Report"  
경영진은 활동량이 아니라 리스크 감소와 변화 가능성을 봐야 한다.

포함 내용:
- 현재 핵심 조직 리스크
- 왜 이 리스크가 중요한가
- 어떤 개입을 했는가 (참여율 포함)
- 어떤 선행 변화(Leading Signal)가 보이는가
- 어떤 후행 결과가 아직 안 움직였는가
- 다음 의사결정은 무엇인가

**[P4] 30/90일 Follow-up 설문 구조 추가**

**[P5] 조직별 변화 타임라인**
```
2026 Pulse 리스크 감지 → 경청 세션 진행 → 리더 약속 등록 → 1차 실행 완료 → 사후 설문 변화 → 30일 후 재확인
```
이게 생기면 플랫폼 정체성이 "분석 도구"에서 "변화가 축적되는 시스템"으로 바뀐다.

### UX 개선

- **세션 카드:** 사전/사후 설문 완료 상태를 카드 레벨에서 바로 보이게
- **대시보드:** "점수 변화 없음 / 선행 신호 있음 / 후속 필요" 상태 판정 추가
- **리포트 PDF:** 설명 텍스트 + 인사이트 요약 자동 포함 (데이터 덤프 → 보고서)
- **세션 생성:** 준비 사항 체크리스트 자동 생성

### 개발 변경

| 우선순위 | 항목 |
|---|---|
| 긴급 | Firebase Firestore 마이그레이션 |
| 긴급 | Pulse 도메인 매핑 버전 관리 (하드코딩 → 버전별 config) |
| 중요 | 세션 상태 머신 명확화 (생성됨/진행중/완료/보류) |
| 중요 | 약속 보드와 세션 결과를 조직별 타임라인으로 연결 |
| 개선 | 가중치 설정 파일 분리 + 근거 주석 (경영진 질문 대비) |
| 개선 | 지표마다 데이터 신뢰도(N-size) 표시 강화 |
| 개선 | 정성 답변 키워드 변화 추적 |

### 현재 상태 vs 목표 요약

| 항목 | 현재 | 목표 |
|---|---|---|
| 목적 1 (할 일 알려주기) | ❌ 없음 | Home TO-DO + 세션 체크리스트 |
| 목적 3 (경영진 설득) | ⚠️ 데이터만 있음 | Change Evidence Report |
| 목적 4 (팔로우업) | ⚠️ 수동 의존 | 30/90일 자동 트리거 |
| 데이터 안전성 | ❌ localStorage | Firebase |
| 변화 센싱 깊이 | ⚠️ 인식 중심 | 행동 변화 + Leading Signal |
| 플랫폼 정체성 | 분석하고 운영하는 도구 | 조직문화 변화가 축적되는 시스템 |

---

## 6. 개발 구현 계획 — 작업별 상세

> 작업 1~8은 완료. 작업 9~14가 다음 구현 대상.

---

### 작업 9 — 모바일 반응형

**목표:** 운영자가 모바일에서 현황 확인 가능하게.  
**파일:** `webapp/src/styles.css`  
**주의:** 기존 `@media (max-width: 767px)` 블록이 2601번째 줄에 이미 있음. 새로 만들지 말고 기존 블록 보강.

#### 변경 1 — 세션 드로어: 우측 패널 → 하단 시트 (767px 이하)

`styles.css` 5990번째 줄 `.session-drawer.open` 아래에 미디어 쿼리 추가:

```css
@media (max-width: 767px) {
  .session-drawer {
    top: auto; left: 0; right: 0; bottom: 0;
    width: 100%; max-height: 92vh;
    border-left: none;
    border-top: 0.5px solid #d0d0d0;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -8px 32px rgba(0,0,0,0.12);
    transform: translateY(100%);
    transition: transform 0.26s cubic-bezier(0.16,1,0.3,1);
  }
  .session-drawer.open { transform: translateY(0); }
  .session-drawer-header { padding: 14px 18px 12px; position: relative; }
  .session-drawer-header::before {
    content: ''; display: block;
    width: 36px; height: 4px; border-radius: 99px;
    background: #d0d0d0;
    position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
  }
  .session-drawer-body { padding: 16px 18px; }
  .session-drawer-footer { padding: 12px 18px; }
  .session-drawer-footer .primary,
  .session-drawer-footer .ghost { flex: 1; justify-content: center; }
  .session-drawer-body .schedule-table {
    overflow-x: auto; -webkit-overflow-scrolling: touch;
  }
  .session-card-grid { grid-template-columns: 1fr; }
  .three-movement-grid { grid-template-columns: 1fr; gap: 12px; }
  .gap-visualization { grid-template-columns: 1fr; gap: 16px; }
  .gap-result-box {
    border-left: none; border-top: 1px solid rgba(148,163,184,0.2);
    padding-left: 0; padding-top: 16px;
  }
  .page-head { flex-wrap: wrap; }
  .page-head > .primary,
  .page-head > .ghost { width: 100%; justify-content: center; }
}
```

#### 변경 2 — 초소형(380px 이하) KPI 1열

```css
@media (max-width: 380px) {
  .dashboard-kpi-grid { grid-template-columns: 1fr; }
  .kpi-value { font-size: 28px; }
  .metric-grid, .metric-grid.slim { grid-template-columns: 1fr; gap: 8px; }
  .session-drawer { max-height: 96vh; }
}
```

**검증:**

| 화면 크기 | 확인 항목 |
|---|---|
| 375px (iPhone SE) | 드로어 하단 시트 ↑, 핸들 바, 카드 1열, KPI 2열 |
| 768px (iPad) | 드로어 우측 패널 유지 |
| 360px (구형 Android) | KPI 1열 |

---

### 작업 10 — 멀티 테넌트 준비

**목표:** Firestore에 `organizationId` 레이어 추가.

**범위:**
- Firestore collections: `sessions`, `responses`, `surveys`, `accessRequests`에 `organizationId` 필드 추가
- `webapp/src/state.js`의 모든 Firestore 쿼리에 `where('organizationId', '==', currentOrgId)` 조건 추가
- `webapp/src/authGate.js`에서 로그인 완료 시 사용자의 `organizationId`를 Firestore에서 읽어오는 흐름 추가

**주의:** 기존 데이터 마이그레이션 필요. 현재 데이터에 organizationId 없으므로 기본값 처리 필요.

---

### 작업 11 — 알림 시스템

**목표:** 오늘 할 일 건수를 사이드바 뱃지 + 탑바 벨 버튼으로 노출.

**핵심 전제:** `dashboardEngine.js`의 `dashboardActionQueue()`가 이미 today/upcoming/ready 그룹을 반환. 새 로직 불필요, UI만 추가.

#### 변경 1 — app.js: todayActionCount 계산 + 사이드바 뱃지

```js
import { dashboardActionQueue } from './dashboard/dashboardEngine.js?v=...';

// render() 함수 내
const todayActionCount = dashboardActionQueue({ state, today })
  .filter(a => a.group === 'today').length;

// nav button 렌더 (dashboard 항목에만)
const badge = (id === 'dashboard' && todayActionCount > 0 && state.activeView !== 'dashboard')
  ? `<span class="nav-badge">${todayActionCount > 9 ? '9+' : todayActionCount}</span>`
  : '';
```

#### 변경 2 — app.js: 탑바 벨 버튼 추가

탑바 사용자 아이콘 왼쪽에:
```html
<button class="topbar-notif-btn ${todayActionCount > 0 ? 'has-notif' : ''}"
        id="topbar-notif-btn" title="오늘 할 일">
  <!-- 벨 SVG -->
  ${todayActionCount > 0 ? `<span class="topbar-notif-dot"></span>` : ''}
</button>
```

이벤트: `#topbar-notif-btn` 클릭 → `setState({ activeView: 'dashboard' })`

#### 변경 3 — styles.css: 뱃지/벨 CSS

```css
.nav-icon { position: relative; display: inline-flex; }
.nav-badge {
  position: absolute; top: -5px; right: -7px;
  min-width: 16px; height: 16px;
  background: #ef4444; color: #fff;
  font-size: 10px; font-weight: 700;
  border-radius: 99px; padding: 0 4px;
  display: flex; align-items: center; justify-content: center;
  pointer-events: none;
}
.topbar-notif-btn {
  position: relative; width: 34px; height: 34px;
  border-radius: 50%; border: 1px solid var(--border, #d0d0d0);
  background: none; cursor: pointer; color: var(--text-secondary, #666);
  display: flex; align-items: center; justify-content: center;
}
.topbar-notif-btn.has-notif { border-color: #ef4444; color: #ef4444; }
.topbar-notif-dot {
  position: absolute; top: 4px; right: 4px;
  width: 7px; height: 7px;
  background: #ef4444; border-radius: 50%; border: 1.5px solid #fff;
}
```

**주의:** `styles.css`에 `.nav-icon`이 이미 있을 수 있음 → 추가 전 전체 검색.

**검증:**

| 상황 | 기대 결과 |
|---|---|
| 오늘 할 일 3개 | 사이드바 홈 아이콘 빨간 뱃지 `3`, 탑바 벨 빨간 테두리 |
| 홈 화면 보는 중 | 사이드바 뱃지 숨김 |
| 오늘 할 일 없음 | 뱃지/벨 없음 |

---

### 작업 12 — 비즈니스 로직 단위 테스트

**목표:** N<3 마스킹, 점수 계산, 기수 추론 함수 검증.  
**도구:** Vitest

#### 설치

```bash
# webapp/ 폴더에서
npm init -y
npm install -D vitest
```

`package.json`:
```json
{
  "type": "module",
  "scripts": { "test": "vitest run" }
}
```

#### 테스트 대상 함수

| 함수 | 파일 | 케이스 |
|---|---|---|
| `scoreOf(responses, questionIds)` | `utils.js` | 정상, 빈 배열, null 포함 |
| `maskIfSmall(n, value)` | `utils.js` | N<3, N=3, N>3 |
| `dashboardActionQueue({ state, today })` | `dashboardEngine.js` | 기한초과/오늘세션/사후대기/보고완료 |
| `getSessionStatus(session)` | `dashboardEngine.js` | 시작전/진행중/완료 |

#### 예시 코드

```js
// tests/utils.test.js
import { describe, it, expect } from 'vitest';
import { scoreOf, maskIfSmall } from '../src/utils.js'; // ?v=... 붙이지 말 것

describe('scoreOf', () => {
  it('유효 응답의 평균 반환', () => {
    const r = [{ q1: 4, q2: 2 }, { q1: 2, q2: 4 }];
    expect(scoreOf(r, ['q1', 'q2'])).toBeCloseTo(3.0);
  });
  it('응답 없으면 null', () => {
    expect(scoreOf([], ['q1'])).toBeNull();
  });
});

describe('maskIfSmall', () => {
  it('N < 3이면 마스킹', () => { expect(maskIfSmall(2, 4.0)).toBe('—'); });
  it('N >= 3이면 값 반환', () => { expect(maskIfSmall(3, 4.0)).toBe(4.0); });
});
```

**주의:**
- import 경로에 `?v=...` 붙이지 말 것 — Node.js에서 못 읽음
- `dashboardEngine.js`가 Firebase import하면 `vi.mock('./firebase.js', () => ({}))` 처리 필요

---

### 작업 13 — app.js 모듈 분리

**목표:** 6123줄 단일 파일 → 뷰별 모듈 분리. 렌더 함수만 이동, 이벤트 바인딩은 `app.js`에 남김.

#### 분리 목표

| 새 파일 | 포함 함수 | 원본 줄 범위 |
|---|---|---|
| `src/views/sessions.js` | renderSessions 외 세션 관련 | 52~1445 |
| `src/views/org.js` | renderOrg, renderOrgPopup 외 | 1446~1758 |
| `src/views/survey.js` | renderSurveyCreator, renderCalendar 외 | 1759~2534 |
| `src/views/upload.js` | renderUpload, renderUploadPreview | 2535~2570, 3668~3712 |
| `src/views/analytics.js` | renderAnalytics, renderRadarChart 외 | 2571~2799, 3713~3911 |
| `src/views/report.js` | renderReport, renderCompareReport 외 | 2800~3533 |

#### 실행 순서

1. `src/views/` 폴더 생성
2. `upload.js` 먼저 (함수 2개, 의존성 단순) → 브라우저 확인
3. `analytics.js` → `report.js` → `survey.js` → `org.js` → `sessions.js`
4. 각 파일 분리 후 즉시 브라우저에서 해당 뷰 렌더 확인

**목표 결과:** `app.js` 2,500줄 이하 (라우팅 + 이벤트만 남김)

---

### 작업 14 — 운영 감사 로그

**목표:** 세션 생성·삭제·설문 배포 이력 Firestore에 기록.

#### 기록할 이벤트

| 이벤트 | action 값 |
|---|---|
| 세션 생성 | `session_created` |
| 세션 수정 | `session_updated` |
| 세션 삭제 | `session_deleted` |
| 설문 배포 토글 | `survey_distribution_toggled` |
| 응답 삭제 | `response_deleted` |
| 약속 저장 | `commitment_saved` |
| 약속 삭제 | `commitment_deleted` |

#### Firestore 문서 구조

컬렉션: `auditLogs`

```js
{
  action: 'session_created',
  userId: 'rhokoo4@gmail.com',
  targetId: 'session-abc123',
  targetType: 'session',  // 'session' | 'survey' | 'response' | 'commitment'
  timestamp: serverTimestamp(),
  detail: '리더십 3기 세션 생성'
}
```

#### 구현 순서

1. `authGate.js` 292번째 줄 `currentUser = user` 아래: `window.__currentUserEmail = user.email;`
2. `state.js`에 `writeAuditLog()` 함수 추가 (실패해도 본 작업 막지 않게 try/catch)
3. `saveSessionToFirestore`, `deleteSessionFromFirestore`, `setSurveyDistributionActiveInFirestore` 3개에 먼저 적용
4. Firebase Console `auditLogs` Security Rules 추가
5. 브라우저에서 세션 생성 → Firestore Console에서 `auditLogs` 문서 확인
6. 나머지 함수 적용
7. 탑바 드롭다운에 "운영 로그" 항목 추가 (최근 20건 모달)

**주의:** `orderBy` 사용 시 Firestore 인덱스 필요 — Firebase Console에서 자동 생성 링크 클릭.

---

## 7. 완료된 작업

### 레이어 1 — 즉시 개선 (완료)

| # | 작업 | 파일 | 상태 |
|---|---|---|---|
| 1 | 네비게이션 한국어화 | app.js VIEWS 배열, styles.css | ✅ |
| 2 | 상단 바 정리 (6개→사용자 아이콘+드롭다운) | app.js topbar-actions | ✅ |
| 3 | eyebrow 영문 제거 | app.js 전체 eyebrow | ✅ |
| 4 | 신뢰 회복 퍼널 빈 상태 개선 | dashboardViews.js | ✅ |

### 레이어 2 — 단기 개선 (완료)

| # | 작업 | 파일 | 상태 |
|---|---|---|---|
| 5 | 로그인 배경 완화 | styles.css .auth-gate | ✅ |
| 6 | 대시보드 KPI skeleton + dbStatus 안정화 | dashboardViews.js, state.js | ✅ |
| 7 | 세션 생성 폼 슬라이드 패널(drawer) 분리 | app.js, styles.css | ✅ |
| 8 | 필터 패턴 통일 | app.js | ✅ |

### 작업 7 후속 버그 수정 (완료, push 여부 확인 필요)

- **버그 1:** `.sidebar { z-index: 99 }` → `z-index: 320` (4724번째 줄)
- **버그 2:** `.session-drawer-body`에 `min-height: 0` 추가 (5998번째 줄)
- **버그 3:** `.session-drawer-body .schedule-row` 압축된 grid-template-columns 적용

---

## 8. 기술 참고

### 파일 구조

```
webapp/
├── index.html
├── src/
│   ├── app.js               ← 메인 (6123줄)
│   ├── state.js             ← Firestore 연동, 상태 관리
│   ├── utils.js             ← 순수 유틸 함수 (243줄)
│   ├── firebase.js          ← Firebase 초기화, App Check
│   ├── authGate.js          ← 인증 게이트
│   ├── styles.css           ← 전체 스타일 (5942줄)
│   ├── config/
│   │   ├── questions.js
│   │   ├── domains.js       ← 도메인 분류 (심리적안전감 등)
│   │   ├── pulseDivisionMap.js
│   │   ├── pulseDivisions.js
│   │   └── pulseRelations.js
│   ├── dashboard/
│   │   ├── dashboardEngine.js   ← KPI 계산, 액션 큐 로직
│   │   └── dashboardViews.js    ← 홈 대시보드 렌더링
│   ├── pulse/
│   │   ├── pulseEngine.js       ← 위험 점수 계산 (가중치 W, T 여기 있음)
│   │   ├── pulseViews.js
│   │   ├── pulseTemplate.js
│   │   ├── pulseUpload.js
│   │   └── pulseCommitments.js
│   ├── qual/
│   │   ├── qual-signal.js
│   │   ├── qual-signal-panel.js
│   │   └── qual-analysis-modal.js
│   ├── report/
│   │   └── reportExport.js
│   └── views/               ← 작업 13 분리 후 생성
│       ├── sessions.js
│       ├── org.js
│       ├── survey.js
│       ├── upload.js
│       ├── analytics.js
│       └── report.js
└── tests/                   ← 작업 12 추가 후 생성
    ├── utils.test.js
    ├── dashboardEngine.test.js
    └── fixtures/
```

### 알아야 할 코드 quirk

1. **캐시버스팅:** import 경로에 `?v=날짜-슬러그` 붙임. 파일 수정 시 버전 문자열도 함께 올려야 브라우저가 최신 파일을 읽음.

2. **마스터 이메일 하드코딩:** `authGate.js` 6번째 줄에 `MASTER_EMAIL = 'rhokoo7@naver.com'`. 공개 레포 보안 위험.

3. **App Check 로컬 디버그 토큰:** 로컬에서 Firebase 접근 시 콘솔에 토큰이 찍힘. Firebase Console → App Check → Debug tokens에 1회 등록 필요.

4. **styles.css 다중 테마:** 같은 선택자가 파일 내 여러 번 나옴. 수정 시 반드시 전체 검색 후 모두 확인.

5. **Firestore 응답 복구 로직:** `app.js` 5967번째 줄 근처 `recoveredSurveys`가 있으면 매 snapshot마다 전체 응답 조회 실행됨. 데이터 증가 시 성능 이슈.

6. **Pulse 위험 점수 가중치:** `pulseEngine.js`에 하드코딩된 `W = { level: 0.5, unfav: 0.35, decline: 0.15 }`. 경영진 질문 대비해 근거 문서화 필요.

### 다음 대화 시작 방법

```
이 파일(feedback/MASTER_PLAN_2026-06-27.md)을 읽고
Culture Platform 3.0 작업을 이어서 진행해줘.
[구체적인 요청]
```
