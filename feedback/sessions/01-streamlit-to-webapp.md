# 세션 회고 — Streamlit 프로토타입 → 브라우저 웹앱 마이그레이션

> 정보 출처: git 커밋 이력 기반 재구성. 실제 채팅 창에서 확인 후 보완 권장.

---

## 1. 기본 정보
- 세션 주제: Streamlit UI 포기, 바닐라 JS 브라우저 앱으로 전환
- 대략 시기: 2026-06-15
- 주로 쓴 모델/에이전트: Claude (단일 세션 추정)
- plan mode·서브에이전트·MCP 도구 사용 여부: 기록 없음

## 2. 이 세션의 목표
- 시작할 때 하려던 것: Streamlit 앱 UI/UX 개선 또는 다른 UI로 전환
- 끝났을 때 실제로 한 것: `webapp/` 디렉터리 신설, 바닐라 JS SPA 초안 작성, GitHub Pages 배포 설정
- 목표 대비 달성도: 완료 (전환 완료, 기본 뼈대 동작 확인)

## 3. 산출물 (사실)
- 만들어지거나 바뀐 파일·기능:
  - `webapp/index.html`, `webapp/src/app.js`, `webapp/src/styles.css` 신설
  - `webapp/assets/` (로고, 파비콘 등)
  - `index.html` (루트 리디렉터)
  - `launch_webapp.command`, `webapp/vercel.json`, `webapp/netlify.toml`, `webapp/.nojekyll`
  - `HANDOFF.md`, `WORKLOG.md` 업데이트
  - `CLAUDE.md` 작성 (프로젝트 방향 문서화)
- 내린 주요 결정:
  - 바닐라 JS + 빌드 시스템 없음 (의도적 선택 — 정적 호스팅 단순화)
  - `localStorage` 1차 저장 방식 채택
  - Streamlit 파일 삭제 안 하고 보존 (레거시 참조용)
  - GitHub Pages 배포 경로 결정: `/root` 기준

## 4. 잘된 것 (해석)
- Streamlit 포기 결정이 빠르고 확실했음 — 프로토타입에 집착하지 않은 판단력
- `CLAUDE.md` 와 `HANDOFF.md` 로 맥락을 다음 세션에 전달할 구조를 처음부터 만들어 둔 것은 훌륭한 선택

## 5. 잘못된 것 / 마찰 (해석)
- 초기 Overview/대시보드 디자인이 "너무 아마추어" 수준 → 이후 여러 번 전면 재작업의 씨앗
- localStorage 단일 저장 방식이 크로스 디바이스 문제를 예고했지만 인식 없이 진행

## 6. 재작업·되돌림
- 대시보드 디자인이 이 세션에서 이미 최소 2번 바뀜 (`28b0ef9` Refresh dashboard, `aae6026` Expand full width)
- 왜: 목표 디자인 기준이 없었음, 구체적 레퍼런스가 없는 상태에서 시작

## 7. 다음을 위한 교훈
- 그때 미리 알았으면 좋았을 것: 디자인 레퍼런스(Pinterest/SaaS 사례) 를 먼저 정하고 코딩 시작
- 다음엔 이렇게 하겠다: 첫 번째 세션에서 "완성 기준 체크리스트" 한 장 만들고 시작

## 8. 한 줄 평가 + 점수
- 한 줄 평가: 결정의 방향은 맞았고 기반을 잘 깔았으나 디자인 기준 없이 시작한 것이 이후 재작업의 원인
- 이 세션 점수(1~5): **3** / 5
