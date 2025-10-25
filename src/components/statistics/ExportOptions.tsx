'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { FileSpreadsheet, FileText, Download, Calendar } from 'lucide-react'
import { useStatistics } from '@/lib/hooks/use-statistics'

interface ExportOptionsProps {
  year: number
  month: number
}

export function ExportOptions({ year, month }: ExportOptionsProps) {
  const { exportStatistics, isExporting } = useStatistics(year, month)
  const [selectedFormat, setSelectedFormat] = useState<'excel' | 'pdf'>('excel')

  const handleExport = async () => {
    try {
      exportStatistics(selectedFormat)
      alert(`${selectedFormat === 'excel' ? 'Excel' : 'PDF'} 파일 내보내기가 시작되었습니다`)
    } catch (error) {
      console.error('Export failed:', error)
      alert('내보내기에 실패했습니다')
    }
  }

  return (
    <div className="space-y-6">
      {/* 내보내기 옵션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            통계 내보내기
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-base font-semibold mb-3 block">
              내보내기 형식 선택
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Excel 옵션 */}
              <button
                onClick={() => setSelectedFormat('excel')}
                className={`p-6 border-2 rounded-lg text-left transition-all ${
                  selectedFormat === 'excel'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <FileSpreadsheet
                    className={`w-8 h-8 ${
                      selectedFormat === 'excel' ? 'text-blue-600' : 'text-gray-600'
                    }`}
                  />
                  <div>
                    <h3 className="font-semibold text-lg">Excel</h3>
                    <p className="text-sm text-gray-600">.xlsx</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  데이터 분석 및 편집이 가능한 Excel 파일로 내보냅니다
                </p>
                <ul className="mt-3 text-xs text-gray-500 space-y-1">
                  <li>• 월별 통계 시트</li>
                  <li>• 직원별 업무량 시트</li>
                  <li>• 형평성 점수 시트</li>
                  <li>• 차트 및 그래프 포함</li>
                </ul>
              </button>

              {/* PDF 옵션 */}
              <button
                onClick={() => setSelectedFormat('pdf')}
                className={`p-6 border-2 rounded-lg text-left transition-all ${
                  selectedFormat === 'pdf'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <FileText
                    className={`w-8 h-8 ${
                      selectedFormat === 'pdf' ? 'text-blue-600' : 'text-gray-600'
                    }`}
                  />
                  <div>
                    <h3 className="font-semibold text-lg">PDF</h3>
                    <p className="text-sm text-gray-600">.pdf</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  인쇄 및 공유에 적합한 PDF 리포트로 내보냅니다
                </p>
                <ul className="mt-3 text-xs text-gray-500 space-y-1">
                  <li>• 요약 리포트</li>
                  <li>• 상세 통계표</li>
                  <li>• 형평성 분석</li>
                  <li>• 시각화 차트</li>
                </ul>
              </button>
            </div>
          </div>

          {/* 내보내기 버튼 */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleExport} disabled={isExporting} size="lg">
              <Download className="w-4 h-4 mr-2" />
              {isExporting
                ? '내보내는 중...'
                : `${selectedFormat === 'excel' ? 'Excel' : 'PDF'} 파일 내보내기`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 내보내기 정보 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">내보내기 정보</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p>• 대상 기간: {year}년 {month}월</p>
                <p>• 포함 내용: 월별 통계, 직원 업무량, 형평성 점수</p>
                <p>• 생성일: {new Date().toLocaleString('ko-KR')}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 사용 안내 */}
      <Card>
        <CardHeader>
          <CardTitle>내보내기 가이드</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-700">
            <div>
              <h4 className="font-semibold mb-1">Excel 파일 활용</h4>
              <p className="text-gray-600">
                Excel 파일은 데이터 편집, 추가 분석, 차트 커스터마이징이 가능합니다.
                Microsoft Excel, Google Sheets 등에서 열 수 있습니다.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-1">PDF 리포트 활용</h4>
              <p className="text-gray-600">
                PDF 리포트는 인쇄 및 이메일 공유에 적합합니다. 관리자 보고,
                직원 공지, 회의 자료로 활용할 수 있습니다.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-1">정기 백업 권장</h4>
              <p className="text-gray-600">
                매월 말 통계 데이터를 내보내어 백업하는 것을 권장합니다.
                장기 추세 분석 및 데이터 보존에 유용합니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
