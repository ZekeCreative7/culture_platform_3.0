import React, { useState } from 'react';
import { DivisionDetailCard } from '../panels/DivisionDetailCard.jsx';
import { DivisionSmallMultiple } from '../charts/DivisionSmallMultiple.jsx';

/**
 * Tab2Divisions — 본부별 확인 탭
 */
export function Tab2Divisions({
  diagnostics,
  currentDoc,
  prevDoc,
  year,
  prevYear,
  cleanFav = null,
  getSupportSummary,   // (row) => supportSummary
  onSelectDivision,
}) {
  const rows = diagnostics?.rows ?? [];
  // 전사 대비 기준선도 오염 2본부(고객혁신본부CE·Data Control) 제외 값으로 통일.
  const companyOverall = cleanFav !== null && cleanFav !== undefined ? cleanFav : (diagnostics?.overallCompany ?? null);
  const companyDomainMeans = diagnostics?.companyDomainMeans ?? {};

  const [selectedId, setSelectedId] = useState(() => {
    // default: first ranked (non-masked, non-outlier)
    const ranked = diagnostics?.ranked ?? [];
    return ranked[0]?.id ?? (rows[0]?.id ?? '');
  });

  const selectedRow = rows.find((r) => r.id === selectedId) ?? null;
  const support = selectedRow ? getSupportSummary(selectedRow) : null;
  const divisionDoc = selectedId ? currentDoc?.divisions?.[selectedId] : null;
  const prevDivisionDoc = selectedId && prevDoc ? prevDoc?.divisions?.[selectedId] : null;

  function handleSelect(id) {
    setSelectedId(id);
    onSelectDivision?.(id);
    // scroll to detail card
    setTimeout(() => {
      document.getElementById('pr-div-detail-anchor')?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  }

  return (
    <div className="pr-tab-content pr-tab2">

      {/* Pulse 원본 단위 안내 */}
      <div className="pr-tab2-unit-banner">
        <span className="pri-chip pri-chip--slate">본부 단위</span>
        <p>
          이 데이터는 <strong>본부 단위</strong> Pulse 결과입니다.
          팀 단위 수치가 필요한 경우, 해당 팀이 속한 본부 결과를 참고하세요.
          팀은 본부 데이터를 상속하며, Pulse 원본이 팀 단위로 분리되지 않습니다.
        </p>
      </div>

      {/* Small Multiple 전체 보기 */}
      <section className="pr-section">
        <div className="pr-section-eyebrow">본부별 개요</div>
        <h3 className="pr-section-title">전체 본부 현황</h3>
        <p className="pr-section-desc">
          카드를 선택하면 아래 상세 카드에 해당 본부 정보가 표시됩니다.
        </p>
        <DivisionSmallMultiple
          rows={rows}
          companyOverall={companyOverall}
          onSelect={handleSelect}
        />
      </section>

      {/* 본부 선택 드롭다운 */}
      <section className="pr-section">
        <div className="pr-section-eyebrow">본부 상세 확인</div>
        <div className="pr-div-select-row">
          <label htmlFor="pr-div-select" className="pr-div-select-label">
            본부 선택
          </label>
          <select
            id="pr-div-select"
            className="pr-div-select"
            value={selectedId}
            onChange={(e) => handleSelect(e.target.value)}
          >
            <option value="">-- 본부 선택 --</option>
            {rows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.id}
                {row.status === 'masked' ? ' (마스킹)' : ''}
                {row.flags?.outlier ? ' (이상치)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Anchor for scroll */}
        <div id="pr-div-detail-anchor" />

        {selectedRow ? (
          <DivisionDetailCard
            row={selectedRow}
            companyOverall={companyOverall}
            companyDomainMeans={companyDomainMeans}
            rows={rows}
            support={support}
            divisionDoc={divisionDoc}
            prevRow={null}
          />
        ) : (
          <div className="pr-div-select-placeholder">
            위에서 본부를 선택하면 상세 카드가 표시됩니다.
          </div>
        )}
      </section>

      {/* 연도 정보 */}
      {prevYear && (
        <div className="pr-tab2-year-note">
          전년도 비교: {prevYear}년 → {year}년
        </div>
      )}
    </div>
  );
}
