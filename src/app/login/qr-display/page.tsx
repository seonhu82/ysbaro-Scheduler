/**
 * QR 디스플레이 전용 로그인 페이지
 * 경로: /login/qr-display
 *
 * 기능:
 * - QR_DISPLAY 역할 전용 로그인
 * - 자동 로그인 유지
 * - 대기실 TV 디스플레이용
 */

'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Monitor, Lock, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function QRDisplayLoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: '/qr-display'
      })

      if (result?.error) {
        setError('로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.')
        toast({
          variant: 'destructive',
          title: '로그인 실패',
          description: '인증 정보가 올바르지 않습니다'
        })
      } else if (result?.ok) {
        // 역할 확인을 위해 세션 조회
        const sessionRes = await fetch('/api/auth/session')
        const session = await sessionRes.json()

        if (session?.user?.role !== 'QR_DISPLAY') {
          setError('이 계정은 QR 디스플레이 권한이 없습니다.')
          toast({
            variant: 'destructive',
            title: '권한 없음',
            description: 'QR_DISPLAY 역할이 필요합니다'
          })
          // 로그아웃
          await fetch('/api/auth/signout', { method: 'POST' })
          return
        }

        toast({
          title: '로그인 성공',
          description: 'QR 디스플레이 모드로 전환합니다'
        })

        router.push('/qr-display')
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('로그인 중 오류가 발생했습니다')
      toast({
        variant: 'destructive',
        title: '오류',
        description: '로그인 처리 중 문제가 발생했습니다'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4">
      <div className="w-full max-w-md">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-500 rounded-full mb-4">
            <Monitor className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            QR 디스플레이 로그인
          </h1>
          <p className="text-gray-600">
            대기실 디스플레이용 전용 로그인
          </p>
        </div>

        {/* 로그인 카드 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              인증
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="qr-display@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-500 hover:bg-blue-600"
                disabled={loading}
                size="lg"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    로그인 중...
                  </>
                ) : (
                  <>
                    <Monitor className="w-5 h-5 mr-2" />
                    디스플레이 모드 시작
                  </>
                )}
              </Button>
            </form>

            {/* 안내 사항 */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium mb-1">QR 디스플레이 모드</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>QR_DISPLAY 역할이 필요합니다</li>
                    <li>대기실 TV에서만 사용하세요</li>
                    <li>로그인 상태가 자동 유지됩니다</li>
                    <li>실시간으로 스케줄이 표시됩니다</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 하단 링크 */}
        <div className="text-center mt-6">
          <Button
            variant="link"
            onClick={() => router.push('/login')}
            className="text-gray-600"
          >
            일반 로그인으로 돌아가기
          </Button>
        </div>
      </div>
    </div>
  )
}
