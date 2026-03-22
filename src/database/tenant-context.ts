import { AsyncLocalStorage } from 'async_hooks';

/**
 * AsyncLocalStorage → permite almacenar datos asociados a una
 * ejecución asíncrona específica (un request HTTP).
 *
 * Es similar a un "hilo de ejecución" en otros lenguajes.
 * Cada request tiene su propio contexto aislado, por lo que
 * dos requests simultáneos de distintas iglesias NO se mezclan.
 *
 * Sin esto tendríamos que pasar el schemaName como parámetro
 * en CADA función de CADA servicio → código muy acoplado.
 */
export const tenantContext = new AsyncLocalStorage<TenantContextData>();

export interface TenantContextData {
    // schemaName → nombre real del schema en Postgres
    // Ejemplo: 'iglesia_bethel'
    schemaName: string;

    // tenantId → id del tenant en la tabla public.tenants
    // Lo incluimos para evitar consultas extra en los servicios
    tenantId: string;
}