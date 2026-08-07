import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'community-grocery-jwt-secret';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || process.env.NEXT_PUBLIC_INTERNAL_SECRET || '';

export function signAdminToken(): string {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyAdminToken(token: string): boolean {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { role?: string };
    return decoded && decoded.role === 'admin';
  } catch {
    return false;
  }
}

export function validateAdminRequest(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return false;
  return verifyAdminToken(token);
}

export function validateInternalRequest(req: NextRequest): boolean {
  const secret = req.headers.get('x-internal-secret');
  if (secret && INTERNAL_SECRET && secret === INTERNAL_SECRET) {
    return true;
  }
  // Allow authenticated admin sessions to also invoke internal broadcast/whatsapp routes
  return validateAdminRequest(req);
}
