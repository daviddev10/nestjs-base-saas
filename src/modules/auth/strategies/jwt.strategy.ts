import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { IJwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * JwtStrategy → Passport valida automáticamente el token JWT
 * en cada request que use el JwtAuthGuard.
 *
 * El flujo es:
 * 1. Extrae el token del header Authorization: Bearer <token>
 * 2. Verifica la firma con el accessSecret
 * 3. Verifica que no haya expirado
 * 4. Llama a validate() con el payload decodificado
 * 5. El resultado de validate() se inyecta en req.user
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(private readonly configService: ConfigService) {
        super({
            // Extrae el token del header Authorization: Bearer <token>
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            // Si el token expiró Passport lo rechaza automáticamente
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('jwt.accessSecret')!,
        });
    }

    /**
     * Se ejecuta después de que Passport verifica la firma y expiración.
     * Lo que retornamos aquí queda disponible como req.user en los controladores.
     */
    async validate(payload: IJwtPayload): Promise<IJwtPayload> {
        if (!payload.sub || !payload.tenantId) {
            throw new UnauthorizedException('Token inválido');
        }

        return payload;
    }
}