'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tablet,
  QrCode,
  Fingerprint,
  Users,
  Copy,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Video,
  VideoOff
} from 'lucide-react'
import { io, Socket } from 'socket.io-client'

interface TabletData {
  clinic: {
    id: string
    name: string
    phone: string
    address: string
    userCount: number
    staffCount: number
  }
  tablets: {
    attendance: {
      url: string | null
      token: string | null
      expiresAt: string | null
      status: string
    }
    biometric: {
      url: string | null
      token: string | null
      expiresAt: string | null
      registeredCount: number
      totalStaff: number
      status: string
    }
    manualAssign: {
      url: string | null
      token: string | null
      expiresAt: string | null
      status: string
    }
  }
  lastActivity: {
    timestamp: string | null
    method: string | null
  }
}

export default function TabletsPage() {
  const [tablets, setTablets] = useState<TabletData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Socket.io 스트리밍
  const [socket, setSocket] = useState<Socket | null>(null)
  const [watchingClinicId, setWatchingClinicId] = useState<string | null>(null)
  const [streamFrame, setStreamFrame] = useState<string | null>(null)
  const [streamActive, setStreamActive] = useState(false)

  const fetchTablets = async () => {
    setLoading(true)
    console.log('🔍 Fetching tablets data...')
    try {
      const res = await fetch('/api/admin/tablets')
      console.log('📡 API Response status:', res.status)
      const data = await res.json()
      console.log('📦 API Response data:', data)
      if (data.success) {
        console.log('✅ Setting', data.data.length, 'clinics')
        setTablets(data.data)
      } else {
        console.error('❌ API returned success: false', data)
      }
    } catch (error) {
      console.error('❌ Failed to fetch tablets:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTablets()
  }, [])

  // Socket.io 연결
  useEffect(() => {
    const socketIo = io()
    setSocket(socketIo)

    socketIo.on('connect', () => {
      console.log('🔌 Admin socket connected:', socketIo.id)
    })

    socketIo.on('admin:frame', (data: { clinicId: string; frame: string }) => {
      if (data.clinicId === watchingClinicId) {
        setStreamFrame(data.frame)
      }
    })

    socketIo.on('admin:stream-active', (data: { clinicId: string }) => {
      console.log('📹 Stream is active for clinic:', data.clinicId)
      setStreamActive(true)
    })

    socketIo.on('admin:stream-inactive', (data: { clinicId: string }) => {
      console.log('🛑 Stream is inactive for clinic:', data.clinicId)
      setStreamActive(false)
      setStreamFrame(null)
    })

    socketIo.on('admin:stream-stopped', (data: { clinicId: string }) => {
      console.log('🛑 Stream stopped for clinic:', data.clinicId)
      if (data.clinicId === watchingClinicId) {
        setStreamActive(false)
        setStreamFrame(null)
      }
    })

    return () => {
      socketIo.disconnect()
    }
  }, [watchingClinicId])

  // 스트리밍 시작
  const startWatching = (clinicId: string) => {
    if (!socket) return

    setWatchingClinicId(clinicId)
    setStreamFrame(null)
    socket.emit('admin:watch-stream', { clinicId })
  }

  // 스트리밍 중지
  const stopWatching = () => {
    if (!socket || !watchingClinicId) return

    socket.emit('admin:stop-watching', { clinicId: watchingClinicId })
    setWatchingClinicId(null)
    setStreamFrame(null)
    setStreamActive(false)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('클립보드에 복사되었습니다.')
  }

  const filteredTablets = tablets.filter(
    (t) =>
      t.clinic.name.toLowerCase().includes(search.toLowerCase()) ||
      t.clinic.phone?.includes(search)
  )

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return (
        <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded">
          <CheckCircle className="w-3 h-3" />
          활성
        </span>
      )
    }
    return (
      <span className="flex items-center gap-1 text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded">
        <XCircle className="w-3 h-3" />
        비활성
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Tablet className="w-8 h-8" />
          태블릿 관리
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchTablets} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
          <Link href="/admin/dashboard">
            <Button variant="outline" size="sm">
              ← 대시보드로
            </Button>
          </Link>
        </div>
      </div>

      {/* 검색 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <Input
          type="text"
          placeholder="병원명 또는 전화번호로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* 실시간 카메라 스트리밍 뷰어 */}
      {watchingClinicId && (
        <Card className="border-4 border-blue-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-blue-600" />
                실시간 카메라 스트리밍
                {streamActive && (
                  <span className="flex items-center gap-2 text-sm text-green-600 font-normal">
                    <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                    활성
                  </span>
                )}
              </CardTitle>
              <Button variant="destructive" size="sm" onClick={stopWatching}>
                <VideoOff className="w-4 h-4 mr-2" />
                닫기
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {streamFrame ? (
              <div className="relative">
                <img
                  src={streamFrame}
                  alt="Live camera stream"
                  className="w-full rounded-lg border-2 border-gray-300"
                />
                <div className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                  LIVE
                </div>
              </div>
            ) : (
              <div className="bg-gray-100 rounded-lg p-12 text-center">
                <Video className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">
                  {streamActive
                    ? '스트리밍 데이터를 기다리는 중...'
                    : '태블릿에서 스트리밍을 시작해주세요.'}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  태블릿 페이지에서 "스트리밍 시작" 버튼을 클릭해주세요.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 태블릿 목록 */}
      {loading ? (
        <div className="p-8 text-center text-gray-500">로딩 중...</div>
      ) : filteredTablets.length === 0 ? (
        <div className="p-8 text-center text-gray-500">병원이 없습니다.</div>
      ) : (
        <div className="space-y-6">
          {filteredTablets.map((tablet) => (
            <Card key={tablet.clinic.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{tablet.clinic.name}</CardTitle>
                    <div className="text-sm text-gray-600 mt-1">
                      {tablet.clinic.phone && `📞 ${tablet.clinic.phone}`}
                      {tablet.clinic.address && ` · 📍 ${tablet.clinic.address}`}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      사용자 {tablet.clinic.userCount}명 · 직원 {tablet.clinic.staffCount}명
                    </div>
                  </div>
                  {tablet.lastActivity.timestamp && (
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      마지막 활동: {new Date(tablet.lastActivity.timestamp).toLocaleString('ko-KR')}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 출퇴근 태블릿 */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-5 h-5 text-blue-600" />
                      <h3 className="font-semibold">출퇴근 태블릿</h3>
                    </div>
                    {getStatusBadge(tablet.tablets.attendance.status)}
                  </div>
                  {tablet.tablets.attendance.url ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={tablet.tablets.attendance.url}
                          readOnly
                          className="flex-1 text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(tablet.tablets.attendance.url!)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(tablet.tablets.attendance.url!, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                      <Button
                        variant={watchingClinicId === tablet.clinic.id ? "destructive" : "default"}
                        size="sm"
                        onClick={() => {
                          if (watchingClinicId === tablet.clinic.id) {
                            stopWatching()
                          } else {
                            startWatching(tablet.clinic.id)
                          }
                        }}
                        className="w-full"
                      >
                        {watchingClinicId === tablet.clinic.id ? (
                          <>
                            <VideoOff className="w-4 h-4 mr-2" />
                            카메라 닫기
                          </>
                        ) : (
                          <>
                            <Video className="w-4 h-4 mr-2" />
                            카메라 보기
                          </>
                        )}
                      </Button>
                      {tablet.tablets.attendance.expiresAt && (
                        <p className="text-xs text-gray-500">
                          만료: {new Date(tablet.tablets.attendance.expiresAt).toLocaleString('ko-KR')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">활성화된 링크가 없습니다.</p>
                  )}
                </div>

                {/* 생체인식 등록 */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Fingerprint className="w-5 h-5 text-purple-600" />
                      <h3 className="font-semibold">생체인식 등록</h3>
                    </div>
                    {getStatusBadge(tablet.tablets.biometric.status)}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span>
                        등록 현황: {tablet.tablets.biometric.registeredCount} / {tablet.tablets.biometric.totalStaff}
                        {tablet.tablets.biometric.totalStaff > 0 && (
                          <span className="ml-2 text-gray-500">
                            ({Math.round((tablet.tablets.biometric.registeredCount / tablet.tablets.biometric.totalStaff) * 100)}%)
                          </span>
                        )}
                      </span>
                    </div>
                    {tablet.tablets.biometric.url ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={tablet.tablets.biometric.url}
                            readOnly
                            className="flex-1 text-sm"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(tablet.tablets.biometric.url!)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(tablet.tablets.biometric.url!, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                        {tablet.tablets.biometric.expiresAt && (
                          <p className="text-xs text-gray-500">
                            만료: {new Date(tablet.tablets.biometric.expiresAt).toLocaleString('ko-KR')}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">활성화된 링크가 없습니다.</p>
                    )}
                  </div>
                </div>

                {/* 수동 배치 */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-600" />
                      <h3 className="font-semibold">수동 배치</h3>
                    </div>
                    {getStatusBadge(tablet.tablets.manualAssign.status)}
                  </div>
                  {tablet.tablets.manualAssign.url ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={tablet.tablets.manualAssign.url}
                          readOnly
                          className="flex-1 text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(tablet.tablets.manualAssign.url!)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(tablet.tablets.manualAssign.url!, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                      {tablet.tablets.manualAssign.expiresAt && (
                        <p className="text-xs text-gray-500">
                          만료: {new Date(tablet.tablets.manualAssign.expiresAt).toLocaleString('ko-KR')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">활성화된 링크가 없습니다.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
