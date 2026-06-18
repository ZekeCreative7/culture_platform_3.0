# 정성 신호 레이어 (Qualitative Signal Layer) 스펙 v1.0

작성일: 2026-06-19
상위 근거: `wow_balance_report_page_spec_v1.0.md` (이하 "리포트 스펙"), `qual_analysis_prompt_v1.0.md`
한 줄 원칙: **주관식 LLM 분석 결과는 ACRI(정량 엔진)에 합치지 않는다. 별도 레이어에서 "정성 신호"로 나란히 보여주고, 사람이 검수한 것만 반영한다.**

---

## 0. 왜 분리하는가 (설계 근거)

LLM이 주관식을 점수화해 ACRI에 합치면 세 가지가 깨진다.
1. **재현성:** 같은 텍스트도 모델·프롬프트·버전에 따라 점수가 흔들린다. ACRI는 측정 지표(variance=defect)인데 variance 큰 도구를 측정값 자리에 넣게 된다.
2. **측정 대상:** 주관식은 6축 구조로 물은 게 아니다. 언급 없는 축에 점수를 만들면 측정이 아니라 추론(가짜 정밀도)이다.
3. **신뢰 계약:** 출처 글리프에 LLM 점수를 끼우면 "AI가 매긴 점수 믿냐"라는 공격면이 생긴다.

따라서 LLM은 **연속 점수가 아니라 범주형 신호**(테마·빈도·방향·인용·축 언급 여부/강도)만 낸다. 이건 "의미 있는 숫자"이되 측정값이 아니다.

---

## 1. 데이터 구조 (Firestore)

ACRI 정량 컬렉션(`TeamScoreCurrent`, `OrgAggregateScore`)과 **물리적으로 분리된 별도 컬렉션**.

### 1.1 컬렉션 `QualSignal`

```text
QualSignal (collection)
  docId: {session_id}__{phase}
  ├─ session_id          string
  ├─ phase               'pre' | 'post'
  ├─ team_id             string
  ├─ session_type        'teambuilding' | 'leadership' | 'collaboration'
  ├─ instrument_version  'legacy' | 'current'
  ├─ analyzed_n          number              # 분석에 넣은 응답 수
  ├─ themes              Theme[]             # 스키마: qual_analysis_prompt
  ├─ axis_signals        { [axisKey]: AxisSignal }   # 점수 아님(범주형)
  ├─ tone_distribution   { positive, neutral, negative }
  ├─ flags               Flag[]
  ├─ analysis_meta       { prompt_version, model, temperature, analyzed_at }
  ├─ review              Review              # 검수 상태
  └─ source_label        'ai_qual'           # 고정: AI 정성·측정값 아님
```

```text
AxisSignal = { mentioned: bool, strength: 'strong'|'moderate'|'weak'|null,
               direction: 'positive'|'negative'|'mixed'|null, evidence_quote: string|null }
Theme      = { label, mention_count, direction, quotes: string[] }
Flag       = { label, severity: 'high'|'medium'|'low', quote }
Review     = { status: 'draft'|'confirmed'|'rejected', reviewer, reviewed_at, edits: object|null }
```

### 1.2 불변 규칙 (코드 가드)

- `QualSignal`에는 `axis_score`, 0~100 점수, 5점 평균 등 **정량 점수 필드가 존재해서는 안 된다.** 파서가 발견 시 거부.
- ACRI 계산 함수(리포트 스펙 §7의 tier 계산, OrgAggregate 집계)는 `QualSignal`을 **입력으로 받지 않는다.** import 자체를 금지(린트 규칙 또는 런타임 `assertNotQuantInput`).
- 패널 렌더 시 `review.status === 'confirmed'`인 문서만 노출. draft/rejected는 패널 비표시.

---

## 2. 워크플로우 (분석 버튼 → 검수 → 반영)

```text
1. [세션 카드]  주관식 응답이 있는 세션에만 "정성 분석" 버튼 노출
                (current 세션의 q11/q12, legacy 세션의 주관식 전부)
2. [버튼 클릭]  모달 오픈
3. [모달]       세션 메타 + 주관식 응답을 끼워 프롬프트 자동 생성(버전 고정)
                → "프롬프트 복사" 버튼
4. [앱 밖]      사용자가 GPT/Claude에 붙여넣고 실행 (temperature ≤0.2 안내)
5. [모달]       결과 JSON을 "결과 붙여넣기" 영역에 paste → "파싱"
6. [파서]       스키마 검증. 점수 필드 발견 시 거부. 실패 필드 표시.
7. [검수 UI]    추출된 테마·축신호·플래그·인용을 표시.
                사용자가 편집/삭제/방향 수정 가능. (human-in-the-loop)
8. [확정]       "확정" → review.status='confirmed'로 QualSignal 저장 → 패널 반영
```

핵심: 7번 검수가 안전장치다. 자동 합산이 아니라 **사람이 본 것만** 들어간다. 6번 파서 거부가 정량 오염 방지의 코드 레벨 방어선이다.

---

## 3. 정성 신호 패널 설계

### 3.1 위치

현 단계(정량 콜드스타트)에서는 리포트 스펙 ④ 상태·⑥ The Ask 옆에서 가장 강하다. 별도 섹션 "현장의 목소리(정성)"로 배치하거나 ⑤ 진단 하단에 둔다. **ACRI 6축 레이더(⑦c)와는 시각적으로 구분되는 별도 위젯.**

### 3.2 구성 요소

1. **출처 헤더(고정):** `AI 정성 분석 · 측정값 아님 · 참고` + 모델/날짜/검수자.
2. **톤 분포:** 가로 스택바 (positive/neutral/negative 카운트).
3. **6축 신호 strip:** 6칸. 언급된 축만 방향=색, 강도=농도. 미언급 축은 회색 "미언급". **숫자 점수 없음.** ACRI 레이더와 다른 표현(strip)으로 혼동 차단.
4. **테마 리스트:** label + mention_count 바 + 방향 색 + 대표 인용(토글).
5. **플래그 칩:** red-flag(severity 색).

### 3.3 ACRI와의 관계 (화면 규칙)

- 같은 페이지에 있어도 "나란히, 합치지 않음." 정성 신호 strip과 ACRI 6축 레이더는 별개 위젯이며, 둘을 한 차트에 겹치지 않는다.
- 정성 신호는 출처색 `--provenance-masked` 계열 또는 전용 정성 토큰을 쓰고, 직접측정(teal)/추정(amber)과 구분한다.

---

## 4. 컴포넌트 (코드 파일)

```text
js/qual/qual-signal.js          # 스키마 상수, buildPrompt, parseQualJson, 가드
js/qual/qual-analysis-modal.js  # 분석 버튼 + 팝업(생성·붙여넣기·파싱·검수·확정)
js/qual/qual-signal-panel.js    # 정성 신호 패널(톤·축신호 strip·테마·플래그)
```

함수 계약(리포트 스펙 공통 계약과 동일):
```js
buildPrompt(meta, responses) -> string
parseQualJson(text) -> { ok, data, errors }     // 점수 필드 발견 시 ok=false
renderQualAnalysisModal(mount, { session, responses, onConfirm }) -> { close, destroy }
renderQualSignalPanel(mount, { qualSignal }) -> { el, update, destroy }
```

---

## 5. 완료 정의

1. 주관식 있는 세션에만 "정성 분석" 버튼이 뜬다.
2. 모달이 버전 고정 프롬프트를 생성하고 복사된다.
3. 파서가 스키마를 검증하고, 0~100 점수 필드가 있으면 거부한다.
4. 검수 UI에서 사용자가 테마·신호를 편집/확정할 수 있다.
5. 확정된 QualSignal만 패널에 표시된다.
6. 패널에 "측정값 아님 · 참고" 라벨이 고정 노출된다.
7. 6축 신호는 점수 없이 범주(강도·방향)로만 표시되고, 미언급 축은 "미언급"이다.
8. ACRI 계산 경로가 QualSignal을 입력으로 받지 않는다(가드).
