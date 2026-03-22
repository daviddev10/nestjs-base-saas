import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEmail, IsOptional, IsUrl, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateTenantDto {
    @ApiProperty({
        example: 'Iglesia Bethel',
        description: 'Nombre de la iglesia',
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @ApiProperty({
        example: 'bethel',
        description:
            'Subdominio único. Solo letras minúsculas, números y guiones. ' +
            'Se usará como bethel.miapp.com',
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(50)
    /**
     * El subdominio solo puede contener letras minúsculas, números y guiones.
     * No puede empezar ni terminar con guión.
     * Ejemplos válidos:   bethel, iglesia-gracia, church-1
     * Ejemplos inválidos: Bethel, iglesia_gracia, -church
     */
    @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message:
            'El subdominio solo puede contener letras minúsculas, números y guiones. No puede empezar ni terminar con guión.',
    })
    subdomain: string;

    @ApiProperty({
        example: 'admin@iglesiabethel.com',
        description: 'Email principal de la iglesia',
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        example: 'Calle Falsa 123, Ciudad, País',
        description: 'Dirección física de la iglesia',
    })
    @IsString()
    @IsOptional()
    @MaxLength(200)
    address?: string;

    @ApiProperty({
        example: '+57 312 345 6789',
        description: 'Teléfono de contacto de la iglesia',
    })
    @IsString()
    @IsOptional()
    @MaxLength(20)
    phone?: string;

    @ApiPropertyOptional({
        example: 'USD',
        description: 'Moneda principal (código ISO 4217). Por defecto: BOB',
        default: 'BOB',
    })
    @IsString()
    @IsOptional()
    @MaxLength(3)
    currency?: string;

    @ApiPropertyOptional({
        example: 'America/La_Paz',
        description: 'Zona horaria. Por defecto: America/La_Paz',
        default: 'America/La_Paz',
    })
    @IsString()
    @IsOptional()
    timezone?: string;
}