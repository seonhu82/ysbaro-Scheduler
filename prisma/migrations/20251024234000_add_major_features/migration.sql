-- 1. Doctor 테이블에 shortName 추가
ALTER TABLE "Doctor" ADD COLUMN "shortName" TEXT NOT NULL DEFAULT '';

-- 2. DoctorCategory 테이블에 shortName 추가
ALTER TABLE "DoctorCategory" ADD COLUMN "shortName" TEXT NOT NULL DEFAULT '';

-- 3. Staff 테이블에 배치 유연성 및 직급 필드 추가
ALTER TABLE "Staff" ADD COLUMN "position" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Staff" ADD COLUMN "flexibleForCategories" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Staff" ADD COLUMN "flexibilityPriority" INTEGER NOT NULL DEFAULT 0;

-- 4. CategoryRatioSettings 테이블 생성
CREATE TABLE "CategoryRatioSettings" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "ratios" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryRatioSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CategoryRatioSettings_clinicId_key" ON "CategoryRatioSettings"("clinicId");

ALTER TABLE "CategoryRatioSettings" ADD CONSTRAINT "CategoryRatioSettings_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. ApplicationStatus enum 확장 (ON_HOLD, REJECTED 추가)
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'ON_HOLD';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- 6. LeaveApplication 테이블에 holdReason 추가
ALTER TABLE "LeaveApplication" ADD COLUMN "holdReason" TEXT;

-- status 인덱스는 이미 존재할 수 있으므로 없을 때만 생성
CREATE INDEX IF NOT EXISTS "LeaveApplication_status_idx" ON "LeaveApplication"("status");

-- 코멘트 추가
COMMENT ON COLUMN "Doctor"."shortName" IS '조합명용 줄임표시 (예: 박, 황)';
COMMENT ON COLUMN "DoctorCategory"."shortName" IS '조합명용 줄임표시 (예: 박(상담))';
COMMENT ON COLUMN "Staff"."position" IS '직급';
COMMENT ON COLUMN "Staff"."flexibleForCategories" IS '배치 유연성 - 다른 구분으로도 배치 가능';
COMMENT ON COLUMN "Staff"."flexibilityPriority" IS '유연 배치 우선순위';
COMMENT ON COLUMN "LeaveApplication"."holdReason" IS '보류 사유 (ON_HOLD 상태일 때)';
COMMENT ON TABLE "CategoryRatioSettings" IS '구분별 필요인원 비율 설정';
