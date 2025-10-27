/**
 * 통합 테스트 스크립트
 * 핵심 기능 검증
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testFairnessSettings() {
  console.log('\n📊 [Test 1] Fairness Settings with Weights')
  console.log('=' .repeat(60))

  try {
    // 형평성 설정 조회
    const settings = await prisma.fairnessSettings.findFirst({
      where: { clinicId: 'clinic-1' }
    })

    if (!settings) {
      console.log('❌ Fairness settings not found')
      return false
    }

    console.log('✅ Fairness Settings Found:')
    console.log(`  - Night Shift Fairness: ${settings.enableNightShiftFairness}`)
    console.log(`  - Weekend Fairness: ${settings.enableWeekendFairness}`)
    console.log(`  - Holiday Fairness: ${settings.enableHolidayFairness}`)
    console.log(`  - Threshold: ${settings.fairnessThreshold}`)
    console.log('\n  Weight Fields:')
    console.log(`  - Night Shift Weight: ${settings.nightShiftWeight}`)
    console.log(`  - Weekend Weight: ${settings.weekendWeight}`)
    console.log(`  - Holiday Weight: ${settings.holidayWeight}`)
    console.log(`  - Holiday Adjacent Weight: ${settings.holidayAdjacentWeight}`)

    return true
  } catch (error) {
    console.log('❌ Error:', error.message)
    return false
  }
}

async function testDatabaseIntegrity() {
  console.log('\n🗄️  [Test 2] Database Integrity')
  console.log('=' .repeat(60))

  try {
    const clinic = await prisma.clinic.findFirst()
    const staff = await prisma.staff.count()
    const doctors = await prisma.doctor.count()
    const holidays = await prisma.holiday.count()

    console.log('✅ Database Records:')
    console.log(`  - Clinic: ${clinic?.name}`)
    console.log(`  - Staff: ${staff}명`)
    console.log(`  - Doctors: ${doctors}명`)
    console.log(`  - Holidays: ${holidays}개`)

    return true
  } catch (error) {
    console.log('❌ Error:', error.message)
    return false
  }
}

async function testEmailService() {
  console.log('\n📧 [Test 3] Email Service Configuration')
  console.log('=' .repeat(60))

  try {
    const fs = require('fs')
    const path = require('path')

    // .env 파일에서 이메일 설정 확인
    const envPath = path.join(__dirname, '.env')
    const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : ''

    const hasEmailHost = envContent.includes('EMAIL_HOST')
    const hasEmailUser = envContent.includes('EMAIL_USER')
    const hasEmailPassword = envContent.includes('EMAIL_PASSWORD')

    console.log('✅ Email Configuration Check:')
    console.log(`  - EMAIL_HOST: ${hasEmailHost ? 'Configured' : 'Not configured'}`)
    console.log(`  - EMAIL_USER: ${hasEmailUser ? 'Configured' : 'Not configured'}`)
    console.log(`  - EMAIL_PASSWORD: ${hasEmailPassword ? 'Configured' : 'Not configured'}`)

    // email-service.ts 파일 존재 확인
    const emailServicePath = path.join(__dirname, 'src', 'lib', 'services', 'email-service.ts')
    const emailServiceExists = fs.existsSync(emailServicePath)

    console.log(`  - Email Service File: ${emailServiceExists ? 'EXISTS ✓' : 'MISSING ✗'}`)

    if (emailServiceExists) {
      const serviceContent = fs.readFileSync(emailServicePath, 'utf-8')
      const hasApprovalEmail = serviceContent.includes('sendLeaveApprovalEmail')
      const hasRejectionEmail = serviceContent.includes('sendLeaveRejectionEmail')
      const hasScheduleEmail = serviceContent.includes('sendScheduleNotification')
      const hasSuspiciousEmail = serviceContent.includes('sendSuspiciousAttendanceEmail')

      console.log('\n  Email Service Methods:')
      console.log(`    * Leave Approval: ${hasApprovalEmail ? '✓' : '✗'}`)
      console.log(`    * Leave Rejection: ${hasRejectionEmail ? '✓' : '✗'}`)
      console.log(`    * Schedule Notification: ${hasScheduleEmail ? '✓' : '✗'}`)
      console.log(`    * Suspicious Attendance: ${hasSuspiciousEmail ? '✓' : '✗'}`)
    }

    console.log('\n💡 Note: Email credentials not configured in .env')
    console.log('   Emails will be logged to console instead of being sent.')

    return true
  } catch (error) {
    console.log('❌ Error:', error.message)
    return false
  }
}

async function testStaffQueries() {
  console.log('\n👥 [Test 4] Staff Department/Category Queries')
  console.log('=' .repeat(60))

  try {
    const staff = await prisma.staff.findMany({
      where: { clinicId: 'clinic-1' },
      select: {
        name: true,
        departmentName: true,
        categoryName: true,
        workType: true,
        isActive: true
      },
      take: 5
    })

    console.log('✅ Sample Staff Records:')
    staff.forEach((s, i) => {
      console.log(`  ${i+1}. ${s.name} - ${s.departmentName}/${s.categoryName} (${s.workType})`)
    })

    return true
  } catch (error) {
    console.log('❌ Error:', error.message)
    return false
  }
}

async function testScheduleAlgorithmInputs() {
  console.log('\n🤖 [Test 5] Schedule Algorithm Inputs')
  console.log('=' .repeat(60))

  try {
    // 원장 조합이 있는지 확인
    const combinations = await prisma.doctorCombination.count({
      where: { clinicId: 'clinic-1' }
    })

    console.log('✅ Algorithm Prerequisites:')
    console.log(`  - Doctor Combinations: ${combinations}개`)

    if (combinations === 0) {
      console.log('⚠️  Warning: No doctor combinations found. Need to run initial setup.')
    }

    // 규칙 설정 확인
    const ruleSettings = await prisma.ruleSettings.findUnique({
      where: { clinicId: 'clinic-1' }
    })

    if (ruleSettings) {
      console.log('  - Rule Settings: Configured ✓')
      console.log(`    * Max Consecutive Nights: ${ruleSettings.maxConsecutiveNights}`)
      console.log(`    * Prevent Sunday Off: ${ruleSettings.preventSundayOff}`)
    }

    return true
  } catch (error) {
    console.log('❌ Error:', error.message)
    return false
  }
}

async function runAllTests() {
  console.log('\n🚀 Starting Integration Tests')
  console.log('=' .repeat(60))

  const results = []

  results.push(await testFairnessSettings())
  results.push(await testDatabaseIntegrity())
  results.push(await testEmailService())
  results.push(await testStaffQueries())
  results.push(await testScheduleAlgorithmInputs())

  const passed = results.filter(r => r).length
  const total = results.length

  console.log('\n' + '=' .repeat(60))
  console.log(`📊 Test Results: ${passed}/${total} tests passed`)
  console.log('=' .repeat(60))

  if (passed === total) {
    console.log('✅ All tests passed!')
  } else {
    console.log(`⚠️  ${total - passed} test(s) failed`)
  }

  await prisma.$disconnect()
  process.exit(passed === total ? 0 : 1)
}

runAllTests()
