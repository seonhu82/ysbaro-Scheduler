-- AlterTable: FairnessSettings - 가중치 필드 제거, 개별 형평성 활성화 옵션 추가
ALTER TABLE "FairnessSettings" DROP COLUMN "enableFairnessCheck",
DROP COLUMN "holidayWeight",
DROP COLUMN "nightShiftWeight",
DROP COLUMN "weekendWeight",
ADD COLUMN "enableNightShiftFairness" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "enableWeekendFairness" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "enableHolidayFairness" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "enableHolidayAdjacentFairness" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: FairnessScore - totalScore 제거, holidayAdjacentCount 추가
ALTER TABLE "FairnessScore" DROP COLUMN "totalScore",
ADD COLUMN "holidayAdjacentCount" INTEGER NOT NULL DEFAULT 0;

-- 주석 추가
COMMENT ON COLUMN "FairnessScore"."nightShiftCount" IS '야간 근무 횟수';
COMMENT ON COLUMN "FairnessScore"."weekendCount" IS '주말(토요일) 근무 횟수';
COMMENT ON COLUMN "FairnessScore"."holidayCount" IS '공휴일 근무 횟수';
COMMENT ON COLUMN "FairnessScore"."holidayAdjacentCount" IS '공휴일 전후 근무 횟수';

COMMENT ON COLUMN "FairnessSettings"."enableNightShiftFairness" IS '야간 근무 형평성 사용';
COMMENT ON COLUMN "FairnessSettings"."enableWeekendFairness" IS '주말 근무 형평성 사용';
COMMENT ON COLUMN "FairnessSettings"."enableHolidayFairness" IS '공휴일 근무 형평성 사용';
COMMENT ON COLUMN "FairnessSettings"."enableHolidayAdjacentFairness" IS '공휴일 전후 근무 형평성 사용';
