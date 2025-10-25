/**
 * QR 토큰 관리 서비스
 *
 * 주요 기능:
 * 1. QR 토큰 생성
 * 2. 토큰 검증
 * 3. 자동 갱신 (5분 주기)
 * 4. 만료된 토큰 정리
 */

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export interface QRTokenData {
  token: string;
  expiresAt: Date;
  isActive: boolean;
}

/**
 * 새 QR 토큰 생성
 */
export async function generateQRToken(
  clinicId: string
): Promise<QRTokenData> {
  // 1. 랜덤 토큰 생성 (UUID v4 형식)
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5분 후

  // 2. 이전 미사용 토큰 비활성화
  await prisma.qRToken.updateMany({
    where: {
      clinicId,
      used: false,
      expiresAt: {
        gt: new Date()
      }
    },
    data: {
      used: true
    }
  });

  // 3. 새 토큰 DB에 저장
  await prisma.qRToken.create({
    data: {
      clinicId,
      token,
      expiresAt,
      used: false
    }
  });

  return {
    token,
    expiresAt,
    isActive: true,
  };
}

/**
 * 토큰 검증
 */
export async function validateQRToken(token: string): Promise<{
  valid: boolean;
  message: string;
  tokenData?: any;
}> {
  // 1. 토큰 존재 확인
  const tokenRecord = await prisma.qRToken.findUnique({
    where: { token }
  });

  if (!tokenRecord) {
    return {
      valid: false,
      message: '유효하지 않은 토큰입니다'
    };
  }

  // 2. 사용 여부 확인
  if (tokenRecord.used) {
    return {
      valid: false,
      message: '이미 사용된 토큰입니다'
    };
  }

  // 3. 만료 시간 확인
  if (new Date() > tokenRecord.expiresAt) {
    return {
      valid: false,
      message: '만료된 토큰입니다'
    };
  }

  return {
    valid: true,
    message: '유효한 토큰입니다',
    tokenData: tokenRecord
  };
}

/**
 * 현재 활성 토큰 조회
 */
export async function getCurrentActiveToken(
  clinicId: string
): Promise<QRTokenData | null> {
  const now = new Date();

  const activeToken = await prisma.qRToken.findFirst({
    where: {
      clinicId,
      used: false,
      expiresAt: {
        gt: now
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (!activeToken) {
    return null;
  }

  return {
    token: activeToken.token,
    expiresAt: activeToken.expiresAt,
    isActive: true
  };
}

/**
 * 만료된 토큰 정리
 */
export async function cleanupExpiredTokens(clinicId?: string): Promise<number> {
  const where: any = {
    used: false,
    expiresAt: {
      lt: new Date()
    }
  };

  if (clinicId) {
    where.clinicId = clinicId;
  }

  const result = await prisma.qRToken.updateMany({
    where,
    data: {
      used: true
    }
  });

  return result.count;
}

/**
 * QR 토큰 사용 처리
 */
export async function markTokenAsUsed(
  token: string,
  staffId: string
): Promise<void> {
  await prisma.qRToken.update({
    where: { token },
    data: {
      used: true,
      usedAt: new Date(),
      usedBy: staffId
    }
  });
}
