import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    MinLength,
    MaxLength,
    Matches,
} from 'class-validator';

export class ResetPasswordDto {
    @ApiProperty({
        description: 'Token de reset recibido por email',
    })
    @IsString()
    @IsNotEmpty()
    token: string;

    @ApiProperty({
        example: 'NuevoPassword123!',
        description: 'Nueva contraseña',
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @MaxLength(50)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
        message:
            'La contraseña debe incluir al menos una mayúscula, una minúscula, ' +
            'un número y un carácter especial (@$!%*?&)',
    })
    newPassword: string;
}