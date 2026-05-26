import { describe, expect, it } from 'vitest';
import { createAdminAuth, hashPassword } from '../server/auth.js';

const TEST_PASSWORD = 'unit-test-admin-password';

describe('admin auth', () => {
  it('accepts the configured root account password', async () => {
    const passwordHash = await hashPassword(TEST_PASSWORD, 'test-salt');
    const auth = createAdminAuth({
      adminUser: 'root',
      passwordHash,
      sessionSecret: 'test-secret'
    });

    const session = await auth.login('root', TEST_PASSWORD);

    expect(session.ok).toBe(true);
    expect(auth.verifySession(session.token)).toMatchObject({ username: 'root' });
  });

  it('rejects wrong passwords and tampered session tokens', async () => {
    const passwordHash = await hashPassword(TEST_PASSWORD, 'test-salt');
    const auth = createAdminAuth({
      adminUser: 'root',
      passwordHash,
      sessionSecret: 'test-secret'
    });

    await expect(auth.login('root', 'bad-password')).resolves.toMatchObject({ ok: false });
    expect(auth.verifySession('root.invalid.signature')).toBeNull();
  });
});
