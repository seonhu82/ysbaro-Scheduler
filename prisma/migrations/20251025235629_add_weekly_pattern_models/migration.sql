-- CreateTable
CREATE TABLE "WeeklyPattern" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyPatternDay" (
    "id" TEXT NOT NULL,
    "weeklyPatternId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "combinationId" TEXT,
    "isClosedDay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyPatternDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyPattern_clinicId_idx" ON "WeeklyPattern"("clinicId");

-- CreateIndex
CREATE INDEX "WeeklyPattern_isDefault_idx" ON "WeeklyPattern"("isDefault");

-- CreateIndex
CREATE INDEX "WeeklyPatternDay_weeklyPatternId_idx" ON "WeeklyPatternDay"("weeklyPatternId");

-- CreateIndex
CREATE INDEX "WeeklyPatternDay_combinationId_idx" ON "WeeklyPatternDay"("combinationId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyPatternDay_weeklyPatternId_dayOfWeek_key" ON "WeeklyPatternDay"("weeklyPatternId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "WeeklyPattern" ADD CONSTRAINT "WeeklyPattern_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPatternDay" ADD CONSTRAINT "WeeklyPatternDay_weeklyPatternId_fkey" FOREIGN KEY ("weeklyPatternId") REFERENCES "WeeklyPattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPatternDay" ADD CONSTRAINT "WeeklyPatternDay_combinationId_fkey" FOREIGN KEY ("combinationId") REFERENCES "DoctorCombination"("id") ON DELETE SET NULL ON UPDATE CASCADE;
