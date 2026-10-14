import bcrypt from 'bcryptjs';

export interface IPasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export class BcryptPasswordHasher implements IPasswordHasher {
  private saltRounds: number;

  constructor(saltRounds: number = 10) {
    this.saltRounds = saltRounds;
  }

  public async hash(password: string): Promise<string> {
    if (!password || password.trim().length === 0) {
      throw new Error('كلمة المرور لا يمكن أن تكون فارغة');
    }
    const salt = await bcrypt.genSalt(this.saltRounds);
    return await bcrypt.hash(password, salt);
  }

  public async verify(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) return false;
    try {
      return await bcrypt.compare(password, hash);
    } catch {
      return false;
    }
  }
}

// Export singleton default hasher
export const defaultPasswordHasher = new BcryptPasswordHasher(10);
