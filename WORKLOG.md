# Culture Platform 3.0 — Work Log

## 프로젝트 개요
라이나생명 조직문화 세션 운영 플랫폼. 단일 운영자 전용.  
스택: Python 3.9 · Streamlit 1.50 · SQLite · openpyxl · altair

---

## 파일 구조

```
Culture Platform 3.0/
├── app.py              # 메인 Streamlit 앱 (전체 UI + 페이지 로직)
├── db.py               # SQLite 헬퍼 함수 모음
├── schema.sql          # DB 스키마 (org_unit, session, session_schedule, response + cohort_stat 뷰)
├── parser.py           # Google Form CSV 검증·파싱
├── load_org.py         # 조직도 Excel → DB 적재 스크립트
├── requirements.txt    # streamlit>=1.35, pandas>=2.0, openpyxl
├── launch.command      # macOS 더블클릭 런처 (브라우저 자동 오픈)
├── culture.db          # SQLite DB (런타임 생성)
├── static/assets/
│   ├── favicon.png
│   ├── lina_logo.png
│   └── lina_logo_square.png
└── STYLE_GUIDE.md      → 원본은 /Users/zekedongwookrho/Desktop/untitled folder 2/Platform Development 2.0/STYLE_GUIDE.md
```

---

## DB 스키마 요약

```sql
org_unit        (id TEXT PK, level TEXT, parent_id TEXT, name, leader, leader_title, leader_role)
session         (id PK, type TEXT, cohort INT, division, bonbu, team, participating_teams JSON, linked_session_id, target_weeks, created_at)
session_schedule(id PK, session_id FK, seq INT, scheduled_date TEXT, start_time, duration_min, content_name, content_note, status)
response        (id PK, session_id FK, cohort INT, phase TEXT, q1-q8 INT, q9-q11 TEXT, created_at)

VIEW cohort_stat: type, cohort, phase, n, q1_avg..q8_avg  (GROUP BY type, cohort, phase)
```

session.type ∈ {팀빌딩, 팀장, 크로스펑셔널}  
session_schedule.status ∈ {planned, confirmed, completed, cancelled}  
response.phase ∈ {사전, 중간, 사후}  
org_unit.level ∈ {company, division, hq, team}

---

## 세션 타입 규칙

| 타입 | 기간 | 회차 | 시간 | 대상 |
|------|------|------|------|------|
| 팀빌딩 | 8주 | 6회 | 60분 | 특정 팀 팀장+팀원 전체 |
| 팀장 | 4주 | 4회 | 120분 | 협업 필요 팀장들 |
| 크로스펑셔널 | 6주 | 6회 | 120분 | 팀장세션 팀장들이 차출한 팀원 2명씩 |

크로스펑셔널은 반드시 팀장 세션과 linked_session_id로 연결.  
스케줄: 처음 2회차만 확정, 나머지는 진행하면서 입력.

---

## 조직 위계

전사 (company) > 부문 (division) > 본부 (hq) > 팀 (team)  
조직도 Excel: `~/Downloads/lina_organization_template (1).xlsx` → `python3 load_org.py` 로 적재  
101개 unit (1 company, 9 division, 22 hq, 69 team)

---

## CSV 파싱 규칙 (parser.py)

- Google Form CSV, [태그] prefix 컬럼명으로 필드 매핑
- 개인 식별자 컬럼 (이름, 사번, 이메일, 전화 등) 포함 시 오류
- 텍스트 점수 → 정수: 매우그렇다=5, 그렇다=4, 보통=3, 아니다=2, 전혀아니다=1, 모름=None
- 반환: (rows: list[dict], errors: list[str])
- N < 3 마스킹은 경영진 보고 페이지에서 적용 (parser에서는 하지 않음)

---

## 구현된 기능 (app.py 페이지)

### 홈 대시보드
- 전체 세션/진행중/이번주일정/미정알림 metric 4개
- 이번 주 확정 일정 카드 목록 (7일 이내)
- 업로드 현황: 세션별 사전/중간/사후 badge
- 미정 회차 알림: 날짜 미확정 회차 있는 세션 목록
- 세션 타입별 현황 카드 (팀빌딩/팀장/크로스펑셔널)

### 세션 관리
- 세션 유형 선택 → 조직 정보 입력 (cascade dropdown)
- 스케줄 빌더: 회차별 날짜/시간/콘텐츠명/소요시간/메모
- 팀빌딩: 콘텐츠 템플릿 6회 (WOW세션/명상세션/커뮤니케이션세션/간담회/파트너요가/에너지회복)
- 팀장: 4회 (웰니스+WOW세션, 120분)
- 크로스펑셔널: 6회 (크로스펑셔널 세션, 120분)
- 등록 후: "CSV 업로드 바로가기" 네비게이션 버튼
- 세션 목록: 전체/팀빌딩/팀장/크로스펑셔널 탭
- 상태 badge: 시작전(muted)/시작전(accent)/진행중(primary)/완료(secondary)
- 미정 회차 날짜 확정 UI (expander 내부)

### CSV 업로드
- 세션 선택 후 현재 phase 업로드 현황 badge 표시
- Phase 선택 (사전/중간/사후)
- 검증 통과 → 미리보기 → 적재 확정

### 변화량 조회
- 기수 선택
- Altair grouped bar chart (사전/중간/사후, 색상: #c7cbf8/#ffd166/#5f6dee)
- 표: 사전/중간/사후 평균 + 변화량(Δ)
- 정성 응답 (q9 기대/q10 좋았던점/q11 운영진에게)

### 경영진 보고
- N < 3 마스킹 적용한 집계 표
- 사전/사후 grouped bar chart
- Excel 다운로드 (집계결과 + 정성응답 시트, openpyxl 서식)

---

## 디자인 시스템 (STYLE_GUIDE.md 기반)

| 토큰 | 값 | 용도 |
|------|-----|------|
| Primary | `#5f6dee` | 주요 버튼, 선택 상태 |
| Secondary | `#18b6aa` | 확산/안정 신호, 보조 액션 |
| Accent (Warm) | `#ffd166` | 카운트 배지, 긍정 강조 |
| Risk | `#fb7185` | 리스크, 피로도 |
| Text Strong | `#0b1020` | 제목, 핵심 수치 |
| Text Muted | `#64748b` | 설명, 보조 메타 |
| Surface | `rgba(255,255,255,0.86)` | 카드, 패널 |
| Line | `rgba(203,213,225,0.72)` | 구분선 |

**버튼 위계:**
- Primary: gradient(#5f6dee→#18b6aa), white text, shadow — 주요 CTA
- Secondary: white bg, thin outline(Line color), muted text — 보조 액션

**카드/패널:** 20~28px border-radius, Surface bg, Line border, 1px shadow  
**사이드바:** dark `#0d1b35`, 로고 110px 고정폭, 13px 메뉴 텍스트  
**헤더 위계:** h1 1.55rem bold → h2 1.05rem → h3 0.9rem uppercase

**TYPE_COLOR:**
- 팀빌딩: #5f6dee (primary)
- 팀장: #18b6aa (secondary)
- 크로스펑셔널: #f59e0b (amber)

---

## 앱 실행

```bash
# 새 웹앱 실행
./launch_webapp.command
# 또는
cd webapp && python3 -m http.server 4173

# 개발 실행
python3 -m streamlit run app.py --server.headless=true --server.port=8501 --server.enableStaticServing=true

# 브라우저 자동 오픈 (더블클릭)
# launch.command 파일을 Finder에서 더블클릭
```

---

## 주요 session_state 키

| 키 | 설명 |
|----|------|
| `nav_page` | 현재 페이지 (radio widget key) — 프로그래밍 방식 변경 가능 |
| `ns_type` | 새 세션 등록 중인 유형 |
| `ns_count` | 현재 회차 수 |
| `ns_confirmed_{i}` | i번째 회차 날짜 확정 여부 |
| `ns_date_{i}` | i번째 회차 날짜 |
| `ns_time_{i}` | i번째 회차 시작시간 |
| `ns_content_{i}` | i번째 회차 콘텐츠명 |
| `ns_dur_{i}` | i번째 회차 소요시간(분) |
| `ns_note_{i}` | i번째 회차 메모 |
| `_last_sid` | 마지막으로 등록한 세션 ID |

---

## 알려진 제약사항 / 참고

- Python 3.9: `dict | None` 문법 불가 → `Optional[dict]` 사용
- `st.image(width='stretch')` : Streamlit 1.28+ 필요 (use_container_width deprecated)
- Altair는 Streamlit에 번들 포함 (별도 설치 불필요)
- PDF 내보내기 미구현 (weasyprint 등 외부 의존성 필요 → Excel로 대체)
- 조직도는 외부 Excel에서 load_org.py로 수동 적재 (API 연동 없음)
- 세션 삭제/수정 기능 미구현 (plan.md SSOT 미포함)
- N < 3 마스킹: 경영진 보고에서만 적용, 변화량 조회는 마스킹 없음

---

## TODO / 미완료 항목

- [ ] 세션 수정/삭제 기능 (plan.md 확인 후 구현 여부 결정)
- [ ] PDF 내보내기 (weasyprint 또는 reportlab 도입 필요)
- [ ] 세션 완료 처리 (모든 session_schedule.status → completed)
- [ ] 조직도 자동 동기화 (현재 수동 스크립트)
- [ ] 로그인/접근 제어 (현재 없음 — 단일 운영자 로컬 사용 전제)

---

_최종 업데이트: 2026-06-15_

---

## 2026-06-15 웹앱 구조 전환

Streamlit 프로토타입의 UI/UX 한계를 줄이기 위해 브라우저 우선 정적 웹앱을 추가했다. 기존 Python/SQLite 구현은 보존하고, 새 화면은 `webapp/` 아래에서 독립적으로 실행한다.

### 새 파일 구조

```text
Culture Platform 3.0/
├── index.html              # 저장소 루트 배포 시 webapp/으로 이동
├── launch_webapp.command   # 로컬 웹앱 실행
└── webapp/
    ├── index.html
    ├── assets/             # 배포용 로고/파비콘
    ├── src/
    │   ├── app.js          # 세션, 업로드, 변화량, 보고 화면 로직
    │   └── styles.css      # 제품형 웹앱 UI 스타일
    ├── vercel.json
    └── netlify.toml
```

### 구현 범위

- 세션 운영 대시보드, 세션 등록, CSV 검증/미리보기, 변화량 조회, 경영진 보고 화면을 웹앱 UI로 재구성
- 데이터 저장은 우선 브라우저 `localStorage` 기반
- 배포는 GitHub Pages, Vercel, Netlify 같은 정적 호스팅에서 가능
- 루트 `index.html`이 `/webapp/`으로 이동하므로 저장소 루트 배포도 동작

### 다음 전환 과제

- 운영용 영구 저장소로 Supabase/Postgres 연결
- 로그인/권한 제어 추가
- 기존 `culture.db` 데이터의 웹앱 초기 데이터 또는 DB 마이그레이션 경로 정리

---

## 2026-06-15 Claude Code 인계 기록

다음 작업자가 바로 이어받을 수 있도록 `CLAUDE.md`와 `HANDOFF.md`를 추가했다.

- `CLAUDE.md`: Claude Code가 먼저 읽을 프로젝트 방향, 실행 방법, 디자인 방향, 배포/검증 기록
- `HANDOFF.md`: 현재 상태, 최신 커밋, 남은 작업, GitHub Pages 배포 절차

핵심 인계 내용:

- Streamlit은 레거시 프로토타입으로 보존
- 실제 제품 표면은 `webapp/` 기준으로 계속 개발
- 현재 데이터 저장은 `localStorage`
- 운영용 다음 단계는 Supabase/Postgres + auth
- GitHub Pages는 `main` branch, `/root` folder로 설정하면 루트 `index.html`이 `/webapp/`으로 이동
