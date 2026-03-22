import { SetMetadata } from '@nestjs/common';

/**
 * @Public() → marca un endpoint como público.
 * El JwtAuthGuard lo detecta y no valida el token.
 *
 * Uso:
 *   @Public()
 *   @Post('login')
 *   login() { ... }
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);