/**
 * 스켈레톤 로딩 컴포넌트
 *
 * 콘텐츠 로딩 중 사용자에게 시각적 피드백 제공
 */

import { cn } from "@/lib/utils"

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="로딩 중"
      className={cn(
        "animate-pulse rounded-md bg-gray-200 dark:bg-gray-700",
        className
      )}
      {...props}
    />
  )
}

/**
 * 텍스트 스켈레톤 (한 줄)
 */
export function SkeletonText({ className, ...props }: SkeletonProps) {
  return <Skeleton className={cn("h-4 w-full", className)} {...props} />
}

/**
 * 제목 스켈레톤
 */
export function SkeletonHeading({ className, ...props }: SkeletonProps) {
  return <Skeleton className={cn("h-8 w-3/4", className)} {...props} />
}

/**
 * 카드 스켈레톤
 */
export function SkeletonCard({ className, ...props }: SkeletonProps) {
  return (
    <div className={cn("rounded-lg border p-4 space-y-3", className)} {...props}>
      <SkeletonHeading />
      <SkeletonText />
      <SkeletonText className="w-5/6" />
      <SkeletonText className="w-4/6" />
    </div>
  )
}

/**
 * 테이블 스켈레톤
 */
export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="테이블 로딩 중">
      {/* 헤더 */}
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-10 flex-1" />
        ))}
      </div>
      {/* 행들 */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} className="h-12 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * 리스트 스켈레톤
 */
export function SkeletonList({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="목록 로딩 중">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <SkeletonText className="w-1/3" />
            <SkeletonText className="w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * 아바타 스켈레톤
 */
export function SkeletonAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16"
  }

  return <Skeleton className={cn("rounded-full", sizes[size])} />
}

/**
 * 버튼 스켈레톤
 */
export function SkeletonButton({ className, ...props }: SkeletonProps) {
  return <Skeleton className={cn("h-10 w-24 rounded-md", className)} {...props} />
}

/**
 * 배지 스켈레톤
 */
export function SkeletonBadge({ className, ...props }: SkeletonProps) {
  return <Skeleton className={cn("h-6 w-16 rounded-full", className)} {...props} />
}
