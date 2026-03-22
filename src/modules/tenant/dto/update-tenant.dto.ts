import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateTenantDto } from './create-tenant.dto';

/**
 * PartialType → hace todos los campos opcionales.
 * OmitType → excluye 'subdomain' porque no se puede cambiar
 * una vez creado — cambiaría la URL de todos los usuarios.
 */
export class UpdateTenantDto extends PartialType(
    OmitType(CreateTenantDto, ['subdomain'] as const),
) { }