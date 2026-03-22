import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { IJwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateUserDto } from './dto/create-user.dto';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
// Solo CHURCH_ADMIN puede gestionar usuarios de su iglesia
@Roles(UserRole.CHURCH_ADMIN)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear un usuario',
    description:
      'El CHURCH_ADMIN crea un usuario directamente. ' +
      'El email queda verificado automáticamente.',
  })
  @ApiCreatedResponse({ description: 'Usuario creado exitosamente' })
  @ApiConflictResponse({ description: 'El email ya está en uso' })
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  /** Listar todos los usuarios */
  @Get()
  findAll() {
    return this.userService.findAll();
  }

  /** Obtener un usuario por ID */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar rol de un usuario',
    description: 'Permite cambiar el rol de un usuario dentro de la iglesia.',
  })
  @ApiOkResponse({ description: 'Usuario actualizado exitosamente' })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado' })
  @ApiForbiddenResponse({ description: 'No tienes permisos para esta acción' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser: IJwtPayload,
  ) {
    return this.userService.update(id, dto, currentUser.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Desactivar un usuario',
    description:
      'Soft delete — marca el usuario como inactivo e invalida sus sesiones. ' +
      'Se puede reactivar posteriormente.',
  })
  @ApiOkResponse({ description: 'Usuario desactivado exitosamente' })
  @ApiForbiddenResponse({ description: 'No tienes permisos para esta acción' })
  deactivate(
    @Param('id') id: string,
    @CurrentUser() currentUser: IJwtPayload,
  ) {
    return this.userService.deactivate(id, currentUser.sub);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Reactivar un usuario desactivado' })
  @ApiOkResponse({ description: 'Usuario activado exitosamente' })
  activate(@Param('id') id: string) {
    return this.userService.activate(id);
  }
}
