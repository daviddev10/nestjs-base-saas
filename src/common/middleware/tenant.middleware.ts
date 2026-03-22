import { Injectable, NestMiddleware, Logger, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { tenantContext } from '../../database/tenant-context';

/**
 * TenantMiddleware → se ejecuta en CADA request HTTP.
 *
 * Responsabilidades:
 * 1. Extraer el subdominio del header 'Host'
 * 2. Buscar el tenant en la tabla public.tenants
 * 3. Almacenar el contexto del tenant en AsyncLocalStorage
 *    para que esté disponible en toda la cadena del request
 *
 * Ejemplos de Host header:
 *   bethel.miapp.com       → subdominio: 'bethel'
 *   gracia.miapp.com       → subdominio: 'gracia'
 *   localhost:3000         → subdominio: null (rutas del SaaS)
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
    private readonly logger = new Logger(TenantMiddleware.name);

    constructor(private readonly prisma: PrismaService) { }

    async use(req: Request, res: Response, next: NextFunction): Promise<void> {
        const subdomain = this.resolverSubdominio(req);
        /**
         * Si no hay subdominio es una ruta del SaaS en sí mismo
         * (ej. panel de Super Admin, health check, etc.).
         * Dejamos pasar el request sin contexto de tenant.
         */
        if (!subdomain) {
            return next();
        }

        // Buscamos el tenant en la BD usando el subdominio
        const tenant = await this.prisma.tenant.findUnique({
            where: { subdomain: subdomain },
            select: {
                id: true,
                schemaName: true,
                isActive: true,
            },
        });

        // Si el subdominio no existe en la BD → 404 claro
        if (!tenant) {
            throw new NotFoundException(
                `No existe ninguna iglesia con el subdominio '${subdomain}'`,
            );
        }

        // Si la iglesia existe pero está desactivada → 404
        // Usamos 404 en lugar de 403 para no revelar que el tenant existe
        if (!tenant.isActive) {
            throw new NotFoundException(
                `No existe ninguna iglesia con el subdominio '${subdomain}'`,
            );
        }

        this.logger.debug(
            `Request de tenant: ${subdomain} → schema: ${tenant.schemaName}`,
        );

        /**
         * Almacenamos el contexto del tenant en AsyncLocalStorage.
         *
         * tenantContext.run() crea un "contenedor" aislado para este
         * request. Todo el código que se ejecute dentro del callback
         * (next()) tendrá acceso a estos datos via tenantContext.getStore()
         * sin importar cuántos awaits o llamadas asíncronas haya en el camino.
         */
        tenantContext.run(
            { schemaName: tenant.schemaName, tenantId: tenant.id },
            () => next(),
        );
    }

    /**
   * Resuelve el subdominio del tenant usando dos estrategias:
   *
   * 1. Header X-Tenant-Subdomain (desarrollo / Swagger)
   *    Se envía manualmente en cada request durante el desarrollo.
   *    Ejemplo: X-Tenant-Subdomain: bethel
   *
   * 2. Subdominio del Host (producción)
   *    Se extrae automáticamente del header Host.
   *    Ejemplo: bethel.miapp.com → 'bethel'
   *
   * La estrategia 1 tiene prioridad sobre la 2 para facilitar
   * el desarrollo sin necesidad de configurar subdominios locales.
   */
    private resolverSubdominio(req: Request): string | null {
        // Estrategia 1: header personalizado (desarrollo / Swagger)
        const headerTenant = req.headers['x-tenant-subdomain'] as string;
        if (headerTenant?.trim()) {
            this.logger.debug(`Tenant resuelto por header X-Tenant-Subdomain: ${headerTenant}`);
            return headerTenant.trim().toLowerCase();
        }

        // Estrategia 2: subdominio del Host (producción)
        return this.extraerSubdominio(req.hostname);
    }

    /**
     * Extrae el subdominio del hostname.
     *
     * Ejemplos:
     *   bethel.miapp.com   → 'bethel'
     *   localhost          → null
     *   localhost:3000     → null
     *   miapp.com          → null  (dominio raíz sin subdominio)
     */
    private extraerSubdominio(host: string): string | null {
        // Eliminamos el puerto si existe (localhost:3000 → localhost)
        const hostSinPuerto = host.split(':')[0];

        const partes = hostSinPuerto.split('.');

        /**
         * Un hostname válido con subdominio tiene al menos 3 partes:
         *   bethel.miapp.com → ['bethel', 'miapp', 'com'] → length: 3
         *   localhost        → ['localhost']               → length: 1
         *   miapp.com        → ['miapp', 'com']            → length: 2
         */
        if (partes.length < 3) {
            return null;
        }

        return partes[0];
    }
}