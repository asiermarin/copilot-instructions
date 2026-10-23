---
description: 'Use when building or modifying non-web .NET hosts: desktop applications (any UI framework), console tools and worker services that reuse the clean/hexagonal core. Covers Generic Host composition root, DI scopes per operation, UI as thin driving adapter, configuration, local persistence and error presentation.'
applyTo: '**/*.Desktop/**/*.cs, **/*.Worker/**/*.cs, **/*.Host/**/*.cs, **/*.Console/**/*.cs'
---

# Desktop, Console and Worker Hosts

These hosts reuse the exact layers of `dotnet-architecture` (Contracts, Abstractions, Application, External, Persistence.*). Only the outermost project changes. Guidance here is UI-framework-agnostic.

## Composition Root

- Build a Generic Host (`Host.CreateApplicationBuilder(args)`) in the entry point, even for desktop apps. Configure configuration, logging and DI there, then start the UI or the worker.
- Register layers with the same configurators as microservices: `AddApplicationDependencies()`, `AddPersistenceDependencies()`, `AddPersistenceProjectionsDependencies()`, `AddPersistenceTransactionsDependencies()`, plus a host configurator `AddDesktopDependencies()` / `AddWorkerDependencies()` for UI or worker types.
- The host project is the only one that references UI frameworks. Application and lower layers never reference UI or ASP.NET Core assemblies.

## Scopes and Lifetimes

- There is no request scope. Create one DI scope per user operation or per work item with `IServiceScopeFactory.CreateAsyncScope()`, and resolve the use-case service inside it. Dispose the scope when the operation ends so the `DbContext` is not kept alive.
- Long-lived UI objects (windows, view-models, presenters) are singletons or transient. They never hold scoped services directly. Inject a small `IOperationRunner`-style helper or `IServiceScopeFactory` instead.
- Never share a `DbContext` across threads or concurrent operations.

## UI as a Driving Adapter

- Views and view-models/presenters are thin:
  - collect input
  - build the Contracts request
  - call one `I<X>Service` method
  - present the Response
- No business rules in the UI layer. Rules shared between UI validation and the core belong in Contracts validators or the application service.
- All service calls are async with a `CancellationToken` linked to the view lifetime or a Cancel command. Never block the UI thread with `.Result`/`.Wait()`. `async void` is allowed only for UI event handlers, and those must catch and present exceptions.
- Marshal back to the UI thread through the framework dispatcher/synchronization context, never through `Task.Run` workarounds inside the core.

## Workers and Console Tools

- Workers inherit `BackgroundService`. `ExecuteAsync` loops until `stoppingToken` is cancelled, creates a scope per item, and catches exceptions per item (log and continue) so one failure doesn't stop the host.
- Console tools return meaningful exit codes, read arguments into a Contracts request, and call one use case.
- Use the queue + worker pattern (`I<X>Queue` + `<X>QueueWorker`) for work that must not block the caller.

## Configuration and Secrets

- `appsettings.json` + `appsettings.{Environment}.json` + environment variables + user-secrets in development. Bind with `AddOptions<T>().Bind(...).ValidateDataAnnotations().ValidateOnStart()`.
- User-editable preferences go through a dedicated port (`IUserPreferencesStore`), not `appsettings.json`.
- Secrets on a desktop machine use OS-protected storage (DPAPI / Credential Manager / Keychain) behind a port. Never store them in plain-text files.

## Persistence

- Same ports (`IProjectionUnit`, `ITransactionUnit`). Local databases (SQLite) are configured in the persistence configurator, with the connection string from options.
- Apply migrations at startup through a dedicated startup step before showing the main UI, and report failures to the user.

## Errors and Logging

- A global handler for unhandled exceptions (UI-thread, `TaskScheduler.UnobservedTaskException`, `AppDomain.UnhandledException`) logs the error and shows a generic message.
- Map framework exceptions to user messages:
  - `BadRequestException` → validation message
  - `NotFoundException` → "item no longer exists"
  - `ForbiddenException` → permission message
- Never show stack traces to users.
- Log to a rolling file and/or telemetry sink configured in the host. Use the same structured logging rules as the C# standard.

## Testing

- Application core: same unit and integration tests as microservices (see `dotnet-testing`).
- View-models/presenters: unit tests with mocked `Application.Abstractions` services. No UI automation in unit tests.
- E2E/UI automation lives in a separate `<Solution>.FeatureTests` project and runs outside the CI build gate.
