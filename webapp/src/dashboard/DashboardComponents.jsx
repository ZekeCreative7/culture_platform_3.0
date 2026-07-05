import React, { useState } from 'react';
import { PIPELINE_STAGES } from './dashboardEngine.js';
import { sessionTypeLabel, SESSION_TYPES } from '../utils.js';

// ── KPI Card Component ──────────────────────────────────────────────
function KPICard({ label, helpText, value, desc, highlightClass, onClick }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`kpi-card ${highlightClass} cursor-pointer`} onClick={onClick}>
      <div className="kpi-header">
        <span className="kpi-label">{label}</span>
        <button
          type="button"
          className={`tooltip-icon${open ? ' help-open' : ''}`}
          aria-label={`${label} 설명`}
          aria-expanded={open}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          ?
        </button>
      </div>
      {open && (
        <div style={{
          position: 'absolute',
          top: '38px',
          left: '12px',
          right: '12px',
          background: 'var(--tooltip-bg, #0f172a)',
          color: '#fff',
          padding: '8px 10px',
          borderRadius: '6px',
          fontSize: '11px',
          lineHeight: '1.4',
          zIndex: 10,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          whiteSpace: 'normal',
          textAlign: 'left'
        }}>
          {helpText}
        </div>
      )}
      <div className="kpi-value">{value}</div>
      <div className="kpi-desc">{desc}</div>
    </div>
  );
}

// ── 5.1 Current operating focus & Quick Actions ────────────────────
export function DashboardStatusStrip({ snapshot, pulseYear, onNavigate }) {
  return (
    <div className="dashboard-status-strip panel">
      <div className="strip-left">
        <span className="strip-eyebrow">오늘의 운영 포커스</span>
        <div className={`operation-focus operation-focus-${snapshot.focus.tone}`}>
          <span className="operation-focus-label">{snapshot.focus.label}</span>
          <div className="operation-focus-copy">
            <strong>{snapshot.focus.title}</strong>
            <span>{snapshot.focus.description}</span>
          </div>
        </div>
      </div>
      <div className="strip-right">
        <div className="strip-meta">
          <span className="meta-item">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }}>
              <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 6a1 1 0 100 2h4a1 1 0 100-2H8zm-1 4a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd"/>
            </svg>
            진단 데이터: <strong>{pulseYear || '—'}년</strong>
          </span>
          <span className="meta-item text-muted">
            데이터 갱신: <span className="db-status-dot"></span>실시간
          </span>
        </div>
        <div className="strip-quick-actions">
          <button className="primary compact quick-action-btn" onClick={() => onNavigate('sessions')}>세션 만들기</button>
          <button className="secondary compact quick-action-btn" onClick={() => onNavigate('survey')}>설문 만들기</button>
          <button className="secondary compact quick-action-btn" onClick={() => onNavigate('pulse-report')}>약속 보드</button>
        </div>
      </div>
    </div>
  );
}

// ── 5.2 KPI Cards Grid ──────────────────────────────────────────────
export function DashboardKPIGrid({ isLoading, actionsReady, todayActionsCount, responseWaiting, weekSessionsCount, reportReady, onNavigate, onScrollTo }) {
  return (
    <div className="dashboard-kpi-grid">
      <KPICard
        label="오늘 할 일"
        helpText="기한 초과 약속, 오늘 세션, 사후설문 대기, 미정 회차처럼 오늘 직접 처리해야 하는 작업 개수입니다. 예정 알림과 보고 준비 완료는 제외합니다."
        value={isLoading || !actionsReady ? '—' : todayActionsCount}
        desc="즉시 조치 필요"
        highlightClass="highlight-red"
        onClick={() => onScrollTo('dashboard-action-queue')}
      />
      <KPICard
        label="응답 대기"
        helpText="작성 중이거나 공감 피드백(We Heard) 작성이 진행되지 않은 약속 개수입니다."
        value={isLoading ? '—' : responseWaiting}
        desc="공감 피드백 미등록"
        highlightClass="highlight-purple"
        onClick={() => onNavigate('pulse-report', '', '', 'listening')}
      />
      <KPICard
        label="이번 주 세션"
        helpText="오늘부터 향후 7일 이내에 예정된 세션 회차들의 개수입니다."
        value={isLoading ? '—' : weekSessionsCount}
        desc="7일 이내 일정"
        highlightClass="highlight-amber"
        onClick={() => onScrollTo('dashboard-week-schedule')}
      />
      <KPICard
        label="보고 준비"
        helpText="사전 및 사후 설문 적재가 완료되어 최종 경영진 보고서 조회가 가능한 세션 개수입니다."
        value={isLoading ? '—' : reportReady}
        desc="사전·사후 적재 완료"
        highlightClass="highlight-green"
        onClick={() => onNavigate('report')}
      />
    </div>
  );
}

// ── 5.3 Team Pipeline Section ──────────────────────────────────────
export function TeamPipelineSection({ teams, viewMode, onToggleViewMode, onNavigate }) {
  const stageIndex = Object.fromEntries(PIPELINE_STAGES.map((s, i) => [s.key, i]));
  const sortedTeams = [...teams].sort((a, b) => (stageIndex[b.stage] ?? 0) - (stageIndex[a.stage] ?? 0));

  const allTeamsSortedByDivision = [...teams].sort((a, b) => {
    const divCmp = (a.division || '').localeCompare(b.division || '');
    if (divCmp !== 0) return divCmp;
    return (stageIndex[b.stage] ?? 0) - (stageIndex[a.stage] ?? 0);
  });

  return (
    <section className="panel dashboard-section" id="dashboard-team-pipeline">
      <div className="section-header">
        <div>
          <h3>팀 변화 파이프라인</h3>
          <span className="section-subtitle">각 팀의 세션 진행 → 사후 설문 → 팔로우업 단계 현황</span>
        </div>
        <div className="pipeline-view-toggle">
          <button className={`pipeline-toggle-btn ${viewMode === 'team' ? 'active' : ''}`} onClick={() => onToggleViewMode('team')}>팀별</button>
          <button className={`pipeline-toggle-btn ${viewMode === 'division' ? 'active' : ''}`} onClick={() => onToggleViewMode('division')}>본부별</button>
        </div>
      </div>

      <div className="pipeline-stage-legend">
        {PIPELINE_STAGES.map(s => (
          <div className="legend-item" key={s.key}>
            <span className="legend-dot" style={{ background: s.color }}></span>
            <span className="legend-label">{s.label}</span>
            <span className="legend-count">{teams.filter(t => t.stage === s.key).length}</span>
          </div>
        ))}
      </div>

      <div className="pipeline-content" id="pipeline-content">
        {viewMode === 'team' ? (
          teams.length === 0 ? (
            <div className="pipeline-empty">등록된 세션이 없습니다. 세션을 먼저 등록하세요.</div>
          ) : (
            <div className="pipeline-team-grid">
              {sortedTeams.map(team => {
                const stage = PIPELINE_STAGES.find(s => s.key === team.stage) || PIPELINE_STAGES[0];
                return (
                  <div
                    className="team-pipeline-card"
                    key={team.teamName}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onNavigate('sessions', team.activeSessionId || team.latestSessionId || '')}
                  >
                    <div className="pipeline-card-stage" style={{ background: `${stage.color}20`, borderLeft: `3px solid ${stage.color}` }}>
                      <span className="pipeline-stage-label" style={{ color: stage.color }}>{stage.label}</span>
                    </div>
                    <div className="pipeline-card-body">
                      <strong className="pipeline-team-name">{team.teamName}</strong>
                      {team.division && <span className="pipeline-division-name">{team.division}</span>}
                      <span className="pipeline-session-count">{team.sessionCount}개 세션</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          teams.length === 0 ? (
            <div className="pipeline-empty">등록된 세션이 없습니다.</div>
          ) : (
            <div className="pipeline-table">
              <div className="pipeline-table-head">
                <span>팀 / 본부</span>
                <span>단계</span>
                <span>세션</span>
              </div>
              {allTeamsSortedByDivision.map(team => {
                const stage = PIPELINE_STAGES.find(s => s.key === team.stage) || PIPELINE_STAGES[0];
                return (
                  <div
                    className="pipeline-table-row cursor-pointer"
                    key={team.teamName}
                    onClick={() => onNavigate('sessions', team.activeSessionId || team.latestSessionId || '')}
                  >
                    <div className="pipeline-table-team">
                      <strong>{team.teamName}</strong>
                      {team.division && <span>{team.division}</span>}
                    </div>
                    <div>
                      <span className="pipeline-stage-pill" style={{ background: `${stage.color}18`, color: stage.color, border: `1px solid ${stage.color}40` }}>
                        <span className="pipeline-stage-dot" style={{ background: stage.color }}></span>
                        {stage.label}
                      </span>
                    </div>
                    <div className="pipeline-table-count">{team.sessionCount}개</div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </section>
  );
}

// ── 5.4 Pulse Team Support Section ──────────────────────────────────
export function SupportTeamsSection({ supportTeams, pulseLoaded, onNavigate }) {
  return (
    <section className="panel dashboard-section" id="dashboard-pulse-team-support">
      <div className="section-header">
        <div>
          <h3>지원 후보 팀</h3>
          <span className="section-subtitle">팀 선택 시 본부 Pulse 결과를 기준으로 현재 상태를 요약합니다.</span>
        </div>
        <span className="section-subtitle">본부 기준</span>
      </div>
      {!pulseLoaded ? (
        <div className="support-team-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="skeleton-org-card" key={i}>
              <div className="skeleton-text medium"></div>
              <div className="skeleton-text short"></div>
            </div>
          ))}
        </div>
      ) : supportTeams.length === 0 ? (
        <div className="empty-state-card compact">
          <p>명시 매핑된 지원 후보 팀이 아직 없습니다.</p>
        </div>
      ) : (
        <div className="support-team-grid">
          {supportTeams.map((team) => {
            const stage = PIPELINE_STAGES.find(s => s.key === team.stage) || PIPELINE_STAGES.find(s => s.key === "세션없음");
            const path = [team.divisionName, team.hqName].filter(Boolean).join(" · ");
            return (
              <div
                className="support-team-card cursor-pointer"
                key={team.teamName}
                onClick={() => onNavigate('pulse-report', '', team.pulseDivisionId)}
              >
                <div className="support-team-head">
                  <strong>{team.teamName}</strong>
                  <span className="support-team-score">{team.pulseOverall !== null ? `${team.pulseOverall}%` : "—"}</span>
                </div>
                <div className="support-team-path">{path || team.pulseDivisionId}</div>
                <div className="support-team-pulse">
                  <span>{team.pulseDivisionId} 본부 기준</span>
                  <b>{team.focusDomain}</b>
                </div>
                <div className="support-team-status">
                  <span className="pipeline-stage-pill" style={{ background: `${stage.color}18`, color: stage.color, border: `1px solid ${stage.color}40` }}>
                    <span className="pipeline-stage-dot" style={{ background: stage.color }}></span>
                    {stage.label}
                  </span>
                  {team.mappingConfidence === "low" && <span className="support-team-note">매핑 확인 필요</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── 5.5 Change Verification Board (Outcome) ────────────────────────
export function OutcomeSnapshotSection({ outcome, onNavigate }) {
  return (
    <section className="panel dashboard-section" id="dashboard-outcome-snapshot">
      <div className="section-header">
        <div>
          <h3>변화 확인 보드</h3>
          <span className="section-subtitle">사후와 팔로우업 설문으로 개선이 보이는지 확인합니다.</span>
        </div>
        <span className="section-subtitle">세션 설문 기준</span>
      </div>
      {outcome.total === 0 ? (
        <div className="empty-state-card compact">
          <p>사전·사후 응답이 각각 3건 이상인 세션이 생기면 변화 지수가 표시됩니다.</p>
        </div>
      ) : (
        <>
          <div className="outcome-snapshot-grid">
            <article className="outcome-snapshot-card">
              <span>변화 모멘텀</span>
              <strong>{outcome.avgMomentumIndex ?? '—'}</strong>
              <small>{outcome.improved}/{outcome.total}개 세션 개선</small>
            </article>
            <article className="outcome-snapshot-card">
              <span>개선 유지</span>
              <strong>{outcome.avgSustainIndex ?? '—'}</strong>
              <small>{outcome.sustained}개 세션 유지 확인</small>
            </article>
            <article className="outcome-snapshot-card">
              <span>팔로우업 대기</span>
              <strong>{outcome.needsFollowup}</strong>
              <small>개선 후 유지 확인 필요</small>
            </article>
            <article className="outcome-snapshot-card">
              <span>응답 신뢰</span>
              <strong>{outcome.avgConfidenceIndex ?? '—'}</strong>
              <small>응답 수와 단계 충족도</small>
            </article>
          </div>
          <div className="outcome-snapshot-list">
            {outcome.ranked.map((item) => (
              <div
                className="outcome-snapshot-row cursor-pointer"
                key={item.sessionId}
                onClick={() => onNavigate('report', item.sessionId)}
              >
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.type} · {item.story.immediateLabel} · {item.story.sustainLabel}</span>
                </div>
                <b>{item.story.momentumIndex ?? "—"}</b>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// ── 5.6 Operating Loop Nodes ────────────────────────────────────────
export function OperatingLoopSection({ loop, pulseYear, pulseLoaded, onNavigate }) {
  return (
    <section className="panel dashboard-section">
      <div className="section-header">
        <h3>조직문화 운영 루프</h3>
        <span className="section-subtitle">기초체력 진단부터 사후 변화 확인까지의 순환 과정</span>
      </div>
      <div className="operating-loop-container">
        <div className="loop-nodes">
          <div className="loop-node cursor-pointer" onClick={() => onNavigate('pulse-report')}>
            <div className={`node-circle ${pulseLoaded ? 'success' : 'empty'}`}>
              <span className="node-num">{loop.diagnosticLabel === '데이터 없음' ? '—' : (pulseYear || '—')}</span>
            </div>
            <div className="node-info">
              <strong className="node-name">진단</strong>
              <span className="node-sub">Pulse 진단</span>
            </div>
          </div>
          <div className="loop-arrow">→</div>
          <div className="loop-node cursor-pointer" onClick={() => onNavigate('sessions')}>
            <div className={`node-circle ${loop.listeningCount > 0 ? 'active' : 'empty'}`}>
              <span className="node-num">{loop.listeningCount}</span>
            </div>
            <div className="node-info">
              <strong className="node-name">듣기</strong>
              <span className="node-sub">의견 청취 세션</span>
            </div>
          </div>
          <div className="loop-arrow">→</div>
          <div className="loop-node cursor-pointer" onClick={() => onNavigate('pulse-report')} style={{ position: 'relative' }}>
            <div className={`node-circle ${loop.commitmentsCount > 0 ? 'active' : 'empty'}`}>
              <span className="node-num">{loop.commitmentsCount}</span>
              {loop.hasRedDot && <span className="node-red-dot"></span>}
            </div>
            <div className="node-info">
              <strong className="node-name">응답</strong>
              <span className="node-sub">공유·진행 약속</span>
            </div>
          </div>
          <div className="loop-arrow">→</div>
          <div className="loop-node cursor-pointer" onClick={() => onNavigate('sessions')}>
            <div className={`node-circle ${loop.activeSessionsCount > 0 ? 'active' : 'empty'}`}>
              <span className="node-num">{loop.activeSessionsCount}</span>
            </div>
            <div className="node-info">
              <strong className="node-name">실행</strong>
              <span className="node-sub">운영 중 세션</span>
            </div>
          </div>
          <div className="loop-arrow">→</div>
          <div className="loop-node cursor-pointer" onClick={() => onNavigate('report')}>
            <div className={`node-circle ${loop.completedSessionsCount > 0 ? 'success' : 'empty'}`}>
              <span className="node-num">{loop.completedSessionsCount}</span>
            </div>
            <div className="node-info">
              <strong className="node-name">확인</strong>
              <span className="node-sub">사후 변화 검증</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 5.7 Action Queue Section ────────────────────────────────────────
export function ActionQueueSection({ todayActions, upcomingActions, readyActions, actionsReady, expandedGroups, onToggleGroup, onActionClick, onNavigate }) {
  const actionDotClass = (act) => {
    if (act.priority === 1) return "dot-red";
    if (act.priority === 2 || act.priority === 4) return "dot-amber";
    if (act.priority === 3) return "dot-purple";
    if (act.priority === 7) return "dot-green";
    return "dot-blue";
  };

  const actionCtaLabel = (act) => {
    if (act.targetView === "sessions" && act.sessionId) return "수정하기 →";
    if (act.targetView === "report") return "보고서 보기 →";
    if (act.targetView === "upload") return "업로드 →";
    if (act.type === "followup_survey_create") return "설문 만들기 →";
    if (act.type === "followup_survey_distribution") return "배포 확인 →";
    return "바로가기 →";
  };

  const renderGroup = (key, label, badgeColor, actions, limit, emptyText, allowExpand = true) => {
    const isExpanded = expandedGroups[key];
    const visibleActions = (allowExpand && isExpanded) ? actions : actions.slice(0, limit);
    const overflowCount = actions.length - visibleActions.length;

    return (
      <div className={`action-queue-group action-queue-${key}`}>
        <div className="action-group-head">
          <strong>{label}</strong>
          <span className={`badge ${badgeColor}`}>{actions.length}</span>
        </div>
        {actions.length === 0 ? (
          <div className="empty-state-card compact">
            <p>{emptyText}</p>
          </div>
        ) : (
          <>
            <div className="queue-rows">
              {visibleActions.map((act) => (
                <div
                  className="queue-row cursor-pointer"
                  key={act.id || act.title}
                  onClick={() => onActionClick(act)}
                >
                  <div className="queue-title-block">
                    <span className={`status-dot ${actionDotClass(act)}`}></span>
                    <span className="queue-title">{act.title}</span>
                  </div>
                  <div className="queue-meta-block">
                    <span className="queue-date">{act.date || '—'}</span>
                    <span className="queue-go-arrow">{actionCtaLabel(act)}</span>
                  </div>
                </div>
              ))}
            </div>
            {allowExpand && overflowCount > 0 && (
              <button type="button" className="queue-more-row text-muted font-sm" onClick={() => onToggleGroup(key)}>
                + {overflowCount}개 더 보기
              </button>
            )}
            {allowExpand && isExpanded && actions.length > limit && (
              <button type="button" className="queue-more-row text-muted font-sm" onClick={() => onToggleGroup(key)}>
                {label} 접기
              </button>
            )}
            {!allowExpand && overflowCount > 0 && (
              <button type="button" className="queue-more-row text-muted font-sm" onClick={() => onNavigate('report')}>
                외 {overflowCount}개는 보고서 화면에서 확인
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <section className="panel dashboard-section" id="dashboard-action-queue">
      <div className="section-header">
        <div className="title-with-badge">
          <h3>지금 할 일</h3>
          <span className="badge red">{actionsReady ? todayActions.length : '—'}</span>
        </div>
      </div>
      <div className="action-queue-list">
        {renderGroup("today", "지금 처리", "red", todayActions, 5, actionsReady ? "오늘 직접 처리해야 할 할 일이 없습니다." : "오늘 할 일을 불러오는 중입니다.")}
        {renderGroup("upcoming", "곧 예정", "amber", upcomingActions, 3, "7일 이내 예정 알림이 없습니다.")}
        {renderGroup("ready", "최근 준비 완료", "green", readyActions, 3, "보고 준비 완료 알림이 없습니다.", false)}
      </div>
    </section>
  );
}

// ── 5.8 5-Signal Radar Chart ────────────────────────────────────────
export function DashboardRadarChart({ pulseSignals }) {
  if (!pulseSignals || pulseSignals.length < 5) return null;

  const cx = 160, cy = 140, r = 85;
  const angles = Array.from({ length: 5 }, (_, i) => -Math.PI / 2 + (i * 2 * Math.PI / 5));
  const ptAt = (angle, factor) => [cx + r * factor * Math.cos(angle), cy + r * factor * Math.sin(angle)];
  const pathOf = pts => `M${pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L')} Z`;
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  const hasPrev = pulseSignals.some(s => s.previousScore !== null);
  const prevYearLabel = pulseSignals[0].previousYear ? `${pulseSignals[0].previousYear}년` : "";
  const currentYearLabel = `${pulseSignals[0].currentYear}년`;

  const currentPts = pulseSignals.map((sig, i) => ptAt(angles[i], sig.score !== null ? sig.score / 100 : 0));
  const prevPts = pulseSignals.map((sig, i) => ptAt(angles[i], sig.previousScore !== null ? sig.previousScore / 100 : 0));

  const getLabelAttrs = (angle) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let anchor = "middle";
    let dy = 0;

    if (Math.abs(cos) < 0.1) {
      anchor = "middle";
      dy = sin < 0 ? -12 : 18;
    } else {
      anchor = cos > 0 ? "start" : "end";
      dy = sin < 0 ? -4 : 12;
    }
    return { anchor, dy };
  };

  return (
    <div className="radar-chart-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 24, padding: 16, background: 'rgba(248,250,252,0.6)', borderRadius: 12, border: '1.5px solid #e2e8f0', flexWrap: 'wrap', gap: 16 }}>
      <svg className="dashboard-radar-chart" viewBox="0 0 320 280" width="280" height="245" style={{ overflow: 'visible', display: 'block' }}>
        {/* Grids */}
        {gridLevels.map(f => (
          <path
            key={f}
            d={pathOf(angles.map(a => ptAt(a, f)))}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={f === 1 ? 1.5 : 1}
            strokeDasharray={f < 1 ? '3 3' : undefined}
          />
        ))}

        {/* Axis lines */}
        {angles.map((a, i) => {
          const p = ptAt(a, 1);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={p[0].toFixed(1)}
              y2={p[1].toFixed(1)}
              stroke="#cbd5e1"
              strokeWidth="1.2"
            />
          );
        })}

        {/* Previous Year Polygon */}
        {hasPrev && (
          <>
            <path
              d={pathOf(prevPts)}
              fill="rgba(148,163,184,0.06)"
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              strokeLinejoin="round"
            />
            {prevPts.map((p, i) => pulseSignals[i].previousScore !== null ? (
              <circle
                key={i}
                cx={p[0].toFixed(1)}
                cy={p[1].toFixed(1)}
                r="4.5"
                fill="#94a3b8"
                stroke="#fff"
                strokeWidth="1.5"
              />
            ) : null)}
          </>
        )}

        {/* Current Year Polygon */}
        <path
          d={pathOf(currentPts)}
          fill="rgba(14,165,233,0.12)"
          stroke="#0ea5e9"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {currentPts.map((p, i) => pulseSignals[i].score !== null ? (
          <circle
            key={i}
            cx={p[0].toFixed(1)}
            cy={p[1].toFixed(1)}
            r="5.5"
            fill="#0ea5e9"
            stroke="#fff"
            strokeWidth="2"
          />
        ) : null)}

        {/* Labels and Scores */}
        {pulseSignals.map((sig, i) => {
          const angle = angles[i];
          const lp = ptAt(angle, 1.12);
          const { anchor, dy } = getLabelAttrs(angle);
          return (
            <g key={sig.label}>
              <text
                x={lp[0].toFixed(1)}
                y={(lp[1] + dy).toFixed(1)}
                textAnchor={anchor}
                fontSize="11"
                fontWeight="700"
                fill="#334155"
                fontFamily="'Plus Jakarta Sans',sans-serif"
              >
                {sig.label}
              </text>
              <text
                x={lp[0].toFixed(1)}
                y={(lp[1] + dy + 13).toFixed(1)}
                textAnchor={anchor}
                fontSize="10.5"
                fontWeight="800"
                fontFamily="'Plus Jakarta Sans',sans-serif"
              >
                {sig.score !== null ? <tspan fill="#0ea5e9">{sig.score}%</tspan> : null}
                {hasPrev && sig.previousScore !== null ? (
                  <tspan fill="#94a3b8" fontWeight="600" fontSize="9.5"> (전년:{sig.previousScore}%)</tspan>
                ) : null}
              </text>
            </g>
          );
        })}

        {/* Tick values */}
        {gridLevels.map(f => (
          <text
            key={f}
            x={(cx + 4).toFixed(1)}
            y={(cy - (r * f) + 4).toFixed(1)}
            fontSize="9"
            fill="#94a3b8"
            fontFamily="sans-serif"
          >
            {Math.round(f * 100)}%
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="radar-legend" style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '11.5px', fontWeight: '700', minWidth: 100, justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(14,165,233,0.12)', border: '2px solid #0ea5e9', borderRadius: 3 }}></span>
          <span style={{ color: '#0ea5e9' }}>{currentYearLabel} 진단</span>
        </div>
        {hasPrev && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(148,163,184,0.06)', border: '2px dashed #94a3b8', borderRadius: 3 }}></span>
            <span style={{ color: '#64748b' }}>{prevYearLabel} 진단</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 5.9 Pulse Signals Section ──────────────────────────────────────
export function PulseSignalsSection({ pulseSignals, pulseYear, pulseLoaded, onNavigate }) {
  return (
    <section className="panel dashboard-section">
      <div className="section-header">
        <h3>조직 기초체력 5개 신호</h3>
        <span className="section-subtitle">
          {pulseSignals?.[0]?.previousYear ? `${pulseSignals[0].previousYear}년 대비 ${pulseYear}년` : `${pulseYear || '—'}년`} Pulse 진단 비교
        </span>
      </div>
      <div className="pulse-signals-list">
        {!pulseLoaded ? (
          <div className="skeleton-signal-row">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i}>
                <div className="skeleton-text short"></div>
                <div className="skeleton-bar"></div>
              </div>
            ))}
          </div>
        ) : !pulseSignals ? (
          <div className="empty-state-card">
            <p>기초체력 데이터가 존재하지 않습니다. 먼저 Pulse 데이터를 업로드해 주세요.</p>
            <button className="primary compact margin-top" onClick={() => onNavigate('upload')}>Pulse 업로드로 이동</button>
          </div>
        ) : (
          <>
            <DashboardRadarChart pulseSignals={pulseSignals} />
            <div className="signals-rows">
              {pulseSignals.map(sig => {
                let deltaHtml = null;
                if (sig.delta !== null) {
                  if (sig.delta > 0) {
                    deltaHtml = <span className="delta-badge plus">{sig.previousYear}년 대비 ↑{sig.delta}pp</span>;
                  } else if (sig.delta < 0) {
                    deltaHtml = <span className="delta-badge minus">{sig.previousYear}년 대비 ↓{Math.abs(sig.delta)}pp</span>;
                  } else {
                    deltaHtml = <span className="delta-badge zero">{sig.previousYear}년 대비 →0pp</span>;
                  }
                } else {
                  deltaHtml = <span className="delta-badge none">—</span>;
                }

                const tooltipContent = sig.breakdown.map(q =>
                  `Q${q.qNo}. ${q.label}: ${q.score !== null ? q.score + '%' : '데이터 없음'}`
                ).join('\n');

                return (
                  <div
                    className="signal-row cursor-pointer"
                    key={sig.label}
                    title={tooltipContent}
                    onClick={() => onNavigate('pulse-report')}
                  >
                    <div className="signal-info">
                      <span className="signal-label">{sig.label}</span>
                      <span className="signal-value">{sig.score !== null ? sig.score + '%' : '—'}</span>
                    </div>
                    <div className="signal-comparison-bars">
                      {sig.previousYear && (
                        <div className="signal-year-row previous">
                          <span>{sig.previousYear}</span>
                          <div className="signal-gauge-track">
                            <div className="signal-gauge-bar previous" style={{ width: `${sig.previousScore ?? 0}%` }}></div>
                          </div>
                          <strong>{sig.previousScore !== null ? `${sig.previousScore}%` : '—'}</strong>
                        </div>
                      )}
                      <div className="signal-year-row current">
                        <span>{sig.currentYear}</span>
                        <div className="signal-gauge-track">
                          <div className="signal-gauge-bar" style={{ width: `${sig.score ?? 0}%` }}></div>
                        </div>
                        <strong>{sig.score !== null ? `${sig.score}%` : '—'}</strong>
                      </div>
                      {deltaHtml}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ── 5.10 Trust Funnel Section ───────────────────────────────────────
export function TrustFunnelSection({ funnel, onNavigate }) {
  return (
    <section className="panel dashboard-section">
      <div className="section-header">
        <h3>신뢰 회복 퍼널</h3>
        <span className="section-subtitle">정성 의견이 약속과 조치로 연결되는 흐름</span>
      </div>
      <div className="trust-funnel-content">
        {funnel.youSaid === 0 ? (
          <div className="empty-state-card">
            <p className="empty-state-title">등록된 약속이 아직 없습니다</p>
            <p className="empty-state-desc">구성원의 정성 의견을 조직의 행동 약속으로 연결합니다.<br />첫 약속을 등록하면 이행 현황과 신뢰 회복 흐름이 여기 표시됩니다.</p>
            <button className="primary compact margin-top" onClick={() => onNavigate('pulse-report', '', '', 'listening', true)}>첫 약속 등록</button>
          </div>
        ) : (
          <>
            <div className="funnel-container">
              {/* Said */}
              <div className={`funnel-step ${funnel.maxDropSegment === 'heard' ? 'highlight-drop' : ''}`}>
                <div className="funnel-step-meta">
                  <span className="step-title"><i className="funnel-index">01</i> YOU SAID <small>의견 등록</small></span>
                  <strong className="step-num">{funnel.youSaid}</strong>
                </div>
                <div className="funnel-bar-track">
                  <div className="funnel-bar fill-said" style={{ width: '100%' }}></div>
                </div>
              </div>

              {/* Heard */}
              <div className={`funnel-step ${funnel.maxDropSegment === 'will' ? 'highlight-drop' : ''}`}>
                <div className="funnel-step-meta">
                  <span className="step-title"><i className="funnel-index">02</i> WE HEARD <small>공감</small></span>
                  <strong className="step-num">{funnel.weHeard}</strong>
                </div>
                <div className="funnel-bar-track">
                  <div className="funnel-bar fill-heard" style={{ width: `${(funnel.weHeard / funnel.youSaid) * 100}%` }}></div>
                </div>
              </div>

              {/* Will */}
              <div className={`funnel-step ${funnel.maxDropSegment === 'did' ? 'highlight-drop' : ''}`}>
                <div className="funnel-step-meta">
                  <span className="step-title"><i className="funnel-index">03</i> WE WILL <small>실행 약속</small></span>
                  <strong className="step-num">{funnel.weWill}</strong>
                </div>
                <div className="funnel-bar-track">
                  <div className="funnel-bar fill-will" style={{ width: `${(funnel.weWill / funnel.youSaid) * 100}%` }}></div>
                </div>
              </div>

              {/* Did */}
              <div className="funnel-step">
                <div className="funnel-step-meta">
                  <span className="step-title"><i className="funnel-index">04</i> WE DID <small>실행 완료</small></span>
                  <strong className="step-num">{funnel.weDid}</strong>
                </div>
                <div className="funnel-bar-track">
                  <div className="funnel-bar fill-did" style={{ width: `${(funnel.weDid / funnel.youSaid) * 100}%` }}></div>
                </div>
              </div>
            </div>
            {funnel.maxDropSegment && (
              <div className="funnel-insight-box">
                <strong>병목 구간 감지</strong>
                <p>
                  {funnel.maxDropSegment === 'heard' ? '직원 의견 등록 대비 회사 공감(We Heard) 비율이 가장 낮습니다. 빠른 공감 표명이 필요합니다.' :
                   funnel.maxDropSegment === 'will' ? '공감 대비 구체적인 약속(We Will) 도출이 막혀 있습니다. 아이디어를 현실화해 주세요.' :
                   '실행 약속 대비 최종 마친(We Did) 완료 건이 적습니다. 마무리 조치 및 증거 등록에 힘써야 합니다.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ── 5.11 Calendar Weekly Schedule ───────────────────────────────────
export function WeeklyCalendarSection({ weekSchedule, selectedDate, weekOffset, selectedDayItems, onSelectDate, onToggleWeekOffset, onNavigate }) {
  return (
    <section className="panel dashboard-section" id="dashboard-week-schedule">
      <div className="section-header">
        <h3>캘린더 일정</h3>
        <div className="toggle-buttons week-toggle">
          <button className={`toggle-btn ${weekOffset === 0 ? 'active' : ''}`} onClick={() => onToggleWeekOffset(0)}>이번 주</button>
          <button className={`toggle-btn ${weekOffset === 1 ? 'active' : ''}`} onClick={() => onToggleWeekOffset(1)}>다음 주</button>
        </div>
      </div>
      <div className="week-timeline-container">
        <div className="timeline-wheel">
          {weekSchedule.dates.map(dateStr => {
            const dObj = new Date(dateStr);
            const dayLabel = dObj.toLocaleDateString('ko-KR', { weekday: 'short' });
            const dateNum = dObj.getDate();
            const count = weekSchedule.itemsMap[dateStr].length;
            const isSelected = dateStr === selectedDate;

            return (
              <div
                className={`timeline-day-col cursor-pointer ${isSelected ? 'selected' : ''}`}
                key={dateStr}
                onClick={() => onSelectDate(dateStr)}
              >
                <span className="day-label">{dayLabel}</span>
                <div className="date-circle">
                  <span className="date-number">{dateNum}</span>
                  {count > 0 && (
                    <span className="session-dots-indicator">
                      {Array.from({ length: Math.min(count, 3) }).map((_, i) => '●').join('')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="timeline-schedules">
          <div className="selected-date-header">
            <strong>{new Date(selectedDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}</strong>
            <span className="count">{selectedDayItems.length}건의 세션</span>
          </div>
          {selectedDayItems.length === 0 ? (
            <div className="thin-empty-state">
              <p>예정된 세션 일정이 없습니다.</p>
            </div>
          ) : (
            <div className="timeline-schedule-list">
              {selectedDayItems.slice(0, 3).map(({ session, item }) => (
                <div
                  className="timeline-schedule-card cursor-pointer"
                  key={session.id}
                  onClick={() => onNavigate('sessions', session.id)}
                >
                  <div className="schedule-card-top">
                    <span className="session-type-tag" style={{ background: `${SESSION_TYPES[session.type]?.accent || 'var(--blue)'}15`, color: SESSION_TYPES[session.type]?.accent || 'var(--blue)' }}>
                      {sessionTypeLabel(session.type)}
                    </span>
                    <span className="schedule-time">{item.time || '시간 미지정'}</span>
                  </div>
                  <strong className="schedule-title">{session.division} &rsaquo; {session.team}</strong>
                  <div className="schedule-round">{item.seq || item.round || 1}회차 진행</div>
                </div>
              ))}
              {selectedDayItems.length > 3 && (
                <div className="schedule-more-note">+ {selectedDayItems.length - 3}개 세션 더보기</div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── 5.12 Orgs to Support First ─────────────────────────────────────
export function SupportOrgsSection({ supportOrgs, pulseLoaded, onNavigate }) {
  return (
    <section className="panel dashboard-section">
      <div className="section-header">
        <h3>먼저 지원할 조직</h3>
        <span className="section-subtitle">Pulse Survey 기반 우선 지원 신호</span>
      </div>
      <div className="support-orgs-content">
        {!pulseLoaded ? (
          <div className="support-orgs-grid">
            {Array.from({ length: 3 }).map((_, i) => (
              <div className="skeleton-org-card" key={i}>
                <div className="skeleton-text medium"></div>
                <div className="skeleton-text short"></div>
              </div>
            ))}
          </div>
        ) : supportOrgs.length === 0 ? (
          <div className="empty-state-card">
            <p>우선 지원 신호가 아직 없습니다.</p>
          </div>
        ) : (
          <div className="support-orgs-grid">
            {supportOrgs.map((org, index) => {
              let rankColor = "rank-1";
              if (index === 1) rankColor = "rank-2";
              else if (index === 2) rankColor = "rank-3";

              return (
                <div
                  className="support-org-card cursor-pointer"
                  key={org.id}
                  onClick={() => onNavigate('pulse-report', '', org.id)}
                >
                  <div className="org-card-head">
                    <span className={`rank-badge ${rankColor}`}>{index + 1}순위</span>
                    <span className="org-score">{org.overall !== null ? org.overall + '점' : '—'}</span>
                  </div>
                  <strong className="org-name">{org.id}</strong>
                  <div className="org-meta">
                    <span className="focus-label">집중 주제:</span>
                    <span className="focus-domain-tag">{org.focusDomain}</span>
                  </div>
                  <div className={`org-session-status ${org.sessionDetails.length ? 'has-session' : ''}`}>
                    {org.sessionDetails.length ? org.sessionDetails.slice(0, 2).map((session, sIdx) => (
                      <span className="support-session-line" key={sIdx}>
                        <i className={`status-indicator-dot ${session.status === '진행중' ? 'active' : session.status === '완료' ? 'done' : ''}`}></i>
                        {session.label} <b>{session.status}</b>
                      </span>
                    )) : (
                      <>
                        <span className="status-indicator-dot"></span>
                        <span className="status-text">연결된 세션 없음</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
