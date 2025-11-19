/**
 * 사용자 프로필 설정 페이지
 * 비밀번호 변경, 개인정보 수정
 */

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { User, Lock, Mail, Save, Eye, EyeOff, Shield } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

export default function ProfilePage() {
  const { data: session, update } = useSession()
  const { toast } = useToast()

  // 개인정보
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  // 비밀번호 변경
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || '')
      setEmail(session.user.email || '')
    }
  }, [session])

  // 사용자 이름의 첫 글자 추출
  const getInitials = (name: string) => {
    return name?.charAt(0).toUpperCase() || 'U'
  }

  // 개인정보 업데이트
  const handleUpdateProfile = async () => {
    setSaving(true)
    try {
      console.log('Updating profile:', { name, email })

      const response = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      })

      console.log('Response status:', response.status)

      const result = await response.json()
      console.log('Response data:', result)

      if (result.success) {
        // 세션 갱신
        await update({
          name: result.data.name,
          email: result.data.email
        })

        toast({
          title: '프로필 업데이트 완료',
          description: '개인정보가 성공적으로 업데이트되었습니다.'
        })

        // 상태 업데이트
        setName(result.data.name)
        setEmail(result.data.email)
      } else {
        throw new Error(result.error || '업데이트 실패')
      }
    } catch (error: any) {
      console.error('Profile update error:', error)
      toast({
        variant: 'destructive',
        title: '업데이트 실패',
        description: error.message || '개인정보 업데이트 중 오류가 발생했습니다'
      })
    } finally {
      setSaving(false)
    }
  }

  // 비밀번호 변경
  const handleChangePassword = async () => {
    // 유효성 검사
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        variant: 'destructive',
        title: '입력 오류',
        description: '모든 비밀번호 필드를 입력해주세요'
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: '비밀번호 불일치',
        description: '새 비밀번호가 일치하지 않습니다'
      })
      return
    }

    if (newPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: '비밀번호 길이 오류',
        description: '새 비밀번호는 최소 6자 이상이어야 합니다'
      })
      return
    }

    setChangingPassword(true)
    try {
      const response = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '비밀번호 변경 완료',
          description: '비밀번호가 성공적으로 변경되었습니다'
        })
        // 입력 필드 초기화
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        throw new Error(result.error || '비밀번호 변경 실패')
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '비밀번호 변경 실패',
        description: error.message || '비밀번호 변경 중 오류가 발생했습니다'
      })
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
          <User className="w-8 h-8" />
          내 프로필
        </h1>
        <p className="text-gray-600">개인정보 및 비밀번호를 관리합니다</p>
      </div>

      {/* 프로필 카드 */}
      <Card className="border-2 border-blue-100">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center space-x-4">
            <Avatar className="h-20 w-20 border-4 border-white shadow-lg">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-2xl font-bold">
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-2xl">{session?.user?.name}</CardTitle>
              <CardDescription className="text-base">{session?.user?.email}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 개인정보 수정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-500" />
            개인정보 수정
          </CardTitle>
          <CardDescription>이름과 이메일 주소를 변경할 수 있습니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일을 입력하세요"
            />
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button onClick={handleUpdateProfile} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? '저장 중...' : '변경사항 저장'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 비밀번호 변경 */}
      <Card className="border-2 border-orange-100">
        <CardHeader className="bg-orange-50">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" />
            비밀번호 변경
          </CardTitle>
          <CardDescription>보안을 위해 정기적으로 비밀번호를 변경하세요</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="current-password">현재 비밀번호</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="현재 비밀번호를 입력하세요"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">새 비밀번호</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="새 비밀번호를 입력하세요 (최소 6자)"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">새 비밀번호 확인</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="새 비밀번호를 다시 입력하세요"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 비밀번호 강도 힌트 */}
          {newPassword && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-medium mb-1">비밀번호 안전 가이드:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li className={newPassword.length >= 6 ? 'text-green-600' : ''}>
                  최소 6자 이상 {newPassword.length >= 6 && '✓'}
                </li>
                <li className={/[A-Z]/.test(newPassword) ? 'text-green-600' : ''}>
                  대문자 포함 권장 {/[A-Z]/.test(newPassword) && '✓'}
                </li>
                <li className={/[0-9]/.test(newPassword) ? 'text-green-600' : ''}>
                  숫자 포함 권장 {/[0-9]/.test(newPassword) && '✓'}
                </li>
                <li className={/[!@#$%^&*]/.test(newPassword) ? 'text-green-600' : ''}>
                  특수문자 포함 권장 {/[!@#$%^&*]/.test(newPassword) && '✓'}
                </li>
              </ul>
            </div>
          )}

          <Separator />

          <div className="flex justify-end">
            <Button
              onClick={handleChangePassword}
              disabled={changingPassword}
              variant="destructive"
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Lock className="w-4 h-4 mr-2" />
              {changingPassword ? '변경 중...' : '비밀번호 변경'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
