-- CreateTable
CREATE TABLE "LeavePeriod" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "maxSlots" INTEGER NOT NULL DEFAULT 0,
    "categorySlots" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeavePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeavePeriod_clinicId_idx" ON "LeavePeriod"("clinicId");

-- CreateIndex
CREATE INDEX "LeavePeriod_year_month_idx" ON "LeavePeriod"("year", "month");

-- CreateIndex
CREATE INDEX "LeavePeriod_isActive_idx" ON "LeavePeriod"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LeavePeriod_clinicId_year_month_key" ON "LeavePeriod"("clinicId", "year", "month");

-- AddForeignKey
ALTER TABLE "LeavePeriod" ADD CONSTRAINT "LeavePeriod_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
