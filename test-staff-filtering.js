const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testStaffFiltering() {
  console.log('=== 직원 관리 필터링 테스트 ===\n')

  const clinicId = 'cmh697itv0001fw83azbrqe60'

  // 모든 활성 직원 조회
  const staff = await prisma.staff.findMany({
    where: {
      clinicId,
      isActive: true
    },
    select: {
      id: true,
      name: true,
      departmentName: true,
      categoryName: true
    },
    orderBy: [
      { departmentName: 'asc' },
      { categoryName: 'asc' },
      { name: 'asc' }
    ]
  })

  console.log(`총 활성 직원: ${staff.length}명\n`)

  // 부서별 그룹화
  const byDepartment = {}
  staff.forEach(s => {
    const dept = s.departmentName || '(부서 없음)'
    if (!byDepartment[dept]) byDepartment[dept] = []
    byDepartment[dept].push(s)
  })

  console.log('📋 부서별 분포:')
  Object.entries(byDepartment).forEach(([dept, staffList]) => {
    console.log(`  ${dept}: ${staffList.length}명`)
    staffList.forEach(s => {
      console.log(`    - ${s.name} (구분: ${s.categoryName || '-'})`)
    })
  })
  console.log()

  // 구분별 그룹화
  const byCategory = {}
  staff.forEach(s => {
    const cat = s.categoryName || '(구분 없음)'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(s)
  })

  console.log('🏷️  구분별 분포:')
  Object.entries(byCategory).forEach(([cat, staffList]) => {
    console.log(`  ${cat}: ${staffList.length}명`)
  })
  console.log()

  // 필터링 시뮬레이션
  console.log('🧪 필터링 시뮬레이션:')

  const testFilters = [
    { dept: '진료실', cat: 'ALL' },
    { dept: 'ALL', cat: '고년차' },
    { dept: '진료실', cat: '고년차' },
  ]

  testFilters.forEach(({ dept, cat }) => {
    const filtered = staff.filter(s => {
      if (dept !== 'ALL' && s.departmentName !== dept) return false
      if (cat !== 'ALL' && s.categoryName !== cat) return false
      return true
    })

    console.log(`  부서="${dept}", 구분="${cat}": ${filtered.length}명`)
    if (filtered.length > 0) {
      filtered.slice(0, 3).forEach(s => {
        console.log(`    - ${s.name} (${s.departmentName} / ${s.categoryName || '-'})`)
      })
      if (filtered.length > 3) {
        console.log(`    ... 외 ${filtered.length - 3}명`)
      }
    }
  })

  await prisma.$disconnect()
}

testStaffFiltering().catch(console.error)
