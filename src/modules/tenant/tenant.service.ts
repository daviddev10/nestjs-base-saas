import { ConflictException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { PrismaService } from 'src/database/prisma.service';
import { TenantPrismaService } from 'src/database/tenant-prisma.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    // PrismaService → para operaciones en el schema 'public'
    private readonly prisma: PrismaService,
    // TenantPrismaService → para provisionar el nuevo schema
    private readonly tenantPrisma: TenantPrismaService,
  ) { }

  async create(dto: CreateTenantDto) {
    // Verificamos que el subdominio no esté en uso
    const existente = await this.prisma.tenant.findUnique({
      where: { subdomain: dto.subdomain },
    });

    if (existente) {
      throw new ConflictException(
        `El subdominio '${dto.subdomain}' ya está en uso`,
      );
    }

    /**
     * Generamos el nombre del schema a partir del subdominio.
     * Reemplazamos guiones por underscores porque Postgres
     * no acepta guiones en nombres de schema sin comillas.
     *
     * Ejemplo: 'iglesia-bethel' → 'iglesia_bethel'
     */
    const schemaName = `iglesia_${dto.subdomain.replace(/-/g, '_')}`;

    try {
      /**
       * Usamos una transacción para garantizar consistencia:
       * Si el provisionamiento del schema falla, el registro
       * del tenant en la BD también se revierte.
       * No queremos un tenant registrado sin su schema.
       */
      const tenant = await this.prisma.$transaction(async (tx) => {
        // 1. Creamos el registro del tenant en public.tenants
        const nuevoTenant = await tx.tenant.create({
          data: {
            name: dto.name,
            subdomain: dto.subdomain,
            schemaName,
            email: dto.email,
            address: dto.address,
            phone: dto.phone,
            currency: dto.currency ?? 'BOB',
            timezone: dto.timezone ?? 'America/La_Paz',
          },
        });

        this.logger.log(
          `Tenant registrado: ${nuevoTenant.name} (${nuevoTenant.subdomain})`,
        );

        return nuevoTenant;
      });

      // 2. Provisionamos el schema DESPUÉS de que el tenant
      //    esté confirmado en la BD (fuera de la transacción)
      await this.tenantPrisma.provisionSchema(schemaName);

      return tenant;
    } catch (error) {
      // Si es un error que ya manejamos lo relanzamos
      if (error instanceof ConflictException) throw error;

      this.logger.error(
        `Error al crear tenant '${dto.subdomain}': ${error.message}`,
        error.stack,
      );

      throw new InternalServerErrorException(
        'Ocurrió un error al registrar la iglesia. Por favor intenta nuevamente.',
      );
    }
  }

  async findBySubdomain(subdomain: string) {
    return this.prisma.tenant.findUnique({
      where: { subdomain },
    });
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        subdomain: true,
        schemaName: true,
        email: true,
        address: true,
        phone: true,
        // logoUrl: true,
        currency: true,
        timezone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        subscriptions: {
          select: {
            id: true,
            status: true,
            startsAt: true,
            endsAt: true,
            plan: {
              select: { name: true, price: true, maxMembers: true },
            },
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Iglesia con id '${id}' no encontrada`);
    }

    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id);

    // Verificamos que el email no esté en uso por otro tenant
    if (dto.email) {
      const emailEnUso = await this.prisma.tenant.findFirst({
        where: {
          email: dto.email,
          // Excluimos el tenant actual de la búsqueda
          NOT: { id },
        },
      });

      if (emailEnUso) {
        throw new ConflictException('El email ya está en uso por otra iglesia');
      }
    }

    const tenantActualizado = await this.prisma.tenant.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        address: dto.address,
        phone: dto.phone,
        currency: dto.currency,
        timezone: dto.timezone,
      },
      select: {
        id: true,
        name: true,
        subdomain: true,
        email: true,
        address: true,
        phone: true,
        currency: true,
        timezone: true,
        isActive: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Tenant actualizado: ${tenantActualizado.name}`);

    return tenantActualizado;
  }

  async deactivate(id: string) {
    const tenant = await this.findOne(id);

    if (!tenant.isActive) {
      throw new ConflictException('La iglesia ya está desactivada');
    }

    await this.prisma.tenant.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`Tenant desactivado: ${tenant.name}`);

    return { message: `Iglesia '${tenant.name}' desactivada exitosamente` };
  }

  async activate(id: string) {
    const tenant = await this.findOne(id);

    if (tenant.isActive) {
      throw new ConflictException('La iglesia ya está activa');
    }

    await this.prisma.tenant.update({
      where: { id },
      data: { isActive: true },
    });

    this.logger.log(`Tenant activado: ${tenant.name}`);

    return { message: `Iglesia '${tenant.name}' activada exitosamente` };
  }
}
