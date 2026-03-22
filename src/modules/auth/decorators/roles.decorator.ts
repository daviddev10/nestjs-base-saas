import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * @Roles() → define qué roles pueden acceder a un endpoint.
 *
 * Uso:
 *   @Roles(UserRole.SUPER_ADMIN)
 *   @Get('tenants')
 *   findAll() { ... }
 *
 *   // Múltiples roles permitidos:
 *   @Roles(UserRole.CHURCH_ADMIN, UserRole.SECRETARY)
 *   @Get('members')
 *   findAll() { ... }
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);