/**
 * 이메일 전송 서비스
 * Nodemailer 기반
 */

import nodemailer from 'nodemailer'

// 환경 변수에서 SMTP 설정 읽기
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com'
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587')
const EMAIL_USER = process.env.EMAIL_USER || ''
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || ''
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@dental.com'

// Transporter 생성
let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (!transporter && EMAIL_USER && EMAIL_PASSWORD) {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465, // true for 465, false for other ports
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD,
      },
      // 개발 환경에서 SSL 인증 오류 무시 (프로덕션에서는 제거)
      tls: {
        rejectUnauthorized: false
      }
    })
  }
  return transporter
}

export interface EmailOptions {
  to: string | string[]
  subject: string
  text?: string
  html?: string
}

/**
 * 이메일 전송
 */
async function sendEmail(options: EmailOptions): Promise<boolean> {
  const transport = getTransporter()

  // 이메일 설정이 안되어 있으면 콘솔에만 출력
  if (!transport) {
    console.log('[Email Service] Email credentials not configured. Skipping email send.')
    console.log('[Email Service] Would send:', {
      to: options.to,
      subject: options.subject,
      preview: (options.text || options.html || '').substring(0, 100)
    })
    return true
  }

  try {
    const info = await transport.sendMail({
      from: EMAIL_FROM,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    })

    console.log('[Email Service] Email sent successfully:', info.messageId)
    return true
  } catch (error) {
    console.error('[Email Service] Failed to send email:', error)
    return false
  }
}

export class EmailService {
  /**
   * 연차 신청 승인 이메일
   */
  async sendLeaveApprovalEmail(
    toEmail: string,
    data: {
      staffName: string
      leaveDate: string
      leaveType: string
    }
  ): Promise<{ success: boolean }> {
    const subject = `연차 신청 승인 - ${data.leaveDate}`
    const html = `
      <h2>연차 신청이 승인되었습니다</h2>
      <p>안녕하세요, ${data.staffName}님</p>
      <p>다음 연차 신청이 승인되었습니다:</p>
      <ul>
        <li><strong>날짜:</strong> ${data.leaveDate}</li>
        <li><strong>유형:</strong> ${data.leaveType}</li>
      </ul>
      <p>감사합니다.</p>
      <hr>
      <p style="font-size: 12px; color: #666;">
        이 이메일은 자동으로 발송되었습니다. 문의사항이 있으시면 관리자에게 연락해주세요.
      </p>
    `

    const success = await sendEmail({ to: toEmail, subject, html })
    return { success }
  }

  /**
   * 연차 신청 거절 이메일
   */
  async sendLeaveRejectionEmail(
    toEmail: string,
    data: {
      staffName: string
      leaveDate: string
      leaveType: string
      reason?: string
    }
  ): Promise<{ success: boolean }> {
    const subject = `연차 신청 거절 - ${data.leaveDate}`
    const html = `
      <h2>연차 신청이 거절되었습니다</h2>
      <p>안녕하세요, ${data.staffName}님</p>
      <p>다음 연차 신청이 거절되었습니다:</p>
      <ul>
        <li><strong>날짜:</strong> ${data.leaveDate}</li>
        <li><strong>유형:</strong> ${data.leaveType}</li>
        ${data.reason ? `<li><strong>사유:</strong> ${data.reason}</li>` : ''}
      </ul>
      <p>자세한 사항은 관리자에게 문의해주세요.</p>
      <hr>
      <p style="font-size: 12px; color: #666;">
        이 이메일은 자동으로 발송되었습니다. 문의사항이 있으시면 관리자에게 연락해주세요.
      </p>
    `

    const success = await sendEmail({ to: toEmail, subject, html })
    return { success }
  }

  /**
   * 스케줄 배포 알림 이메일
   */
  async sendScheduleNotification(
    toEmail: string | string[],
    schedule: {
      year: number
      month: number
      scheduleLink?: string
    }
  ): Promise<{ success: boolean }> {
    const subject = `${schedule.year}년 ${schedule.month}월 스케줄 배포`
    const html = `
      <h2>스케줄이 배포되었습니다</h2>
      <p>안녕하세요,</p>
      <p><strong>${schedule.year}년 ${schedule.month}월</strong> 스케줄이 배포되었습니다.</p>
      ${schedule.scheduleLink ? `
        <p>아래 링크에서 확인하실 수 있습니다:</p>
        <p><a href="${schedule.scheduleLink}" style="display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px;">스케줄 확인하기</a></p>
      ` : ''}
      <p>감사합니다.</p>
      <hr>
      <p style="font-size: 12px; color: #666;">
        이 이메일은 자동으로 발송되었습니다. 문의사항이 있으시면 관리자에게 연락해주세요.
      </p>
    `

    const success = await sendEmail({ to: toEmail, subject, html })
    return { success }
  }

  /**
   * 연차 신청 기간 알림 이메일
   */
  async sendLeaveApplicationPeriodEmail(
    toEmails: string[],
    data: {
      year: number
      month: number
      startDate: string
      endDate: string
      applicationLink: string
    }
  ): Promise<{ success: boolean }> {
    const subject = `${data.year}년 ${data.month}월 연차 신청 기간 안내`
    const html = `
      <h2>연차 신청 기간이 시작되었습니다</h2>
      <p>안녕하세요,</p>
      <p><strong>${data.year}년 ${data.month}월</strong> 연차 신청 기간이 시작되었습니다.</p>
      <ul>
        <li><strong>신청 기간:</strong> ${data.startDate} ~ ${data.endDate}</li>
      </ul>
      <p>아래 링크에서 연차를 신청하실 수 있습니다:</p>
      <p><a href="${data.applicationLink}" style="display: inline-block; padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px;">연차 신청하기</a></p>
      <p>감사합니다.</p>
      <hr>
      <p style="font-size: 12px; color: #666;">
        이 이메일은 자동으로 발송되었습니다. 문의사항이 있으시면 관리자에게 연락해주세요.
      </p>
    `

    const success = await sendEmail({ to: toEmails, subject, html })
    return { success }
  }

  /**
   * 출퇴근 의심 기록 알림 이메일 (관리자용)
   */
  async sendSuspiciousAttendanceEmail(
    toEmail: string,
    data: {
      staffName: string
      date: string
      checkType: string
      reason: string
    }
  ): Promise<{ success: boolean }> {
    const subject = `출퇴근 의심 기록 알림 - ${data.staffName}`
    const html = `
      <h2>출퇴근 의심 기록이 발생했습니다</h2>
      <p>관리자님,</p>
      <p>다음 출퇴근 기록이 의심스러운 것으로 표시되었습니다:</p>
      <ul>
        <li><strong>직원:</strong> ${data.staffName}</li>
        <li><strong>날짜:</strong> ${data.date}</li>
        <li><strong>유형:</strong> ${data.checkType === 'IN' ? '출근' : '퇴근'}</li>
        <li><strong>사유:</strong> ${data.reason}</li>
      </ul>
      <p>확인이 필요합니다.</p>
      <hr>
      <p style="font-size: 12px; color: #666;">
        이 이메일은 자동으로 발송되었습니다.
      </p>
    `

    const success = await sendEmail({ to: toEmail, subject, html })
    return { success }
  }
}

// Singleton 인스턴스
export const emailService = new EmailService()
