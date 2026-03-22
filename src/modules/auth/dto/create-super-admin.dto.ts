import { IsString, IsNotEmpty } from 'class-validator';
import { CreateAuthDto } from './create-auth.dto';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSuperAdminDto extends CreateAuthDto {
    @ApiProperty({
        description: 'Clave de bootstrap definida en las variables de entorno',
        example: 'clave-secreta-de-super-usuario',
    })
    @IsString()
    @IsNotEmpty()
    bootstrapSecret: string;
}