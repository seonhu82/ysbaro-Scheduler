import NextAuth from 'next-auth'
import type { NextAuthConfig } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { prisma } from './prisma'

/**
 * NextAuth configuration
 * Handles authentication for 연세바로치과 스케줄러
 */
export const authConfig: NextAuthConfig = {
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            return null
          }

          // Find user by email
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
            include: { clinic: true },
          })

          if (!user || !user.password) {
            return null
          }

          // Verify password
          const isPasswordValid = await compare(credentials.password as string, user.password)

          if (!isPasswordValid) {
            return null
          }

          // Check account status
          if (user.accountStatus === 'PENDING') {
            throw new Error('계정 승인 대기 중입니다. 관리자의 승인을 기다려주세요.')
          }

          if (user.accountStatus === 'REJECTED') {
            throw new Error('계정 승인이 거절되었습니다.')
          }

          if (user.accountStatus === 'SUSPENDED') {
            const until = user.suspendedUntil
              ? ` (${new Date(user.suspendedUntil).toLocaleDateString('ko-KR')}까지)`
              : ''
            throw new Error(`계정이 정지되었습니다${until}. 사유: ${user.suspendedReason || '미지정'}`)
          }

          if (user.accountStatus === 'DELETED') {
            throw new Error('삭제된 계정입니다.')
          }

          if (user.accountStatus !== 'APPROVED') {
            throw new Error('로그인할 수 없는 계정 상태입니다.')
          }

          // Return user object
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            clinicId: user.clinicId || '',
            clinicName: user.clinic?.name || '',
            accountStatus: user.accountStatus,
            setupCompleted: user.clinic?.setupCompleted ?? false,
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Add custom fields to JWT token
      if (user) {
        token.id = user.id as string
        token.role = (user as any).role
        token.clinicId = (user as any).clinicId
        token.clinicName = (user as any).clinicName
        token.accountStatus = (user as any).accountStatus
        token.setupCompleted = (user as any).setupCompleted
      }
      return token
    },
    async session({ session, token }) {
      // Add custom fields to session
      if (session.user) {
        (session.user as any).id = token.id as string
        (session.user as any).role = token.role as string
        (session.user as any).clinicId = token.clinicId as string
        (session.user as any).clinicName = token.clinicName as string
        (session.user as any).accountStatus = token.accountStatus as string
        (session.user as any).setupCompleted = token.setupCompleted as boolean
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)

// Legacy export for backward compatibility
export const authOptions = authConfig

/**
 * Get current user from session
 */
export async function getCurrentUser(session: any) {
  if (!session?.user?.id) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { clinic: true },
  })

  return user
}

/**
 * Check if user has required role
 */
export function hasRole(userRole: string, requiredRoles: string[]): boolean {
  return requiredRoles.includes(userRole)
}

/**
 * Check if user is admin
 */
export function isAdmin(userRole: string): boolean {
  return userRole === 'ADMIN'
}

/**
 * Check if user is manager or admin
 */
export function isManagerOrAdmin(userRole: string): boolean {
  return ['ADMIN', 'MANAGER'].includes(userRole)
}

/**
 * Check if user is super admin
 */
export function isSuperAdmin(userRole: string): boolean {
  return userRole === 'SUPER_ADMIN'
}

/**
 * Check if user is super admin or admin
 */
export function isSuperAdminOrAdmin(userRole: string): boolean {
  return ['SUPER_ADMIN', 'ADMIN'].includes(userRole)
}

/**
 * Check if user has admin privileges (SUPER_ADMIN, ADMIN, or MANAGER)
 */
export function hasAdminPrivileges(userRole: string): boolean {
  return ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userRole)
}
