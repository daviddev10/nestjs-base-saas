import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { Observable } from 'rxjs';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IJwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * RolesGuard → verifica que el usuario tenga el rol requerido.
 *
 * Siempre se ejecuta DESPUÉS del JwtAuthGuard porque necesita
 * que req.user esté poblado con el payload del JWT.
 *
 * Si un endpoint no tiene @Roles() decorator, permite el acceso
 * a cualquier usuario autenticado.
 */

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    // Leemos los roles requeridos del decorador @Roles()
    const rolesRequeridos = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no hay @Roles() en el endpoint, cualquier usuario autenticado puede acceder
    if (!rolesRequeridos || rolesRequeridos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as IJwtPayload;

    /**
     * SUPER_ADMIN tiene acceso a todo sin excepción.
     * No necesitamos agregarlo explícitamente en cada @Roles().
     */
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    const tieneRol = rolesRequeridos.includes(user.role);

    if (!tieneRol) {
      throw new ForbiddenException(
        `Acceso denegado. Se requiere uno de estos roles: ${rolesRequeridos.join(', ')}`,
      );
    }

    return true;
  }
}
