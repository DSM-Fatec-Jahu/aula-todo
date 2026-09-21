import { createHash, randomBytes } from 'node:crypto';

// 32 bytes aleatorios = 256 bits, codificados em 43 caracteres base64url.
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateShareToken() {
  return randomBytes(32).toString('base64url');
}

// So o hash SHA-256 fica no banco: um vazamento da tabela nao revela links utilizaveis.
export function hashShareToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
