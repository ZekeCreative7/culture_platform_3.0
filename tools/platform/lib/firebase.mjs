/**
 * 길 A 브릿지 — Firebase Admin 초기화
 *
 * 서비스계정 키(tools/platform/serviceAccount.json)로 Firestore에 admin 접근한다.
 * 이 키는 admin 권한(보안 규칙 우회)이므로 절대 커밋하지 않는다(.gitignore).
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const HERE = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = join(HERE, '..', 'serviceAccount.json');

// 앱과 동일하게 organizationId로 데이터를 스코프한다. 이 값이 안 맞으면 화면에 안 뜬다.
export const ORG_ID = 'lina';
export const PROJECT_ID = 'culture-platform-8cd24';

if (!existsSync(KEY_PATH)) {
  console.error('\n[브릿지] 서비스계정 키가 없습니다: tools/platform/serviceAccount.json');
  console.error('Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성으로 받아');
  console.error('이 경로에 serviceAccount.json 으로 저장하세요.\n');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'));

if (serviceAccount.project_id && serviceAccount.project_id !== PROJECT_ID) {
  console.error(`\n[브릿지] 키의 project_id(${serviceAccount.project_id})가 예상(${PROJECT_ID})과 다릅니다. 올바른 프로젝트 키인지 확인하세요.\n`);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });

export const db = getFirestore();

// 조직 스코프가 걸린 컬렉션 조회 헬퍼
export function orgQuery(collectionName) {
  return db.collection(collectionName).where('organizationId', '==', ORG_ID);
}
