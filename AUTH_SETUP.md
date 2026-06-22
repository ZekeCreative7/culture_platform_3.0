# 로그인 시스템 활성화

코드에는 관리자 비밀번호를 저장하지 않습니다. 아래 설정은 Firebase Console에서 한 번만 진행합니다.

1. Firebase Console의 **Authentication → Sign-in method**에서 **Email/Password**를 활성화합니다.
2. Authentication의 사용자 추가에서 `rhokoo7@naver.com` 관리자 계정을 생성하고 별도의 안전한 비밀번호를 설정합니다.
3. 프로젝트 루트에서 `firebase deploy --only firestore:rules`를 실행해 `firestore.rules`를 배포합니다.
4. 관리자 계정으로 로그인한 뒤 상단의 **회원 승인**에서 가입 요청을 승인합니다.

보안을 위해 대화에서 공유된 초기 비밀번호는 첫 로그인 후 변경하는 것을 권장합니다.

익명 설문은 로그인 없이 계속 동작하도록 설문 단건 조회와 해당 설문의 응답 생성만 예외로 허용했습니다. 공개 링크의 자동화된 스팸 제출을 더 강하게 제한하려면 Firebase App Check도 함께 활성화하는 것이 좋습니다.

## 승인 요청 이메일 알림

회원가입 요청이 새로 생성되면 `mail/{uid}` 문서가 함께 생성되며 `zekedesign7@gmail.com`으로 알림을 보냅니다.

1. Firebase Console의 **Extensions**에서 공식 **Trigger Email from Firestore** 확장 기능을 설치합니다.
2. 이메일 문서 컬렉션은 `mail`로 지정합니다.
3. SendGrid, Mailgun 또는 Gmail OAuth2 등 사용할 SMTP 정보를 입력합니다.
4. 기본 발신자 주소를 설정하고 확장 기능 설치를 완료합니다.
5. 새 알림 규칙이 포함된 `firestore.rules`를 다시 퍼블리시합니다.

Firebase 이메일 확장 기능은 Blaze 요금제와 SMTP 발송 계정 설정이 필요합니다. 알림 문서는 사용자 UID를 문서 ID로 사용해 동일 가입 요청에서 중복 메일이 생성되지 않도록 했습니다.

## Firebase App Check

reCAPTCHA Enterprise Site Key `6LfuSSktAAAAANg8W3c0tVOUp6_aH99ZlZX8nbMg`를 운영자 앱과 익명 설문 페이지에 적용했습니다.

1. GitHub Pages에 배포한 뒤 Firebase Console의 **App Check → Metrics**에서 Firestore 요청이 `Verified`로 잡히는지 확인합니다.
2. 운영 화면 로그인, 설문 링크 열기, 설문 제출을 각각 한 번 테스트합니다.
3. 정상 요청이 확인된 뒤 Cloud Firestore에만 **Enforce**를 활성화합니다.
4. Firebase Authentication Enforce는 Preview이므로 초기 적용에서는 활성화하지 않습니다.

로컬 개발 환경에서는 브라우저 콘솔에 출력되는 App Check Debug Token을 Firebase Console의 **App Check → 앱 메뉴 → Manage debug tokens**에 등록해야 합니다. Debug Token은 저장소에 커밋하거나 외부에 공유하지 않습니다.
