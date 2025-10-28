/**
 * 복합 인덱스 성능 검증 스크립트
 *
 * 사용법:
 * npx ts-node scripts/verify-indexes.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['query']
})

async function verifyIndexes() {
  console.log('📊 복합 인덱스 성능 검증 시작\n')

  try {
    // 1. 인덱스 목록 확인
    console.log('1️⃣ 생성된 복합 인덱스 확인')
    const indexes: any[] = await prisma.$queryRaw`
      SELECT
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
        AND (indexname LIKE '%_clinic_%'
          OR indexname LIKE '%_staff_%'
          OR indexname LIKE '%_date_%'
          OR indexname LIKE '%_type_%')
      ORDER BY tablename, indexname
    `

    console.log(`\n✅ 총 ${indexes.length}개의 복합 인덱스 발견:\n`)
    for (const idx of indexes) {
      console.log(`   ${idx.tablename.padEnd(25)} ${idx.indexname.padEnd(35)} ${idx.index_size}`)
    }

    // 2. LeaveApplication 쿼리 테스트
    console.log('\n\n2️⃣ LeaveApplication 쿼리 성능 테스트')
    const startDate = new Date('2024-01-01')
    const endDate = new Date('2024-12-31')

    const leaveStart = Date.now()
    const leaveApps = await prisma.leaveApplication.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        status: 'CONFIRMED'
      },
      take: 100
    })
    const leaveTime = Date.now() - leaveStart
    console.log(`   ⏱️  쿼리 시간: ${leaveTime}ms`)
    console.log(`   📄 결과: ${leaveApps.length}건`)

    // 3. FairnessScore 쿼리 테스트
    console.log('\n3️⃣ FairnessScore 추세 분석 쿼리 테스트')
    const fairnessStart = Date.now()
    const fairnessScores = await prisma.fairnessScore.findMany({
      where: {
        year: 2024,
        month: { gte: 1, lte: 12 }
      },
      take: 100
    })
    const fairnessTime = Date.now() - fairnessStart
    console.log(`   ⏱️  쿼리 시간: ${fairnessTime}ms`)
    console.log(`   📄 결과: ${fairnessScores.length}건`)

    // 4. AttendanceRecord 쿼리 테스트
    console.log('\n4️⃣ AttendanceRecord 날짜 범위 쿼리 테스트')
    const attendanceStart = Date.now()
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        date: { gte: startDate, lte: endDate }
      },
      take: 100
    })
    const attendanceTime = Date.now() - attendanceStart
    console.log(`   ⏱️  쿼리 시간: ${attendanceTime}ms`)
    console.log(`   📄 결과: ${attendanceRecords.length}건`)

    // 5. 인덱스 사용률 통계
    console.log('\n\n5️⃣ 인덱스 사용률 통계')
    const usageStats: any[] = await prisma.$queryRaw`
      SELECT
        indexname,
        idx_scan as scans,
        idx_tup_read as rows_read,
        idx_tup_fetch as rows_fetched
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'leave_clinic_date_status',
          'leave_staff_date',
          'assignment_staff_date',
          'fairness_staff_year',
          'fairness_year_month',
          'attendance_clinic_date',
          'attendance_staff_date_type',
          'activity_clinic_time'
        )
      ORDER BY idx_scan DESC
    `

    console.log('\n   인덱스명                              스캔 횟수    읽은 행    가져온 행')
    console.log('   ' + '─'.repeat(80))
    for (const stat of usageStats) {
      console.log(
        `   ${stat.indexname.padEnd(35)} ${String(stat.scans).padStart(10)} ${String(stat.rows_read).padStart(10)} ${String(stat.rows_fetched).padStart(10)}`
      )
    }

    console.log('\n\n✅ 검증 완료!')
    console.log('\n💡 Tips:')
    console.log('   - 쿼리 시간이 100ms 이하면 양호')
    console.log('   - idx_scan이 높을수록 인덱스가 잘 활용되고 있음')
    console.log('   - EXPLAIN ANALYZE로 실행 계획을 확인하여 Index Scan 사용 확인')

  } catch (error) {
    console.error('❌ 에러 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// EXPLAIN ANALYZE 실행 함수
async function explainQuery(query: string) {
  console.log('\n📋 쿼리 실행 계획:\n')
  const plan: any[] = await prisma.$queryRawUnsafe(`EXPLAIN (ANALYZE, BUFFERS) ${query}`)
  for (const line of plan) {
    console.log(`   ${line['QUERY PLAN']}`)
  }
}

// 실행
verifyIndexes()
  .then(() => {
    console.log('\n\n📊 추가 분석이 필요하면 다음 쿼리를 실행하세요:')
    console.log('\n```sql')
    console.log(`EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM "LeaveApplication"
WHERE "date" >= '2024-01-01'
  AND "date" <= '2024-12-31'
  AND "status" = 'CONFIRMED';
`)
    console.log('```')
  })
  .catch(console.error)
