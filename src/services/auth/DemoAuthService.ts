import { newId } from '../../data/ids';
import { AuthError, type AuthService, type KeyValueStore, type User } from './AuthService';

const ACCOUNT_KEY = 'lutealine.demo.account';
const SESSION_KEY = 'lutealine.demo.session';

interface StoredAccount {
  user: User;
  password: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * DEMO ONLY: one local account, kept in the device's secure storage
 * (Keychain / Keystore). There is no server, so nothing leaves the device.
 * Replace with a real backend before handling real patients.
 */
export class DemoAuthService implements AuthService {
  constructor(private readonly kv: KeyValueStore) {}

  private async account(): Promise<StoredAccount | null> {
    const raw = await this.kv.getItem(ACCOUNT_KEY);
    return raw ? (JSON.parse(raw) as StoredAccount) : null;
  }

  async getCurrentUser(): Promise<User | null> {
    const [session, account] = await Promise.all([this.kv.getItem(SESSION_KEY), this.account()]);
    return session && account && account.user.id === session ? account.user : null;
  }

  async signUp(email: string, password: string, displayName: string): Promise<User> {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL.test(normalized)) throw new AuthError('invalidInput', 'Please enter a valid email address');
    if (password.length < 8) throw new AuthError('invalidInput', 'Password must be at least 8 characters');
    if (!displayName.trim()) throw new AuthError('invalidInput', 'Please enter a name');
    if (await this.account()) throw new AuthError('accountExists', 'An account already exists on this device');

    const user: User = { id: newId(), email: normalized, displayName: displayName.trim() };
    await this.kv.setItem(ACCOUNT_KEY, JSON.stringify({ user, password } satisfies StoredAccount));
    await this.kv.setItem(SESSION_KEY, user.id);
    return user;
  }

  async signIn(email: string, password: string): Promise<User> {
    const account = await this.account();
    if (!account) throw new AuthError('noAccount', 'No account on this device yet');
    if (account.user.email !== email.trim().toLowerCase() || account.password !== password) {
      throw new AuthError('invalidCredentials', 'Email or password is incorrect');
    }
    await this.kv.setItem(SESSION_KEY, account.user.id);
    return account.user;
  }

  async signOut(): Promise<void> {
    await this.kv.deleteItem(SESSION_KEY);
  }

  /** Removes the account entirely (used by "reset demo"). */
  async deleteAccount(): Promise<void> {
    await Promise.all([this.kv.deleteItem(SESSION_KEY), this.kv.deleteItem(ACCOUNT_KEY)]);
  }
}
