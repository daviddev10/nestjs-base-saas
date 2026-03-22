# NestJS SaaS Base

Production-ready boilerplate para construir aplicaciones SaaS multitenancy con NestJS.

## Stack tecnológico

- **NestJS** + TypeScript — framework backend
- **Prisma** + PostgreSQL (Supabase) — ORM y base de datos
- **Multitenancy** schema-per-tenant con AsyncLocalStorage
- **Auth completo** — JWT, refresh tokens, verificación email, 2FA (TOTP), recuperación de contraseña
- **Swagger** — documentación interactiva con login rápido integrado
- **Resend** — envío de emails transaccionales

---

## Requisitos previos

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Cuenta en [Supabase](https://supabase.com) (gratuita)
- Cuenta en [Resend](https://resend.com) (gratuita)

---

## Instalación

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/nestjs-saas-base.git mi-proyecto
cd mi-proyecto
```

### 2. Instalar dependencias
```bash
pnpm install
```

### 3. Configurar variables de entorno
```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:
```bash
# ─── App ───────────────────────────────────────────────
NODE_ENV=development
PORT=3000

# ─── Base de datos ─────────────────────────────────────
# Supabase → Settings → Database → Connection string (URI)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres

# ─── JWT ───────────────────────────────────────────────
# Genera con: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_ACCESS_SECRET=genera_un_string_aleatorio_seguro_minimo_32_caracteres
JWT_REFRESH_SECRET=genera_otro_string_aleatorio_diferente_al_anterior
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ─── Email (Resend) ────────────────────────────────────
# Resend → API Keys → Create API Key
MAIL_HOST=smtp.resend.com
MAIL_PORT=465
MAIL_USER=resend
MAIL_PASS=re_xxxxxxxxxxxx
MAIL_FROM=onboarding@resend.dev

# ─── Supabase Storage ──────────────────────────────────
# Supabase → Settings → API
SUPABASE_URL=https://[REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# ─── Bootstrap ─────────────────────────────────────────
# Clave para crear el primer Super Admin — cámbiala en producción
BOOTSTRAP_SECRET=cambia_esto_en_produccion
```

### 4. Configurar Supabase

1. Ve a [supabase.com](https://supabase.com) y crea un proyecto
2. En **Settings → Database** copia el **Connection string (URI)**
3. Pégalo en `DATABASE_URL` de tu `.env`
4. En **Settings → API** copia la **service_role key**
5. Pégala en `SUPABASE_SERVICE_ROLE_KEY`

### 5. Ejecutar migraciones
```bash
# Genera el cliente TypeScript de Prisma
npx prisma generate

# Crea las tablas en Supabase
npx prisma migrate dev --name init
```

### 6. Iniciar en desarrollo
```bash
pnpm run start:dev
```

El servidor levanta en `http://localhost:3000`

Swagger disponible en `http://localhost:3000/docs`

---

## Onboarding desde cero

Sigue estos pasos en orden la primera vez que inicias el proyecto.

### Paso 1 — Crear el Super Admin

El Super Admin es el dueño del SaaS. Se crea una sola vez usando la clave de bootstrap.
```http
POST http://localhost:3000/api/v1/auth/bootstrap/super-admin
Content-Type: application/json

{
  "email": "superadmin@miapp.com",
  "password": "SuperAdmin123!",
  "bootstrapSecret": "cambia_esto_en_produccion"
}
```

Esto crea automáticamente:
- El tenant reservado `admin` en la base de datos
- El schema `tenant_admin` en Postgres
- El usuario Super Admin dentro de ese schema

### Paso 2 — Login como Super Admin
```http
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json
X-Tenant-Subdomain: admin

{
  "email": "superadmin@miapp.com",
  "password": "SuperAdmin123!"
}
```

Copia el `accessToken` de la respuesta.

### Paso 3 — Crear el primer tenant (empresa/organización)
```http
POST http://localhost:3000/api/v1/tenants
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "company",
  "subdomain": "company",
  "email": "admin@company.com",
  "currency": "BOB",
  "timezone": "America/La_Paz"
}
```

Esto crea automáticamente el schema `tenant_bethel` en Postgres.

### Paso 4 — Crear el Admin del tenant
```http
POST http://localhost:3000/api/v1/users
Authorization: Bearer <accessToken>
Content-Type: application/json
X-Tenant-Subdomain: bethel

{
  "email": "admin@bethel.com",
  "password": "admin123!",
  "role": "CHURCH_ADMIN"
}
```

### Paso 5 — Login como Admin del tenant
```http
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json
X-Tenant-Subdomain: bethel

{
  "email": "admin@bethel.com",
  "password": "admin123!"
}
```

A partir de aquí el Admin puede gestionar su propio tenant.

---

## Probar con Swagger

1. Abre `http://localhost:3000/docs`
2. Usa el panel **"Login rápido"** en la esquina superior derecha
3. Ingresa el subdominio, email y contraseña
4. Haz clic en **"Iniciar sesión"** — el token se aplica automáticamente

---

## Endpoints disponibles

### Auth
| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| POST | `/auth/bootstrap/super-admin` | Público | Crear Super Admin (primera vez) |
| POST | `/auth/register` | Público | Auto-registro de usuario |
| POST | `/auth/login` | Público | Iniciar sesión |
| POST | `/auth/refresh` | Público | Renovar access token |
| POST | `/auth/logout` | Autenticado | Cerrar sesión |
| GET  | `/auth/me` | Autenticado | Ver perfil propio |
| PATCH | `/auth/me` | Autenticado | Actualizar perfil |
| POST | `/auth/verify-email` | Público | Verificar email |
| POST | `/auth/resend-verify-email` | Autenticado | Reenviar verificación |
| POST | `/auth/forgot-password` | Público | Solicitar reset de contraseña |
| POST | `/auth/reset-password` | Público | Restablecer contraseña |
| POST | `/auth/2fa/setup` | Autenticado | Iniciar setup de 2FA |
| POST | `/auth/2fa/confirm` | Autenticado | Activar 2FA |
| POST | `/auth/2fa/verify` | Público | Verificar código 2FA en login |
| POST | `/auth/2fa/disable` | Autenticado | Desactivar 2FA |

### Tenants (Solo SUPER_ADMIN)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/tenants` | Listar todos los tenants |
| POST | `/tenants` | Crear nuevo tenant |
| GET | `/tenants/:id` | Ver detalle de un tenant |
| PATCH | `/tenants/:id` | Actualizar datos del tenant |
| DELETE | `/tenants/:id` | Desactivar tenant (soft delete) |
| PATCH | `/tenants/:id/activate` | Reactivar tenant |

### Users (Solo CHURCH_ADMIN)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/users` | Listar usuarios del tenant |
| POST | `/users` | Crear usuario |
| GET | `/users/:id` | Ver detalle de un usuario |
| PATCH | `/users/:id` | Actualizar rol del usuario |
| DELETE | `/users/:id` | Desactivar usuario (soft delete) |
| PATCH | `/users/:id/activate` | Reactivar usuario |

---

## Roles del sistema

| Rol | Descripción | Acceso |
|-----|-------------|--------|
| `SUPER_ADMIN` | Dueño del SaaS | Todo — gestiona todos los tenants |
| `CHURCH_ADMIN` | Admin del tenant | Todo dentro de su tenant |
| `SECRETARY` | Editor | Crear y editar, no eliminar |

---

## Estructura del proyecto
```
src/
├── config/
│   ├── env.config.ts          # Namespaces de configuración tipada
│   ├── env.validation.ts      # Validación con Joi al arrancar
│   ├── swagger.config.ts      # Configuración de Swagger UI
│   └── index.ts
├── common/
│   ├── decorators/
│   │   └── tenant.decorator.ts   # @CurrentTenant()
│   └── middleware/
│       └── tenant.middleware.ts  # Resuelve tenant por subdominio
├── database/
│   ├── prisma.service.ts          # Cliente schema public
│   ├── tenant-prisma.service.ts   # Cliente dinámico por tenant
│   ├── tenant-context.ts          # AsyncLocalStorage
│   └── database.module.ts
└── modules/
    ├── auth/
    │   ├── decorators/   # @Public(), @CurrentUser(), @Roles()
    │   ├── dto/          # RegisterDto, LoginDto, etc.
    │   ├── guards/       # JwtAuthGuard, RolesGuard
    │   ├── interfaces/   # IJwtPayload
    │   ├── strategies/   # JwtStrategy
    │   └── templates/    # Emails Handlebars
    ├── mail/             # MailService con Resend
    ├── tenant/           # CRUD de tenants
    └── user/             # CRUD de usuarios por tenant
```

---

## Agregar tu dominio de negocio

### 1. Agregar modelos al schema de Prisma

Edita `prisma/schema.prisma` y agrega tus modelos dentro del schema `tenant_template`:
```prisma
model Product {
  id        String   @id @default(uuid())
  name      String
  price     Decimal  @db.Decimal(10, 2)
  createdAt DateTime @default(now()) @map("created_at")

  @@map("products")
  @@schema("tenant_template")
}
```

### 2. Ejecutar migración
```bash
npx prisma migrate dev --name add-products
npx prisma generate
```

### 3. Crear el módulo
```bash
nest generate module modules/product
nest generate controller modules/product
nest generate service modules/product
```

### 4. Usar TenantPrismaService en tu servicio
```typescript
@Injectable()
export class ProductService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async findAll() {
    // getClient() devuelve el cliente del tenant actual
    // resuelto automáticamente por el TenantMiddleware
    const client = this.tenantPrisma.getClient();
    return client.product.findMany();
  }
}
```

### 5. Registrar en AppModule
```typescript
@Module({
  imports: [
    // ...módulos existentes...
    ProductModule,
  ],
})
export class AppModule {}
```

---

## Multitenancy — cómo funciona
```
Request: GET bethel.miapp.com/api/v1/members
                    ↓
         TenantMiddleware lee el subdominio 'bethel'
                    ↓
         Busca en public.tenants donde subdomain = 'bethel'
                    ↓
         Almacena { schemaName: 'tenant_bethel', tenantId: '...' }
         en AsyncLocalStorage para este request
                    ↓
         TenantPrismaService.getClient() lee el AsyncLocalStorage
         y devuelve un PrismaClient apuntando a tenant_bethel
                    ↓
         Todas las queries van a tenant_bethel.members
         sin pasar parámetros manualmente
```

En desarrollo usa el header `X-Tenant-Subdomain: bethel` en lugar del subdominio real.

---

## Despliegue en Railway

### 1. Crear proyecto en Railway
```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Crear proyecto
railway init
```

### 2. Configurar variables de entorno

En el dashboard de Railway agrega todas las variables de tu `.env` con `NODE_ENV=production`.

### 3. Desplegar
```bash
railway up
```

Railway detecta automáticamente el proyecto NestJS y lo despliega.

---

## Variables de entorno — referencia completa

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `NODE_ENV` | Sí | `development` o `production` |
| `PORT` | No | Puerto del servidor. Default: `3000` |
| `DATABASE_URL` | Sí | URL de conexión a Postgres |
| `JWT_ACCESS_SECRET` | Sí | Secret para firmar access tokens (min 32 chars) |
| `JWT_REFRESH_SECRET` | Sí | Secret para firmar refresh tokens (min 32 chars) |
| `JWT_ACCESS_EXPIRES_IN` | No | Expiración del access token. Default: `15m` |
| `JWT_REFRESH_EXPIRES_IN` | No | Expiración del refresh token. Default: `7d` |
| `MAIL_HOST` | Sí | Host SMTP del proveedor de email |
| `MAIL_PORT` | No | Puerto SMTP. Default: `587` |
| `MAIL_USER` | Sí | Usuario SMTP |
| `MAIL_PASS` | Sí | Contraseña o API key SMTP |
| `MAIL_FROM` | Sí | Email remitente |
| `SUPABASE_URL` | Sí | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Service role key de Supabase |
| `BOOTSTRAP_SECRET` | Sí | Clave para crear el primer Super Admin |

---

## Licencia

MIT