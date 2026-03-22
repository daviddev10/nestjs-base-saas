import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { DatabaseModule } from 'src/database/database.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    DatabaseModule,
    // PassportModule → habilita el sistema de estrategias de Passport
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // JwtModule.register({}) sin configuración aquí porque
    // cada llamada a jwtService.signAsync() usa su propio secret
    // y expiración definidos en el AuthService
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule { }
