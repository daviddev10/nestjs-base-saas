import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { tenantContext } from './tenant-context';

@Injectable()
export class TenantPrismaService implements OnModuleDestroy {
    private readonly logger = new Logger(TenantPrismaService.name);

    // Map de schemaName → PrismaClient
    // Ejemplo: { 'iglesia_bethel': PrismaClient, 'iglesia_gracia': PrismaClient }
    private readonly clients = new Map<string, PrismaClient>();

    constructor(private readonly configService: ConfigService) { }

    /**
     * Obtiene el PrismaClient del tenant actual.
     *
     * Lee el schemaName desde el AsyncLocalStorage — que fue
     * almacenado por el TenantMiddleware al inicio del request.
     *
     * Si no existe el cliente para ese schema lo crea y lo cachea.
     */
    getClient(): PrismaClient {
        const context = tenantContext.getStore();

        // Si no hay contexto de tenant significa que alguien intentó
        // usar este servicio fuera de un request HTTP (ej. en un cron job
        // sin configurar el contexto). Fallamos rápido con un error claro.
        if (!context) {
            throw new Error(
                'TenantPrismaService: No hay contexto de tenant activo. ' +
                'Asegúrate de que el TenantMiddleware esté configurado.',
            );
        }

        return this.getOrCreateClient(context.schemaName);
    }

    /**
     * Crea un PrismaClient configurado para un schema específico.
     * Si ya existe en caché lo devuelve directamente.
     */
    private getOrCreateClient(schemaName: string): PrismaClient {
        // Si ya tenemos un cliente para este schema lo reutilizamos
        if (this.clients.has(schemaName)) {
            return this.clients.get(schemaName)!;
        }

        this.logger.log(`Creando cliente Prisma para schema: ${schemaName}`);

        const databaseUrl = this.configService.get<string>('database.url')!;

        /**
         * Aquí está la magia del multitenancy con Postgres:
         *
         * Agregamos ?schema=iglesia_bethel a la URL de conexión.
         * Esto le dice a Prisma que ejecute un SET search_path = iglesia_bethel
         * antes de cada query, haciendo que todas las queries de este cliente
         * apunten automáticamente al schema correcto.
         */
        const urlWithSchema = this.buildUrlWithSchema(databaseUrl, schemaName);

        const client = new PrismaClient({
            datasources: {
                db: { url: urlWithSchema },
            },
            log: [
                { emit: 'event', level: 'error' },
                { emit: 'event', level: 'warn' },
            ],
        });

        // Logueamos errores del cliente del tenant
        client.$on('error' as never, (e: any) => {
            this.logger.error(
                `Error en cliente tenant [${schemaName}]: ${e.message}`,
            );
        });

        // Guardamos en caché
        this.clients.set(schemaName, client);

        return client;
    }

    /**
     * Provisiona un schema nuevo para una iglesia recién registrada.
     *
     * Este método se llamará desde el TenantService cuando el
     * Super Admin registre una nueva iglesia en el SaaS.
     *
     * Por ahora solo crea el schema vacío. Las migraciones
     * las implementaremos cuando tengamos el schema del tenant listo.
     */
    async provisionSchema(schemaName: string): Promise<void> {
        this.logger.log(`Provisionando schema: ${schemaName}`);

        // Usamos el cliente base (public) para ejecutar el DDL
        const client = this.getOrCreateClient('public');

        // CREATE SCHEMA IF NOT EXISTS → idempotente, no falla si ya existe
        await client.$executeRawUnsafe(
            `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`,
        );

        this.logger.log(`Schema ${schemaName} creado exitosamente`);
    }

    /**
     * Construye la URL de conexión con el schema como parámetro.
     *
     * Entrada:  postgresql://user:pass@host:5432/postgres
     * Salida:   postgresql://user:pass@host:5432/postgres?schema=iglesia_bethel
     *
     * Si la URL ya tiene query params los respeta y agrega el schema.
     */
    private buildUrlWithSchema(baseUrl: string, schemaName: string): string {
        const url = new URL(baseUrl);

        // Sobreescribimos siempre el schema para garantizar que
        // apunte al correcto incluso si la URL base tiene uno definido
        url.searchParams.set('schema', schemaName);

        return url.toString();
    }

    /**
     * Cierra todas las conexiones al apagar la app.
     * Evita conexiones huérfanas en Supabase.
     */
    async onModuleDestroy(): Promise<void> {
        this.logger.log(
            `Cerrando ${this.clients.size} conexiones de tenants...`,
        );

        const disconnectPromises = Array.from(this.clients.entries()).map(
            async ([schema, client]) => {
                await client.$disconnect();
                this.logger.debug(`Conexión cerrada para schema: ${schema}`);
            },
        );

        await Promise.all(disconnectPromises);
    }
}
