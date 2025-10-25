'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function SuccessPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <CardTitle className="text-2xl">신청이 완료되었습니다</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-center">
              <p className="text-gray-600">
                연차/오프 신청이 성공적으로 접수되었습니다.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  관리자가 검토 후 승인 여부를 결정합니다.
                  <br />
                  결과는 이메일로 통보됩니다.
                </p>
              </div>
              <div className="pt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.back()}
                >
                  확인
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
