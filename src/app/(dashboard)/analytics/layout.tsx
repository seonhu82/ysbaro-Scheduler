import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '인력 운영 분석',
  description: '직원 출퇴근 패턴 분석 및 통계',
}

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
