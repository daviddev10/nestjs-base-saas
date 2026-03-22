import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { setupSwagger } from './config/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Controlamos los niveles de log según el entorno:
    // - Development → mostramos todo incluyendo verbose y debug
    // - Production  → solo errores, warnings y logs importantes
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'verbose', 'debug'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port')!;
  const nodeEnv = configService.get<string>('app.nodeEnv');

  // Prefijo global para todas las rutas → /api/v1/...
  app.setGlobalPrefix('api/v1');

  // Solo habilitamos Swagger en desarrollo
  // En producción no queremos exponer la documentación de la API
  if (nodeEnv !== 'production') {
    setupSwagger(app);
  }

  // Logger con contexto 'Bootstrap' para identificar
  // de dónde vienen estos mensajes al arrancar
  const logger = new Logger('ADMINISTERIO SAAS v1.0.0');

  await app.listen(port, () => {
    logger.log(`🚀 Server running on port ${port}`);
    logger.log(`Environment: ${nodeEnv}`);
    if (nodeEnv !== 'production') {
      logger.log(`Swagger docs en: http://localhost:${port}/swagger`);
    }
  });
}
bootstrap();
