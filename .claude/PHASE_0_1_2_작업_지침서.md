# Phase 0-2 작업 지침서

**작성일**: 2025-10-26
**목적**: 일관되고 누락 없는 작업 진행을 위한 상세 가이드
**범위**: Phase 0 (관리자 시스템) ~ Phase 2 (주간 패턴 관리)

---

## Phase 0: 관리자 시스템 구축

### 목표
- 무분별한 회원가입 방지
- 사용자 권한 관리 체계 확립
- 병원별 데이터 격리 및 관리
- 승인 기반 회원가입 프로세스 구현

### 0-1. 데이터베이스 스키마 수정

#### Step 1: Prisma Schema 업데이트
**파일**: `prisma/schema.prisma`

**변경 사항**:

1. **UserRole enum 확장**
```prisma
enum UserRole {
  SUPER_ADMIN  // 시스템 전체 관리자 (개발자)
  ADMIN        // 병원 시스템 관리자
  MANAGER      // 병원 관리자 (스케줄 관리 권한)
  STAFF        // 일반 직원 (조회만 가능)
}
```

2. **AccountStatus enum 추가**
```prisma
enum AccountStatus {
  PENDING    // 가입 대기 (승인 필요)
  APPROVED   // 승인됨
  REJECTED   // 거절됨
  SUSPENDED  // 정지됨
  DELETED    // 삭제됨
}
```

3. **User 모델 확장**
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  name      String
  role      UserRole @default(STAFF)

  // 가입 승인 관련 필드 추가
  accountStatus   AccountStatus @default(PENDING)
  approvedBy      String?       // 승인자 User ID
  approvedAt      DateTime?
  rejectedReason  String?
  suspendedReason String?
  suspendedUntil  DateTime?

  clinicId  String?
  clinic    Clinic?  @relation(fields: [clinicId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // 기존 관계
  notifications       Notification[]
  activityLogs        ActivityLog[]
  passwordResetTokens PasswordResetToken[]

  // 새 관계: 내가 승인한 사용자들
  approvedUsers User[] @relation("UserApprovals", fields: [approvedBy], references: [id])
  approver      User?  @relation("UserApprovals")

  @@index([clinicId])
  @@index([email])
  @@index([accountStatus])
  @@index([role])
}
```

4. **InitialSetup 모델에 createdBy 추가**
```prisma
model InitialSetup {
  id String @id @default(cuid())

  clinicId String @unique
  clinic   Clinic @relation(fields: [clinicId], references: [id])

  createdById String
  createdBy   User   @relation(fields: [createdById], references: [id])

  // 기존 필드들...

  @@index([clinicId])
  @@index([createdById])
}
```

#### Step 2: Migration 생성 및 실행
```bash
# Migration 파일 생성
npx prisma migrate dev --name add_account_approval_system

# DB 반영 확인
npx prisma migrate status

# Prisma Client 재생성
npx prisma generate
```

#### Step 3: Seed 데이터 업데이트
**파일**: `prisma/seed.ts`

**추가 내용**:
```typescript
// 환경변수에서 슈퍼 관리자 정보 가져오기
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@system.com'
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!'

// 슈퍼 관리자 계정 생성
const superAdmin = await prisma.user.upsert({
  where: { email: SUPER_ADMIN_EMAIL },
  update: {},
  create: {
    email: SUPER_ADMIN_EMAIL,
    password: await hash(SUPER_ADMIN_PASSWORD, 10),
    name: '시스템 관리자',
    role: 'SUPER_ADMIN',
    accountStatus: 'APPROVED',
    approvedAt: new Date(),
  },
})

console.log('✅ Super Admin created:', superAdmin.email)
```

#### Step 4: 환경변수 설정
**파일**: `.env`

**추가 내용**:
```env
# Super Admin Credentials
SUPER_ADMIN_EMAIL=admin@yonsedental.com
SUPER_ADMIN_PASSWORD=YonseBaro2025!

# 보안을 위해 프로덕션에서는 반드시 변경할 것
```

---

### 0-2. 회원가입 프로세스 개선

#### Step 1: 회원가입 API 수정
**파일**: `src/app/api/auth/register/route.ts`

**변경 전** (즉시 승인):
```typescript
const user = await prisma.user.create({
  data: {
    email,
    password: hashedPassword,
    name,
    clinicId,
    role: 'STAFF', // 기본값
  },
})
```

**변경 후** (승인 대기):
```typescript
const user = await prisma.user.create({
  data: {
    email,
    password: hashedPassword,
    name,
    clinicId,
    role: 'STAFF',
    accountStatus: 'PENDING', // 승인 대기 상태
  },
})

// 관리자에게 알림 전송
await notifyAdminsOfNewRegistration(user)

// 사용자에게 승인 대기 안내 이메일 전송
await sendPendingApprovalEmail(user)
```

#### Step 2: 로그인 검증 추가
**파일**: `src/lib/auth.ts` (NextAuth 설정)

**변경 내용**:
```typescript
async authorize(credentials) {
  const user = await prisma.user.findUnique({
    where: { email: credentials.email },
  })

  if (!user || !await verify(user.password, credentials.password)) {
    throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.')
  }

  // 계정 상태 확인 추가
  if (user.accountStatus === 'PENDING') {
    throw new Error('계정 승인 대기 중입니다. 관리자의 승인을 기다려주세요.')
  }

  if (user.accountStatus === 'REJECTED') {
    throw new Error('계정 승인이 거절되었습니다.')
  }

  if (user.accountStatus === 'SUSPENDED') {
    const until = user.suspendedUntil
      ? ` (${format(user.suspendedUntil, 'yyyy-MM-dd')}까지)`
      : ''
    throw new Error(`계정이 정지되었습니다${until}. 사유: ${user.suspendedReason}`)
  }

  if (user.accountStatus === 'DELETED') {
    throw new Error('삭제된 계정입니다.')
  }

  return user
}
```

#### Step 3: 회원가입 페이지 UI 개선
**파일**: `src/app/(auth)/register/page.tsx`

**추가할 필드**:
1. 병원 선택 (기존 병원 / 새 병원)
2. 신청 사유 (선택 사항, textarea)

**UI 구조**:
```tsx
<form onSubmit={handleSubmit}>
  <Input name="name" label="이름" required />
  <Input name="email" label="이메일" type="email" required />
  <Input name="password" label="비밀번호" type="password" required />
  <Input name="passwordConfirm" label="비밀번호 확인" type="password" required />

  <RadioGroup name="clinicType" label="병원 선택">
    <Radio value="existing">기존 병원</Radio>
    <Radio value="new">새 병원</Radio>
  </RadioGroup>

  {clinicType === 'existing' && (
    <Select name="clinicId" label="병원 선택" required>
      {clinics.map(clinic => (
        <Option key={clinic.id} value={clinic.id}>{clinic.name}</Option>
      ))}
    </Select>
  )}

  {clinicType === 'new' && (
    <Input name="newClinicName" label="병원명" required />
  )}

  <Textarea name="applicationReason" label="신청 사유 (선택)" rows={3} />

  <Button type="submit">가입 신청</Button>
</form>
```

**성공 후 표시할 모달**:
```tsx
<Dialog open={registrationSuccess}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>✅ 가입 신청 완료</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      <p>관리자의 승인을 기다리는 중입니다.</p>
      <p className="text-sm text-gray-600">
        승인 결과는 등록하신 이메일로 안내해 드립니다.
      </p>
    </div>
    <DialogFooter>
      <Button onClick={() => router.push('/login')}>확인</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### 0-3. 슈퍼 관리자 페이지 구현

#### Step 1: 레이아웃 및 네비게이션
**파일**: `src/app/(admin)/layout.tsx` (새 파일)

```tsx
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  // 권한 확인
  if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link href="/admin/dashboard" className="flex items-center">
                <span className="text-xl font-bold">관리자 페이지</span>
              </Link>
              <div className="ml-10 flex space-x-8">
                <NavLink href="/admin/dashboard">대시보드</NavLink>
                <NavLink href="/admin/users">회원 관리</NavLink>
                <NavLink href="/admin/clinics">병원 관리</NavLink>
                <NavLink href="/admin/logs">시스템 로그</NavLink>
                <NavLink href="/admin/settings">설정</NavLink>
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-700">{session.user.name}</span>
              <Button onClick={signOut} variant="ghost" className="ml-4">
                로그아웃
              </Button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
```

#### Step 2: 대시보드 페이지
**파일**: `src/app/(admin)/admin/dashboard/page.tsx` (새 파일)

```tsx
import { prisma } from '@/lib/prisma'
import { StatsCard } from '@/components/admin/StatsCard'
import { RecentActivityLog } from '@/components/admin/RecentActivityLog'
import { PendingApprovals } from '@/components/admin/PendingApprovals'

export default async function AdminDashboard() {
  // 통계 데이터 조회
  const [
    totalClinics,
    totalUsers,
    pendingUsers,
    usersByRole,
    recentActivities,
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
      include: { user: true },
    }),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">시스템 대시보드</h1>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard
          title="총 병원 수"
          value={totalClinics}
          icon="🏥"
        />
        <StatsCard
          title="총 사용자 수"
          value={totalUsers}
          icon="👥"
        />
        <StatsCard
          title="승인 대기"
          value={pendingUsers}
          icon="⏳"
          variant={pendingUsers > 0 ? 'warning' : 'default'}
        />
        <StatsCard
          title="활성 병원"
          value={totalClinics}
          icon="✅"
        />
      </div>

      {/* 역할별 사용자 분포 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">역할별 사용자 분포</h2>
        <div className="grid grid-cols-4 gap-4">
          {usersByRole.map(({ role, _count }) => (
            <div key={role} className="text-center">
              <div className="text-3xl font-bold text-blue-600">{_count}</div>
              <div className="text-sm text-gray-600">{role}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 승인 대기 목록 */}
      {pendingUsers > 0 && (
        <PendingApprovals />
      )}

      {/* 최근 활동 로그 */}
      <RecentActivityLog activities={recentActivities} />
    </div>
  )
}
```

#### Step 3: 회원 관리 페이지
**파일**: `src/app/(admin)/admin/users/page.tsx` (새 파일)

```tsx
'use client'

import { useState, useEffect } from 'react'
import { UserList } from '@/components/admin/UserList'
import { UserFilters } from '@/components/admin/UserFilters'
import { ApprovalModal } from '@/components/admin/ApprovalModal'
import { RejectionModal } from '@/components/admin/RejectionModal'

export default function UsersManagement() {
  const [users, setUsers] = useState([])
  const [filters, setFilters] = useState({
    status: 'all',
    role: 'all',
    clinic: 'all',
    search: '',
  })
  const [selectedUser, setSelectedUser] = useState(null)
  const [modalType, setModalType] = useState<'approve' | 'reject' | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [filters])

  const fetchUsers = async () => {
    const params = new URLSearchParams(filters)
    const res = await fetch(`/api/admin/users?${params}`)
    const data = await res.json()
    setUsers(data)
  }

  const handleApprove = (user) => {
    setSelectedUser(user)
    setModalType('approve')
  }

  const handleReject = (user) => {
    setSelectedUser(user)
    setModalType('reject')
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">회원 관리</h1>
      </div>

      <UserFilters filters={filters} onChange={setFilters} />

      <UserList
        users={users}
        onApprove={handleApprove}
        onReject={handleReject}
        onRefresh={fetchUsers}
      />

      {modalType === 'approve' && selectedUser && (
        <ApprovalModal
          user={selectedUser}
          onClose={() => setModalType(null)}
          onSuccess={fetchUsers}
        />
      )}

      {modalType === 'reject' && selectedUser && (
        <RejectionModal
          user={selectedUser}
          onClose={() => setModalType(null)}
          onSuccess={fetchUsers}
        />
      )}
    </div>
  )
}
```

#### Step 4: 회원 승인/거절 API
**파일**: `src/app/api/admin/users/[id]/approve/route.ts` (새 파일)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)

  // 권한 확인
  if (!session?.user || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { role } = await req.json()
  const userId = params.id

  try {
    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { clinic: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // ADMIN은 본인 병원만 승인 가능
    if (session.user.role === 'ADMIN' && user.clinicId !== session.user.clinicId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // 승인 처리
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        accountStatus: 'APPROVED',
        role: role || 'STAFF',
        approvedBy: session.user.id,
        approvedAt: new Date(),
      },
    })

    // 활동 로그 기록
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'USER_APPROVED',
        details: `Approved user ${user.email} with role ${role}`,
      },
    })

    // 사용자에게 승인 이메일 전송
    await sendApprovalEmail(user, role)

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('User approval error:', error)
    return NextResponse.json(
      { error: 'Failed to approve user' },
      { status: 500 }
    )
  }
}
```

**파일**: `src/app/api/admin/users/[id]/reject/route.ts` (새 파일)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { reason } = await req.json()
  const userId = params.id

  if (!reason) {
    return NextResponse.json(
      { error: 'Rejection reason is required' },
      { status: 400 }
    )
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (session.user.role === 'ADMIN' && user.clinicId !== session.user.clinicId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        accountStatus: 'REJECTED',
        rejectedReason: reason,
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'USER_REJECTED',
        details: `Rejected user ${user.email}. Reason: ${reason}`,
      },
    })

    // 거절 이메일 전송
    await sendRejectionEmail(user, reason)

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('User rejection error:', error)
    return NextResponse.json(
      { error: 'Failed to reject user' },
      { status: 500 }
    )
  }
}
```

---

### 0-4. 병원 관리자 페이지 구현

#### Step 1: 레이아웃
**파일**: `src/app/(clinic-admin)/layout.tsx` (새 파일)

```tsx
import { redirect } from 'next/navigation'
import { getServerSession } from 'next/auth'
import { authOptions } from '@/lib/auth'

export default async function ClinicAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  // ADMIN만 접근 가능
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link href="/admin/clinic" className="flex items-center">
                <span className="text-xl font-bold">병원 관리</span>
              </Link>
              <div className="ml-10 flex space-x-8">
                <NavLink href="/admin/clinic/users">회원 관리</NavLink>
                <NavLink href="/admin/clinic/settings">병원 설정</NavLink>
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
```

#### Step 2: 병원 회원 관리
**파일**: `src/app/(clinic-admin)/admin/clinic/users/page.tsx` (새 파일)

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { UserList } from '@/components/admin/UserList'

export default function ClinicUsersManagement() {
  const { data: session } = useSession()
  const [users, setUsers] = useState([])

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    // 본인 병원 사용자만 조회
    const res = await fetch('/api/admin/clinic/users')
    const data = await res.json()
    setUsers(data)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">
        {session?.user?.clinic?.name} 회원 관리
      </h1>

      <UserList
        users={users}
        onApprove={(user) => handleApprove(user)}
        onReject={(user) => handleReject(user)}
        onRefresh={fetchUsers}
        showOnlyOwnClinic={true}
      />
    </div>
  )
}
```

---

### 0-5. 미들웨어 및 권한 검증

#### Step 1: 미들웨어 업데이트
**파일**: `middleware.ts`

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request })

  // Admin 페이지 보호
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Super Admin 페이지
    if (request.nextUrl.pathname.startsWith('/admin/dashboard') ||
        request.nextUrl.pathname.startsWith('/admin/users') ||
        request.nextUrl.pathname.startsWith('/admin/clinics')) {
      if (token.role !== 'SUPER_ADMIN') {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }

    // Clinic Admin 페이지
    if (request.nextUrl.pathname.startsWith('/admin/clinic')) {
      if (token.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
```

---

## Phase 1: 설정 메뉴 완성도 향상

### 목표
- 초기 설정의 모든 항목을 설정 메뉴에서 조회/수정 가능하게
- 부서/구분 관리 시스템 구축
- 형평성 설정 UI 제공
- 구분별 비율 설정 기능 추가

### 1-1. 부서/구분 관리 페이지

#### Step 1: 데이터 모델 확인
현재 Department와 Category는 InitialSetup의 JSON 필드에 저장되어 있음.
운영 중 수정을 위해 별도 테이블로 분리 필요.

**파일**: `prisma/schema.prisma`

```prisma
model Department {
  id        String   @id @default(cuid())
  name      String
  order     Int      @default(0)
  useAutoAssignment Boolean @default(true)

  clinicId  String
  clinic    Clinic   @relation(fields: [clinicId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([clinicId, name])
  @@index([clinicId])
}

model Category {
  id        String   @id @default(cuid())
  name      String
  order     Int      @default(0)
  priority  Int      @default(0)  // 배치 우선순위

  clinicId  String
  clinic    Clinic   @relation(fields: [clinicId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([clinicId, name])
  @@index([clinicId])
  @@index([priority])
}
```

Migration 실행:
```bash
npx prisma migrate dev --name add_department_category_tables
```

#### Step 2: 부서/구분 관리 페이지
**파일**: `src/app/(dashboard)/settings/departments/page.tsx` (새 파일)

```tsx
'use client'

import { useState, useEffect } from 'react'
import { DepartmentList } from '@/components/settings/DepartmentList'
import { CategoryList } from '@/components/settings/CategoryList'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function DepartmentsSettings() {
  const [departments, setDepartments] = useState([])
  const [categories, setCategories] = useState([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [deptRes, catRes] = await Promise.all([
      fetch('/api/settings/departments'),
      fetch('/api/settings/categories'),
    ])
    setDepartments(await deptRes.json())
    setCategories(await catRes.json())
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">부서/구분 관리</h1>

      <Tabs defaultValue="departments">
        <TabsList>
          <TabsTrigger value="departments">부서 관리</TabsTrigger>
          <TabsTrigger value="categories">구분 관리</TabsTrigger>
        </TabsList>

        <TabsContent value="departments" className="space-y-4">
          <DepartmentList
            departments={departments}
            onRefresh={fetchData}
          />
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <CategoryList
            categories={categories}
            onRefresh={fetchData}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

#### Step 3: 드래그앤드롭 컴포넌트
**파일**: `src/components/settings/DepartmentList.tsx` (새 파일)

```tsx
'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

function SortableDepartmentItem({ department, onUpdate, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: department.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-4 bg-white border rounded-lg"
    >
      <div {...attributes} {...listeners} className="cursor-move">
        ☰
      </div>

      <Input
        value={department.name}
        onChange={(e) => onUpdate(department.id, { name: e.target.value })}
        className="flex-1"
      />

      <div className="flex items-center gap-2">
        <Checkbox
          checked={department.useAutoAssignment}
          onCheckedChange={(checked) =>
            onUpdate(department.id, { useAutoAssignment: checked })
          }
        />
        <span className="text-sm">자동배치</span>
      </div>

      <Button
        variant="destructive"
        size="sm"
        onClick={() => onDelete(department.id)}
      >
        삭제
      </Button>
    </div>
  )
}

export function DepartmentList({ departments, onRefresh }) {
  const [items, setItems] = useState(departments)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event) => {
    const { active, over } = event

    if (active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)

      const newItems = arrayMove(items, oldIndex, newIndex)
      setItems(newItems)

      // 순서 저장
      await fetch('/api/settings/departments/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departments: newItems.map((item, idx) => ({ id: item.id, order: idx })),
        }),
      })
    }
  }

  const handleUpdate = async (id, updates) => {
    await fetch(`/api/settings/departments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    onRefresh()
  }

  const handleDelete = async (id) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      await fetch(`/api/settings/departments/${id}`, {
        method: 'DELETE',
      })
      onRefresh()
    }
  }

  const handleAdd = async () => {
    await fetch('/api/settings/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '새 부서',
        useAutoAssignment: true,
      }),
    })
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <Button onClick={handleAdd}>+ 새 부서 추가</Button>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {items.map((dept) => (
              <SortableDepartmentItem
                key={dept.id}
                department={dept}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
```

---

### 1-2. 형평성 설정 페이지

#### Step 1: 형평성 설정 페이지
**파일**: `src/app/(dashboard)/settings/fairness/page.tsx` (새 파일)

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function FairnessSettings() {
  const [settings, setSettings] = useState({
    nightShiftFairness: true,
    weekendFairness: true,
    holidayFairness: true,
    holidayAdjacentFairness: false,
    threshold: 2, // 형평성 임계값
    calculationPeriod: 'monthly', // daily, weekly, monthly, yearly
  })

  const [currentScores, setCurrentScores] = useState([])

  useEffect(() => {
    fetchSettings()
    fetchCurrentScores()
  }, [])

  const fetchSettings = async () => {
    const res = await fetch('/api/settings/fairness')
    const data = await res.json()
    setSettings(data)
  }

  const fetchCurrentScores = async () => {
    const res = await fetch('/api/fairness/current-scores')
    const data = await res.json()
    setCurrentScores(data)
  }

  const handleSave = async () => {
    await fetch('/api/settings/fairness', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    alert('저장되었습니다.')
  }

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-3xl font-bold">형평성 설정</h1>

      <div className="bg-white p-6 rounded-lg shadow space-y-6">
        <h2 className="text-xl font-semibold">형평성 항목</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">야간 근무 형평성</Label>
              <p className="text-sm text-gray-600">
                야간 근무 배치 시 형평성 고려
              </p>
            </div>
            <Switch
              checked={settings.nightShiftFairness}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, nightShiftFairness: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">주말 근무 형평성</Label>
              <p className="text-sm text-gray-600">
                주말 근무 배치 시 형평성 고려
              </p>
            </div>
            <Switch
              checked={settings.weekendFairness}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, weekendFairness: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">공휴일 근무 형평성</Label>
              <p className="text-sm text-gray-600">
                공휴일 근무 배치 시 형평성 고려
              </p>
            </div>
            <Switch
              checked={settings.holidayFairness}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, holidayFairness: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">
                공휴일 인접일 형평성
              </Label>
              <p className="text-sm text-gray-600">
                공휴일 전후 근무 배치 시 형평성 고려
              </p>
            </div>
            <Switch
              checked={settings.holidayAdjacentFairness}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, holidayAdjacentFairness: checked })
              }
            />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow space-y-6">
        <h2 className="text-xl font-semibold">형평성 임계값</h2>
        <div className="space-y-4">
          <Label>
            최대 차이 허용 횟수: {settings.threshold}회
          </Label>
          <Slider
            value={[settings.threshold]}
            onValueChange={([value]) =>
              setSettings({ ...settings, threshold: value })
            }
            min={1}
            max={5}
            step={1}
            className="w-full"
          />
          <p className="text-sm text-gray-600">
            직원 간 근무 횟수 차이가 이 값을 초과하면 경고 표시
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow space-y-6">
        <h2 className="text-xl font-semibold">현재 형평성 점수</h2>
        <div className="space-y-2">
          {currentScores.map((score) => (
            <div
              key={score.staffId}
              className="flex items-center justify-between p-3 bg-gray-50 rounded"
            >
              <span>{score.staffName}</span>
              <div className="flex gap-4 text-sm">
                <span>야간: {score.nightShiftCount}회</span>
                <span>주말: {score.weekendCount}회</span>
                <span>공휴일: {score.holidayCount}회</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} size="lg">
          저장
        </Button>
      </div>
    </div>
  )
}
```

---

### 1-3. 구분별 비율 설정 페이지

#### Step 1: 비율 설정 페이지
**파일**: `src/app/(dashboard)/settings/category-ratios/page.tsx` (새 파일)

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export default function CategoryRatiosSettings() {
  const [categories, setCategories] = useState([])
  const [ratios, setRatios] = useState({})

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const res = await fetch('/api/settings/categories')
    const cats = await res.json()
    setCategories(cats)

    // 기존 비율 로드
    const ratioRes = await fetch('/api/settings/category-ratios')
    const ratioData = await ratioRes.json()
    setRatios(ratioData)
  }

  const handleRatioChange = (categoryId, value) => {
    setRatios({ ...ratios, [categoryId]: value })
  }

  const total = Object.values(ratios).reduce((sum, val) => sum + val, 0)

  const handleSave = async () => {
    if (total !== 100) {
      alert('비율 합계가 100%가 되어야 합니다.')
      return
    }

    await fetch('/api/settings/category-ratios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ratios),
    })
    alert('저장되었습니다.')
  }

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold">구분별 비율 설정</h1>

      <div className="bg-white p-6 rounded-lg shadow space-y-6">
        <p className="text-sm text-gray-600">
          각 구분별 배치 목표 비율을 설정합니다. 합계는 100%가 되어야 합니다.
        </p>

        <div className="space-y-6">
          {categories.map((cat) => (
            <div key={cat.id} className="space-y-2">
              <div className="flex justify-between">
                <Label>{cat.name}</Label>
                <span className="font-semibold">{ratios[cat.id] || 0}%</span>
              </div>
              <Slider
                value={[ratios[cat.id] || 0]}
                onValueChange={([value]) => handleRatioChange(cat.id, value)}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
            </div>
          ))}
        </div>

        <div className="pt-4 border-t">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">합계</span>
            <span
              className={`text-2xl font-bold ${
                total === 100 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {total}%
            </span>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={total !== 100} size="lg">
            저장
          </Button>
        </div>
      </div>
    </div>
  )
}
```

---

## Phase 2: 주간 패턴 관리 시스템 구축

### 목표
- 초기 설정에서 만든 의사 조합을 운영 중 수정 가능
- 주간 단위 패턴 생성 및 관리
- 특정 날짜 패턴 임시 변경 기능

### 2-1. 의사 조합 관리 페이지

#### Step 1: 데이터 모델
**파일**: `prisma/schema.prisma`

```prisma
model DoctorCombination {
  id        String   @id @default(cuid())
  name      String
  dayOfWeek String

  requiredStaff           Int
  departmentRequiredStaff Json // { [deptName]: count }

  // 구분별 상세 인원
  categoryStaff Json // { [deptName]: { [catName]: { count, minRequired } } }

  doctors       String[] // 원장 ID 배열
  hasNightShift Boolean  @default(false)

  clinicId  String
  clinic    Clinic   @relation(fields: [clinicId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  weeklyPatterns WeeklyPatternDay[]

  @@index([clinicId])
  @@index([dayOfWeek])
}

model WeeklyPattern {
  id        String   @id @default(cuid())
  name      String

  clinicId  String
  clinic    Clinic   @relation(fields: [clinicId], references: [id])

  days      WeeklyPatternDay[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([clinicId])
}

model WeeklyPatternDay {
  id        String   @id @default(cuid())
  dayOfWeek String   // 0-6 (일-토)

  patternId      String
  pattern        WeeklyPattern @relation(fields: [patternId], references: [id])

  combinationId  String
  combination    DoctorCombination @relation(fields: [combinationId], references: [id])

  @@index([patternId])
  @@index([combinationId])
}
```

Migration:
```bash
npx prisma migrate dev --name add_combination_and_weekly_pattern_tables
```

#### Step 2: 조합 관리 페이지
**파일**: `src/app/(dashboard)/settings/combinations/page.tsx` (새 파일)

```tsx
'use client'

import { useState, useEffect } from 'react'
import { CombinationCard } from '@/components/settings/CombinationCard'
import { CombinationEditModal } from '@/components/settings/CombinationEditModal'
import { Button } from '@/components/ui/button'

export default function CombinationsSettings() {
  const [combinations, setCombinations] = useState([])
  const [editingCombination, setEditingCombination] = useState(null)

  useEffect(() => {
    fetchCombinations()
  }, [])

  const fetchCombinations = async () => {
    const res = await fetch('/api/settings/combinations')
    const data = await res.json()
    setCombinations(data)
  }

  const handleAdd = () => {
    setEditingCombination({
      name: '',
      dayOfWeek: '월요일',
      requiredStaff: 0,
      departmentRequiredStaff: {},
      categoryStaff: {},
      doctors: [],
      hasNightShift: false,
    })
  }

  const handleEdit = (combination) => {
    setEditingCombination(combination)
  }

  const handleDelete = async (id) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      await fetch(`/api/settings/combinations/${id}`, {
        method: 'DELETE',
      })
      fetchCombinations()
    }
  }

  const handleDuplicate = async (combination) => {
    const newCombination = {
      ...combination,
      name: `${combination.name} (복사)`,
    }
    delete newCombination.id

    await fetch('/api/settings/combinations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCombination),
    })
    fetchCombinations()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">의사 조합 관리</h1>
        <Button onClick={handleAdd}>+ 새 조합 추가</Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {combinations.map((combo) => (
          <CombinationCard
            key={combo.id}
            combination={combo}
            onEdit={() => handleEdit(combo)}
            onDelete={() => handleDelete(combo.id)}
            onDuplicate={() => handleDuplicate(combo)}
          />
        ))}
      </div>

      {editingCombination && (
        <CombinationEditModal
          combination={editingCombination}
          onClose={() => setEditingCombination(null)}
          onSuccess={fetchCombinations}
        />
      )}
    </div>
  )
}
```

---

### 2-2. 주간 패턴 관리 페이지

#### Step 1: 주간 패턴 관리
**파일**: `src/app/(dashboard)/settings/weekly-patterns/page.tsx` (새 파일)

```tsx
'use client'

import { useState, useEffect } from 'react'
import { WeeklyPatternEditor } from '@/components/settings/WeeklyPatternEditor'
import { Button } from '@/components/ui/button'

export default function WeeklyPatternsSettings() {
  const [patterns, setPatterns] = useState([])
  const [combinations, setCombinations] = useState([])
  const [editingPattern, setEditingPattern] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [patternsRes, combosRes] = await Promise.all([
      fetch('/api/settings/weekly-patterns'),
      fetch('/api/settings/combinations'),
    ])
    setPatterns(await patternsRes.json())
    setCombinations(await combosRes.json())
  }

  const handleAdd = () => {
    setEditingPattern({
      name: '새 주간 패턴',
      days: [
        { dayOfWeek: '0', combinationId: null }, // 일요일
        { dayOfWeek: '1', combinationId: null }, // 월요일
        { dayOfWeek: '2', combinationId: null }, // 화요일
        { dayOfWeek: '3', combinationId: null }, // 수요일
        { dayOfWeek: '4', combinationId: null }, // 목요일
        { dayOfWeek: '5', combinationId: null }, // 금요일
        { dayOfWeek: '6', combinationId: null }, // 토요일
      ],
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">주간 패턴 관리</h1>
        <Button onClick={handleAdd}>+ 새 패턴 추가</Button>
      </div>

      <div className="grid gap-6">
        {patterns.map((pattern) => (
          <WeeklyPatternCard
            key={pattern.id}
            pattern={pattern}
            combinations={combinations}
            onEdit={() => setEditingPattern(pattern)}
            onDelete={() => handleDelete(pattern.id)}
          />
        ))}
      </div>

      {editingPattern && (
        <WeeklyPatternEditor
          pattern={editingPattern}
          combinations={combinations}
          onClose={() => setEditingPattern(null)}
          onSuccess={fetchData}
        />
      )}
    </div>
  )
}
```

---

## 체크리스트

### Phase 0 완료 기준
- [ ] DB 스키마 업데이트 완료 (UserRole, AccountStatus)
- [ ] Migration 실행 완료
- [ ] Seed 데이터에 SUPER_ADMIN 추가
- [ ] 회원가입 API 수정 (PENDING 상태)
- [ ] 로그인 검증 추가 (계정 상태 확인)
- [ ] 슈퍼 관리자 대시보드 완성
- [ ] 회원 관리 페이지 완성 (승인/거절)
- [ ] 병원 관리자 페이지 완성
- [ ] 미들웨어 권한 검증 추가
- [ ] 이메일 알림 기능 구현

### Phase 1 완료 기준
- [ ] Department, Category 테이블 생성
- [ ] 부서 관리 페이지 (CRUD, 드래그앤드롭)
- [ ] 구분 관리 페이지 (CRUD, 우선순위)
- [ ] 형평성 설정 페이지 (ON/OFF, 임계값)
- [ ] 구분별 비율 설정 페이지 (슬라이더)
- [ ] 현재 형평성 점수 조회 기능

### Phase 2 완료 기준
- [ ] DoctorCombination 테이블 생성
- [ ] WeeklyPattern, WeeklyPatternDay 테이블 생성
- [ ] 의사 조합 관리 페이지 (CRUD, 복사)
- [ ] 주간 패턴 관리 페이지 (생성, 편집)
- [ ] 패턴 미리보기 기능
- [ ] 월별 패턴 할당 기능

---

**작성일**: 2025-10-26
**작성자**: Claude
**버전**: 1.0
