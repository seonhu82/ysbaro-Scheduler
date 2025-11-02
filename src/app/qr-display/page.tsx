/**
 * QR 디스플레이 뷰 페이지
 * 경로: /qr-display
 *
 * 기능:
 * - 대기실 TV용 실시간 스케줄 표시
 * - QR 코드 표시 (출퇴근 체크인용)
 * - 자동 새로고침
 * - 전체화면 최적화
 */

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Monitor, Calendar, Users, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import QRCode from 'qrcode'

interface TodaySchedule {
  date: string
  doctors: { name: string; isNightShift: boolean }[]
  staff: { name: string; categoryName: string }[]
  hasNightShift: boolean
}

export default function QRDisplayPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [schedule, setSchedule] = useState<TodaySchedule | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [loading, setLoading] = useState(true)

  // 권한 확인
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login/qr-display')
    } else if (status === 'authenticated' && (session?.user as any)?.role !== 'QR_DISPLAY') {
      router.push('/')
    }
  }, [status, session, router])

  // 현재 시각 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // 오늘 스케줄 조회
  useEffect(() => {
    fetchTodaySchedule()
    const interval = setInterval(fetchTodaySchedule, 60000) // 1분마다 갱신

    return () => clearInterval(interval)
  }, [])

  // QR 코드 생성
  useEffect(() => {
    generateQRCode()
  }, [session])

  const fetchTodaySchedule = async () => {
    try {
      setLoading(true)
      const today = new Date()
      const year = today.getFullYear()
      const month = today.getMonth() + 1
      const date = today.getDate()

      const response = await fetch(
        `/api/schedule/daily-detail?year=${year}&month=${month}&date=${date}`
      )
      const data = await response.json()

      if (data.success) {
        setSchedule(data.schedule)
      }
    } catch (error) {
      console.error('Failed to fetch schedule:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateQRCode = async () => {
    try {
      // 출퇴근 체크인 URL
      const checkInUrl = `${window.location.origin}/attendance/check-in`
      const qrUrl = await QRCode.toDataURL(checkInUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#1f2937',
          light: '#ffffff'
        }
      })
      setQrCodeUrl(qrUrl)
    } catch (error) {
      console.error('Failed to generate QR code:', error)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-xl">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 p-8">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Monitor className="w-12 h-12 text-white" />
              <div>
                <h1 className="text-4xl font-bold text-white">연세바로치과</h1>
                <p className="text-blue-200 text-lg">근무 스케줄 안내</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold text-white">
              {format(currentTime, 'HH:mm:ss')}
            </div>
            <div className="text-xl text-blue-200 mt-1">
              {format(currentTime, 'yyyy년 M월 d일 (E)', { locale: ko })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 좌측: 오늘의 스케줄 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 원장 스케줄 */}
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center gap-2">
                <Users className="w-6 h-6" />
                오늘 근무 원장
              </CardTitle>
            </CardHeader>
            <CardContent>
              {schedule?.doctors && schedule.doctors.length > 0 ? (
                <div className="space-y-3">
                  {schedule.doctors.map((doctor, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-white/20 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                          {doctor.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xl font-bold text-white">{doctor.name}</div>
                          <div className="text-blue-200">원장</div>
                        </div>
                      </div>
                      {doctor.isNightShift && (
                        <Badge className="bg-purple-500 text-white text-lg px-4 py-2">
                          🌙 야간 근무
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-white/60">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-xl">오늘 근무 원장 정보가 없습니다</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 직원 스케줄 */}
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center gap-2">
                <Calendar className="w-6 h-6" />
                오늘 근무 직원
              </CardTitle>
            </CardHeader>
            <CardContent>
              {schedule?.staff && schedule.staff.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {schedule.staff.map((member, index) => (
                    <div
                      key={index}
                      className="p-4 bg-white/20 rounded-lg"
                    >
                      <div className="text-lg font-bold text-white">{member.name}</div>
                      <div className="text-blue-200 text-sm">{member.categoryName}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-white/60">
                  <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-xl">오늘 근무 직원 정보가 없습니다</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 우측: QR 코드 */}
        <div className="space-y-6">
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center gap-2">
                <Clock className="w-6 h-6" />
                출퇴근 체크인
              </CardTitle>
            </CardHeader>
            <CardContent>
              {qrCodeUrl ? (
                <div className="text-center">
                  <div className="bg-white p-6 rounded-xl inline-block mb-4">
                    <img
                      src={qrCodeUrl}
                      alt="출퇴근 체크인 QR 코드"
                      className="w-64 h-64"
                    />
                  </div>
                  <div className="text-white">
                    <p className="text-xl font-bold mb-2">스마트폰으로 스캔하세요</p>
                    <p className="text-blue-200">
                      QR 코드를 스캔하여
                      <br />
                      출퇴근을 체크인할 수 있습니다
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-white/60">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                  <p>QR 코드 생성 중...</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 안내 사항 */}
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader>
              <CardTitle className="text-lg text-white">안내 사항</CardTitle>
            </CardHeader>
            <CardContent className="text-white/80 space-y-2 text-sm">
              <p>• 출근 시 QR 코드를 스캔해주세요</p>
              <p>• 퇴근 시에도 체크아웃 해주세요</p>
              <p>• 스케줄은 자동으로 업데이트됩니다</p>
              <p>• 문의사항은 관리자에게 연락하세요</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 하단 상태 표시 */}
      <div className="mt-8 text-center text-white/60 text-sm">
        <p>마지막 업데이트: {format(new Date(), 'HH:mm:ss')}</p>
        <p className="mt-1">자동 갱신 활성화</p>
      </div>
    </div>
  )
}
