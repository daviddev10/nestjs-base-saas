import * as Joi from 'joi';

/**
 * Joi valida las variables de entorno AL ARRANCAR el servidor.
 * Si falta alguna variable requerida o tiene un formato incorrecto,
 * NestJS lanza un error ANTES de levantar cualquier módulo.
 *
 * Esto evita que el servidor arranque en un estado inválido.
 */
export const envValidationSchema = Joi.object({
    // ── App ──────────────────────────────────────────────
    NODE_ENV: Joi.string()
        .valid('development', 'production', 'test')
        .default('development'),
    PORT: Joi.number().default(3000),

    // ── Base de datos ────────────────────────────────────
    // .required() → el servidor NO arranca si falta esta variable
    DATABASE_URL: Joi.string().uri().required(),

    // ── JWT ──────────────────────────────────────────────
    JWT_ACCESS_SECRET: Joi.string().min(32).required(),
    JWT_REFRESH_SECRET: Joi.string().min(32).required(),
    JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

    // ── Email ────────────────────────────────────────────
    MAIL_HOST: Joi.string().required(),
    MAIL_PORT: Joi.number().default(587),
    MAIL_USER: Joi.string().required(),
    MAIL_PASS: Joi.string().required(),
    MAIL_FROM: Joi.string().email().required(),

    // ── Supabase ─────────────────────────────────────────
    // SUPABASE_URL: Joi.string().uri().required(),
    // SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),

    // ── Bootstrap ────────────────────────────────────────
    BOOTSTRAP_SECRET: Joi.string().required(),
});