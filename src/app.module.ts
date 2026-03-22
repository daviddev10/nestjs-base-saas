import { MiddlewareConsumer, Module, NestModule, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig, databaseConfig, envValidationSchema, jwtConfig, mailConfig, supabaseConfig } from './config';
import { DatabaseModule } from './database/database.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { TenantModule } from './modules/tenant/tenant.module';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { MailModule } from './modules/mail/mail.module';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      // isGlobal: true → no necesitas importar ConfigModule
      // en cada módulo, está disponible en toda la app
      isGlobal: true,

      // Carga las variables del archivo .env
      envFilePath: '.env',

      // Los namespaces de configuración tipada
      load: [appConfig, databaseConfig, jwtConfig, mailConfig, supabaseConfig],

      // Joi valida al arrancar — si algo falla, el servidor no levanta
      validationSchema: envValidationSchema,

      validationOptions: {
        // allowUnknown: true → permite variables extra en .env sin que Joi las rechace
        allowUnknown: true,
        // abortEarly: false → muestra TODOS los errores de validación de una vez,
        // no solo el primero
        abortEarly: false,
      }
    }),
    DatabaseModule,
    MailModule,
    TenantModule,
    AuthModule,
    UserModule
  ],
  controllers: [],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        // whitelist: true → elimina automáticamente los campos
        // que no están en el DTO, aunque vengan en el body
        whitelist: true,
        // forbidNonWhitelisted: true → lanza error si vienen
        // campos extra no definidos en el DTO
        forbidNonWhitelisted: true,
        // transform: true → convierte automáticamente los tipos
        // (ej. string '3000' → number 3000)
        transform: true,
      }),
    },
    // JwtAuthGuard global → todos los endpoints requieren JWT
    // excepto los marcados con @Public()
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // RolesGuard global → verifica roles después del JWT
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    }
  ],
})
export class AppModule implements NestModule {
  /**
   * configure() → registra middlewares y define a qué rutas aplican.
   *
   * forRoutes('*') → aplica a TODAS las rutas.
   * El middleware se encarga internamente de ignorar las rutas
   * que no tienen subdominio de tenant.
   */
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes('*path');
  }

}
