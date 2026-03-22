import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';

/**
 * @Global() → MailService disponible en toda la app
 * sin necesidad de importar MailModule en cada módulo.
 */
@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('mail.host'),
          port: configService.get<number>('mail.port'),
          secure: true,
          auth: {
            user: configService.get<string>('mail.user'),
            pass: configService.get<string>('mail.pass'),
          },
        },
        defaults: {
          from: configService.get<string>('mail.from'),
        },
        template: {
          dir: join(process.cwd(), 'src', 'modules', 'auth', 'templates'), // Apuntamos a la carpeta de templates del AuthModule
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        }
      }),
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule { }
