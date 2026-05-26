import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 12;

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function parseBase64url(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt}$${Buffer.from(hash).toString('hex')}`;
}

export async function verifyPassword(password, passwordHash) {
  const [scheme, salt, expected] = String(passwordHash).split('$');
  if (scheme !== 'scrypt' || !salt || !expected) {
    return false;
  }

  const actual = await hashPassword(password, salt);
  return safeEqual(actual, passwordHash);
}

export function createAdminAuth({ adminUser = 'root', passwordHash, sessionSecret, sessionTtlMs = DEFAULT_TTL_MS }) {
  if (!passwordHash) {
    throw new Error('passwordHash is required');
  }
  if (!sessionSecret || sessionSecret.length < 8) {
    throw new Error('sessionSecret must be at least 8 characters');
  }

  return {
    async login(username, password) {
      if (username !== adminUser) {
        return { ok: false, message: '账号或密码错误' };
      }

      const passwordOk = await verifyPassword(password, passwordHash);
      if (!passwordOk) {
        return { ok: false, message: '账号或密码错误' };
      }

      const payload = base64url(JSON.stringify({
        username: adminUser,
        exp: Date.now() + sessionTtlMs
      }));
      const signature = sign(payload, sessionSecret);
      return { ok: true, token: `${payload}.${signature}`, username: adminUser };
    },

    verifySession(token) {
      const [payload, signature] = String(token || '').split('.');
      if (!payload || !signature || !safeEqual(sign(payload, sessionSecret), signature)) {
        return null;
      }

      try {
        const session = JSON.parse(parseBase64url(payload));
        if (!session.username || !session.exp || session.exp < Date.now()) {
          return null;
        }
        return { username: session.username, exp: session.exp };
      } catch {
        return null;
      }
    }
  };
}
