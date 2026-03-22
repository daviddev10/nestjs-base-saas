import { ConflictException, ForbiddenException, Injectable, InternalServerErrorException, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { TenantPrismaService } from 'src/database/tenant-prisma.service';
import { UserRole } from '@prisma/client';

import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

import * as argon2 from 'argon2';
import { LoginDto } from './dto/login.dto';
import { tenantContext } from 'src/database/tenant-context';
import { IJwtPayload } from './interfaces/jwt-payload.interface';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { PrismaService } from 'src/database/prisma.service';
import { MailService } from '../mail/mail.service';
import { ForgotPasswordDto, ResetPasswordDto, UpdateProfileDto, Verify2FADto, VerifyEmailDto } from './dto';
import { ICreatedUser } from './interfaces/user.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    // Usamos TenantPrismaService porque los usuarios viven
    // en el schema del tenant, no en el schema public
    private readonly tenantPrisma: TenantPrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    // PrismaService → para leer datos del tenant (nombre organización)
    // desde el schema public
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) { }

  async register(dto: CreateAuthDto) {
    const client = this.tenantPrisma.getClient();

    // Verificamos que el email no esté registrado en este tenant
    const usuarioExistente = await client.user.findUnique({
      where: { email: dto.email },
    });

    if (usuarioExistente) {
      throw new ConflictException(
        'Ya existe un usuario con este email',
      );
    }

    try {
      /**
       * Hasheamos la contraseña con argon2.
       * argon2 es más seguro que bcrypt porque es resistente
       * a ataques de GPU y memoria. La API es igual de simple.
       */
      const passwordHash = await argon2.hash(dto.password);

      /**
       * Generamos un token de verificación de email seguro.
       * Usamos crypto.randomBytes que genera bytes aleatorios
       * criptográficamente seguros.
       * Lo convertimos a hex para guardarlo como string.
       */
      const { randomBytes } = await import('crypto');
      const emailVerifyToken = randomBytes(32).toString('hex');

      // El token de verificación expira en 24 horas
      const emailVerifyExpires = new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      );

      const user = await client.user.create({
        data: {
          email: dto.email,
          passwordHash,
          // El primer usuario de un tenant es ADMIN por defecto
          // Esto lo ajustaremos cuando tengamos el flujo completo de onboarding
          role: UserRole.ADMIN,
          emailVerifyToken,
          emailVerifyExpires,
        },
        // Nunca devolvemos el hash de la contraseña ni tokens sensibles
        select: {
          id: true,
          email: true,
          role: true,
          emailVerified: true,
          createdAt: true,
        },
      });

      this.logger.log(
        `Usuario registrado: ${user.email} (${user.role})`,
      );

      // Enviamos el email de verificación
      await this.sendVerifyEmail(user, emailVerifyToken); //TODO: Verificar error en producción

      return {
        message:
          'Usuario registrado exitosamente. ' +
          'Por favor verifica tu email para activar tu cuenta.',
        user,
      };
    } catch (error) {
      if (error instanceof ConflictException) throw error;

      this.logger.error(
        `Error al registrar usuario: ${error.message}`,
        error.stack,
      );

      throw new InternalServerErrorException(
        'Ocurrió un error al registrar el usuario.',
      );
    }
  }

  private async sendVerifyEmail(user: ICreatedUser, emailVerifyToken: string): Promise<void> {
    const context = tenantContext.getStore()!;
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: context.tenantId },
      select: { name: true, subdomain: true },
    });

    if (!tenant) {
      throw new InternalServerErrorException('Tenant no encontrado');
    }

    const verifyUrl = `https://${tenant.subdomain}.miapp.com/verify-email?token=${emailVerifyToken}`;

    await this.mailService.sendVerifyEmail({
      to: user.email,
      verifyUrl,
      tenantName: tenant.name,
    });

    this.logger.debug(`Token de verificación generado para: ${user.email}`);
  }

  async login(dto: LoginDto) {
    const client = this.tenantPrisma.getClient();

    // Obtenemos el contexto del tenant para incluirlo en el JWT
    const context = tenantContext.getStore()!;

    const user = await client.user.findUnique({
      where: { email: dto.email },
    });

    console.log('user :>> ', user);

    /**
     * Verificamos usuario y contraseña en el mismo bloque
     * y lanzamos el mismo error en ambos casos.
     * Esto evita revelar si el email existe o no (enumeración de usuarios).
     */
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValido = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    console.log('passwordValido :>> ', passwordValido);

    if (!passwordValido) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Si tiene 2FA habilitado emitimos un token temporal
    // que solo permite acceder al endpoint de verificación 2FA
    if (user.twoFactorEnabled) {
      const temp2FAToken = await this.generarAccessToken(
        {
          sub: user.id,
          email: user.email,
          tenantId: context.tenantId,
          schemaName: context.schemaName,
          role: user.role,
          emailVerified: user.emailVerified,
          // false → aún no pasó el segundo factor
          twoFactorPassed: false,
        },
        // Token de corta duración para el flujo 2FA (5 minutos)
        '5m',
      );

      return {
        requires2FA: true,
        // Enviamos el token temporal para que el cliente
        // lo use en el endpoint POST /auth/2fa/verify
        tempToken: temp2FAToken,
      };
    }

    // Sin 2FA → emitimos los tokens definitivos
    const tokens = await this.generarTokens({
      sub: user.id,
      email: user.email,
      tenantId: context.tenantId,
      schemaName: context.schemaName,
      role: user.role,
      emailVerified: user.emailVerified,
      twoFactorPassed: true,
    });

    this.logger.log(`Login exitoso: ${user.email}`);

    return {
      requires2FA: false,
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    };
  }

  private async generarAccessToken(payload: IJwtPayload, expiresIn?: string): Promise<string> {
    const options: JwtSignOptions = {
      secret: this.configService.get<string>('jwt.accessSecret')!,
      expiresIn: (expiresIn ?? this.configService.get<string>('jwt.accessExpiresIn')!) as any,
    }
    return this.jwtService.signAsync(payload as any, options);
  }

  private async generarRefreshToken(payload: IJwtPayload): Promise<string> {
    const options: JwtSignOptions = {
      secret: this.configService.get<string>('jwt.refreshSecret')!,
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn')! as any,
    }
    return this.jwtService.signAsync(payload as any, options);
  }

  /**
   * Genera el par de tokens (access + refresh) y guarda
   * el hash del refresh token en la BD para poder invalidarlo.
   */
  async generarTokens(
    payload: IJwtPayload,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const client = this.tenantPrisma.getClient();

    const [accessToken, refreshToken] = await Promise.all([
      this.generarAccessToken(payload),
      this.generarRefreshToken(payload),
    ]);

    // Guardamos el hash del refresh token en la BD.
    // Nunca guardamos el token en texto plano.
    const tokenHash = await argon2.hash(refreshToken);

    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn')!;

    // Calculamos la fecha de expiración del refresh token
    const diasExpiracion = parseInt(refreshExpiresIn.replace('d', ''));
    const expiresAt = new Date(
      Date.now() + diasExpiracion * 24 * 60 * 60 * 1000,
    );

    await client.refreshToken.create({
      data: {
        userId: payload.sub,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  async refresh(dto: RefreshTokenDto) {
    /**
     * Verificamos la firma del refresh token con el refreshSecret.
     * Si el token está manipulado o expirado jwtService lanza una excepción.
     */
    let payload: IJwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<IJwtPayload>(
        dto.refreshToken,
        {
          secret: this.configService.get<string>('jwt.refreshSecret')!,
        },
      );
    } catch {
      throw new UnauthorizedException(
        'Refresh token inválido o expirado',
      );
    }

    const client = this.tenantPrisma.getClient();

    // Buscamos todos los refresh tokens activos del usuario
    const refreshTokensActivos = await client.refreshToken.findMany({
      where: {
        userId: payload.sub,
        expiresAt: { gt: new Date() },
      },
    });

    if (refreshTokensActivos.length === 0) {
      throw new UnauthorizedException('No hay sesiones activas');
    }

    /**
     * Buscamos cuál de los tokens activos corresponde al que nos enviaron.
     * Usamos argon2.verify porque guardamos el hash, no el token en texto plano.
     *
     * Este proceso evita que un refresh token robado pueda usarse
     * si ya fue invalidado (logout, cambio de contraseña).
     */
    let tokenEncontrado: { id: string; tokenHash: string } | null = null;

    for (const rt of refreshTokensActivos) {
      const coincide = await argon2.verify(rt.tokenHash, dto.refreshToken);
      if (coincide) {
        tokenEncontrado = rt;
        break;
      }
    }

    if (!tokenEncontrado) {
      /**
       * Si el refresh token no coincide con ninguno almacenado
       * podría indicar un intento de reutilización de token robado.
       * Invalidamos TODOS los tokens del usuario como medida de seguridad.
       */
      await client.refreshToken.deleteMany({
        where: { userId: payload.sub },
      });

      this.logger.warn(
        `Posible reutilización de refresh token detectada para usuario: ${payload.sub}`,
      );

      throw new ForbiddenException(
        'Sesión inválida. Por seguridad se cerraron todas las sesiones activas.',
      );
    }

    // Invalidamos el refresh token usado — rotación de tokens
    // Cada refresh genera un nuevo par de tokens y el anterior queda inválido
    await client.refreshToken.delete({
      where: { id: tokenEncontrado.id },
    });

    // Obtenemos los datos actualizados del usuario
    const user = await client.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        isActive: true,
        twoFactorEnabled: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario inactivo o no encontrado');
    }

    // Generamos un nuevo par de tokens con los datos actualizados del usuario
    const context = tenantContext.getStore()!;

    const nuevoPayload: IJwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: context.tenantId,
      schemaName: context.schemaName,
      role: user.role,
      emailVerified: user.emailVerified,
      twoFactorPassed: true,
    };

    const tokens = await this.generarTokens(nuevoPayload);

    this.logger.log(`Refresh token rotado para: ${user.email}`);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    };
  }

  async logout(userId: string) {
    const client = this.tenantPrisma.getClient();

    /**
     * Eliminamos TODOS los refresh tokens del usuario.
     * Esto cierra todas las sesiones activas en todos los dispositivos.
     */
    const resultado = await client.refreshToken.deleteMany({
      where: { userId },
    });

    this.logger.log(
      `Logout: ${resultado.count} sesión(es) cerrada(s) para usuario: ${userId}`,
    );

    return {
      message: 'Sesión cerrada exitosamente',
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const client = this.tenantPrisma.getClient();

    const user = await client.user.findFirst({
      where: { emailVerifyToken: dto.token },
    });

    if (!user) {
      throw new UnauthorizedException('Token de verificación inválido');
    }

    // Verificamos que el token no haya expirado
    if (user.emailVerifyExpires && user.emailVerifyExpires < new Date()) {
      throw new UnauthorizedException(
        'El token de verificación ha expirado. Solicita uno nuevo.',
      );
    }

    // Activamos la cuenta y limpiamos los campos del token
    await client.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
      },
    });

    this.logger.log(`Email verificado para: ${user.email}`);

    return { message: 'Email verificado exitosamente. Ya puedes iniciar sesión.' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const client = this.tenantPrisma.getClient();
    const context = tenantContext.getStore()!;

    const user = await client.user.findUnique({
      where: { email: dto.email },
    });

    /**
     * Respondemos con el mismo mensaje aunque el usuario no exista.
     * Esto evita revelar qué emails están registrados (enumeración).
     */
    if (!user || !user.isActive) {
      return {
        message:
          'Si el email existe recibirás un enlace para restablecer tu contraseña.',
      };
    }

    const { randomBytes } = await import('crypto');
    const resetToken = randomBytes(32).toString('hex');

    // El token de reset expira en 15 minutos
    const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000);

    await client.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpires },
    });

    // Obtenemos el nombre del tenant para personalizar el email
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: context.tenantId },
      select: { name: true, subdomain: true },
    });

    if (!tenant) {
      throw new InternalServerErrorException('Tenant no encontrado');
    }

    const resetUrl = `https://${tenant.subdomain}.miapp.com/reset-password?token=${resetToken}`;

    await this.mailService.sendResetPassword({
      to: user.email,
      resetUrl,
      tenantName: tenant!.name,
    });

    return {
      message:
        'Si el email existe recibirás un enlace para restablecer tu contraseña.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const client = this.tenantPrisma.getClient();

    const user = await client.user.findFirst({
      where: { resetToken: dto.token },
    });

    if (!user) {
      throw new UnauthorizedException('Token de reset inválido');
    }

    if (user.resetTokenExpires && user.resetTokenExpires < new Date()) {
      throw new UnauthorizedException(
        'El token de reset ha expirado. Solicita uno nuevo.',
      );
    }

    const passwordHash = await argon2.hash(dto.newPassword);

    // Actualizamos la contraseña y limpiamos el token de reset
    await client.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    /**
     * Invalidamos todos los refresh tokens activos.
     * Si alguien robó la cuenta y cambia la contraseña,
     * todas las sesiones anteriores quedan cerradas.
     */
    await client.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    this.logger.log(`Contraseña restablecida para: ${user.email}`);

    return { message: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión.' };
  }

  async resendVerifyEmail(userId: string) {
    const client = this.tenantPrisma.getClient();
    const context = tenantContext.getStore()!;

    const user = await client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (user.emailVerified) {
      return { message: 'Tu email ya está verificado.' };
    }

    const { randomBytes } = await import('crypto');
    const emailVerifyToken = randomBytes(32).toString('hex');
    const emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await client.user.update({
      where: { id: user.id },
      data: { emailVerifyToken, emailVerifyExpires },
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: context.tenantId },
      select: { name: true, subdomain: true },
    });

    if (!tenant) {
      throw new InternalServerErrorException('Tenant no encontrado');
    }

    const verifyUrl = `https://${tenant.subdomain}.miapp.com/verify-email?token=${emailVerifyToken}`;

    await this.mailService.sendVerifyEmail({
      to: user.email,
      verifyUrl,
      tenantName: tenant.name,
    });

    return { message: 'Email de verificación reenviado.' };
  }

  /**
   * Paso 1 del setup de 2FA:
   * Genera un secret TOTP y devuelve el QR code para escanear
   * con Google Authenticator. El 2FA NO está activo todavía —
   * el usuario debe confirmar con un código válido primero.
   */
  async setup2FA(userId: string) {
    const client = this.tenantPrisma.getClient();
    const context = tenantContext.getStore()!;

    const user = await client.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, twoFactorEnabled: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (user.twoFactorEnabled) {
      throw new ConflictException('El 2FA ya está activado en esta cuenta');
    }

    // Obtenemos el nombre del tenant para mostrarlo en Google Authenticator
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: context.tenantId },
      select: { name: true },
    });

    if (!tenant) {
      throw new InternalServerErrorException('Tenant no encontrado');
    }

    /**
     * Generamos el secret TOTP.
     * encoding: 'base32' → formato estándar compatible con Google Authenticator,
     * Authy y cualquier app TOTP.
     */
    const secret = speakeasy.generateSecret({
      name: `${tenant.name} (${user.email})`,
      issuer: 'SaaS Platform',
      length: 20,
    });

    // Guardamos el secret temporalmente — aún no activamos el 2FA
    // Solo lo activamos cuando el usuario confirme con un código válido
    await client.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret.base32 },
    });

    /**
     * Generamos el QR code como imagen base64.
     * El usuario lo escanea con Google Authenticator.
     * secret.otpauth_url contiene todos los datos necesarios:
     * issuer, account name, secret y algoritmo.
     */
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      message:
        'Escanea el QR con Google Authenticator y confirma con un código para activar el 2FA.',
      qrCode: qrCodeUrl,
      // Enviamos también el secret en texto para quienes no puedan escanear el QR
      manualCode: secret.base32,
    };
  }

  /**
   * Paso 2 del setup de 2FA:
   * El usuario envía el código que ve en Google Authenticator
   * para confirmar que lo configuró correctamente.
   * Solo después de esto el 2FA queda activo.
   */
  async confirm2FA(userId: string, dto: Verify2FADto) {
    const client = this.tenantPrisma.getClient();

    const user = await client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        twoFactorSecret: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (user.twoFactorEnabled) {
      throw new ConflictException('El 2FA ya está activado');
    }

    if (!user.twoFactorSecret) {
      throw new UnauthorizedException(
        'Primero debes iniciar el setup del 2FA',
      );
    }

    const codigoValido = this.verificarCodigo2FA(
      user.twoFactorSecret,
      dto.code,
    );

    if (!codigoValido) {
      throw new UnauthorizedException(
        'Código inválido. Asegúrate de que tu dispositivo tenga la hora correcta.',
      );
    }

    // Activamos el 2FA
    await client.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    this.logger.log(`2FA activado para usuario: ${userId}`);

    return { message: '2FA activado exitosamente.' };
  }

  /**
   * Verificación del código 2FA durante el login.
   * Se usa cuando el login devuelve requires2FA: true
   * y el usuario envía el código temporal + código TOTP.
   */
  async verify2FALogin(tempToken: string, dto: Verify2FADto) {
    /**
     * Verificamos el token temporal generado en el login.
     * Este token tiene twoFactorPassed: false — si tuviera true
     * significaría que alguien está intentando reusar un token ya verificado.
     */
    let payload: IJwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<IJwtPayload>(tempToken, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw new UnauthorizedException('Token temporal inválido o expirado');
    }

    if (payload.twoFactorPassed) {
      throw new UnauthorizedException('Token inválido para verificación 2FA');
    }

    const client = this.tenantPrisma.getClient();

    const user = await client.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        isActive: true,
        twoFactorSecret: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const codigoValido = this.verificarCodigo2FA(
      user.twoFactorSecret!,
      dto.code,
    );

    if (!codigoValido) {
      throw new UnauthorizedException('Código 2FA inválido');
    }

    // El código es válido → emitimos los tokens definitivos
    const tokens = await this.generarTokens({
      sub: user.id,
      email: user.email,
      tenantId: payload.tenantId,
      schemaName: payload.schemaName,
      role: user.role,
      emailVerified: user.emailVerified,
      twoFactorPassed: true,
    });

    this.logger.log(`Login con 2FA exitoso: ${user.email}`);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    };
  }

  async disable2FA(userId: string, dto: Verify2FADto) {
    const client = this.tenantPrisma.getClient();

    const user = await client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        twoFactorSecret: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!user.twoFactorEnabled) {
      throw new ConflictException('El 2FA no está activado');
    }

    // Pedimos el código actual para confirmar que es el dueño
    const codigoValido = this.verificarCodigo2FA(
      user.twoFactorSecret!,
      dto.code,
    );

    if (!codigoValido) {
      throw new UnauthorizedException(
        'Código inválido. No se puede desactivar el 2FA.',
      );
    }

    await client.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    this.logger.log(`2FA desactivado para usuario: ${userId}`);

    return { message: '2FA desactivado exitosamente.' };
  }

  // ── Método privado de verificación TOTP ───────────────────────────────────

  /**
   * Verifica un código TOTP contra el secret del usuario.
   *
   * window: 1 → acepta el código del intervalo anterior y siguiente
   * al actual. Esto da una tolerancia de ±30 segundos para compensar
   * pequeñas diferencias de reloj entre el servidor y el dispositivo.
   */
  private verificarCodigo2FA(secret: string, code: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
  }

  async createSuperAdmin(dto: CreateAuthDto, bootstrapSecret: string) {
    const secretEsperado = this.configService.get<string>('app.bootstrapSecret');

    if (bootstrapSecret !== secretEsperado) {
      throw new UnauthorizedException('Clave de bootstrap inválida');
    }

    /**
     * Verificamos si ya existe el tenant 'admin'.
     * Si no existe lo creamos automáticamente — es el tenant
     * reservado donde viven los Super Admins del SaaS.
     */
    let adminTenant = await this.prisma.tenant.findUnique({
      where: { subdomain: 'admin' },
    });

    if (!adminTenant) {
      this.logger.log('Creando tenant reservado: admin');

      adminTenant = await this.prisma.tenant.create({
        data: {
          name: 'SaaS Admin',
          subdomain: 'admin',
          schemaName: 'tenant_admin',
          email: 'admin@saas.com',
          currency: 'USD',
          timezone: 'UTC',
          isActive: true,
        },
      });

      // Provisionamos el schema del tenant admin
      await this.tenantPrisma.provisionSchema('tenant_admin');
    }

    /**
     * Ahora creamos el Super Admin dentro del tenant 'admin'.
     * Ejecutamos el código dentro del contexto del tenant admin
     * para que TenantPrismaService apunte al schema correcto.
     */
    return new Promise((resolve, reject) => {
      tenantContext.run(
        { schemaName: 'tenant_admin', tenantId: adminTenant.id },
        async () => {
          try {
            const client = this.tenantPrisma.getClient();

            const existente = await client.user.findUnique({
              where: { email: dto.email },
            });

            if (existente) {
              reject(new ConflictException('Ya existe un usuario con este email'));
              return;
            }

            const passwordHash = await argon2.hash(dto.password);

            const user = await client.user.create({
              data: {
                email: dto.email,
                passwordHash,
                role: UserRole.SUPER_ADMIN,
                emailVerified: true,
              },
              select: {
                id: true,
                email: true,
                role: true,
                createdAt: true,
              },
            });

            this.logger.log(`Super Admin creado: ${user.email}`);

            resolve({
              message: 'Super Admin creado exitosamente',
              user,
              // Informamos el subdominio que debe usar para login
              loginSubdomain: 'admin',
            });
          } catch (error) {
            reject(error);
          }
        },
      );
    });
  }

  async getProfile(userId: string) {
    const client = this.tenantPrisma.getClient();

    const user = await client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const client = this.tenantPrisma.getClient();

    const user = await client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verificamos que el nuevo email no esté en uso
    if (dto.email && dto.email !== user.email) {
      const emailEnUso = await client.user.findUnique({
        where: { email: dto.email },
      });

      if (emailEnUso) {
        throw new ConflictException('El email ya está en uso');
      }
    }

    // Si quiere cambiar la contraseña verificamos la actual
    let passwordHash: string | undefined;

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new UnauthorizedException(
          'Debes ingresar tu contraseña actual para cambiarla',
        );
      }

      const passwordValido = await argon2.verify(
        user.passwordHash,
        dto.currentPassword,
      );

      if (!passwordValido) {
        throw new UnauthorizedException('La contraseña actual es incorrecta');
      }

      passwordHash = await argon2.hash(dto.newPassword);
    }

    const data: any = {};

    if (dto.email) {
      data.email = dto.email;
      // Si cambia el email necesita verificarlo de nuevo
      data.emailVerified = false;
    }

    if (passwordHash) {
      data.passwordHash = passwordHash;
      // Invalidamos todos los refresh tokens al cambiar contraseña
      await client.refreshToken.deleteMany({ where: { userId } });
    }

    const usuarioActualizado = await client.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        twoFactorEnabled: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Perfil actualizado: ${usuarioActualizado.email}`);

    return {
      message: 'Perfil actualizado exitosamente',
      user: usuarioActualizado,
    };
  }
}
