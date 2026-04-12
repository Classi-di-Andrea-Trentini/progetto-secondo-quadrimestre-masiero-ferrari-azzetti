# Backend Architecture

## Entry point — main.ts

`server/src/main.ts` is the bootstrap file. It creates the NestJS application, applies global middleware and configuration, and starts the HTTP server.

The middleware applied here affects every request:

**helmet** — sets a collection of security-related HTTP response headers (Content-Security-Policy, X-Frame-Options, etc.). It is applied as raw Express middleware via `app.use(helmet())`.

**cookie-parser** — required for reading the `access_token` HttpOnly cookie. Without this, `req.cookies` would be undefined and JWT authentication would break entirely.

**CORS** — configured to accept requests only from `FRONTEND_URL` (default `http://localhost:4200`), with `credentials: true` so the browser sends cookies cross-origin. The allowed methods cover everything the frontend uses.

**ValidationPipe** — applied globally. This is the pipe that enforces DTO validation across all controllers. `whitelist: true` silently strips any property that is not declared in the DTO class. `transform: true` automatically converts incoming query strings and body values to the types declared on the DTO (e.g. `"24"` becomes the number `24`). `forbidNonWhitelisted: true` goes one step further and throws a 400 if an undeclared property is present instead of just stripping it.

## AppModule — app.module.ts

The root module imports everything. Notable points:

**ConfigModule** — `@nestjs/config` loaded as global, which means `process.env` variables are available everywhere. The `.env` file at the project root is picked up automatically when `isGlobal: true`.

**ThrottlerModule** — global rate limiting. Configured as 100 requests per 60 seconds per IP. The `ThrottlerGuard` is registered as a global `APP_GUARD` in the `providers` array, so every route gets rate limiting by default. Individual controllers can override the limit using the `@Throttle()` decorator (as the auth controller does for login and register).

**PrismaModule** — declared `@Global()` in its own module file, which means any other module can inject `PrismaService` without explicitly importing `PrismaModule`. This is why you do not see `PrismaModule` in the `imports` array of feature modules.

**MailModule** — also declared `@Global()` for the same reason. `MailService` can be injected anywhere.

The rest of the imports are the feature modules, each self-contained with their own controller and service.

## PrismaService — prisma/prisma.service.ts

`PrismaService` extends `PrismaClient` directly, which is the standard NestJS + Prisma pattern. It implements `OnModuleInit` and `OnModuleDestroy` to manage the database connection lifecycle cleanly within the NestJS IoC container.

The constructor builds the connection string from environment variables. If `DATABASE_URL` is set, it uses that. Otherwise it assembles a URL from the individual `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` variables. Inside Docker Compose the `DATABASE_URL` is always set, so the fallback is only relevant when running the backend locally outside of Docker.

It uses `PrismaPg` from `@prisma/adapter-pg` as the driver adapter, which is the newer driver-adapter approach rather than the older native binding.

Because `PrismaService extends PrismaClient`, all Prisma model accessors (`this.prisma.user`, `this.prisma.product`, etc.) are available through the service instance.

## Module structure convention

Every feature follows the same pattern:

```
feature/
├── feature.module.ts      imports controller + service, no further config
├── feature.controller.ts  HTTP routing, extracts req.user, delegates to service
├── feature.service.ts     all business logic and Prisma queries
└── dto/
    └── *.dto.ts           class-validator decorated classes for request bodies
```

The controller's job is to receive the HTTP request, extract the authenticated user from `req.user` (injected by the JWT strategy), and call the appropriate service method. No business logic lives in controllers.

The service's job is to talk to Prisma and implement the rules (ownership checks, state validation, atomic transactions, etc.). Services never know about HTTP — they receive plain values and return plain objects.

DTOs use `class-validator` decorators (`@IsString()`, `@IsUUID()`, `@Min()`, etc.) combined with the global `ValidationPipe` to validate incoming request bodies automatically before the controller method is even called.

## Authentication guard — JwtAuthGuard

`JwtAuthGuard` is a thin wrapper around `AuthGuard('jwt')` from `@nestjs/passport`. Apply it to a controller or method with `@UseGuards(JwtAuthGuard)`.

When the guard runs, Passport calls `JwtStrategy.validate()`. That method takes the decoded JWT payload, calls `AuthService.validateSession()` with the `sub` (userId) and `sid` (sessionId) claims, verifies the session exists in the database and has not expired, and returns the user object. The returned value is attached to `req.user` and is available in every protected controller method.

The guard does not differentiate between user roles. Admin-only restrictions are handled manually in service methods by checking `req.user.role`.
