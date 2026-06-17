# 개발 사양서 (Codex 핸드오프) — Pulse 진단 & 프로그램 추천 모듈

> 버전: v1.0 · 작성일 2026-06-17
> 대상 구현자: **Codex (코딩 전담)**
> 작성자 역할: 제품 의도 · 화면 기획 · 논리 구조 · 화면 설계 (이 문서가 단일 진실 소스)
> 상위 근거 문서: `PulseSurvey_Insight_and_RecommendationEngine.md` (수치·가설·엔진 로직의 출처)
> 적용 대상 코드베이스: `culture_platform_3.0/webapp` (Vanilla JS SPA, 빌드 없음, Firestore)

---

## 0. 이 문서의 사용법 (Codex 필독)

- **이 문서에 적힌 공식·임계값·매핑·상태는 임의로 바꾸지 않는다.** "튜닝 가능"이라고 명시된 상수만 `config` 객체로 빼서 조정 가능하게 둔다.
- **추론·발명 금지.** 명세가 모호하면 구현을 멈추고 `// TODO(spec): 질문` 주석으로 표시한다.
- **기존 스택을 유지한다.** 빌드 시스템·프레임워크·번들러 도입 금지(현재 "빌드 없음"은 의도적 선택). ES Modules + 순수 CSS + 기존 디자인 토큰만 사용.
- **가드레일은 불변(§9).** 위반하는 구현은 거부 대상.
- 범위 밖(인증, 멀티테넌시, 데이터모델 전면 정규화)은 **이번 작업에서 건드리지 않는다.** §10에 경계만 표시.

---

## 1. 제품 의도 (왜 만드는가)

### 1.1 목표
플랫폼의 최종 목표는 **"변화에 유연한 조직"** 을 만드는 것이다. 그 수단으로 이 모듈은 다음 루프를 자동화한다:

```
Pulse Survey(기초체력 진단)  →  이 모듈(진단 해석 + 어디에 무엇을 투입할지 추천)  →  세션 설계·운영  →  재측정
```

### 1.2 이 모듈이 해결하는 문제
현재 플랫폼은 Pulse 결과를 *보여주기만* 한다. 운영자(실무자)는 "그래서 **어느 본부를 먼저, 어떤 세션에, 무엇에 집중**시켜야 하는가"를 직접 판단해야 한다. 이 모듈은 그 판단을 **데이터 기반 추천**으로 자동 생성한다.

### 1.3 핵심 설계 원칙
- **이중 레이어:** 같은 화면에서 *쉬운 말(실무자·CEO)* 과 *전문 근거(검증용)* 를 토글로 전환. 기본은 쉬운 말.
- **추천은 처방이 아니라 출발점:** 추천 결과에서 바로 "이 추천으로 세션 만들기"로 기존 세션 생성 화면에 연결.
- **숫자는 근거, 메시지가 우선:** 화면 상단은 결론·행동, 숫자는 하단/펼침.
- **평가가 아니라 배정 근거:** 낮은 점수 = 벌점이 아니라 *프로그램 우선 배정 자격*. 카피 전체가 이 톤(§8).

---

## 2. 사용자 & 사용 시나리오

| 사용자 | 권한(현재) | 핵심 Job |
|---|---|---|
| 운영자(조직문화 담당, 본인) | 전체 읽기/쓰기 | Pulse 결과 업로드 → 추천 확인 → 세션 설계로 연결 |
| 임원/CEO | (향후 조회 전용, 이번엔 동일 화면) | 전사 한 장 요약을 보고 의사결정 |

**대표 시나리오 (Happy Path):**
1. 운영자가 Pulse 집계 결과(부문×문항)를 업로드한다.
2. 모듈이 전사/부문 진단과 추천을 자동 계산해 **전사 개요 화면**을 띄운다.
3. 운영자가 "먼저 챙길 부문" 목록에서 한 부문을 눌러 **부문 상세 화면**으로 들어간다.
4. 추천 세션·집중점을 확인하고 **"이 추천으로 세션 만들기"** 를 눌러 기존 세션 생성 화면으로 이동(프리필).
5. 임원에게 공유 시 화면 상단의 **쉬운 말 요약**만으로 설명된다.

---

## 3. 정보 구조 (IA) — 기존 내비게이션에 추가

기존 사이드바 메뉴(Sessions / Organization / Survey Creator / Upload / Change Analysis / Report)에 **신규 1개 섹션**을 추가한다.

```
사이드바
 ├─ Sessions
 ├─ Organization
 ├─ Survey Creator
 ├─ Upload
 ├─ Change Analysis
 ├─ Report
 └─ ★ Pulse Insights (신규)   라벨: "조직 진단 · 추천 / Pulse Insights"
      ├─ 화면 A: 전사 개요 (Enterprise Overview)   ← 기본 진입
      ├─ 화면 B: 부문 상세 (Division Detail)        ← A에서 부문 클릭 시
      └─ 화면 C: 추천 우선순위 목록 (Priority List)  ← A의 탭 또는 A 내 섹션
```

라우팅은 기존 SPA 방식(해시/상태 기반)을 따른다. 신규 라우트 키: `pulse-overview`, `pulse-division/:deptId`, `pulse-priority`.

---

## 4. 데이터 모델 (입력 스키마)

### 4.1 중요한 전제
Pulse 입력은 **이미 집계된 부문×문항 데이터**다(개인 응답 아님). 개인 원자료는 받지 않는다(가드레일). 따라서 세션용 `responses` 컬렉션과 **별도 컬렉션**을 쓴다.

### 4.2 Firestore 컬렉션 (신규)
```
pulseResults/{year}        — 연도별 Pulse 집계 문서 (예: pulseResults/2026)
```
문서 구조(JSON):
```json
{
  "year": 2026,
  "companywide": {
    "Q1": { "fav": 0.55, "p5": 0.30, "p4": 0.25, "p3": 0.29, "p2": 0.10, "p1": 0.06 },
    "...": {},
    "Q22": { "...": 0 }
  },
  "divisions": {
    "고객솔루션본부UW": {
      "n": 35,
      "items": {
        "Q1": { "fav": 0.25, "p5": 0.15, "p4": 0.10, "p3": 0.35, "p2": 0.25, "p1": 0.15 },
        "...": {}
      }
    },
    "...": {}
  },
  "engagementScore": {                 // 본사 공식 제공값 — 플랫폼이 계산하지 않고 그대로 저장·표시
    "company":   { "y2024": 0.38, "y2025": 0.43, "y2026": 0.41, "exOutlier2026": 0.34 },
    "divisions": { "고객솔루션본부UW": { "y2025": 0.42, "y2026": 0.17 }, "...": {} },
    "source": "HQ",                    // 출처 표시용
    "note": "Q1~5를 모두 4점 이상 준 응답자 비율(본사 정의). 로컬 계산 없음."
  },
  "meta": {
    "reorgBaselineYears": [2025],      // baseline이 복제된 연도
    "uploadedAt": "ISO-8601"
  }
}
```
- `fav`는 표시·검증용이며, 엔진은 `fav = p5 + p4`로 **재계산해 일치 검증**한다(불일치 시 경고 로그).
- `engagementScore`는 **본사 공식 제공값**이다. 플랫폼은 이 값을 *계산하지 않고* 입력받은 그대로 저장·표시한다. 앞으로도 본사가 매년 제공한다. 표시 시 작은 워닝/출처 표기만 단다(§6.8·§11). 응답자 단위가 없어 부문 게이트 분해 등은 불가하지만, 이 값 자체는 신뢰해 사용한다.
- 이전 연도(`pulseResults/2025`, `pulseResults/2024`)도 같은 구조. 2024는 `divisions`가 없을 수 있음(전사만) → §6.9 처리.

### 4.3 업로드 포맷 — 업로드 템플릿(.xlsx) 기준, raw 파일 구조 그대로

업로드는 **플랫폼이 제공하는 연도별 템플릿**(§15, 예: `Pulse_Survey_2027_Upload_Template.xlsx`)을 채워 올린다. 템플릿은 기존 raw 파일 구조를 그대로 따른다. 파서는 이 와이드(wide) 레이아웃을 읽는다.

**시트 구조(파서가 읽는 대상):**
- **`Pulse_{year}` 시트(와이드):** 행 = 22개 문항. 열 = `No`, `질문`, `BM_Medallia`, `BM_ChubbAPAC`, `BM_Fav`, 그다음 **블록**이 `전사` → 18개 본부 순으로 반복. 각 블록 6열 = `FAV, 5, 4, 3, 2, 1`(비율 0~1). `FAV`는 템플릿에서 `=5점+4점` 수식이므로 파서는 무시하고 `p5+p4`로 재계산.
- **`응답자수(N)` 시트:** `부문`, `응답자수(N)`. 마스킹 판정용(§6.2).
- **`EngagementScore(본사제공)` 시트:** `구분`(전사+18본부) × 연도 열 + `{year}` 입력 열. → `engagementScore`로 적재. **계산 금지, 입력값 그대로.**
- 헤더 2행(블록명 / FAV·5·4·3·2·1)은 병합 처리. 파서는 2행 헤더를 기준으로 열을 매핑한다.

**검증:** 각 블록의 `5+4+3+2+1` 합이 0.98~1.02 밖이면 셀 오류 표시. 문항 1~22. 개인식별 컬럼/시트 발견 시 업로드 차단(기존 로직 재사용). 업로드 전 프리뷰 + 오류 하이라이트(기존 Upload UX).

> CSV로도 받고 싶으면 동일 와이드 레이아웃을 CSV로 내보낸 형태를 허용하되, **기본 경로는 템플릿 .xlsx**다.

### 4.4 문항 정의 (상수, `config/questions.js`)
```js
export const QUESTIONS = {
  1:"우리 회사를 일하기 좋은 회사로 추천할 의향", 2:"회사에서 일하는 것이 자랑스럽다",
  3:"주어진 일이 개인적 성취감을 준다", 4:"앞으로 12개월 이상 더 근무할 의향",
  5:"조직 내에서 내 의견은 존중받는다", 6:"업무 수행에 필요한 자료 접근 권한",
  7:"내 업무가 회사 목표에 기여하는지 이해", 8:"기대되는 역할을 명확히 이해",
  9:"역할 수행에 적절한 행동이 무엇인지 이해", 10:"필요한 스킬을 배울 기회가 있다",
  11:"웰빙 관련 지원을 편하게 요청할 수 있다", 12:"회사가 웰빙 가이드·프로그램 제공",
  13:"매니저가 성과 향상에 도움되는 피드백 적시 제공", 14:"매니저가 잘한 일을 인정",
  15:"매니저가 문제 상황 해결을 돕는다", 16:"매니저와 역량개발·성장을 정기적으로 대화",
  17:"두려움 없이 문제·이슈를 제기할 수 있다", 18:"차상위 리더가 회사 일을 적시 공유",
  19:"지난 서베이 결과에 조치가 취해졌다", 20:"회사가 포용적 업무환경 조성에 노력",
  21:"회사에 소속감을 느낀다", 22:"동료들이 업무를 위해 협업한다"
};
```

---

## 5. 도메인 매핑 (상수, `config/domains.js`)

4대 측정 도메인 ↔ 문항. 보조 클러스터(매니저)는 세션 분기용.
```js
export const DOMAINS = {
  "심리적안전감": [5, 17, 19],
  "사일로해소":   [22, 18, 7],
  "회복탄력성":   [11, 12, 15, 10],
  "전반분위기":   [1, 2, 4, 21, 20]
};
export const MANAGER_CLUSTER = [13, 14, 15, 16]; // 세션 타입 분기용(도메인 평균엔 미포함)
export const CORE = [1, 2, 3, 4, 5];             // 인게이지먼트 코어(Engagement Score 게이트 항목)
```

---

## 6. 계산 로직 (엔진) — `engine/pulseEngine.js`

모든 함수는 **순수 함수**(입력→출력, 부수효과 없음). 입력은 §4.2 구조.

### 6.1 기본 지표 (부문 d, 연도 y)
```
favItem(d, q)      = items[q].fav   (없으면 null)
unfavItem(d, q)    = items[q].p2 + items[q].p1
share5(d)          = mean_q(items[q].p5)                 // 응답 균일성 판정용
domainScore(d, D)  = mean( favItem(d,q) for q in DOMAINS[D] if not null )
overall(d)         = mean( favItem(d,q) for q in 1..22 if not null )
unfavAvg(d)        = mean( unfavItem(d,q) for all q )
manager(d)         = mean( favItem(d,q) for q in MANAGER_CLUSTER )
core(d)            = mean( favItem(d,q) for q in CORE )
net(d, q)          = favItem(d,q) - unfavItem(d,q)
```

### 6.2 N<3 마스킹 (가드레일)
```
if (d.n != null && d.n < 3)  → 부문 전체 마스킹: status="masked", 점수 표시 안 함, 추천 생략
if (d.n == null)             → status="n_unknown": 추천은 하되 "표본 미확인" 배지 노출
```

### 6.3 이상치 탐지 (튜닝 가능 상수)
```
const OUTLIER = { share5Max: 0.65, zMax: 2.0, unfavFloor: 0.05 };
companyMean = mean(overall(d) for non-masked d)
companySd   = sd(overall(d) for non-masked d)
isOutlier(d) =
   share5(d) >= OUTLIER.share5Max
   OR ( (overall(d) - companyMean)/companySd >= OUTLIER.zMax  AND  unfavAvg(d) <= OUTLIER.unfavFloor )
```
- 이상치는 **계산은 하되**(값 표시) `status="outlier"`로 분리: 전사 평균·우선순위 순위·부문 비교에서 제외하고, 화면엔 항상 ⚠ 경고 배지 + 이유 툴팁(§8.3 카피).

### 6.4 전년 대비 변화 + 조직개편 플래그
```
delta25(d) = overall_2026(d) - overall_2025(d)
reorgFlag(d) = true if (이 부문의 2025 baseline이 다른 부문과 동일값으로 복제됨)
              판정: 2025 overall 값이 둘 이상 부문에서 정확히 일치하면 해당 부문들 reorgFlag=true
```
- `reorgFlag`면 우선순위의 변화량 가중을 0으로(§6.5) + 화면에 ⚑ "조직개편 영향" 배지.

### 6.5 우선순위 인덱스 (비-이상치, 비-마스킹 대상만)
```
const W = { level: 0.5, unfav: 0.35, decline: 0.15 };   // 튜닝 가능
declineTerm(d) = reorgFlag(d) ? 0 : max(0, -delta25(d))
priority(d) = W.level*(1 - overall(d)) + W.unfav*unfavAvg(d) + W.decline*declineTerm(d)
정렬: priority 내림차순(클수록 시급). 동률 시 overall 오름차순.
```

### 6.6 집중 도메인 (focus) — 회사 대비 상대 약점
```
companyDomainMean(D) = mean(domainScore(d, D) for non-outlier, non-masked d)
gap(d, D) = companyDomainMean(D) - domainScore(d, D)   // 클수록 회사보다 약함
focusDomain(d) = argmax_D gap(d, D)
focusPoint(d)  = focusDomain 안에서 favItem 최저(동률 시 unfav 최고) 문항 1~2개
```

### 6.7 세션 추천 결정 트리 (deterministic)
```
const T = { managerLow: 0.55, orgGap: 0.10 };   // 튜닝 가능
managerLow(d)       = manager(d) < T.managerLow
gapCM(d)            = manager(d) - core(d)
orgConstrained(d)   = (manager(d) >= T.managerLow) && (gapCM(d) >= T.orgGap)  // 매니저는 OK인데 인게이지/소속이 처짐
managerConstrained  = managerLow(d) && (gapCM(d) <= 0)                        // 매니저가 약한 고리

recommendSession(d):
  if isOutlier(d) || status=="masked":  return { type:"보류", reason:"데이터 재확인 필요" }
  if orgConstrained(d):
        return { type: (focusDomain=="사일로해소" ? "크로스펑셔널(6주)" : "팀빌딩(8주)"),
                 focus: "소속·포용", note:"매니저는 양호 — 팀장 교육 아님, 팀 결속" }
  if managerConstrained || managerLow(d):
        return { type:"팀장 세션(4주)", focus: focusDomain, note:"매니저 강화 시 상승 여력" }
  // 그 외: focusDomain → 세션 매핑
  switch(focusDomain):
     "사일로해소"  → "크로스펑셔널(6주)" / focus:"협업·사일로"
     "회복탄력성"  → "팀빌딩(8주)" / focus:"회복·에너지"
     "심리적안전감" → "팀장 세션(4주)" / focus:"안전감(이슈제기·신뢰)"
     "전반분위기"  → "팀빌딩(8주)" / focus:"소속·분위기"
```

### 6.8 전사 집계(화면 A 상단)
```
overallCompany   = mean(overall(d) for non-outlier, non-masked d)     // "진짜 숫자"
overallWithOutlier = mean(overall(d) for non-masked d)                 // 참고용(이상치 포함)
domainMeans      = { D: companyDomainMean(D) }
trend(year)      = companywide 기준 매칭 문항 평균 FAV  (2024/2025/2026)
themeTrends      = §1.2 5개 테마의 연도별 평균(웰빙/매니저/펀더멘털/포용·소속/설문신뢰)
favNeutralUnfav(q) = { fav, neutral:p3, unfav:p2+p1 }  // 화면 A 발산 표현용
engagementScore  = pulseResults.engagementScore.company  // 본사 제공값 그대로 표시(계산 안 함)
                   // 전사 ScoreCard에 사용. 기본 표시값 = exOutlier2026(34%), 호버에 포함값(41%).
                   // 카드 하단에 작은 워닝: "본사 제공 공식값 · 플랫폼 미계산"
```

### 6.9 2024 데이터 부재 처리
2024는 `divisions` 없음 → 전사 추이(화면 A의 3개년 라인)에만 사용. 부문 화면(B)은 2025·2026만 비교. 누락 연도는 라인에서 "데이터 없음" 처리(0으로 그리지 말 것).

---

## 7. 화면 기획 & 설계

> 기존 디자인 시스템 사용: 비비드 블루, 카드 섀도우, **RAG 색상**(Red<40% / Amber 40–60% / Green>60%, 임계값 튜닝 가능), 접이식 사이드바, 모바일 드로어. 모든 화면 상단에 **[쉬운 말 ⇄ 전문] 토글**(기본 쉬운 말).

### 공통 컴포넌트
- `LayerToggle` — 쉬운 말/전문 전환(전역 상태, 화면 전환해도 유지)
- `RAGBadge(value)` — 점수→색
- `OutlierBadge` / `ReorgBadge` / `MaskedBadge` — 경고 배지 + 호버 툴팁(이유)
- `ScoreCard(title, value, delta, rag)` — 큰 숫자 카드
- `EmptyState` — 데이터 미업로드 시 안내 + 업로드 CTA

### 7.1 화면 A — 전사 개요 (Enterprise Overview) `pulse-overview`

목적: CEO가 위 3줄만 읽어도 핵심이 잡히게. 결론 → 행동 → 우선 부문 순.

```
┌───────────────────────────────────────────────┐
│ [쉬운 말 ⇄ 전문]                    연도: 2026 ▾ │
├───────────────────────────────────────────────┤
│ ① 한 줄 결론 (큰 글씨)                            │
│   "평균은 안정(66%)이지만, 핵심인 팀장·소속감이      │
│    약해졌습니다. 아직 되돌릴 수 있는 시점입니다."     │
├───────────────────────────────────────────────┤
│ ② ScoreCard ×3                                  │
│   [전사 점수 34%* ]  [빨간불: 포용 ▼]  [설문신뢰 37%]│
│   *이상치 2개 제외 기준 (호버: 포함 시 41%)         │
├───────────────────────────────────────────────┤
│ ③ 발산(divergence) 시각화                         │
│   좋아진 것(웰빙·매니저) ↑  vs  약해진 것(소속·자부심) ↓│
│   (전문 모드: 테마별 2025→2026 수치·FAV/중립/UNFAV) │
├───────────────────────────────────────────────┤
│ ④ "먼저 챙길 5개 부문" 카드 리스트                  │
│   각 카드: 부문명 · 추천세션 배지 · 한 줄 이유 · [상세>]│
├───────────────────────────────────────────────┤
│ ⑤ (쉬운 말) 숫자 읽을 때 주의 박스                  │
│    · 부서끼리 줄세우지 마세요 · 작은 부서 들쭉날쭉    │
│    · 이상치 2개 주의                               │
└───────────────────────────────────────────────┘
```
- **쉬운 말 모드:** ①②④⑤ 중심, 숫자 최소, 용어 0. (Key Driver, 잔차, Net 등 금지어 §8.2)
- **전문 모드:** ③에 테마 추이표·발산 수치, 별도 섹션으로 Key Driver Top, 깨진 커플링, 도메인 평균표 노출.
- 데이터 없으면 `EmptyState` → Upload로 유도.

### 7.2 화면 B — 부문 상세 (Division Detail) `pulse-division/:deptId`

목적: 이 부문에 **무엇을, 왜** 추천하는지 + 바로 세션 생성으로 연결.

```
┌───────────────────────────────────────────────┐
│ ◀ 전사로  | 부문명  [⚑조직개편] [⚠이상치(해당 시)]   │
├───────────────────────────────────────────────┤
│ ① 추천 배너 (큰 카드)                             │
│   "추천: 팀빌딩(8주) · 집중: 소속·포용"             │
│   이유 한 줄(쉬운 말): "팀장은 잘하고 있어요.        │
│    문제는 팀 사이 연결이에요."                      │
│   [ 이 추천으로 세션 만들기 ▶ ]                    │
├───────────────────────────────────────────────┤
│ ② 도메인 4축 점수 (레이더 또는 막대) + RAG          │
│   심리적안전감 / 사일로해소 / 회복탄력성 / 전반분위기  │
│   (회사 평균과 겹쳐 표시 → 상대 약점 한눈에)         │
├───────────────────────────────────────────────┤
│ ③ 집중점(focusPoint) 1~2문항 — 가장 약한 항목 명시  │
├───────────────────────────────────────────────┤
│ ④ (전문 모드) 문항별 FAV/중립/UNFAV 표 + 2025 대비  │
│    매니저 클러스터 점수, gapCM, 결정 트리 경로 표시   │
└───────────────────────────────────────────────┘
```
- ① 버튼 → §7.4 연결(세션 생성 프리필).
- 이상치 부문이면 ① 추천 배너 대신 **경고 배너**(이유 4가지 §8.3) + "응답자 수 확인" 안내, 세션 버튼 비활성.

### 7.3 화면 C — 추천 우선순위 목록 (Priority List) `pulse-priority`

전체 16개 부문(+이상치 2개는 하단 별도)을 우선순위 순으로. 운영자의 "작업 큐".

| 열 | 내용 |
|---|---|
| 순위 | priority 내림차순 |
| 부문 | 이름 + 배지(⚑/⚠) |
| 상태 | overall + RAG |
| 약점 | focusDomain |
| 추천 | 세션 타입 배지 |
| 액션 | [상세] [세션 만들기] |

- 이상치 2개는 **표 하단에 회색 처리 + ⚠**, 정렬에서 제외.
- 마스킹 부문은 "표본 부족" 배지로 별도.

### 7.4 기존 기능 연결 — "이 추천으로 세션 만들기"

화면 B/C의 버튼 → 기존 **Survey/Session Creator** 화면으로 이동하며 다음을 프리필:
```
{ deptId, sessionType: rec.type(→ 기존 3종 매핑), focusArea: rec.focus, focusPoints: [...] }
```
세션 타입 매핑: `팀장 세션(4주)`→기존 "팀장", `팀빌딩(8주)`→"팀빌딩", `크로스펑셔널(6주)`→"크로스펑셔널". 프리필 후 운영자가 일정만 채우면 되도록.

---

## 8. 카피(문구) 가이드 — 이중 레이어

### 8.1 원칙
- 쉬운 말 = 결론 먼저, 상황 언어, 비유 OK, 숫자 최소.
- 전문 = 근거·수치·방법론.
- **같은 사실, 다른 표현.** 토글로 전환되며 내용 모순 금지.

### 8.2 쉬운 말 모드 **금지어**(나오면 안 됨)
`Key Driver`, `상관/상관계수`, `r=`, `잔차/residual`, `AND 게이트`, `Net`, `z-score`, `회귀`, `learned helplessness`, `Edmondson`. → 모두 풀어서 표현.
예) "매니저가 인게이지먼트의 최강 동인(r=.86)" → "직원이 마음 붙이는 데 **가장 큰 영향은 '내 팀장이 어떤가'**예요."

### 8.3 이상치 경고 카피 (툴팁/배너 고정 문구)
> ⚠ 이 부서(예: 고객경험혁신본부CE)는 점수를 **그대로 믿지 마세요.** ① 점수가 비현실적으로 높고(전사 평균을 크게 상회), ② 거의 모든 문항을 최고점으로 답해(응답 쏠림 의심), ③ 응답 인원이 적어 들쭉날쭉하며, ④ 거의 만점이라 '가장 약한 곳'을 가려내기 어렵습니다. **실행 전 응답자 수·분포를 먼저 확인**하세요.

### 8.4 부서 전달 톤(운영자용 안내 문구, 화면 A⑤·B에 노출)
"낮은 점수 = 벌점이 아니라, 프로그램을 먼저 받을 자격입니다. 부서끼리 줄 세우지 말고, '어디를 먼저 도울지' 자료로 쓰세요."

---

## 9. 가드레일 & 비기능 요구사항 (불변)

- **N<3 마스킹** 모든 표시·계산에 적용(§6.2).
- **개인 식별자 저장·표시 금지**, 개인 추적 불가(집계만). 업로드 시 식별자 컬럼 차단.
- **Pulse는 세션 변화 공식과 별개 컨텍스트** — 이 모듈의 추천을 세션 효과 측정과 혼용 금지(별 컬렉션·별 화면).
- **이상치·조직개편 부문**은 평균·순위에서 분리하되 화면엔 경고와 함께 표시.
- 빌드 도구·프레임워크 도입 금지. `app.js` 비대화 방지를 위해 신규 코드는 **별도 ES 모듈**로 분리(`pulse/` 폴더): `pulseEngine.js`, `pulseViews.js`, `config/`.
- 성능: 부문 ~20 × 문항 22 규모 → 클라이언트 계산으로 충분. Firestore 읽기는 연도 문서 단위(1 read/년).
- 접근성: RAG 색에 **텍스트/아이콘 병기**(색맹 대비). 모바일 드로어·반응형 유지.

---

## 10. 범위 경계 (이번 작업에서 하지 않음)

PLATFORM_STATUS §6의 스케일업 항목 중 **인증/역할, 멀티테넌시, 데이터모델 전면 정규화, AI 분석 자동화, 구글폼 자동수집**은 본 모듈 범위 밖이다. 단, 본 모듈의 신규 컬렉션(`pulseResults`)은 향후 정규화와 충돌하지 않도록 `appState/main` 블롭에 넣지 말고 **독립 컬렉션**으로 둔다.

---

## 11. 외부 의존 / 미해결 (구현 전 확인 필요)

- **Engagement Score(38/43/41, 이상치 제외 34%)는 본사 공식 제공값으로 확정.** 플랫폼은 *계산하지 않고* 입력값을 그대로 표시한다. 앞으로도 본사가 매년 제공한다. 표시할 때 카드 하단/툴팁에 **작은 워닝 한 줄만** 단다: "본사 제공 공식값 · 플랫폼에서 계산하지 않음(정의: Q1~5 모두 4점 이상 비율)". 별도 "산식 검증" 배지나 차단 로직은 두지 않는다.
- **Engagement Score 부문 게이트 분해**(누가 어느 항목에서 탈락하는지): 개인 응답이 없어 계산 불가. 본사가 *마스킹된 분해 집계*를 별도로 주면 `pulseResults/{year}.engagementScore.gateDecomp`에 적재하고 해당 UI를 노출, 받기 전엔 숨김. (이건 게이트 *분해*에 한한 얘기이며, 위의 본값 38/43/41/34는 이미 확정·사용.)

---

## 12. 구현 순서 (단계별, 각 단계 끝에 동작 확인)

1. **데이터 계층:** CSV 업로드 파서(§4.3) + `pulseResults/{year}` 적재 + `fav=p5+p4` 검증.
2. **엔진:** `pulseEngine.js` 순수 함수 전부(§6) + 콘솔 검증 하니스(샘플 입력→기대 출력).
3. **화면 A(전사 개요)** 쉬운 말 레이어 → 전문 레이어.
4. **화면 C(우선순위 목록)** + 이상치/마스킹 분리.
5. **화면 B(부문 상세)** + 레이더·집중점.
6. **연결:** "이 추천으로 세션 만들기" 프리필(§7.4).
7. **경고·배지·카피** 마감(§8) + 접근성 점검(§9).

---

## 13. 수용 기준 (수동 체크리스트 — 테스트 프레임워크 없음)

- [ ] 2026 업로드 시 전사 개요가 **이상치 제외 34% 기준**으로 표시되고, 호버에 포함 41% 노출.
- [ ] 고객경험혁신본부CE·Data_Control이 ⚠ 배지 + 경고 카피와 함께 **순위/평균에서 분리**됨.
- [ ] DigitalSales 부문 상세에서 추천이 **팀빌딩/크로스펑셔널**(팀장 아님)로 나오고, 이유에 "매니저는 양호" 문구 포함.
- [ ] 매니저가 약한 소비자보호·대면영업·인사관리는 **팀장 세션**으로 추천됨.
- [ ] N<3(또는 n 미입력) 부문이 마스킹/배지 처리됨.
- [ ] 조직개편 baseline 복제 부문에 ⚑ 배지 + 변화량 가중 0 적용.
- [ ] 쉬운 말 모드에서 §8.2 금지어가 화면에 **하나도** 없음.
- [ ] "이 추천으로 세션 만들기"가 기존 세션 생성 화면에 타입·집중점을 프리필.
- [ ] 색상 RAG에 텍스트/아이콘 병기(색만으로 의미 전달 금지).
- [ ] 세션 생성 화면에서 팀 선택 시 본부 요약 칩이 뜨고, [상세 보기]가 §7.2로 이동.
- [ ] 점수 좋은 본부(예: 인사관리·법무, 약점 도메인도 60%↑)는 문제 키워드 대신 **"전반 양호"** 가 뜸.
- [ ] "포용 불만 큼" 키워드는 전사 평균보다 확연히 높은 본부에서만 뜸(전 본부 남발 금지).
- [ ] 이상치 본부 칩은 회색+⚠ 경고로, 상태성 키워드 억제·[상세 보기] 유지.
- [ ] Pulse 데이터 없는 본부는 "데이터 없음" 칩이 뜨고 세션 생성은 계속 가능.
- [ ] Engagement Score는 본사 입력값을 **그대로 표시**(로컬 계산 없음), 카드 하단에 "본사 제공값" 워닝 한 줄. 기본 34%, 호버 41%.
- [ ] `[업로드 템플릿 다운로드]`가 `Pulse_Survey_{year}_Upload_Template.xlsx`를 생성하며, 4개 시트·문항·Benchmark·기존 Engagement Score가 채워져 있음.
- [ ] 다운로드한 템플릿을 채워 업로드하면 §4.3 파서가 무수정으로 읽음(라운드트립).

---

## 14. 본부 요약 칩 — 세션 생성 연동 (신규 요청 반영)

### 14.1 의도
세션 생성 화면에서 팀을 고르면, 그 팀이 속한 **본부의 상태를 즉시 알아차리는 요약 칩**이 뜬다. "들으면 바로 무슨 얘긴지 아는" 키워드 + 핵심 수치 1개로. 더 보려면 칩의 버튼으로 해당 본부 **상세 화면(§7.2)** 으로 점프. 운영자가 세션 설계 중 맥락을 잃지 않게 하는 장치.

### 14.2 저장 구조 — 업로드 시 미리 계산해 저장
세션 생성마다 전 엔진을 재계산하지 않도록, Pulse 업로드(§12-1) 직후 엔진이 **본부 요약 맵**을 만들어 함께 저장한다.
```
pulseResults/{year}.summaries = {
  "<deptId>": {
    "status": "시급" | "주의" | "양호",     // overall RAG: R→시급, A→주의, G→양호
    "rag": "R" | "A" | "G",
    "overall": 0.37,
    "headline": "소진·회복 필요",            // 대표 키워드 1개
    "keywords": ["소진·회복 필요", "팀장 강화 필요"], // 0~3개(controlled list)
    "keyStat": { "label": "전반 점수", "value": "37%", "sub": "전사 최저권" },
    "recSession": "팀빌딩(회복)",            // §6.7 추천 타입 축약
    "flags": { "outlier": false, "reorg": true, "masked": false },
    "route": "pulse-division/<deptId>"
  }
}
```
- 세션 생성 화면은 이 한 필드만 읽으면 됨(추가 Firestore read 1회/년). 최신 연도 `summaries`는 `appState`/localStorage에 캐시해 즉시 표시.
- 요약은 **엔진의 동일 입력에서 결정적으로 파생**된다(§6 함수 재사용). 별도 수기 입력 없음.

### 14.3 키워드 생성 규칙 (controlled vocabulary — 결정적)
키워드는 **미리 정의된 어휘에서만** 나온다(자유 생성 금지 → 항상 "들으면 아는 말"). 임계값은 튜닝 가능.

```js
const CHIP = { unfavMargin: 0.05, managerLow: 0.55, domainConcern: 0.60 }; // 튜닝 가능

// (a) 약점 도메인 키워드: '회사 대비 약점'이면서 '절대값도 우려 수준(<domainConcern)'일 때만
const DOMAIN_KW = {
  "심리적안전감": "말하기 어려움·신뢰 낮음",
  "사일로해소":   "협업 단절·사일로",
  "회복탄력성":   "소진·회복 필요",
  "전반분위기":   "소속감 약화"
};
// (b) 보조 신호 키워드(해당 시 추가)
//   manager(d) < managerLow                         → "팀장 강화 필요"
//   unfavItem(d,20) >= companyUnfav(20) + unfavMargin → "포용 불만 큼"   // 전사보다 확연히 높을 때만
//   reorgFlag(d)                                     → "조직개편 영향"
//   isOutlier(d)                                     → "데이터 재확인"   // 이 경우 (a)(b) 다른 키워드 억제

buildKeywords(d):
  if isOutlier(d):  return ["데이터 재확인"]            // 경고만, 상태성 키워드 금지
  if masked(d):     return ["표본 부족"]
  kws = []
  if domainScore(d, focusDomain(d)) < CHIP.domainConcern:   // 약점이 '진짜 낮을 때만'
        kws.push(DOMAIN_KW[focusDomain(d)])
  if manager(d) < CHIP.managerLow:               kws.push("팀장 강화 필요")
  if unfavItem(d,20) >= companyUnfav(20)+CHIP.unfavMargin: kws.push("포용 불만 큼")
  if reorgFlag(d):                               kws.push("조직개편 영향")
  if kws.length == 0:                            kws = ["전반 양호"]   // 좋은 본부는 오해 키워드 금지
  return dedupe(kws).slice(0, 3)

headline = keywords[0]
```
**핵심 보정:** 약점 도메인 키워드는 *상대적 약점 + 절대값 < 60%* 둘 다 만족할 때만. 그래서 인사관리·법무처럼 약점 도메인도 60% 이상인 본부는 문제 키워드 대신 **"전반 양호"** 가 뜬다(오해 방지).

### 14.4 keyStat(핵심 수치) 선정 규칙
칩에 숫자 1개만 노출. 우선순위:
```
if isOutlier → { "전반 점수", overall%, "이상치 — 신뢰 주의" }
elif status=="시급" → { "전반 점수", overall%, "전사 최저권" if overall<=P10 else "낮음" }
elif "포용 불만 큼" in keywords → { "포용 불만", unfav20%, "전사 평균 대비 ↑" }
elif manager<managerLow → { "팀장 평가", manager%, "낮음" }
else → { "전반 점수", overall%, status }
```

### 14.5 칩 UI (세션 생성 화면 내)
PLATFORM_STATUS §3.1의 "팀 선택 시 인원 자동 표시" 영역 **바로 아래**에 칩을 렌더. 팀 → 소속 본부(deptId)는 조직도에서 이미 해석되므로 그 deptId로 `summaries[deptId]` 조회.

```
┌──────────────────────────────────────────────┐
│ ● [시급]  고객솔루션본부UW                       │   ● = RAG 색 점(+텍스트 병기)
│ 키워드:  소진·회복 필요 · 팀장 강화 필요           │
│ 핵심수치: 전반 점수 37% (전사 최저권)             │
│ 추천:    팀빌딩(회복)              [ 상세 보기 ▶ ]│ ← §7.2로 이동
└──────────────────────────────────────────────┘
```
- 상태 색: 시급=Red, 주의=Amber, 양호=Green (색만으로 의미 전달 금지 → 라벨 병기, §9).
- `flags.outlier`면 칩 전체를 회색+⚠로, 추천 영역 대신 §8.3 경고 1줄, [상세 보기]는 유지.
- `flags.reorg`면 ⚑ 작은 배지.
- `flags.masked` 또는 해당 연도 Pulse 데이터 없음 → 칩 대신 "이 본부의 진단 데이터 없음" + (있으면) 업로드 안내. 세션 생성은 그대로 진행 가능(칩은 보조 정보).
- 칩은 **읽기 전용**. 세션 폼 값을 자동 변경하지 않는다(운영자 판단 보존). 단 [상세 보기]에서 §7.4 "이 추천으로 세션 만들기"로 돌아오면 프리필 가능.

### 14.6 엣지 케이스
- 팀이 여러 본부에 걸친 크로스펑셔널 차출 → 관련 본부 칩을 **여러 개** 스택으로(최대 3개, 나머지 "+N").
- `summaries`에 deptId 없음(신설 조직 등) → "데이터 없음" 칩.
- 키워드가 3개 초과로 산출 → headline 포함 상위 3개만(상태성 > 약점 > 보조 순).

---

## 15. 업로드 템플릿 다운로드 (2027 대비, 신규 요청 반영)

### 15.1 의도
내년(2027)부터 운영자가 **빈 템플릿을 받아 채워 업로드**할 수 있게 한다. 템플릿은 기존 raw 파일 구조와 동일해, 본사/운영자가 익숙한 양식 그대로 작성한다.

### 15.2 위치 & 동작
- **Upload 화면**과 **Pulse Insights 화면 A**에 `[업로드 템플릿 다운로드 ▾]` 버튼. 연도 선택(기본 = 다음 연도, 예: 2027).
- 클릭 시 해당 연도용 `.xlsx` 생성·다운로드. 파일명: `Pulse_Survey_{year}_Upload_Template.xlsx`.
- (선택) 동일 레이아웃 CSV 다운로드도 제공 가능하나 기본은 .xlsx.

### 15.3 템플릿 내용 (§4.3 포맷과 1:1 일치 — 파서가 그대로 읽을 수 있어야 함)
4개 시트:
1. **`안내(먼저 읽기)`** — 작성법 + 가드레일(개인정보 금지, 줄세우기 금지, N<3 마스킹 안내).
2. **`Pulse_{year}`** — 22문항 행 × [No, 질문, Benchmark×3, (전사 + 18본부)×(FAV,5,4,3,2,1)]. 질문 텍스트·Benchmark는 **미리 채워** 제공. 5/4/3/2/1 칸은 빈칸(입력은 파란색), `FAV`는 `=5점+4점` 수식(자동).
3. **`응답자수(N)`** — 부문별 N 입력(마스킹용).
4. **`EngagementScore(본사제공)`** — 전사+18본부 × 연도. 2024~2026 값은 채워 제공, `{year}` 열은 빈칸(노란색). 상단에 본사 제공값 워닝.

### 15.4 구현 방식 (스택 제약 준수 — 빌드 없음)
- 클라이언트에서 .xlsx 생성은 **SheetJS(xlsx) CDN**을 사용(기존 CDN import 패턴과 동일, 빌드 불필요).
- 템플릿의 **질문 목록·Benchmark·부문 목록·기존 연도 Engagement Score**는 `config/`의 상수에서 주입(하드코딩 금지, §4.4·§5 재사용).
- 부문 목록은 조직도(`org_data.json`)가 아니라 **Pulse 부문 집계 단위**(18본부)를 쓴다. 둘이 다를 수 있으므로 `config/pulseDivisions.js`로 분리 관리.
- **참고 산출물:** 본 문서와 함께 제공되는 `Pulse_Survey_2027_Upload_Template.xlsx`가 정답 레이아웃이다. 생성 로직은 이 파일과 동일한 시트·열·서식을 만들어야 한다(검증 기준).

### 15.5 라운드트립 보장
다운로드한 템플릿을 (채워서) 업로드하면 §4.3 파서가 **무수정으로 읽혀야 한다.** 다운로드 포맷 = 업로드 파서 입력 포맷. 한쪽을 바꾸면 반드시 다른 쪽도 같이 바꾼다.

---

## 부록 A — 참조 추천 결과 (검증용 정답표, 16부문)

엔진이 아래와 일치해야 한다(이상치 제외, 2026 기준). 출처: 상위 근거 문서.

| 순위 | 부문 | overall | 약점 도메인 | 추천 |
|---|---|---|---|---|
| 1 | 고객솔루션본부UW | 37% | 회복탄력성 | 팀빌딩(회복)+팀장 |
| 2 | DT 운영본부 | 45% | 심리적안전감 | 팀장 |
| 3 | DigitalSales | 47% | 전반분위기 | 팀빌딩/크로스펑셔널(매니저 양호) |
| 4 | 소비자보호본부 | 49% | 심리적안전감 | 팀장(상승여력) |
| 5 | GA영업본부 | 50% | 회복탄력성 | 팀빌딩(회복)+팀장 |
| 6 | DT혁신본부/CISO | 52% | 심리적안전감 | 팀장 |
| 7 | 고객경험혁신본부본사 | 60% | 심리적안전감 | 팀장 |
| 8 | 채널전략본부 | 60% | 전반분위기 | 팀빌딩/크로스펑셔널 |
| 9 | 재무관리회계투자본부 | 60% | 전반분위기 | 팀빌딩 |
| 10 | 경영관리본부 | 62% | 전반분위기 | 팀빌딩 |
| 11 | 계약서비스본부 | 64% | 심리적안전감 | 팀장 |
| 12 | 고객솔루션본부상품/헬스 | 64% | 심리적안전감 | 팀장 |
| 13 | 계리RM본부 | 65% | 전반분위기 | 팀빌딩 |
| 14 | 대면영업지원본부 | 68% | 심리적안전감 | 팀장(상승여력) |
| 15 | 인사관리부문 | 70% | 전반분위기 | 팀장(상승여력)/모니터링 |
| 16 | 법무/준법/감사/대외협력 | 71% | 심리적안전감 | 모니터링 |
| ⚠ | 고객경험혁신본부CE | 95% | (무의미) | 보류 — 이상치 |
| ⚠ | Data_Control | 84% | (무의미) | 보류 — 이상치 |

---

# Part B — 착수 가능 보강 (실제 코드 기준, 블로커 해소)

> 리뷰에서 도출된 착수 블로커 3개(통합 지점·전사 화면 함수·부문 매핑)를 `app.js`/`org_data.json` 실측으로 메운다. **이 Part가 Part A보다 우선한다.**

## 16. 기존 코드 통합 지점 (app.js v현재 — 실측)

신규 코드는 `pulse/` 모듈로 분리하되, 아래 **4개 지점에만** 손댄다(그 외 기존 코드 수정 금지).

### 16.1 라우팅 — `VIEWS` 배열에 1줄 추가 (현재 L72)
```js
const VIEWS = [
  ["dashboard","Home","홈"], ["sessions","Sessions","세션"], ["org","Organization","조직"],
  ["survey","Survey Creator","설문지"], ["upload","Upload","데이터 업로드"],
  ["analytics","Change","변화 분석"], ["report","Report","리포트"],
  ["pulse","Pulse Insights","조직 진단"],   // ★ 추가
];
// NAV_ICONS 에 pulse: `<svg .../>` 1개 추가(기존 아이콘과 동일 톤).
```

### 16.2 라우터 분기 — `renderView()` if-chain에 1줄 (현재 L745)
```js
function renderView() {
  if (state.activeView === "sessions") return renderSessions();
  ...
  if (state.activeView === "pulse")    return renderPulse();   // ★ 추가 (pulse/pulseViews.js)
  return renderDashboard();
}
```
- 화면 A/B/C 전환은 별도 라우트를 만들지 말고 **`state.pulseView`**(="overview"|"division"|"priority")와 **`state.pulseDeptId`** 로 `renderPulse()` 내부에서 분기한다(기존이 해시 라우팅이 아니라 `state.activeView` 단일 스위치 방식이므로 그 패턴을 따른다).

### 16.3 재렌더 패턴 — 전체 innerHTML 교체 후 `bindGlobal()` (현재 L680, L2554)
- 이 앱은 **가상 DOM 없음**: `render()`가 `#app.innerHTML`을 통째로 다시 쓰고 `bindGlobal()`에서 `[data-view]` 등 이벤트를 재바인딩한다.
- 따라서 Pulse 화면의 버튼은 **`data-view` 또는 신규 `data-pulse-*` 속성**으로 달고, `bindGlobal()` 끝에 `bindPulse()` 호출 1줄을 추가한다. 인라인 `onclick` 금지(재렌더 시 소실). 상태 변경 후엔 항상 `saveState(); render();`.
```js
function bindGlobal(){ ... ; bindPulse(); }   // ★ 마지막에 추가
// bindPulse(): document.querySelectorAll('[data-pulse-view]') 등 클릭 → state.pulseView/ pulseDeptId 설정 → saveState(); render();
```

### 16.4 상태 영속화 — `blankState()` + `saveState()` 화이트리스트 **둘 다** 등록 (현재 L196, L212)
- ⚠ **함정:** `saveState()`는 필드를 **명시적 구조분해 화이트리스트**로만 저장한다(L212~). 신규 영속 필드를 `blankState()`에만 넣고 `saveState()` 목록에 빠뜨리면 **새로고침 시 사라진다.**
- 추가할 영속 상태: `activeView`는 이미 저장됨. 신규로 `pulseView`, `pulseDeptId`, `pulseLayer`("easy"|"expert")를 **두 곳 모두**에 등록.
- Pulse 원자료(`pulseResults`)는 localStorage state에 넣지 말 것(용량·구조). Firestore 컬렉션 + 메모리 캐시(`window.__pulseCache`)로 둔다.

### 16.5 Firestore — 기존 패턴 그대로, 신규 컬렉션 (현재 L1, L3656·L3674·L3714)
- import는 L1에서 이미 `setDoc, getDoc, getDocs, collection, doc` 제공. 추가 import 불필요.
- **세션과 동일 패턴**으로 신규 컬렉션 사용(블롭 `appState/main`에 넣지 말 것 — 기존에도 sessions/responses/surveys는 독립 컬렉션):
```js
// 적재
await setDoc(doc(db,'pulseResults', String(year)), payload);
// 로드
const snap = await getDoc(doc(db,'pulseResults', String(year)));
```
- DB 상태 점(`setDbStatus`)·`btn-db-upload/download`(L1088) 흐름은 건드리지 않는다.

### 16.6 세션 화면 칩 삽입 위치 (현재 L2892 `#session-team` change)
- 세션 생성의 팀 선택 핸들러(`#session-team` change, L2892)가 이미 `state.draftTeamId`를 세팅하고 `render()`한다. 칩은 **이 팀의 상위 본부(hq)** 를 구해 §부록 B 매핑으로 Pulse deptId를 찾아 `renderSessionConfigPanel`(L1019) 하단에 렌더한다.
- 팀→본부: 기존 헬퍼 `describe…`/`teamUnitsForSelection`(L334) 및 부모 추적 로직(L394~398, `parent.level==='hq'`)을 재사용. **새 조직 탐색 로직을 만들지 말 것.**

---

## 17. 전사 화면(A) 계산 함수 — 멀티연도 (Part A §6 보강)

화면 A는 2024–2026을 동시에 읽는다. `pulseResults/2024|2025|2026` 3개 문서를 로드해 아래 함수에 넣는다. **연도 누락 시 0으로 그리지 말고 라인에서 제외**(§6.9).

```
loadPulseYears([2024,2025,2026]) → { 2024:doc, 2025:doc, 2026:doc|null }

companyFav(year, q)   = doc[year].companywide["Q"+q].fav   // = p5+p4 재계산
trendMatched(years)   = 각 연도에서 '세 해 모두 존재하는 문항'만으로 평균 FAV
                        // 검증값: 2024 58.7% / 2025 65.6% / 2026 66.1%
themeTrend(themeQs, year) = mean(companyFav(year,q) for q in themeQs)
  THEMES = { 웰빙:[11,12], 매니저:[13,16], 펀더멘털:[1,2,4], "포용·소속":[20,21], 설문신뢰:[19] }
  // 검증값(2025→2026): 웰빙 42→59, 매니저 57→64, 펀더멘털 70→62, 포용·소속 60→52, 설문신뢰 36→37
favNeutralUnfav(year,q) = { fav:p5+p4, neutral:p3, unfav:p2+p1 }
net(year,q)           = (p5+p4) - (p2+p1)
```
- 이 값들은 **전사(companywide)** 기준이며 부문 평균이 아니다(부문 평균과 헷갈리지 말 것).
- 화면 A의 ScoreCard "전사 점수"는 **engagementScore.company.exOutlier2026(34%)** 표시(§6.8), 추이 라인은 위 `trendMatched`.

---

## 부록 B — Pulse 18본부 ↔ 조직도(org_data.json) 매핑 (★ 블로커 #6, 필수)

**실측 결과:** Pulse 부문은 조직도 hq와 **입도(granularity)가 다르다.** 1:1은 7개뿐, 나머지는 분할/병합/부재다. 자동 이름매칭 금지. 아래 표를 `config/pulseDivisionMap.js`로 박되, ⚠ 행은 **운영자가 업로드 시 명시 확정**해야 한다(자동 추정은 보조).

```js
// pulseDeptId : { orgUnitIds:[...], relation, confidence }
export const PULSE_DIV_MAP = {
  "Data_Control":          { orgUnitIds:["<Data Control본부>"],       relation:"1:1",   confidence:"high" },
  "DigitalSales":          { orgUnitIds:["<Digital Sales본부>"],       relation:"1:1",   confidence:"high" },
  "GA영업본부":             { orgUnitIds:["<GA영업본부>"],              relation:"1:1",   confidence:"high" },
  "경영관리본부":           { orgUnitIds:["<경영관리본부>"],            relation:"1:1",   confidence:"high" },
  "대면영업지원본부":        { orgUnitIds:["<대면영업지원본부>"],        relation:"1:1",   confidence:"high" },
  "소비자보호본부":         { orgUnitIds:["<소비자보호본부>"],          relation:"1:1",   confidence:"high" },
  "채널전략본부":           { orgUnitIds:["<채널전략본부>"],            relation:"1:1",   confidence:"high" },
  "인사관리부문":           { orgUnitIds:["HR"],                        relation:"division",confidence:"med" }, // 부문 레벨

  // ⚠ 운영자 확정 필요 (분할: 조직도 1개 본부를 Pulse가 둘로 쪼갬)
  "고객솔루션본부UW":       { orgUnitIds:["<고객솔루션본부>"], relation:"split",  confidence:"low" },
  "고객솔루션본부상품/헬스": { orgUnitIds:["<고객솔루션본부>"], relation:"split",  confidence:"low" },
  "고객경험혁신본부CE":     { orgUnitIds:["<고객경험혁신본부?>"], relation:"split", confidence:"low" }, // org hq 목록에 없음
  "고객경험혁신본부본사":   { orgUnitIds:["<고객경험혁신본부?>"], relation:"split", confidence:"low" },

  // ⚠ 운영자 확정 필요 (병합: 조직도 여러 본부를 Pulse가 하나로 묶음)
  "계리RM본부":            { orgUnitIds:["<계리본부>","<RM본부>"],                 relation:"merge", confidence:"low" },
  "재무관리회계투자본부":    { orgUnitIds:["<재무관리본부>","<투자본부>"],           relation:"merge", confidence:"low" },
  "법무/준법/감사/대외협력": { orgUnitIds:["<법무&프라이버시본부>","<대외협력본부>","<최고감사책임자>"], relation:"merge", confidence:"low" },

  // ⚠ 운영자 확정 필요 (조직도 매칭 불명/부재)
  "DT 운영본부":           { orgUnitIds:["<DT부문 하위 ? (인프라서비스/Operation)>"], relation:"unclear", confidence:"low" },
  "DT혁신본부/CISO":       { orgUnitIds:["<CISO본부 (+혁신?)>"],                     relation:"unclear", confidence:"low" },
  "계약서비스본부":         { orgUnitIds:["<조직도에 없음 — 확인>"],                  relation:"missing", confidence:"low" }
};
```
**구현 규칙:**
- `<...>`는 실제 `org_data.json`의 `units[].id`로 채운다(이름 아님, id로). 위 표는 이름 기준 초안.
- 칩/세션 연동에서 팀의 상위 hq id → 이 맵을 **역방향**(orgUnitId→pulseDeptId)으로 조회. 한 orgUnit이 분할 부문에 걸치면(고객솔루션 등) **둘 다 후보로 칩 스택**(§14.6) + "분할 부문 — 확인" 배지.
- `confidence!=="high"`인 부문은 칩·추천에 **"매핑 확인 필요" 배지**. 운영자가 업로드 시 `pulseResults/{year}.meta.divMapConfirmed=true`로 잠그기 전엔 추천을 *제안(draft)* 으로만 표시.
- 매핑 불명/부재(`missing`,`unclear`)는 칩 "데이터 매핑 없음"으로 처리하고 세션 생성은 정상 진행.

---

## 부록 C — PM 평결 & 권장 착수 범위

**평결:** 기획서 A / 착수 사양 B+ → Part B 반영 후 **A− (착수 가능)**.

**MVP 절단(권장):** 한 PR에 전부 X. 아래 순서로 자른다.
1. **Phase 1 (가치 검증):** Upload(템플릿 §15) + 화면 A 전사 개요(쉬운 말) + engagementScore 표시. 추천엔진 없음. → 작고 안전, 통합 리스크만 검증.
2. **Phase 2 (엔진):** §6 엔진 + 화면 C 우선순위 + 이상치/마스킹. 부록 A 정답표로 검증.
3. **Phase 3 (연동):** 화면 B 상세 + 세션 칩(부록 B 매핑) + "이 추천으로 세션 만들기".

**남은 1차-구현 중 확정 항목:** ③reorgFlag 수동지정(자동 false-positive 위험), ④이상치 2-pass(순환정의 회피), ⑦추천 신뢰도 라벨(N 작음), ⑧엣지 경로(일부 문항 누락/ N 누락/ 전년 없음). 이 4개는 코드 리뷰 게이트에 포함.
