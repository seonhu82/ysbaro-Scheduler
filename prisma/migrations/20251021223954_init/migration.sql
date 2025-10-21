-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "StaffRank" AS ENUM ('HYGIENIST', 'ASSISTANT', 'COORDINATOR', 'NURSE', 'OTHER');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('DRAFT', 'PENDING', 'CONFIRMED', 'DEPLOYED');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('DAY', 'NIGHT', 'OFF');

-- CreateEnum
CREATE TYPE "LinkStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DayType" AS ENUM ('WEEKDAY', 'SATURDAY');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'OFF');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LEAVE_SUBMITTED', 'LEAVE_CONFIRMED', 'LEAVE_CANCELLED', 'SCHEDULE_DEPLOYED', 'SYSTEM_ALERT');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('SCHEDULE_CREATED', 'SCHEDULE_UPDATED', 'SCHEDULE_DEPLOYED', 'LEAVE_SUBMITTED', 'LEAVE_CONFIRMED', 'LEAVE_CANCELLED', 'SETTINGS_UPDATED', 'USER_LOGIN', 'USER_LOGOUT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "clinicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clinic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialization" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorPattern" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patternName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorPatternDay" (
    "id" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isWorkday" BOOLEAN NOT NULL DEFAULT true,
    "hasNightShift" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DoctorPatternDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rank" "StaffRank" NOT NULL,
    "pin" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffRankSettings" (
    "id" TEXT NOT NULL,
    "rank" "StaffRank" NOT NULL,
    "requiredCount" INTEGER NOT NULL,
    "distributionRate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffRankSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deployedAt" TIMESTAMP(3),

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleDoctor" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hasNightShift" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ScheduleDoctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAssignment" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationLink" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "LinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlotLimit" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dayType" "DayType" NOT NULL,
    "maxSlots" INTEGER NOT NULL,
    "currentSlots" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SlotLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveApplication" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleViewLink" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleViewLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentSettings" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "autoGenerateLink" BOOLEAN NOT NULL DEFAULT true,
    "linkValidityDays" INTEGER NOT NULL DEFAULT 30,
    "allowIndividualView" BOOLEAN NOT NULL DEFAULT true,
    "allowFullView" BOOLEAN NOT NULL DEFAULT true,
    "allowDoctorView" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleSettings" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "maxWeeklyOffs" INTEGER NOT NULL DEFAULT 2,
    "preventSundayOff" BOOLEAN NOT NULL DEFAULT true,
    "preventHolidayOff" BOOLEAN NOT NULL DEFAULT true,
    "maxConsecutiveNights" INTEGER NOT NULL DEFAULT 3,
    "minRestAfterNight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FairnessSettings" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "nightShiftWeight" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "weekendWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "holidayWeight" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "enableFairnessCheck" BOOLEAN NOT NULL DEFAULT true,
    "fairnessThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FairnessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialCondition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "condition" JSONB NOT NULL,
    "action" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSettings" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "enableBrowserNotification" BOOLEAN NOT NULL DEFAULT true,
    "enableEmailNotification" BOOLEAN NOT NULL DEFAULT false,
    "notifyOnLeaveSubmit" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnLeaveConfirm" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnScheduleDeploy" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupConfig" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "enableAutoBackup" BOOLEAN NOT NULL DEFAULT true,
    "backupFrequency" TEXT NOT NULL DEFAULT 'daily',
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "lastBackupAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackupConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Backup" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "backupType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Backup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FairnessScore" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "nightShiftCount" INTEGER NOT NULL DEFAULT 0,
    "weekendCount" INTEGER NOT NULL DEFAULT 0,
    "holidayCount" INTEGER NOT NULL DEFAULT 0,
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FairnessScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "userId" TEXT,
    "activityType" "ActivityType" NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_clinicId_idx" ON "User"("clinicId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Doctor_clinicId_idx" ON "Doctor"("clinicId");

-- CreateIndex
CREATE INDEX "DoctorPattern_doctorId_idx" ON "DoctorPattern"("doctorId");

-- CreateIndex
CREATE INDEX "DoctorPatternDay_patternId_idx" ON "DoctorPatternDay"("patternId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorPatternDay_patternId_dayOfWeek_key" ON "DoctorPatternDay"("patternId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "Staff_clinicId_idx" ON "Staff"("clinicId");

-- CreateIndex
CREATE INDEX "Staff_pin_idx" ON "Staff"("pin");

-- CreateIndex
CREATE UNIQUE INDEX "StaffRankSettings_rank_key" ON "StaffRankSettings"("rank");

-- CreateIndex
CREATE INDEX "Schedule_clinicId_year_month_idx" ON "Schedule"("clinicId", "year", "month");

-- CreateIndex
CREATE INDEX "Schedule_status_idx" ON "Schedule"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_clinicId_year_month_key" ON "Schedule"("clinicId", "year", "month");

-- CreateIndex
CREATE INDEX "ScheduleDoctor_scheduleId_idx" ON "ScheduleDoctor"("scheduleId");

-- CreateIndex
CREATE INDEX "ScheduleDoctor_date_idx" ON "ScheduleDoctor"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleDoctor_scheduleId_doctorId_date_key" ON "ScheduleDoctor"("scheduleId", "doctorId", "date");

-- CreateIndex
CREATE INDEX "StaffAssignment_scheduleId_idx" ON "StaffAssignment"("scheduleId");

-- CreateIndex
CREATE INDEX "StaffAssignment_staffId_idx" ON "StaffAssignment"("staffId");

-- CreateIndex
CREATE INDEX "StaffAssignment_date_idx" ON "StaffAssignment"("date");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAssignment_scheduleId_staffId_date_key" ON "StaffAssignment"("scheduleId", "staffId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationLink_token_key" ON "ApplicationLink"("token");

-- CreateIndex
CREATE INDEX "ApplicationLink_clinicId_idx" ON "ApplicationLink"("clinicId");

-- CreateIndex
CREATE INDEX "ApplicationLink_token_idx" ON "ApplicationLink"("token");

-- CreateIndex
CREATE INDEX "ApplicationLink_status_idx" ON "ApplicationLink"("status");

-- CreateIndex
CREATE INDEX "SlotLimit_linkId_idx" ON "SlotLimit"("linkId");

-- CreateIndex
CREATE INDEX "SlotLimit_date_idx" ON "SlotLimit"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SlotLimit_linkId_date_key" ON "SlotLimit"("linkId", "date");

-- CreateIndex
CREATE INDEX "LeaveApplication_clinicId_idx" ON "LeaveApplication"("clinicId");

-- CreateIndex
CREATE INDEX "LeaveApplication_linkId_idx" ON "LeaveApplication"("linkId");

-- CreateIndex
CREATE INDEX "LeaveApplication_staffId_idx" ON "LeaveApplication"("staffId");

-- CreateIndex
CREATE INDEX "LeaveApplication_date_idx" ON "LeaveApplication"("date");

-- CreateIndex
CREATE INDEX "LeaveApplication_status_idx" ON "LeaveApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleViewLink_token_key" ON "ScheduleViewLink"("token");

-- CreateIndex
CREATE INDEX "ScheduleViewLink_clinicId_idx" ON "ScheduleViewLink"("clinicId");

-- CreateIndex
CREATE INDEX "ScheduleViewLink_token_idx" ON "ScheduleViewLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentSettings_clinicId_key" ON "DeploymentSettings"("clinicId");

-- CreateIndex
CREATE INDEX "Holiday_clinicId_idx" ON "Holiday"("clinicId");

-- CreateIndex
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_clinicId_date_key" ON "Holiday"("clinicId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RuleSettings_clinicId_key" ON "RuleSettings"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "FairnessSettings_clinicId_key" ON "FairnessSettings"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSettings_clinicId_key" ON "NotificationSettings"("clinicId");

-- CreateIndex
CREATE INDEX "BackupConfig_clinicId_idx" ON "BackupConfig"("clinicId");

-- CreateIndex
CREATE INDEX "Backup_clinicId_idx" ON "Backup"("clinicId");

-- CreateIndex
CREATE INDEX "Backup_createdAt_idx" ON "Backup"("createdAt");

-- CreateIndex
CREATE INDEX "FairnessScore_staffId_idx" ON "FairnessScore"("staffId");

-- CreateIndex
CREATE INDEX "FairnessScore_year_month_idx" ON "FairnessScore"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "FairnessScore_staffId_year_month_key" ON "FairnessScore"("staffId", "year", "month");

-- CreateIndex
CREATE INDEX "Notification_clinicId_idx" ON "Notification"("clinicId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_clinicId_idx" ON "ActivityLog"("clinicId");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorPattern" ADD CONSTRAINT "DoctorPattern_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorPatternDay" ADD CONSTRAINT "DoctorPatternDay_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "DoctorPattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleDoctor" ADD CONSTRAINT "ScheduleDoctor_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleDoctor" ADD CONSTRAINT "ScheduleDoctor_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationLink" ADD CONSTRAINT "ApplicationLink_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotLimit" ADD CONSTRAINT "SlotLimit_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ApplicationLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApplication" ADD CONSTRAINT "LeaveApplication_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApplication" ADD CONSTRAINT "LeaveApplication_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ApplicationLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApplication" ADD CONSTRAINT "LeaveApplication_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleViewLink" ADD CONSTRAINT "ScheduleViewLink_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentSettings" ADD CONSTRAINT "DeploymentSettings_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleSettings" ADD CONSTRAINT "RuleSettings_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairnessSettings" ADD CONSTRAINT "FairnessSettings_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackupConfig" ADD CONSTRAINT "BackupConfig_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Backup" ADD CONSTRAINT "Backup_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairnessScore" ADD CONSTRAINT "FairnessScore_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
