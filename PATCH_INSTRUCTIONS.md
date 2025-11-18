# Daily Detail API 수정 사항

## 파일: src/app/api/schedule/daily-detail/route.ts

### 변경 1: Line 29 뒤에 부서 순서 맵 추가

Line 29 (`const clinicId = (session.user as any).clinicId`) 다음에 추가:

```typescript
    // 부서 순서 맵 생성 (모든 부서 포함)
    const allDepartments = await prisma.department.findMany({
      where: { clinicId },
      select: { name: true, order: true }
    })
    const departmentOrderMap = allDepartments.reduce((acc, dept) => {
      acc[dept.name] = dept.order
      return acc
    }, {} as Record<string, number>)
```

### 변경 2: Line 165-172 타입 정의 수정

기존:
```typescript
    const staffList: Array<{
      id: string
      name: string
      category: string
      isAssigned: boolean
      leaveType?: 'ANNUAL' | 'OFF' | null
      leaveStatus?: string | null
    }> = []
```

변경 후:
```typescript
    const staffList: Array<{
      id: string
      name: string
      category: string
      departmentName: string
      departmentOrder: number
      isAssigned: boolean
      leaveType?: 'ANNUAL' | 'OFF' | null
      leaveStatus?: string | null
    }> = []
```

### 변경 3: Line 193-200 staffList.push 수정

기존:
```typescript
      staffList.push({
        id: assignment.staff.id,
        name: assignment.staff.name,
        category: assignment.staff.departmentName || '미분류',
        isAssigned: true,
        leaveType,
        leaveStatus: leaveInfo?.status || null
      })
```

변경 후:
```typescript
      const deptName = assignment.staff.departmentName || '미분류'
      staffList.push({
        id: assignment.staff.id,
        name: assignment.staff.name,
        category: deptName,
        departmentName: deptName,
        departmentOrder: departmentOrderMap[deptName] ?? 999,
        isAssigned: true,
        leaveType,
        leaveStatus: leaveInfo?.status || null
      })
```

### 변경 4: Line 210-217 ANNUAL staffList.push 수정

기존:
```typescript
        staffList.push({
          id: leave.staff.id,
          name: leave.staff.name,
          category: leave.staff.departmentName || '미분류',
          isAssigned: true,
          leaveType: 'ANNUAL',
          leaveStatus: leave.status
        })
```

변경 후:
```typescript
        const deptName = leave.staff.departmentName || '미분류'
        staffList.push({
          id: leave.staff.id,
          name: leave.staff.name,
          category: deptName,
          departmentName: deptName,
          departmentOrder: departmentOrderMap[deptName] ?? 999,
          isAssigned: true,
          leaveType: 'ANNUAL',
          leaveStatus: leave.status
        })
```
