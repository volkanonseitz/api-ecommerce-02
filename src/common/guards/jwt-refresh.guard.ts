import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Hanya dipakai di endpoint POST /auth/refresh. */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
