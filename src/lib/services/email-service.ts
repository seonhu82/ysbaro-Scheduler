// 이메일 서비스
export class EmailService {
  async sendLeaveApprovalEmail(to: string, data: any) {
    console.log('Email sent:', to, data)
    return { success: true }
  }

  async sendScheduleNotification(to: string, schedule: any) {
    console.log('Schedule notification sent:', to)
    return { success: true }
  }
}
