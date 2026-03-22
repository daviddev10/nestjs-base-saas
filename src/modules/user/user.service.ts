import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { TenantPrismaService } from 'src/database/tenant-prisma.service';
import { UserRole } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import * as argon2 from 'argon2';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly tenantPrisma: TenantPrismaService) { }

  async create(dto: CreateUserDto) {
    const client = this.tenantPrisma.getClient();

    const existente = await client.user.findUnique({
      where: { email: dto.email },
    });

    if (existente) {
      throw new ConflictException('Ya existe un usuario con este email');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await client.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role ?? UserRole.EDITOR,
        /**
         * Cuando un admin crea el usuario directamente
         * marcamos el email como verificado — el admin
         * es responsable de entregar las credenciales.
         */
        emailVerified: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    this.logger.log(`Usuario creado por admin: ${user.email} (${user.role})`);

    return user;
  }

  async findAll() {
    const client = this.tenantPrisma.getClient();

    return client.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
        twoFactorEnabled: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const client = this.tenantPrisma.getClient();

    const user = await client.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con id '${id}' no encontrado`);
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto, currentUserId: string) {
    const client = this.tenantPrisma.getClient();

    const user = await this.findOne(id);

    /**
     * Evitamos que un usuario se cambie su propio rol.
     * Solo otro admin puede cambiar el rol de un usuario.
     */
    if (id === currentUserId && dto.role) {
      throw new ForbiddenException('No puedes cambiar tu propio rol');
    }

    /**
     * Evitamos que se cambie el rol del único SUPER_ADMIN.
     * Siempre debe haber al menos un admin en el sistema.
     */
    if (user.role === UserRole.ADMIN && dto.role !== UserRole.ADMIN) {
      const admins = await client.user.count({
        where: { role: UserRole.ADMIN, isActive: true },
      });

      if (admins <= 1) {
        throw new ForbiddenException(
          'No puedes cambiar el rol del único administrador de la organización',
        );
      }
    }

    const usuarioActualizado = await client.user.update({
      where: { id },
      data: { role: dto.role },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    this.logger.log(
      `Rol actualizado: ${usuarioActualizado.email} → ${usuarioActualizado.role}`,
    );

    return usuarioActualizado;
  }

  async deactivate(id: string, currentUserId: string) {
    const client = this.tenantPrisma.getClient();

    const user = await this.findOne(id);

    // Un usuario no puede desactivarse a sí mismo
    if (id === currentUserId) {
      throw new ForbiddenException('No puedes desactivar tu propia cuenta');
    }

    if (!user.isActive) {
      throw new ForbiddenException('El usuario ya está desactivado');
    }

    // Verificamos que no sea el último admin activo
    if (user.role === UserRole.ADMIN) {
      const admins = await client.user.count({
        where: { role: UserRole.ADMIN, isActive: true },
      });

      if (admins <= 1) {
        throw new ForbiddenException(
          'No puedes desactivar al único administrador de la organización',
        );
      }
    }

    await client.user.update({
      where: { id },
      data: { isActive: false },
    });

    // Invalidamos todas las sesiones del usuario desactivado
    await client.refreshToken.deleteMany({ where: { userId: id } });

    this.logger.log(`Usuario desactivado: ${user.email}`);

    return { message: 'Usuario desactivado exitosamente' };
  }

  async activate(id: string) {
    const user = await this.findOne(id);
    const client = this.tenantPrisma.getClient();

    if (user.isActive) {
      throw new ForbiddenException('El usuario ya está activo');
    }

    await client.user.update({
      where: { id },
      data: { isActive: true },
    });

    this.logger.log(`Usuario activado: ${user.email}`);

    return { message: 'Usuario activado exitosamente' };
  }
}
