// 엑셀 내보내기 서비스
import * as XLSX from 'xlsx'

export class ExportService {
  exportScheduleToExcel(data: any[]) {
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Schedule')
    XLSX.writeFile(wb, 'schedule.xlsx')
  }

  exportLeaveToExcel(data: any[]) {
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Leave')
    XLSX.writeFile(wb, 'leave.xlsx')
  }
}
