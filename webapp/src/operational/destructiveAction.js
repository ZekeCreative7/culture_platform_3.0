export function confirmDestructiveAction({
  title,
  body,
  impact = [],
  confirmImpl = (message) => window.confirm(message),
}) {
  const lines = [
    title || '위험 작업을 실행할까요?',
    '',
    body,
    ...(impact.length ? ['', '영향:', ...impact.map((item) => `- ${item}`)] : []),
    '',
    '계속하시겠습니까?',
  ].filter((line) => line !== undefined && line !== null);
  return confirmImpl(lines.join('\n'));
}

export async function runDestructiveAction({
  title,
  body,
  impact = [],
  applyLocal,
  rollbackLocal,
  persistRemote,
  onSuccess,
  onError,
  confirmImpl,
}) {
  if (!confirmDestructiveAction({ title, body, impact, confirmImpl })) return { ok: false, cancelled: true };
  try {
    applyLocal?.();
    await persistRemote?.();
    onSuccess?.();
    return { ok: true, cancelled: false };
  } catch (error) {
    try {
      rollbackLocal?.();
    } catch (rollbackError) {
      console.error('[destructiveAction] rollback failed', rollbackError);
    }
    onError?.(error);
    return { ok: false, cancelled: false, error };
  }
}
