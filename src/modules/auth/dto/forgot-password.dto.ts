import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
    @ApiProperty({
        example: 'pastor@iglesiabethel.com',
        description: 'Email de la cuenta a recuperar',
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;
}