import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Menandai route yang tidak perlu access token (mis. login, register,
 * refresh, social-login) — padanan route yang tidak dipasangi middleware
 * `auth:sanctum` di Laravel.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
