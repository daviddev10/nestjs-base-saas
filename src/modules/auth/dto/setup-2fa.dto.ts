import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

export class Verify2FADto {
    @ApiProperty({
        example: '123456',
        description: 'Código de 6 dígitos generado por Google Authenticator',
    })
    @IsString()
    @IsNotEmpty()
    @Length(6, 6, { message: 'El código debe tener exactamente 6 dígitos' })
    code: string;
}