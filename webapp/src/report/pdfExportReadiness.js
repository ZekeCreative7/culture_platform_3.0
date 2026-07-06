const REQUIRED_EXPORT_MARKERS = [
  { id: "root", label: "PDF export root", pattern: /\b(?:id|class)=["'][^"']*report-export-content[^"']*["']/ },
  { id: "header", label: "report header", pattern: /\bclass=["'][^"']*report-export-header[^"']*["']/ },
];

const INLINE_HANDLER_PATTERN = /\son[a-z]+\s*=/gi;
const LEGACY_WINDOW_HANDLER_PATTERN = /window\.(downloadReportPdf|downloadReportXlsx|applyReportFilter|openQualAnalysisModal)\s*\(/g;
const ID_PATTERN = /\sid=["']([^"']+)["']/g;
const CRITICAL_DUPLICATE_IDS = new Set([
  "report-export-content",
  "download-report-pdf",
  "download-report-xlsx",
  "apply-report-filter",
]);

function collectMatches(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => match[0]);
}

function collectDuplicateIds(source) {
  const counts = new Map();
  for (const match of source.matchAll(ID_PATTERN)) {
    const id = match[1];
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]) => ({ id, count }));
}

function isVisibleElement(child) {
  if (!child || child.nodeType !== 1) return false;
  if (typeof child.getBoundingClientRect !== "function") return true;
  return child.getBoundingClientRect().height > 0;
}

export function inspectPdfExportMarkup(html) {
  const source = String(html || "");
  const blockers = [];
  const warnings = [];

  if (!source.trim()) {
    blockers.push("PDF로 변환할 리포트 내용이 비어 있습니다.");
  }

  for (const marker of REQUIRED_EXPORT_MARKERS) {
    if (!marker.pattern.test(source)) {
      blockers.push(`PDF export markup에서 ${marker.label}를 찾지 못했습니다.`);
    }
  }

  const inlineHandlers = collectMatches(source, INLINE_HANDLER_PATTERN);
  const legacyWindowHandlers = collectMatches(source, LEGACY_WINDOW_HANDLER_PATTERN);
  const duplicateIds = collectDuplicateIds(source);
  const criticalDuplicateIds = duplicateIds.filter((item) => CRITICAL_DUPLICATE_IDS.has(item.id));

  if (inlineHandlers.length > 0) {
    blockers.push("PDF export markup에 inline 이벤트 핸들러가 남아 있습니다.");
  }
  if (legacyWindowHandlers.length > 0) {
    blockers.push("PDF export markup에 legacy window 액션 호출이 남아 있습니다.");
  }
  if (criticalDuplicateIds.length > 0) {
    blockers.push(`PDF export markup에 중복된 핵심 ID가 있습니다: ${criticalDuplicateIds.map((item) => item.id).join(", ")}`);
  }
  if (duplicateIds.length > criticalDuplicateIds.length) {
    warnings.push(`중복 ID ${duplicateIds.length}개가 있습니다.`);
  }

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    inlineHandlerCount: inlineHandlers.length,
    legacyWindowHandlerCount: legacyWindowHandlers.length,
    duplicateIds,
  };
}

export function inspectPdfExportDocument(root) {
  const markupReport = inspectPdfExportMarkup(root?.outerHTML || "");
  const visibleBlockCount = root?.children ? Array.from(root.children).filter(isVisibleElement).length : 0;
  const blockers = [...markupReport.blockers];

  if (visibleBlockCount === 0) {
    blockers.push("PDF로 변환할 가시 리포트 블록이 없습니다.");
  }

  return {
    ...markupReport,
    ok: blockers.length === 0,
    blockers,
    visibleBlockCount,
  };
}

/**
 * PDF export 폭 검사 — 콘텐츠가 export 폭(940px)을 넘어가는(오른쪽으로 삐져나가는)
 * 요소를 찾아낸다. html2canvas는 요소의 offsetWidth로 캡처하므로, 이 폭을 넘는
 * 자식이 있으면 그동안 오른쪽이 잘렸다. (지금은 scrollWidth로 캡처해 잘림은 막지만,
 * 여기서 잡아 두면 어떤 요소가 넘치는지 로그로 확인/수정할 수 있다.)
 */
export function inspectPdfExportWidth(root, exportWidth) {
  if (!root || typeof root.getBoundingClientRect !== "function") {
    return { fits: true, contentWidth: 0, overflowing: [] };
  }
  const rootLeft = root.getBoundingClientRect().left;
  const limit = rootLeft + exportWidth;
  const overflowing = [];
  root.querySelectorAll("*").forEach((el) => {
    const rect = el.getBoundingClientRect();
    const overflow = rect.right - limit;
    if (overflow > 2 && rect.width > 0) {
      overflowing.push({
        tag: el.tagName.toLowerCase(),
        cls: typeof el.className === "string" ? el.className.slice(0, 60) : "",
        overflowPx: Math.round(overflow),
        width: Math.round(rect.width),
      });
    }
  });
  overflowing.sort((a, b) => b.overflowPx - a.overflowPx);
  return {
    fits: overflowing.length === 0,
    contentWidth: Math.ceil(root.scrollWidth || 0),
    exportWidth,
    overflowing: overflowing.slice(0, 12),
  };
}

export function assertPdfExportReady(root) {
  const report = inspectPdfExportDocument(root);
  if (!report.ok) {
    throw new Error(`PDF 리포트 준비 상태를 확인해 주세요: ${report.blockers.join(" ")}`);
  }
  return report;
}
