import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

export class Verify2FALoginDto {
    @ApiProperty({
        description: 'Token temporal recibido en el login cuando requires2FA es true',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    @IsString()
    @IsNotEmpty()
    tempToken: string;

    @ApiProperty({
        example: '123456',
        description: 'Código de 6 dígitos generado por Google Authenticator',
    })
    @IsString()
    @IsNotEmpty()
    @Length(6, 6, { message: 'El código debe tener exactamente 6 dígitos' })
    code: string;
}