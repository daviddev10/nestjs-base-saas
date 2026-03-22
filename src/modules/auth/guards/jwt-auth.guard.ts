import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JwtAuthGuard → protege los endpoints que requieren autenticación.
 *
 * Por defecto todos los endpoints son privados.
 * Para hacer un endpoint público usamos el decorador @Public().
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private readonly reflector: Reflector) {
        super();
    }

    canActivate(context: ExecutionContext) {
        /**
         * Verificamos si el endpoint tiene el decorador @Public().
         * Si es público dejamos pasar sin validar el token.
         * Reflector lee los metadatos de los decoradores.
         */
        const isPublic = this.reflector.getAllAndOverride<boolean>(
            IS_PUBLIC_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (isPublic) return true;

        return super.canActivate(context);
    }

    handleError(err: Error) {
        throw new UnauthorizedException(
            err?.message || 'No autorizado. Token inválido o expirado.',
        );
    }
}