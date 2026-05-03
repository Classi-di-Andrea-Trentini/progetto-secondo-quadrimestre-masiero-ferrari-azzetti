# Backend Architecture

## Entry point — main.ts

`server/src/main.ts` is the first file executed when the backend starts. Its only job is to create the NestJS application, wire up global middleware and configuration, and call `app.listen()`. Nothing that belongs to a specific feature lives here.

```typescript
const app = await NestFactory.create(AppModule);
app.use(helmet());
app.use(cookieParser());
app.enableCors({ origin: process.env.FRONTEND_URL, credentials: true, ... });
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, ... }));
await app.listen(process.env.PORT ?? 3000);
```

### helmet

`helmet()` is Express middleware that sets a collection of HTTP response headers that browsers use to block common attack vectors. Examples of what it sets: `Content-Security-Policy` (controls which scripts, images and frames can load), `X-Frame-Options: SAMEORIGIN` (prevents the page from being embedded in an iframe on another site), `X-Content-Type-Options: nosniff` (stops the browser from guessing MIME types), `Strict-Transport-Security` (in production, forces HTTPS). Applied as the very first middleware so it affects every response including error responses.

### cookie-parser

NestJS is built on Express. Without `cookie-parser`, `req.cookies` is undefined. The JWT authentication strategy reads the `access_token` cookie from `req.cookies`, so if this middleware is missing, every authenticated request gets a 401. Applied before the NestJS routing layer.

### CORS

Configured with `credentials: true`, which allows the browser to send cookies in cross-origin requests. Without this flag, the browser refuses to include cookies even if `withCredentials: true` is set on the Angular `HttpClient` call. The `origin` is restricted to the `FRONTEND_URL` environment variable, so the backend will not respond to credentialed requests from any other domain. In development this is `http://localhost:4200`.

### ValidationPipe

The global validation pipe intercepts every incoming request body before it reaches a controller method. It uses the DTO class and its `class-validator` decorators to validate and transform the incoming data.

- `whitelist: true` — strips any property not declared in the DTO. If a client sends `{ email: "x", role: "admin" }` and the DTO only has `email`, the `role` field is silently removed before the controller sees it. This prevents mass assignment attacks.
- `forbidNonWhitelisted: true` — instead of silently stripping, throws a `400 Bad Request` if an unknown field is present. More strict than whitelist alone.
- `transform: true` — converts incoming values to the TypeScript types declared in the DTO. A query string parameter is always a string in HTTP; with `transform: true`, a `@Type(() => Number)` decorated field gets converted to a number automatically. Without this, `page: "2"` would be passed to Prisma's `skip` as the string `"2"`, causing incorrect results.

---

## AppModule — app.module.ts

The root module composes the entire application. NestJS reads it when building the dependency injection container. Every module imported here becomes part of the application.

### ConfigModule

`ConfigModule.forRoot({ isGlobal: true })` loads the `.env` file and makes `process.env` available everywhere. `isGlobal: true` means no other module needs to import `ConfigModule` to access environment variables — they are available through `process.env` in every service. In practice the codebase reads env vars directly from `process.env` rather than through the injected `ConfigService`.

### ThrottlerModule

Rate limiting applied globally. Configured as 100 requests per 60 seconds per IP address.

```typescript
ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])
```

The `ThrottlerGuard` is registered as an `APP_GUARD` in the providers array. An `APP_GUARD` is applied to every route in the application automatically, without needing `@UseGuards()` on each controller. Individual routes can override the default limits with the `@Throttle()` decorator — the auth controller uses this to apply stricter limits (5 registrations per 15 minutes, 10 logins per 15 minutes) because login and register endpoints are typical targets for brute-force attacks.

### PrismaModule and MailModule

Both are marked `@Global()` in their own module files and both `exports` their service. A global module in NestJS means its exports are available in the entire application injection context without needing to import the module again in each feature module. This is why `AddressesModule`, `OrdersModule`, etc. do not list `PrismaModule` in their `imports` — `PrismaService` is just injected in their service constructors and NestJS resolves it.

---

## PrismaService — prisma/prisma.service.ts

```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const adapter = new PrismaPg({ connectionString: buildConnectionString() });
    super({ adapter });
  }
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
```

`PrismaService extends PrismaClient` is the standard approach. Because it inherits `PrismaClient`, every model accessor is available on the service instance: `this.prisma.user`, `this.prisma.product`, `this.prisma.order`, and so on. IDE autocompletion works fully on these because Prisma generates typed accessors from the schema.

`OnModuleInit` and `OnModuleDestroy` are NestJS lifecycle hooks. `$connect()` is called when the module initialises, establishing the connection pool. `$disconnect()` is called on shutdown to cleanly close all connections. Without these hooks, the connection would be established lazily on the first query and never explicitly closed.

`buildConnectionString()` has a fallback that assembles a Postgres URL from individual `DB_HOST`, `DB_PORT`, etc. variables if `DATABASE_URL` is not set. Inside Docker Compose, `DATABASE_URL` is always set so the fallback only matters when running the backend locally outside of Docker.

The `PrismaPg` adapter from `@prisma/adapter-pg` is the driver-adapter approach introduced in Prisma 5, replacing the older native binary binding. It uses the `pg` npm package as the underlying Postgres client.

---

## Module and file conventions

Every feature follows a strict three-layer structure:

```
feature/
├── feature.module.ts      NestJS module: registers controller and provider
├── feature.controller.ts  HTTP layer: routing, extracting req.user, delegating
├── feature.service.ts     business logic and all Prisma queries
└── dto/
    └── *.dto.ts           request body shapes with class-validator decorators
```

### Controller responsibilities

Controllers have one job: translate an HTTP request into a service call. They extract the route parameters and query strings, pull the authenticated user from `req.user` (which is injected by the JWT strategy after authentication), and call the service. They do not contain conditionals, database queries, or calculations.

```typescript
@Get(':id')
findOne(@Req() req: any, @Param('id') id: string) {
  return this.svc.findOne(req.user.id, id);  // two lines total
}
```

The return value from the service is serialised to JSON automatically by NestJS/Express. No manual `res.json()` calls are needed.

### Service responsibilities

Services contain all the business logic. They receive plain values (strings, numbers, DTOs) and return plain objects or throw NestJS HTTP exceptions (`NotFoundException`, `ForbiddenException`, `BadRequestException`). NestJS catches these exceptions and maps them to the appropriate HTTP status codes automatically.

Services never import `Request`, `Response`, or any HTTP concept. This makes them easy to test in isolation.

### DTO classes

DTOs are plain TypeScript classes with `class-validator` decorators. The global `ValidationPipe` reads these decorators to validate incoming request bodies before the controller method is called. If validation fails, a `400 Bad Request` is returned automatically with a `message` array listing every failed field. Example:

```typescript
export class CreateAddressDto {
  @IsString()
  @MaxLength(255)
  street: string;

  @IsString()
  @MaxLength(100)
  city: string;

  @IsPostalCode('IT')
  postalCode: string;
}
```

---

## Authentication guard — JwtAuthGuard

```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

Applied with `@UseGuards(JwtAuthGuard)` at controller or method level. When the guard runs, it calls the Passport `jwt` strategy (`JwtStrategy`). The strategy extracts the token from the `access_token` cookie, verifies the JWT signature using `JWT_SECRET`, decodes the payload, and calls `AuthService.validateSession()` to confirm the session row still exists in the database.

If everything passes, the user object returned by `validateSession()` is attached to `req.user`. If the token is missing, expired, or the session no longer exists, the guard throws a `401 Unauthorized` automatically.

The guard does not check user roles. There is no `@Roles()` decorator. Admin access restrictions in the admin area (when implemented) will need to be enforced manually in service methods by checking `req.user.role === 'admin'` or by creating a separate `AdminGuard`.

### Why a database check on every request

Purely JWT-based auth is stateless — the server only needs to verify the signature. But that means there is no way to invalidate a token before it expires. If a user logs out or changes their password, an attacker holding a stolen token could continue making requests until it expires (up to 7 days).

By storing sessions in the database and checking the session row on every request, the server can invalidate a session immediately by deleting the row. Logout deletes the row. Password change deletes all rows except the current session. The JWT is just a signed carrier for the `sessionId` — the authoritative check is the database lookup.

The cost is one extra database query per authenticated request. For this application's scale this is entirely acceptable.
