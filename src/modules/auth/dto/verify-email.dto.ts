import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyEmailDto {
    @ApiProperty({
        description: 'Token de verificación recibido por email',
        example: 'a3f2c1...',
    })
    @IsString()
    @IsNotEmpty()
    token: string;
}