import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
    @ApiProperty({
        example: 'secretario@bethel.com',
        description: 'Email del nuevo usuario',
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        example: 'Password123!',
        description: 'Contraseña inicial del usuario',
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

    @ApiPropertyOptional({
        enum: [UserRole.ADMIN, UserRole.EDITOR],
        example: UserRole.EDITOR,
        description: 'Rol del usuario. Por defecto: EDITOR',
    })
    @IsEnum([UserRole.ADMIN, UserRole.EDITOR])
    @IsOptional()
    role?: UserRole;
}