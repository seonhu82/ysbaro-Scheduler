'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface StatisticsData {
  period: string
  schedules: {
    total: number
    draft: number
    confirmed: number
    deployed: number
    totalAssignments: number
  }
  leaves: {
    total: number
    pending: number
    approved: number
    rejected: number
    annual: number
    off: number
  }
  staff: {
    total: number
    byRank: Record<string, number>
    byWorkType: Record<string, number>
  }
  attendance: {
    total: number
    checkIn: number
    checkOut: number
    suspicious: number
  }
  staffDetails?: Array<{
    id: string
    name: string
    departmentName: string
    categoryName: string
    workType: string
    rank: string
    leaves: { total: number; annual: number; off: number }
    fairness: { nightShift: number; weekend: number; holiday: number; holidayAdjacent: number }
    attendance: { total: number; checkIn: number; checkOut: number }
  }>
  departments?: Array<{
    name: string
    staffCount: number
    leaves: number
    attendance: number
    fairness: { nightShift: number; weekend: number; holiday: number }
  }>
  categories?: Array<{
    name: string
    staffCount: number
    leaves: number
    attendance: number
    fairness: { nightShift: number; weekend: number; holiday: number }
  }>
  monthlyTrend?: Array<{
    month: number
    schedules: number
    leaves: number
    attendance: number
  }>
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function StatisticsPage() {
  const [data, setData] = useState<StatisticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState<number | null>(null)

  useEffect(() => {
    fetchStatistics()
  }, [year, month])

  const fetchStatistics = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ year: year.toString() })
      if (month) {
        params.append('month', month.toString())
      }

      const response = await fetch(`/api/statistics?${params}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePrevYear = () => setYear(year - 1)
  const handleNextYear = () => setYear(year + 1)
  const handleMonthSelect = (m: number | null) => setMonth(m)

  // 엑셀 다운로드
  const downloadExcel = () => {
    if (!data) return

    const wb = XLSX.utils.book_new()

    // 1. 요약 시트
    const summaryData = [
      ['기간', data.period],
      [],
      ['스케줄 통계'],
      ['총 스케줄', data.schedules.total],
      ['임시저장', data.schedules.draft],
      ['확정', data.schedules.confirmed],
      ['배포', data.schedules.deployed],
      ['총 배정 수', data.schedules.totalAssignments],
      [],
      ['연차 통계'],
      ['총 신청', data.leaves.total],
      ['대기', data.leaves.pending],
      ['승인', data.leaves.approved],
      ['거절', data.leaves.rejected],
      ['연차', data.leaves.annual],
      ['오프', data.leaves.off],
      [],
      ['직원 통계'],
      ['총 직원', data.staff.total],
      [],
      ['출퇴근 통계'],
      ['총 기록', data.attendance.total],
      ['출근', data.attendance.checkIn],
      ['퇴근', data.attendance.checkOut],
      ['의심 기록', data.attendance.suspicious]
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summarySheet, '요약')

    // 2. 부서별 통계
    if (data.departments && data.departments.length > 0) {
      const deptData = data.departments.map(d => ({
        부서: d.name,
        직원수: d.staffCount,
        연차사용: d.leaves,
        출퇴근기록: d.attendance,
        야간근무: d.fairness.nightShift,
        주말근무: d.fairness.weekend,
        공휴일근무: d.fairness.holiday
      }))
      const deptSheet = XLSX.utils.json_to_sheet(deptData)
      XLSX.utils.book_append_sheet(wb, deptSheet, '부서별 통계')
    }

    // 3. 구분별 통계
    if (data.categories && data.categories.length > 0) {
      const catData = data.categories.map(c => ({
        구분: c.name,
        직원수: c.staffCount,
        연차사용: c.leaves,
        출퇴근기록: c.attendance,
        야간근무: c.fairness.nightShift,
        주말근무: c.fairness.weekend,
        공휴일근무: c.fairness.holiday
      }))
      const catSheet = XLSX.utils.json_to_sheet(catData)
      XLSX.utils.book_append_sheet(wb, catSheet, '구분별 통계')
    }

    // 4. 직원별 상세
    if (data.staffDetails && data.staffDetails.length > 0) {
      const staffData = data.staffDetails.map(s => ({
        이름: s.name,
        부서: s.departmentName,
        구분: s.categoryName,
        근무형태: s.workType,
        총연차: s.leaves.total,
        연차: s.leaves.annual,
        오프: s.leaves.off,
        야간근무: s.fairness.nightShift,
        주말근무: s.fairness.weekend,
        공휴일근무: s.fairness.holiday,
        출퇴근기록: s.attendance.total
      }))
      const staffSheet = XLSX.utils.json_to_sheet(staffData)
      XLSX.utils.book_append_sheet(wb, staffSheet, '직원별 상세')
    }

    // 5. 월별 추이
    if (data.monthlyTrend) {
      const trendData = data.monthlyTrend.map(t => ({
        월: `${t.month}월`,
        스케줄: t.schedules,
        연차: t.leaves,
        출퇴근: t.attendance
      }))
      const trendSheet = XLSX.utils.json_to_sheet(trendData)
      XLSX.utils.book_append_sheet(wb, trendSheet, '월별 추이')
    }

    XLSX.writeFile(wb, `통계_${data.period}.xlsx`)
  }

  // PDF 다운로드
  const downloadPDF = () => {
    if (!data) return

    const doc = new jsPDF()

    // 한글 폰트 문제로 영문으로 표시 (실제로는 한글 폰트 추가 필요)
    doc.setFontSize(18)
    doc.text(`Statistics Report - ${data.period}`, 14, 22)

    let yPos = 40

    // 요약 통계
    doc.setFontSize(14)
    doc.text('Summary', 14, yPos)
    yPos += 10

    autoTable(doc, {
      startY: yPos,
      head: [['Category', 'Total', 'Draft', 'Confirmed', 'Deployed']],
      body: [
        ['Schedules', data.schedules.total, data.schedules.draft, data.schedules.confirmed, data.schedules.deployed]
      ],
      theme: 'grid'
    })

    yPos = (doc as any).lastAutoTable.finalY + 15

    autoTable(doc, {
      startY: yPos,
      head: [['Category', 'Total', 'Pending', 'Approved', 'Rejected']],
      body: [
        ['Leave Applications', data.leaves.total, data.leaves.pending, data.leaves.approved, data.leaves.rejected]
      ],
      theme: 'grid'
    })

    yPos = (doc as any).lastAutoTable.finalY + 15

    // 부서별 통계
    if (data.departments && data.departments.length > 0) {
      if (yPos > 250) {
        doc.addPage()
        yPos = 20
      }

      doc.setFontSize(14)
      doc.text('Department Statistics', 14, yPos)
      yPos += 10

      autoTable(doc, {
        startY: yPos,
        head: [['Department', 'Staff', 'Leaves', 'Night Shift', 'Weekend', 'Holiday']],
        body: data.departments.map(d => [
          d.name,
          d.staffCount,
          d.leaves,
          d.fairness.nightShift,
          d.fairness.weekend,
          d.fairness.holiday
        ]),
        theme: 'striped'
      })

      yPos = (doc as any).lastAutoTable.finalY + 15
    }

    // 구분별 통계
    if (data.categories && data.categories.length > 0) {
      if (yPos > 250) {
        doc.addPage()
        yPos = 20
      }

      doc.setFontSize(14)
      doc.text('Category Statistics', 14, yPos)
      yPos += 10

      autoTable(doc, {
        startY: yPos,
        head: [['Category', 'Staff', 'Leaves', 'Night Shift', 'Weekend', 'Holiday']],
        body: data.categories.map(c => [
          c.name,
          c.staffCount,
          c.leaves,
          c.fairness.nightShift,
          c.fairness.weekend,
          c.fairness.holiday
        ]),
        theme: 'striped'
      })
    }

    doc.save(`statistics_${data.period}.pdf`)
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">통계</h1>
        <p>로딩 중...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">통계</h1>
        <p>데이터를 불러올 수 없습니다.</p>
      </div>
    )
  }

  // 차트 데이터 준비
  const scheduleChartData = [
    { name: '임시저장', value: data.schedules.draft, fill: COLORS[0] },
    { name: '확정', value: data.schedules.confirmed, fill: COLORS[1] },
    { name: '배포', value: data.schedules.deployed, fill: COLORS[2] }
  ]

  const leaveChartData = [
    { name: '대기', value: data.leaves.pending, fill: COLORS[3] },
    { name: '승인', value: data.leaves.approved, fill: COLORS[1] },
    { name: '거절', value: data.leaves.rejected, fill: COLORS[0] }
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">통계 대시보드</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrevYear}>
              이전
            </Button>
            <span className="font-semibold">{year}년</span>
            <Button variant="outline" size="sm" onClick={handleNextYear}>
              다음
            </Button>
          </div>
          <select
            value={month || ''}
            onChange={(e) => handleMonthSelect(e.target.value ? parseInt(e.target.value) : null)}
            className="border rounded px-3 py-1"
          >
            <option value="">연간</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
          <Button onClick={downloadExcel} variant="outline" size="sm" className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            엑셀
          </Button>
          <Button onClick={downloadPDF} variant="outline" size="sm" className="gap-2">
            <FileText className="w-4 h-4" />
            PDF
          </Button>
        </div>
      </div>

      <div className="text-sm text-gray-600">기간: {data.period}</div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">스케줄</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.schedules.total}</div>
            <div className="text-xs text-gray-500 mt-2">
              확정: {data.schedules.confirmed} / 배포: {data.schedules.deployed}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">연차 신청</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.leaves.total}</div>
            <div className="text-xs text-gray-500 mt-2">
              승인: {data.leaves.approved} / 대기: {data.leaves.pending}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">직원</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.staff.total}</div>
            <div className="text-xs text-gray-500 mt-2">활성 직원</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">출퇴근 기록</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.attendance.total}</div>
            <div className="text-xs text-gray-500 mt-2">
              출근: {data.attendance.checkIn} / 퇴근: {data.attendance.checkOut}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 차트 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 스케줄 상태 차트 */}
        <Card>
          <CardHeader>
            <CardTitle>스케줄 상태 분포</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={scheduleChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {scheduleChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 연차 신청 상태 차트 */}
        <Card>
          <CardHeader>
            <CardTitle>연차 신청 현황</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={leaveChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8">
                  {leaveChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 부서별 통계 */}
      {data.departments && data.departments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>부서별 통계</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">부서</th>
                    <th className="text-right py-2">직원 수</th>
                    <th className="text-right py-2">연차 사용</th>
                    <th className="text-right py-2">야간 근무</th>
                    <th className="text-right py-2">주말 근무</th>
                    <th className="text-right py-2">공휴일 근무</th>
                  </tr>
                </thead>
                <tbody>
                  {data.departments.map((dept, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="py-2">{dept.name}</td>
                      <td className="text-right">{dept.staffCount}</td>
                      <td className="text-right">{dept.leaves}</td>
                      <td className="text-right">{dept.fairness.nightShift}</td>
                      <td className="text-right">{dept.fairness.weekend}</td>
                      <td className="text-right">{dept.fairness.holiday}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 구분별 통계 */}
      {data.categories && data.categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>구분별 통계</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">구분</th>
                    <th className="text-right py-2">직원 수</th>
                    <th className="text-right py-2">연차 사용</th>
                    <th className="text-right py-2">야간 근무</th>
                    <th className="text-right py-2">주말 근무</th>
                    <th className="text-right py-2">공휴일 근무</th>
                  </tr>
                </thead>
                <tbody>
                  {data.categories.map((cat, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="py-2">{cat.name}</td>
                      <td className="text-right">{cat.staffCount}</td>
                      <td className="text-right">{cat.leaves}</td>
                      <td className="text-right">{cat.fairness.nightShift}</td>
                      <td className="text-right">{cat.fairness.weekend}</td>
                      <td className="text-right">{cat.fairness.holiday}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 월별 추이 (연간 조회시) */}
      {data.monthlyTrend && (
        <Card>
          <CardHeader>
            <CardTitle>월별 추이</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" label={{ value: '월', position: 'insideBottomRight', offset: -5 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="schedules" stroke="#3b82f6" name="스케줄" />
                <Line type="monotone" dataKey="leaves" stroke="#10b981" name="연차" />
                <Line type="monotone" dataKey="attendance" stroke="#f59e0b" name="출퇴근" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
