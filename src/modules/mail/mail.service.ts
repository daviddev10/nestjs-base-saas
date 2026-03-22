import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);

    constructor(private readonly mailerService: MailerService) { }

    async sendVerifyEmail(params: {
        to: string;
        verifyUrl: string;
        churchName: string;
    }): Promise<void> {
        try {
            await this.mailerService.sendMail({
                to: params.to,
                subject: `Verifica tu email — ${params.churchName}`,
                template: 'verify-email',
                context: {
                    verifyUrl: params.verifyUrl,
                    churchName: params.churchName,
                },
            });

            this.logger.log(`Email de verificación enviado a: ${params.to}`);
        } catch (error) {
            // Logueamos el error pero no lo relanzamos para no bloquear
            // el registro del usuario si el email falla
            this.logger.error(
                `Error al enviar email de verificación a ${params.to}: ${error.message}`,
            );
        }
    }

    async sendResetPassword(params: {
        to: string;
        resetUrl: string;
        churchName: string;
    }): Promise<void> {
        try {
            await this.mailerService.sendMail({
                to: params.to,
                subject: `Restablecer contraseña — ${params.churchName}`,
                template: 'reset-password',
                context: {
                    resetUrl: params.resetUrl,
                    churchName: params.churchName,
                },
            });

            this.logger.log(`Email de reset enviado a: ${params.to}`);
        } catch (error) {
            this.logger.error(
                `Error al enviar email de reset a ${params.to}: ${error.message}`,
            );
        }
    }
}