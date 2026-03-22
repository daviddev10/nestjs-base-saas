import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);

    constructor() {
        super({
            log: [
                // En desarrollo logueamos todas las queries para debugging.
                // En producción solo errores y warnings para no saturar los logs.
                { emit: 'event', level: 'query' },
                { emit: 'event', level: 'error' },
                { emit: 'event', level: 'warn' },
            ],
        });
    }

    async onModuleInit() {
        // Intentamos conectar al arrancar el módulo.
        // Si falla (BD no disponible), el error se loguea y el servidor no levanta.
        await this.$connect();
        this.logger.log('Conexión a la base de datos establecida');

        // Logueamos las queries solo en desarrollo para ver qué SQL genera Prisma
        this.$on('query' as never, (e: any) => {
            this.logger.debug(`Query: ${e.query} — Duración: ${e.duration}ms`);
        });

        this.$on('error' as never, (e: any) => {
            this.logger.error(`Error de Prisma: ${e.message}`);
        });

        this.$on('warn' as never, (e: any) => {
            this.logger.warn(`Advertencia de Prisma: ${e.message}`);
        });
    }

    async onModuleDestroy() {
        // Cerramos la conexión limpiamente cuando NestJS apaga la app.
        // Evita conexiones huérfanas en la BD.
        await this.$disconnect();
        this.logger.log('Conexión a la base de datos cerrada');
    }

}
