import { IsEmail, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class UpdateProfileDto {

    @IsEmail()
    @IsOptional()
    email?: string;


    @IsString()
    @IsOptional()
    @MinLength(8)
    @MaxLength(50)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
        message:
            'La contraseña debe incluir al menos una mayúscula, una minúscula, ' +
            'un número y un carácter especial (@$!%*?&)',
    })
    newPassword?: string;

    /**
     * Para cambiar la contraseña pedimos la actual como confirmación.
     * Esto evita que alguien con una sesión robada cambie la contraseña.
     */

    @IsString()
    @IsOptional()
    currentPassword?: string;
}