export const REPORT_EXPORT_GOLDEN_HTML = `
  <div id="report-export-content" class="report-export-content">
    <section class="page-head report-export-header">
      <div>
        <span class="eyebrow">변화 분석 리포트</span>
        <h1>변화 분석 리포트</h1>
        <p>현 상황 진단, 세션 운영 제안, 변화 분석을 통합한 보고서입니다.</p>
      </div>
    </section>
    <section class="panel session-outcome-intro">
      <span class="eyebrow">Team Building Outcome</span>
      <h2>함께 일하는 방식의 변화</h2>
      <p>세션 이후 팀의 협업 행동 변화와 후속 실행 상태를 확인합니다.</p>
    </section>
    <section class="panel report-exec-summary">
      <h2>핵심 요약</h2>
      <p>응답 수와 변화 지표가 리포트 생성 기준을 충족합니다.</p>
    </section>
    <section class="panel report-change-analysis">
      <h2>변화 분석</h2>
      <p>사전, 사후, 팔로우업 데이터를 기준으로 변화 흐름을 표시합니다.</p>
    </section>
  </div>
`;

export const STALE_LEGACY_REPORT_HTML = `
  <div id="report-export-content" class="report-export-content">
    <section class="page-head report-export-header">
      <h1>변화 분석 리포트</h1>
      <button id="download-report-pdf" onclick="window.downloadReportPdf(event)">PDF</button>
      <button id="download-report-pdf" onclick="window.downloadReportPdf(event)">PDF</button>
    </section>
  </div>
`;
