import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { IJwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * @CurrentUser() → inyecta el payload del JWT en el parámetro del método.
 *
 * Uso:
 *   @Get('profile')
 *   getProfile(@CurrentUser() user: IJwtPayload) {
 *     return user;
 *   }
 */
export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): IJwtPayload => {
        const request = ctx.switchToHttp().getRequest();
        return request.user;
    },
);