import { registerAs } from '@nestjs/config';

/**
 * registerAs agrupa variables relacionadas bajo un namespace.
 * En lugar de acceder a ConfigService.get('JWT_ACCESS_SECRET'),
 * accedes a ConfigService.get('jwt.accessSecret') → más organizado
 * y con mejor tipado.
 */

export const appConfig = registerAs('app', () => ({
    nodeEnv: process.env.NODE_ENV,
    port: parseInt(process.env.PORT || '3000', 10),
    bootstrapSecret: process.env.BOOTSTRAP_SECRET,
}));

export const databaseConfig = registerAs('database', () => ({
    url: process.env.DATABASE_URL,
}));

export const jwtConfig = registerAs('jwt', () => ({
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
}));

export const mailConfig = registerAs('mail', () => ({
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT || '587', 10),
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
    from: process.env.MAIL_FROM,
}));

export const supabaseConfig = registerAs('supabase', () => ({
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
}));