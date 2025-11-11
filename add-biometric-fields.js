const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// 1. Staff 모델에 생체인증 필드 추가
const staffSecurityBlock = `  // 보안 정보
  registeredDevices Json? // 등록된 기기 목록
  pinCode           String? // 6자리 PIN 번호 (로그인용)
  securityQuestion  String? // 보안 질문 (PIN 재설정용)
  securityAnswer    String? // 보안 답변 (PIN 재설정용)`;

const staffSecurityWithBiometric = `  // 보안 정보
  registeredDevices Json? // 등록된 기기 목록
  pinCode           String? // 6자리 PIN 번호 (로그인용)
  securityQuestion  String? // 보안 질문 (PIN 재설정용)
  securityAnswer    String? // 보안 답변 (PIN 재설정용)

  // 생체인증 정보 (WebAuthn)
  biometricEnabled      Boolean  @default(false) // 생체인증 활성화 여부
  biometricPublicKey    String?  @db.Text // 암호화된 공개키
  biometricCredentialId String? // 인증서 ID
  biometricCounter      Int      @default(0) // 재생 공격 방지 카운터
  biometricRegisteredAt DateTime? // 등록 일시
  biometricDeviceType   String? // 기기 타입 (fingerprint, face 등)`;

schema = schema.replace(staffSecurityBlock, staffSecurityWithBiometric);

// 2. AttendanceRecord에 method 필드 추가
const attendanceCheckType = `  checkType CheckType // IN (출근) / OUT (퇴근)`;
const attendanceCheckTypeWithMethod = `  checkType   CheckType         // IN (출근) / OUT (퇴근)
  checkMethod AttendanceMethod? // 인증 방법 (BIOMETRIC, PIN, QR, MANUAL)`;

schema = schema.replace(attendanceCheckType, attendanceCheckTypeWithMethod);

// 3. Enum 추가 (파일 끝에)
const enumsToAdd = `
// 출퇴근 인증 방법
enum AttendanceMethod {
  BIOMETRIC // 생체인증
  PIN       // PIN 번호
  QR        // QR 코드
  MANUAL    // 관리자 수동 입력
}
`;

// CheckType enum 뒤에 추가
const checkTypeEnum = `enum CheckType {
  IN
  OUT
}`;

schema = schema.replace(checkTypeEnum, checkTypeEnum + enumsToAdd);

fs.writeFileSync(schemaPath, schema, 'utf8');

console.log('✅ Prisma schema updated successfully!');
console.log('');
console.log('Added to Staff model:');
console.log('  - biometricEnabled');
console.log('  - biometricPublicKey');
console.log('  - biometricCredentialId');
console.log('  - biometricCounter');
console.log('  - biometricRegisteredAt');
console.log('  - biometricDeviceType');
console.log('');
console.log('Added to AttendanceRecord model:');
console.log('  - checkMethod (AttendanceMethod enum)');
console.log('');
console.log('Added AttendanceMethod enum:');
console.log('  - BIOMETRIC, PIN, QR, MANUAL');
console.log('');
console.log('Next step: Run migration');
console.log('  npx prisma migrate dev --name add_biometric_attendance');
