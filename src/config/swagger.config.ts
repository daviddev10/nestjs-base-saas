import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * setupSwagger → configura y monta Swagger UI en la aplicación.
 * Solo se activa en entornos que no sean producción.
 *
 * Recibe la app de NestJS para poder montar el documento
 * y el prefijo global para que las rutas sean correctas.
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Administerio SaaS API')
    .setDescription('API para la gestión integral de iglesias locales')
    .setVersion('1.0')
    .setBasePath('api/v1')
    /**
      * Agregamos X-Tenant-Subdomain como header global.
      * Swagger mostrará un campo en cada endpoint para enviarlo.
      * En producción este header se ignora y se usa el subdominio real.
      */
    .addGlobalParameters({
      in: 'header',
      name: 'X-Tenant-Subdomain',
      schema: { type: 'string', example: 'casadeoracion' },
      description:
        'Solo en desarrollo. Subdominio del tenant a usar. ' +
        'En producción se resuelve automáticamente por el subdominio del Host.',
      required: false,
    })
    // Definimos el esquema de autenticación JWT que usaremos más adelante.
    // El botón "Authorize" en Swagger pedirá el Bearer token
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Ingresa el JWT access token',
      },
      // Este nombre 'JWT-auth' lo usaremos en los decoradores
      // @ApiBearerAuth('JWT-auth') de cada controlador protegido
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Swagger disponible en http://localhost:3000/swagger
  SwaggerModule.setup('swagger', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    }
  });

}