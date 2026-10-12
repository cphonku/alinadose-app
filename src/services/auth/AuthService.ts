export interface User {
  id: string;
  email: string;
  displayName: string;
}

export class AuthError extends Error {
  constructor(
    public readonly code: 'invalidCredentials' | 'accountExists' | 'noAccount' | 'invalidInput',
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Account handling. For the Jamboree demo, DemoAuthService keeps a single
 * account on the device. A real backend (needed before data can be sent to
 * the physician) implements this same interface.
 */
export interface AuthService {
  getCurrentUser(): Promise<User | null>;
  signUp(email: string, password: string, displayName: string): Promise<User>;
  signIn(email: string, password: string): Promise<User>;
  signOut(): Promise<void>;
}

/** Async key–value storage (expo-secure-store on device, memory in tests). */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

export class MemoryKeyValueStore implements KeyValueStore {
  private map = new Map<string, string>();
  async getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  async deleteItem(key: string) {
    this.map.delete(key);
  }
}
