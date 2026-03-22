import { Controller, Post, Body, HttpCode, HttpStatus, Get, Patch } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import type { IJwtPayload } from './interfaces/jwt-payload.interface';
import { ForgotPasswordDto, ResetPasswordDto, UpdateProfileDto, Verify2FADto, Verify2FALoginDto, VerifyEmailDto } from './dto';
import { CreateSuperAdminDto } from './dto/create-super-admin.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  /**
   * @summary Registrar un nuevo usuario
   * @description Registra un usuario en el tenant actual (iglesia). El tenant se determina automáticamente por el subdominio.
   */
  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: CreateAuthDto) {
    return this.authService.register(dto);
  }

  /**
   * @summary Obtener perfil del usuario autenticado
   */
  @Get('login-user')
  @ApiBearerAuth('JWT-auth')
  getProfile(@CurrentUser() user: IJwtPayload) {
    return this.authService.getProfile(user.sub);
  }

  /**
   * @summary Actualizar perfil del usuario autenticado
   */
  @Patch('login-user')
  @ApiBearerAuth('JWT-auth')
  updateProfile(
    @CurrentUser() user: IJwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.sub, dto);
  }

  /**
   * @summary Iniciar sesión
   */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Login exitoso. Retorna access y refresh tokens.' })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * @summary Renovar access token
   * @description Genera un nuevo par de tokens usando el refresh token. El refresh token usado queda invalidado (rotación).
   */
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Tokens renovados exitosamente' })
  @ApiUnauthorizedResponse({ description: 'Refresh token inválido o expirado' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  /**
   * @summary Cerrar sesión
   * @description Invalida todos los refresh tokens activos del usuario.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOkResponse({ description: 'Sesión cerrada exitosamente' })
  logout(@CurrentUser() user: IJwtPayload) {
    return this.authService.logout(user.sub);
  }

  /**
   * @summary Verificar email
   * @description Activa la cuenta usando el token recibido por email.
   */
  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Email verificado exitosamente' })
  @ApiUnauthorizedResponse({ description: 'Token inválido o expirado' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  /**
   * @summary Reenviar email de verificación
   * @description Genera un nuevo token y reenvía el email de verificación.
   */
  @Post('resend-verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOkResponse({ description: 'Email reenviado exitosamente' })
  resendVerifyEmail(@CurrentUser() user: IJwtPayload) {
    return this.authService.resendVerifyEmail(user.sub);
  }

  /**
   * @summary Solicitar recuperación de contraseña
   * @description Envía un email con enlace de reset. Siempre responde con el mismo mensaje para evitar enumeración de usuarios.
   */
  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Email enviado si la cuenta existe' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /**
   * @summary Restablecer contraseña
   * @description Cambia la contraseña usando el token recibido por email.
   */
  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Contraseña restablecida exitosamente' })
  @ApiUnauthorizedResponse({ description: 'Token inválido o expirado' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  /**
   * @summary Iniciar setup de 2FA
   * @description Genera un QR code para escanear con Google Authenticator. El 2FA no queda activo hasta confirmar con un código válido.
   */
  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOkResponse({ description: 'QR code generado' })
  setup2FA(@CurrentUser() user: IJwtPayload) {
    return this.authService.setup2FA(user.sub);
  }

  /**
   * @summary Confirmar y activar 2FA
   * @description Verifica el primer código TOTP para confirmar que Google Authenticator fue configurado correctamente.
   */
  @Post('2fa/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOkResponse({ description: '2FA activado exitosamente' })
  @ApiUnauthorizedResponse({ description: 'Código inválido' })
  confirm2FA(
    @CurrentUser() user: IJwtPayload,
    @Body() dto: Verify2FADto,
  ) {
    return this.authService.confirm2FA(user.sub, dto);
  }

  /**
   * @summary Verificar código 2FA durante el login
   * @description Se usa cuando el login devuelve requires2FA: true. Envía el tempToken recibido en el login junto con el código TOTP.
   */
  @Post('2fa/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Login completado. Retorna tokens definitivos.' })
  @ApiUnauthorizedResponse({ description: 'Token temporal o código 2FA inválido' })
  verify2FALogin(@Body() dto: Verify2FALoginDto) {
    return this.authService.verify2FALogin(dto.tempToken, dto);
  }



  /**
   * @summary Desactivar 2FA
   * @description Requiere el código TOTP actual para confirmar.
   */
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOkResponse({ description: '2FA desactivado exitosamente' })
  @ApiUnauthorizedResponse({ description: 'Código inválido' })
  disable2FA(
    @CurrentUser() user: IJwtPayload,
    @Body() dto: Verify2FADto,
  ) {
    return this.authService.disable2FA(user.sub, dto);
  }

  /**
   * @summary Crear Super Admin
   * @description Crea el primer Super Admin del SaaS. Requiere la clave de bootstrap definida en las variables de entorno.
   */
  @Post('super-admin')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  createSuperAdmin(@Body() dto: CreateSuperAdminDto) {
    return this.authService.createSuperAdmin(dto, dto.bootstrapSecret);
  }
}
