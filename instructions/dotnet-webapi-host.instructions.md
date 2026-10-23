---
description: 'ASP.NET Core host standard for .NET microservices: controllers, routing, API versioning, authorization policies, ProblemDetails error mapping, JSON, middleware, hosted services, health/startup checks and containerization.'
applyTo: '**/Controllers/**/*.cs, **/Middleware/**/*.cs, **/Authorize/**/*.cs, **/Program.cs, **/Startup.cs, **/*.Backend/Configurators/**/*.cs, **/*.Backend/Extensions/**/*.cs'
---

# ASP.NET Core Microservice Host

The host is a driving adapter plus the composition root. It holds no business logic. See `dotnet-architecture` for layering.

## Startup

- `Program.cs` builds the host. Configuration sources, in order: JSON files (`appsettings.json`, `appsettings.{Environment}.json`), then environment variables, then Key Vault when configured.
- With the company framework, `Startup` inherits `StartupBase` and overrides the hooks it needs: `AddAuthorization`, `AddServices`, `AddHostedServices`, `UseCors`. Without it, use minimal hosting (`WebApplication.CreateBuilder`) with the same order.
- `AddServices` registers API versioning, controllers + JSON options, then `services.AddDependencies(Configuration)` (root `InversionOfControlConfigurator`).
- JSON: camelCase, `JsonIgnoreCondition.WhenWritingNull`, `ReferenceHandler.IgnoreCycles`, enums as strings when the contract requires it.
- Database migrations run as a hosted service gated by configuration (`SQLSERVER_RUN_MIGRATIONS_ON_STARTUP`), never in request paths.

## Controllers

- Location `Controllers/Api/<Resource>Controller.cs`, inheriting `ControllerBase`, with the plural resource name (`TenantsController`).
- Class attributes: `[Authorize]`, `[ApiController]`, `[ApiVersion("1.0")]`, `[Route("api/v{version:apiVersion}/[controller]")]`.
- Primary-constructor injection of `Application.Abstractions` services only. Never repositories, units or DbContexts.
- Actions are thin:
  - bind
  - call one service method
  - return the result
- Actions never contain business rules, mapping logic beyond trivial route-to-request assembly, or try/catch.
- Signature: `public async Task<ActionResult<TResponse>> <Verb><Resource>Async(..., CancellationToken cancellationToken)`. Bind explicitly with `[FromRoute]`, `[FromQuery]` and `[FromBody]`.
- HTTP semantics:
  - `GET` → `200 OK` with body
  - `POST` (create) → `201 Created` (`CreatedAtAction`), or `200 OK` with the id when an existing contract requires it
  - `PUT`/`PATCH` → `200 OK` with body, or `204 NoContent`
  - `DELETE` → `204 NoContent`
- Route templates: lowercase nouns, ids as typed constraints (`{tenantGuid:guid}`), sub-resources as segments (`{tenantGuid:guid}/mfa`). Never expose internal numeric ids.
- Document responses with `[ProducesResponseType]` for each status the action can return.

## Authorization

- Policy names are constants in `Authorize/AuthorizePolicy.cs`. Never use string literals in attributes: `[Authorize(AuthorizePolicy.Nexus)]`.
- Policies are registered in `AddAuthorization` (framework `AddAuthorizationWithPolicies(...)` plus `AddAuthorizationBuilder().AddPolicy(...)`) and are based on claims, roles and `client_id`.
- Endpoints that run without a tenant context are explicitly marked (`[NoTenant]`) and still require a policy.
- Tenant/ownership checks belong to the application service (using `ITenantContext`), not to controllers.

## Errors and Validation

- Contracts are validated by `[ApiController]` model validation (DataAnnotations / `IValidatableObject` / validators in `Contracts/Validators`), which produces `ValidationProblemDetails` (400).
- A global middleware or exception handler maps exceptions to RFC 9457 ProblemDetails:
  - `BadRequestException` → 400
  - `UnauthorizedAccessException` → 401/403 as defined by the framework
  - `ForbiddenException` → 403
  - `NotFoundException` → 404
  - anything else → 500 with a generic message
- Unexpected errors are logged with the exception. Stack traces and internal messages are never returned to clients.
- Request/response logging middleware skips sensitive paths and bodies (credentials, tokens, personal data) and is toggled by configuration.

## Cross-Cutting

- Forwarded headers configured for running behind ingress (`ForwardedHeadersOptions` with known networks cleared only when the ingress is trusted).
- CORS via the framework default policy. Never `AllowAnyOrigin` together with credentials.
- Health: liveness without dependencies, readiness/startup that checks the database (`ITransactionUnit.CanConnectDatabaseAsync`) and critical brokers.
- Telemetry via Application Insights / OpenTelemetry through the framework logging configurator, with correlation ids propagated.
- Hosted services: `AddHostedService<T>()` for workers (`DataCleanupBackgroundService`, queue workers) and the framework streaming extensions for message handlers (`Add<Topic>HostedService<THandler>()`).
- Typed `HttpClient` per external API, with timeouts and resilience (`AddStandardResilienceHandler` or equivalent) configured in the configurator.

## Containerization and Deployment

- Dockerfile: `mcr.microsoft.com/dotnet/aspnet:<tfm>-alpine` runtime image, copy published output only, run as a non-root user (UID 10001), `ENTRYPOINT ["dotnet", "<Assembly>.dll"]`.
- Kubernetes manifests under `<Host>/k8s/base` + `k8s/patches/<environment>` (Kustomize). Secrets via secret stores, never in manifests.
- CI (Azure Pipelines): restore → build (Release) → unit + integration tests with coverage → SonarQube → publish → image build/push. Feature tests run post-deployment.
