import { HttpException, HttpStatus } from '@nestjs/common';

export class AppHttpException extends HttpException {
  constructor(message: string, status: HttpStatus, errors: unknown = null) {
    super({ message, errors }, status);
  }
}

/** Padanan status 'locked' di AttemptLoginAction (423 + locked_until). */
export class AccountLockedException extends AppHttpException {
  constructor(lockedUntil: Date) {
    super('Akun dikunci sementara.', 423, {
      locked_until: lockedUntil,
    });
  }
}

/** Padanan status 'unverified' di AttemptLoginAction (403). */
export class EmailUnverifiedException extends AppHttpException {
  constructor() {
    super(
      'Silakan verifikasi email Anda terlebih dahulu.',
      HttpStatus.FORBIDDEN,
    );
  }
}

/** Padanan UserSecurityService::enforceRateLimit gagal (429). */
export class TooManyAttemptsException extends AppHttpException {
  constructor() {
    super(
      'Terlalu banyak percobaan login. Silakan coba lagi nanti.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/** Kredensial salah / user tidak ditemukan (401), pesan disamakan supaya tidak bocor info user exists atau tidak. */
export class InvalidCredentialsException extends AppHttpException {
  constructor() {
    super('Email atau password tidak valid.', HttpStatus.UNAUTHORIZED);
  }
}
