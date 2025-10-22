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
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('이메일과 비밀번호를 입력해주세요.')
        }

        // Find user by email
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { clinic: true },
        })

        if (!user || !user.password) {
          throw new Error('존재하지 않는 계정입니다.')
        }

        // Verify password
        const isPasswordValid = await compare(credentials.password as string, user.password)

        if (!isPasswordValid) {
          throw new Error('비밀번호가 일치하지 않습니다.')
        }

        // Return user object
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          clinicId: user.clinicId || '',
          clinicName: user.clinic?.name || '',
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
