let currentOrgId = 'lina';
let currentUserEmail = '';

export function getCurrentOrgId() {
  return currentOrgId || 'lina';
}

export function setCurrentOrgId(orgId) {
  currentOrgId = orgId || 'lina';
  return currentOrgId;
}

export function getCurrentUserEmail() {
  return currentUserEmail || '';
}

export function setCurrentUserEmail(email) {
  currentUserEmail = email || '';
  return currentUserEmail;
}
