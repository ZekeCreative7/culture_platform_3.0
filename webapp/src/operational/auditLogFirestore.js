import { db, addDoc, collection, getDocs, limit as firestoreLimit, orderBy, query, serverTimestamp } from '../firebase.js';
import { getCurrentUserEmail } from '../auth/currentAuthContext.js';

export async function recordAuditLogAdapter({
  action,
  targetId,
  targetType,
  detail = '',
  getCurrentOrgId,
  onWarn = console.warn,
}) {
  try {
    const userId = getCurrentUserEmail() || 'unknown';
    await addDoc(collection(db, 'auditLogs'), {
      action,
      userId,
      targetId,
      targetType,
      detail,
      organizationId: getCurrentOrgId(),
      timestamp: serverTimestamp()
    });
  } catch (e) {
    onWarn('[auditLog] write failed', e);
  }
}

export async function fetchRecentAuditLogsAdapter(count = 20) {
  const auditQuery = query(
    collection(db, 'auditLogs'),
    orderBy('timestamp', 'desc'),
    firestoreLimit(count)
  );
  const snap = await getDocs(auditQuery);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
