import { Controller, Get, Post, Body, HttpStatus, HttpCode, Param, Patch, Delete } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@ApiTags('Tenants')
// ApiBearerAuth → indica a Swagger que estos endpoints requieren JWT
@ApiBearerAuth('JWT-auth')
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) { }

  /**
   * @summary Registrar una nueva organización
   * @description Crea el tenant en la BD y provisiona su schema en Postgres. Solo accesible por el Super Admin.
   */
  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTenantDto) {
    return this.tenantService.create(dto);
  }

  /**
   * @summary Listar todos los tenants
   * @description Retorna todos los tenants registrados en el SaaS.
   */
  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  findAll() {
    return this.tenantService.findAll();
  }

  /**
   * @summary Obtener un tenant por ID
   * @description Retorna los datos completos de un tenant específico.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantService.findOne(id);
  }

  /**
   * @summary Actualizar datos de un tenant
   * @description Actualiza la información de un tenant específico.
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantService.update(id, dto);
  }

  /**
   * @summary Desactivar un tenant
   * @description Marca el tenant como inactivo. Los datos se conservan y se puede reactivar.
   */
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.tenantService.deactivate(id);
  }

  /**
   * @summary Reactivar un tenant desactivado
   * @description Marca el tenant como activo. Los datos se conservan y se puede desactivar.
   */
  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.tenantService.activate(id);
  }
}
