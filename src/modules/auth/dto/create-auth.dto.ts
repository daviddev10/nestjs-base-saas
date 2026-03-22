import { ApiProperty } from '@nestjs/swagger';
import {
    IsEmail,
    IsNotEmpty,
    IsString,
    MinLength,
    MaxLength,
    Matches,
} from 'class-validator';

export class CreateAuthDto {
    @ApiProperty({
        example: 'admin@acme.com',
        description: 'Email del usuario',
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    /**
     * La contraseña debe tener al menos:
     * - 8 caracteres
     * - Una letra mayúscula
     * - Una letra minúscula
     * - Un número
     * - Un carácter especial
     */
    @ApiProperty({
        example: 'MiPassword123!',
        description:
            'Contraseña. Mínimo 8 caracteres, debe incluir mayúscula, ' +
            'minúscula, número y carácter especial.',
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
    password: string;
}