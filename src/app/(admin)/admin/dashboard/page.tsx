import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function AdminDashboard() {
  // 통계 데이터 조회
  const [
    totalClinics,
    totalUsers,
    pendingUsers,
    usersByRole,
    recentActivities,
    recentPendingUsers,
  ] = await Promise.all([
    prisma.clinic.count(),
    prisma.user.count(),
    prisma.user.count({ where: { accountStatus: 'PENDING' } }),
    prisma.user.groupBy({
      by: ['role'],
      _count: true,
    }),
    prisma.activityLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { accountStatus: 'PENDING' },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        clinic: {
          select: {
            name: true,
          },
        },
      },
    }),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">시스템 대시보드</h1>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard
          title="총 병원 수"
          value={totalClinics}
          icon="🏥"
          bgColor="bg-blue-50"
          textColor="text-blue-600"
        />
        <StatsCard
          title="총 사용자 수"
          value={totalUsers}
          icon="👥"
          bgColor="bg-green-50"
          textColor="text-green-600"
        />
        <StatsCard
          title="승인 대기"
          value={pendingUsers}
          icon="⏳"
          bgColor={pendingUsers > 0 ? 'bg-yellow-50' : 'bg-gray-50'}
          textColor={pendingUsers > 0 ? 'text-yellow-600' : 'text-gray-600'}
          link={pendingUsers > 0 ? '/admin/users?status=PENDING' : undefined}
        />
        <StatsCard
          title="활성 병원"
          value={totalClinics}
          icon="✅"
          bgColor="bg-purple-50"
          textColor="text-purple-600"
        />
      </div>

      {/* 역할별 사용자 분포 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          역할별 사용자 분포
        </h2>
        <div className="grid grid-cols-4 gap-4">
          {usersByRole.map(({ role, _count }) => (
            <div key={role} className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">{_count}</div>
              <div className="text-sm text-gray-600 mt-2">{role}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 승인 대기 목록 */}
        {pendingUsers > 0 && (
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                승인 대기 중
              </h2>
              <Link
                href="/admin/users?status=PENDING"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                전체 보기 →
              </Link>
            </div>
            <div className="space-y-3">
              {recentPendingUsers.map((user) => (
                <div
                  key={user.id}
                  className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-900">
                        {user.name}
                      </div>
                      <div className="text-sm text-gray-600">{user.email}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        병원: {user.clinic?.name || '미지정'}
                      </div>
                    </div>
                    <Link
                      href={`/admin/users?highlight=${user.id}`}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      승인 →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 최근 활동 로그 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">
            최근 활동
          </h2>
          <div className="space-y-3">
            {recentActivities.map((activity) => (
              <div
                key={activity.id}
                className="p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="text-sm text-gray-900">
                      {activity.description}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {activity.user?.name || '시스템'} •{' '}
                      {new Date(activity.createdAt).toLocaleString('ko-KR')}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {activity.activityType}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 통계 카드 컴포넌트
 */
function StatsCard({
  title,
  value,
  icon,
  bgColor,
  textColor,
  link,
}: {
  title: string
  value: number
  icon: string
  bgColor: string
  textColor: string
  link?: string
}) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-600">{title}</div>
          <div className={`text-3xl font-bold ${textColor} mt-2`}>{value}</div>
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </>
  )

  if (link) {
    return (
      <Link href={link} className={`block p-6 ${bgColor} rounded-lg shadow hover:shadow-lg transition-shadow`}>
        {content}
      </Link>
    )
  }

  return (
    <div className={`p-6 ${bgColor} rounded-lg shadow`}>
      {content}
    </div>
  )
}
