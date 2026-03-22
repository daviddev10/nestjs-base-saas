import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { tenantContext } from '../../database/tenant-context';

/**
 * @CurrentTenant() → decorador para inyectar el contexto del tenant
 * directamente en los parámetros de un método de controlador.
 *
 * Uso en un controlador:
 *   @Get('info')
 *   getInfo(@CurrentTenant() tenant: TenantContextData) {
 *     return tenant.schemaName;
 *   }
 */
export const CurrentTenant = createParamDecorator(
    (_data: unknown, _ctx: ExecutionContext) => {
        return tenantContext.getStore(); // Accede al contexto del tenant
    },
);