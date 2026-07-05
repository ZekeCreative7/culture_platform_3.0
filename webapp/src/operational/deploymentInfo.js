function readMetaContent(name, documentRef) {
  return documentRef?.querySelector?.(`meta[name="${name}"]`)?.getAttribute('content') || '';
}

function shortDateTime(value) {
  if (!value || value === 'unknown') return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

export function buildDeploymentInfo({
  env = import.meta.env,
  documentRef = typeof document !== 'undefined' ? document : null,
} = {}) {
  const commit = env?.VITE_APP_COMMIT || readMetaContent('culture-platform-build-commit', documentRef) || 'unknown';
  const buildTime = env?.VITE_APP_BUILD_TIME || readMetaContent('culture-platform-build-time', documentRef) || 'unknown';

  return {
    commit,
    buildTime,
    label: `배포 ${commit} · ${shortDateTime(buildTime)}`,
  };
}
