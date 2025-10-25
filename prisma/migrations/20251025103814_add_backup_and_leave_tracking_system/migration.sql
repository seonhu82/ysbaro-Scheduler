-- CreateTable
CREATE TABLE "WeeklyAssignmentBackup" (
    "id" TEXT NOT NULL,
    "weekInfoId" TEXT NOT NULL,
    "backupType" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignments" JSONB NOT NULL,
    "fairnessScores" JSONB,
    "restoredAt" TIMESTAMP(3),
    "restoredBy" TEXT,

    CONSTRAINT "WeeklyAssignmentBackup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveChangeLog" (
    "id" TEXT NOT NULL,
    "leaveApplicationId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "oldStatus" TEXT,
    "newStatus" TEXT,
    "oldDate" DATE,
    "newDate" DATE,
    "affectedWeekIds" TEXT[],
    "requiresReassignment" BOOLEAN NOT NULL DEFAULT false,
    "reassignedAt" TIMESTAMP(3),
    "reassignedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "LeaveChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentValidationLog" (
    "id" TEXT NOT NULL,
    "weekInfoId" TEXT NOT NULL,
    "validationType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "issueCount" INTEGER NOT NULL,
    "criticalCount" INTEGER NOT NULL,
    "warningCount" INTEGER NOT NULL,
    "infoCount" INTEGER NOT NULL,
    "issues" JSONB NOT NULL,
    "autoFixAttempted" BOOLEAN NOT NULL DEFAULT false,
    "autoFixSuccess" BOOLEAN,
    "autoFixLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentValidationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyAssignmentBackup_weekInfoId_idx" ON "WeeklyAssignmentBackup"("weekInfoId");

-- CreateIndex
CREATE INDEX "WeeklyAssignmentBackup_backupType_idx" ON "WeeklyAssignmentBackup"("backupType");

-- CreateIndex
CREATE INDEX "WeeklyAssignmentBackup_createdAt_idx" ON "WeeklyAssignmentBackup"("createdAt");

-- CreateIndex
CREATE INDEX "LeaveChangeLog_leaveApplicationId_idx" ON "LeaveChangeLog"("leaveApplicationId");

-- CreateIndex
CREATE INDEX "LeaveChangeLog_requiresReassignment_idx" ON "LeaveChangeLog"("requiresReassignment");

-- CreateIndex
CREATE INDEX "LeaveChangeLog_createdAt_idx" ON "LeaveChangeLog"("createdAt");

-- CreateIndex
CREATE INDEX "AssignmentValidationLog_weekInfoId_idx" ON "AssignmentValidationLog"("weekInfoId");

-- CreateIndex
CREATE INDEX "AssignmentValidationLog_validationType_idx" ON "AssignmentValidationLog"("validationType");

-- CreateIndex
CREATE INDEX "AssignmentValidationLog_severity_idx" ON "AssignmentValidationLog"("severity");

-- CreateIndex
CREATE INDEX "AssignmentValidationLog_createdAt_idx" ON "AssignmentValidationLog"("createdAt");

-- AddForeignKey
ALTER TABLE "WeeklyAssignmentBackup" ADD CONSTRAINT "WeeklyAssignmentBackup_weekInfoId_fkey" FOREIGN KEY ("weekInfoId") REFERENCES "WeekInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveChangeLog" ADD CONSTRAINT "LeaveChangeLog_leaveApplicationId_fkey" FOREIGN KEY ("leaveApplicationId") REFERENCES "LeaveApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentValidationLog" ADD CONSTRAINT "AssignmentValidationLog_weekInfoId_fkey" FOREIGN KEY ("weekInfoId") REFERENCES "WeekInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
