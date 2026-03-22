import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
    @ApiProperty({
        example: 'danieldavid.dev@gmail.com',
        description: 'Email del usuario',
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        example: 'DanielDavid0005!',
        description: 'Contraseña del usuario',
    })
    @IsString()
    @IsNotEmpty()
    password: string;
}