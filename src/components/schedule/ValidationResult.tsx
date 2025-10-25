'use client'

import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react'

interface ValidationResultProps {
  errors: string[]
  warnings: string[]
}

export function ValidationResult({ errors, warnings }: ValidationResultProps) {
  if (errors.length === 0 && warnings.length === 0) {
    return (
      <Card className="bg-green-50 border-green-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-900 mb-1">검증 성공</h3>
              <p className="text-sm text-green-800">
                모든 검증을 통과했습니다. 스케줄을 저장할 수 있습니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* 오류 */}
      {errors.length > 0 && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-2">
                  오류 ({errors.length})
                </h3>
                <ul className="space-y-1">
                  {errors.map((error, index) => (
                    <li key={index} className="text-sm text-red-800">
                      • {error}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-red-700 mt-2">
                  오류를 수정해야 저장할 수 있습니다
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 경고 */}
      {warnings.length > 0 && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 mb-2">
                  경고 ({warnings.length})
                </h3>
                <ul className="space-y-1">
                  {warnings.map((warning, index) => (
                    <li key={index} className="text-sm text-yellow-800">
                      • {warning}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-yellow-700 mt-2">
                  경고가 있지만 저장은 가능합니다
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
