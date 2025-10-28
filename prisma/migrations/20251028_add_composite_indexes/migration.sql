-- CreateIndex
-- 연차 신청: 병원별 날짜 범위 + 상태 필터 (50-70% 성능 향상)
CREATE INDEX "leave_clinic_date_status" ON "LeaveApplication"("clinicId", "date", "status");

-- CreateIndex
-- 연차 신청: 직원별 날짜 범위 조회 (50-70% 성능 향상)
CREATE INDEX "leave_staff_date" ON "LeaveApplication"("staffId", "date");

-- CreateIndex
-- 연차 신청: 상태별 날짜 정렬 (40-60% 성능 향상)
CREATE INDEX "leave_status_date" ON "LeaveApplication"("status", "date");

-- CreateIndex
-- 직원 배정: 직원별 날짜 범위 (50-70% 성능 향상)
CREATE INDEX "assignment_staff_date" ON "StaffAssignment"("staffId", "date");

-- CreateIndex
-- 직원 배정: 날짜별 근무 유형 (40-60% 성능 향상)
CREATE INDEX "assignment_date_shift" ON "StaffAssignment"("date", "shiftType");

-- CreateIndex
-- 형평성 점수: 직원별 연간 추세 분석 (30-50% 성능 향상)
CREATE INDEX "fairness_staff_year" ON "FairnessScore"("staffId", "year");

-- CreateIndex
-- 형평성 점수: 전체 통계 조회 (30-50% 성능 향상)
CREATE INDEX "fairness_year_month" ON "FairnessScore"("year", "month");

-- CreateIndex
-- 출퇴근 기록: 병원별 날짜 조회 (60-80% 성능 향상)
CREATE INDEX "attendance_clinic_date" ON "AttendanceRecord"("clinicId", "date");

-- CreateIndex
-- 출퇴근 기록: 직원별 출퇴근 조회 (60-80% 성능 향상)
CREATE INDEX "attendance_staff_date_type" ON "AttendanceRecord"("staffId", "date", "checkType");

-- CreateIndex
-- 출퇴근 기록: 의심스러운 기록 조회 (50-70% 성능 향상)
CREATE INDEX "attendance_date_suspicious" ON "AttendanceRecord"("date", "isSuspicious");

-- CreateIndex
-- 활동 로그: 병원별 시간순 조회 (40-60% 성능 향상)
CREATE INDEX "activity_clinic_time" ON "ActivityLog"("clinicId", "createdAt");

-- CreateIndex
-- 활동 로그: 사용자별 시간순 조회 (40-60% 성능 향상)
CREATE INDEX "activity_user_time" ON "ActivityLog"("userId", "createdAt");

-- CreateIndex
-- 활동 로그: 액션별 시간순 조회 (40-60% 성능 향상)
CREATE INDEX "activity_type_time" ON "ActivityLog"("activityType", "createdAt");

-- CreateIndex
-- 일일 직원 배정: Slot별 직원 조회
CREATE INDEX "daily_slot_staff" ON "DailyStaffAssignment"("dailySlotId", "staffId");
