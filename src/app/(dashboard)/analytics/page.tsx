'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Users,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  ArrowRight
} from 'lucide-react'

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">인력 운영 분석</h1>
        <p className="text-muted-foreground mt-2">
          직원 출퇴근 패턴, 이상 징후, 부서별 비교 분석을 통한 효율적인 인력 운영
        </p>
      </div>

      {/* Quick Access Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/analytics/individual">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                개인별 분석
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">직원 패턴</div>
              <p className="text-xs text-muted-foreground mt-1">
                개인별 출퇴근 패턴 및 통계
              </p>
              <Button variant="ghost" size="sm" className="mt-3 p-0 h-auto">
                자세히 보기 <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/analytics/patterns">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                시간대 분석
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">패턴 시각화</div>
              <p className="text-xs text-muted-foreground mt-1">
                시간대별 출퇴근 히트맵
              </p>
              <Button variant="ghost" size="sm" className="mt-3 p-0 h-auto">
                자세히 보기 <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/analytics/anomalies">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                이상 징후
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">자동 감지</div>
              <p className="text-xs text-muted-foreground mt-1">
                비정상 패턴 자동 탐지
              </p>
              <Button variant="ghost" size="sm" className="mt-3 p-0 h-auto">
                자세히 보기 <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/analytics/comparison">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                부서별 비교
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">성과 비교</div>
              <p className="text-xs text-muted-foreground mt-1">
                부서간 출퇴근 KPI 비교
              </p>
              <Button variant="ghost" size="sm" className="mt-3 p-0 h-auto">
                자세히 보기 <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Overview Section */}
      <Card>
        <CardHeader>
          <CardTitle>분석 도구 개요</CardTitle>
          <CardDescription>
            효율적인 인력 운영을 위한 4가지 핵심 분석 도구
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                개인별 분석
              </h3>
              <p className="text-sm text-muted-foreground">
                각 직원의 출퇴근 패턴, 지각/조퇴 빈도, 평균 출퇴근 시간을 분석합니다.
                5개 탭(개요, 타임라인, 패턴, 이상징후, 비교)으로 구성된 상세 대시보드를 제공합니다.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                시간대 분석
              </h3>
              <p className="text-sm text-muted-foreground">
                시간대별, 요일별 출퇴근 패턴을 히트맵으로 시각화합니다.
                피크 시간대, 출근 집중 시간, 요일별 트렌드를 한눈에 파악할 수 있습니다.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                이상 징후 탐지
              </h3>
              <p className="text-sm text-muted-foreground">
                통계 알고리즘(Z-score, IQR)을 사용하여 비정상적인 출퇴근 패턴을 자동으로 감지합니다.
                심각도 수준(높음/중간/낮음)별로 분류하여 우선순위를 정할 수 있습니다.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                부서별 비교
              </h3>
              <p className="text-sm text-muted-foreground">
                부서간 출퇴근 KPI(출근율, 정시 출근율, 평균 근무시간)를 비교하고 벤치마킹합니다.
                성과가 우수한 부서와 개선이 필요한 부서를 쉽게 식별할 수 있습니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
