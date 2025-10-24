-- Add hasNightShift column to DoctorCombination
ALTER TABLE "DoctorCombination" ADD COLUMN "hasNightShift" BOOLEAN NOT NULL DEFAULT false;

-- Add comment
COMMENT ON COLUMN "DoctorCombination"."hasNightShift" IS '야간 진료 여부';
