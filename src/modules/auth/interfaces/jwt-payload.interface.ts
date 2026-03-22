import { UserRole } from '@prisma/client';

/**
 * Payload que se codifica dentro del JWT.
 *
 * Incluimos solo lo necesario para:
 * - Identificar al usuario (sub)
 * - Resolver el tenant sin consultar la BD (tenantId, schemaName)
 * - Verificar permisos sin consultar la BD (role)
 * - Verificar estado de seguridad (emailVerified, twoFactorPassed)
 *
 * IMPORTANTE: nunca incluir datos sensibles en el payload
 * porque es solo base64 — cualquiera puede decodificarlo.
 */
export interface IJwtPayload {
    // Identificador del usuario (estándar JWT)
    sub: string;
    email: string;
    tenantId: string;
    schemaName: string;
    role: UserRole;
    emailVerified: boolean;
    // true si el usuario ya pasó el segundo factor (2FA)
    // false si aún necesita verificar el código TOTP
    twoFactorPassed: boolean;
}