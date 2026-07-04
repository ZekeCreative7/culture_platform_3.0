import React from 'react';

function indexTone(value) {
  if (value === null || value === undefined) return { label: "대기", className: "neutral" };
  if (value >= 70) return { label: "강함", className: "good" };
  if (value >= 50) return { label: "보통", className: "watch" };
  return { label: "확인 필요", className: "risk" };
}

function deltaScoreText(value) {
  if (value === null || value === undefined) return "확인 불가";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}점`;
}

export function OutcomeStoryPanel({ story }) {
  if (!story || story.status === "insufficient") {
    return (
      <section className="panel report-export-section report-outcome-story" style={{ marginBottom: '28px' }}>
        <div className="section-title" style={{ marginBottom: '12px' }}>
          <h2>변화 스토리 지수</h2>
          <span>사전·사후·팔로우업 설문으로 개선 여부를 확인합니다</span>
        </div>
        <div className="empty">사전과 사후 설문 응답이 각각 3건 이상 쌓이면 변화 지수를 계산합니다.</div>
      </section>
    );
  }

  const momentumTone = indexTone(story.momentumIndex);
  const sustainTone = indexTone(story.sustainIndex);
  const confidenceTone = indexTone(story.confidenceIndex);
  const sustainValue = story.sustainIndex === null ? "대기" : story.sustainIndex;
  const weakest = story.weakestDim?.label || "확인 대기";
  const strongest = story.strongestDim?.label || "확인 대기";

  return (
    <section className="panel report-export-section report-outcome-story" style={{ marginBottom: '28px' }}>
      <div className="section-title" style={{ marginBottom: '16px' }}>
        <h2>변화 스토리 지수</h2>
        <span>사후 개선과 팔로우업 유지 여부를 분리해서 봅니다</span>
      </div>
      <div className="outcome-index-grid">
        <article className={`outcome-index-card ${momentumTone.className}`}>
          <span>즉시 변화</span>
          <strong>{story.momentumIndex ?? "—"}</strong>
          <small>{story.immediateLabel} · {deltaScoreText(story.immediateDelta)}</small>
        </article>
        <article className={`outcome-index-card ${sustainTone.className}`}>
          <span>개선 유지</span>
          <strong>{sustainValue}</strong>
          <small>{story.sustainLabel}{story.sustainedDelta !== null ? ` · ${deltaScoreText(story.sustainedDelta)}` : ""}</small>
        </article>
        <article className={`outcome-index-card ${confidenceTone.className}`}>
          <span>응답 신뢰</span>
          <strong>{story.confidenceIndex}</strong>
          <small>사전 {story.preN} · 사후 {story.postN}{story.followupN ? ` · 팔로우업 ${story.followupN}` : ""}</small>
        </article>
        <article className="outcome-index-card neutral">
          <span>다음 초점</span>
          <strong>{story.actionFocus}</strong>
          <small>강점 {strongest} · 취약 {weakest}</small>
        </article>
      </div>
      <div className="outcome-story-line">
        <b>{story.immediateLabel}</b>
        <span>세션 직후 평균 변화는 {deltaScoreText(story.immediateDelta)}입니다.</span>
        <b>{story.sustainLabel}</b>
        <span>{story.followupN ? `팔로우업 기준 변화는 {deltaScoreText(story.sustainedDelta)}입니다.` : "팔로우업 설문으로 유지 여부를 확인해야 합니다."}</span>
      </div>
    </section>
  );
}
