import { AuthError, MemoryKeyValueStore } from '../auth/AuthService';
import { DemoAuthService } from '../auth/DemoAuthService';

describe('DemoAuthService', () => {
  let auth: DemoAuthService;
  beforeEach(() => {
    auth = new DemoAuthService(new MemoryKeyValueStore());
  });

  it('signs up, signs out and signs back in', async () => {
    const user = await auth.signUp(' Demo@Example.com ', 'password123', 'Demo');
    expect(user.email).toBe('demo@example.com');
    expect(await auth.getCurrentUser()).toEqual(user);

    await auth.signOut();
    expect(await auth.getCurrentUser()).toBeNull();

    expect(await auth.signIn('demo@example.com', 'password123')).toEqual(user);
  });

  it('rejects wrong credentials', async () => {
    await auth.signUp('demo@example.com', 'password123', 'Demo');
    await expect(auth.signIn('demo@example.com', 'wrong-password')).rejects.toMatchObject({
      code: 'invalidCredentials',
    });
  });

  it('validates input and allows only one account per device', async () => {
    await expect(auth.signUp('not-an-email', 'password123', 'Demo')).rejects.toBeInstanceOf(AuthError);
    await expect(auth.signUp('demo@example.com', 'short', 'Demo')).rejects.toMatchObject({ code: 'invalidInput' });
    await auth.signUp('demo@example.com', 'password123', 'Demo');
    await expect(auth.signUp('other@example.com', 'password123', 'Other')).rejects.toMatchObject({
      code: 'accountExists',
    });
  });

  it('can delete the account for a demo reset', async () => {
    await auth.signUp('demo@example.com', 'password123', 'Demo');
    await auth.deleteAccount();
    await expect(auth.signIn('demo@example.com', 'password123')).rejects.toMatchObject({ code: 'noAccount' });
  });
});
