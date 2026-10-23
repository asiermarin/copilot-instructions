---
description: 'Testing standard for .NET: test pyramid, NUnit + Moq + Shouldly stack, naming, AAA, unit / integration / feature (E2E) tests, 2FA/MFA testing, coverage and Stryker mutation testing.'
applyTo: '**/*Tests*/**/*.cs, **/*.Tests.Common/**/*.cs'
---

# .NET Testing Standard

For procedures and templates, use the `dotnet-write-tests` skill.

## Mandated Stack

- **NUnit 4** (`NUnit`, `NUnit3TestAdapter`, `Microsoft.NET.Test.Sdk`). No xUnit or MSTest.
- **Moq** for test doubles. **Shouldly** for assertions (`result.ShouldBe(...)`, `await Should.ThrowAsync<NotFoundException>(...)`). Don't mix in `Assert.That` in new tests.
- **coverlet** for coverage (`coverlet.msbuild` in unit tests, `coverlet.collector` elsewhere), OpenCover format.
- **Microsoft.EntityFrameworkCore.Sqlite** in-memory (`DataSource=:memory:`) for integration tests. Never the EF InMemory provider (it doesn't enforce relational behavior).
- **Microsoft.AspNetCore.Mvc.Testing** (`WebApplicationFactory<TEntryPoint>`) for HTTP pipeline integration tests.
- **Stryker.NET** for mutation testing of unit tests.

## Test Projects

| Project | Scope | Runs in CI build | Dependencies |
|---|---|---|---|
| `<Solution>.UnitTests` | One class in isolation | Yes | Every port mocked |
| `<Solution>.IntegrationTests` | Real DI + real EF on SQLite in-memory, or the full HTTP pipeline via `WebApplicationFactory` | Yes | Only true externals mocked (message producer, third-party HTTP, blob storage) |
| `<Solution>.FeatureTests` | End-to-end (E2E) against a deployed environment over HTTP with real tokens | No (scheduled/post-deploy) | Nothing mocked |
| `<Solution>.Tests.Common` | Shared builders, data collections, HTTP mocks, context factories | n/a | n/a |

- Test folders mirror production folders (`UnitTests/Application/Services/TenantServiceTests.cs` tests `Application/Services/TenantService.cs`).
- One test class per production class: `<ClassUnderTest>Tests`. Large classes may be split by method: `<ClassUnderTest><Method>Tests`.
- Every production change ships with unit tests. Every bug fix ships with a regression test that fails before the fix.

## Naming and Structure

- Method name: `Method_Scenario_ExpectedResult`, for example `GetTenantByGuidAsync_TenantDoesNotExist_ThrowsNotFoundException` or `ToggleMfaAsync_UserIsNotAdmin_ThrowsForbiddenException`.
- Async tests return `Task` and end with neither `Async` nor `Test`.
- Body is always in three phases with comments: `// Arrange`, `// Act`, `// Assert`. If Act and Assert can't be separated (`Should.ThrowAsync`), use `// Act & Assert`.
- One behavior per test. Several assertions are allowed when they verify the same outcome.
- Data-driven: `[TestCase(...)]` for inline values, `[TestCaseSource(nameof(Cases))]` for complex objects. Prefer real enum values over casted ints (`[TestCase(MessageType.Add)]`).
- Tests are independent and order-free. `[Order]` is allowed only in FeatureTests scenario chains.

## Unit Tests

- The SUT is created in `[SetUp]` with fresh `Mock<T>` instances stored in `_camelCase` fields. No `static` mocks and no `Reset()` in `[TearDown]`.
- Mock only ports (interfaces). Never mock the SUT, mappers, records or static helpers.
- Units of work: mock `IProjectionUnit` / `ITransactionUnit` and set up the repository properties they expose.
- `IQueryable` from read ports: wrap the list with an async query provider (`TestAsyncQueryProvider` in the test project's `Utils`, or Tests.Common) so `ToListAsync`/`SingleOrDefaultAsync` work.
- Loggers: `NullLogger<T>.Instance`. Tenant context: mock `ITenantContext`.
- Verify interactions only when the interaction **is** the behavior (persist, broadcast, enqueue): `transactionUnitMock.Verify(u => u.CompleteAsync(It.IsAny<CancellationToken>()), Times.Once);`. Otherwise assert on returned values or state.
- Cover per public method: happy path, each guard/validation failure, not found, forbidden/tenant mismatch, and boundary values.
- Controllers: assert the `IActionResult` type and status code, and that the service was called with the mapped input. Set `ControllerContext` with `DefaultHttpContext` (and the API versioning feature when routes need it).
- Handlers: payload null, unsupported message type, self-broadcast ignored, and each supported type delegates to the service.

## Integration Tests

- Build a `ServiceCollection` using the **real** layer configurators (`AddApplicationDependencies()`, units, repositories), plus SQLite in-memory: open a `SqliteConnection("DataSource=:memory:")` in the fixture, register `UseSqlite(connection)`, then `EnsureCreatedAsync`.
- Replace only external edges with mocks: message producer/factory, third-party typed HTTP clients (via `Tests.Common` HTTP mocks), storage providers, telemetry.
- Seed data through the real write repositories + `CompleteAsync`, or through Tests.Common builders.
- Each test runs in a fresh scope (`serviceProvider.CreateScope()`). Dispose the connection and `EnsureDeletedAsync` in `[TearDown]` / `DisposeAsync`.
- HTTP pipeline tests: a `WebApplicationFactory<Program>` subclass (`TestWebApplicationFactory`) overrides `ConfigureWebHost` to swap DbContext → SQLite, external ports → mocks, and authentication → a test auth handler issuing the needed claims/policies.
- Test settings come from `testappsettings.json` / `AddInMemoryCollection` and `.runsettings` environment variables, never real secrets.

## Feature (E2E) Tests

- Hit a deployed environment (`<SERVICE>_URL`) with real OAuth tokens from the identity server (`AUTH_URL/connect/token`): `client_credentials` for machine clients, `password` grant for test users.
- All endpoints, client ids, usernames and secrets come from environment variables or pipeline secret variables. Never commit them.
- Use dedicated test tenants and users. Each scenario creates its data and deletes it at the end (or in `[OneTimeTearDown]`).
- Scenarios may be ordered with `[Order(n)]` inside one fixture (create → read → update → delete).
- Assert the HTTP status code first, then the deserialized body (shared `JsonSerializerOptions` from Tests.Common).
- Mark base classes and helpers `[ExcludeFromCodeCoverage]`. Feature tests are excluded from the CI build gate.

## 2FA / MFA Testing

- **Unit**:
  - enabling and disabling MFA at tenant and user level
  - the caller lacks permission (forbidden)
  - tenant/user not found
  - the state is already the requested value (no-op, nothing persisted, no broadcast)
  - a change sets the change date and persists via `CompleteAsync` once
  - the change is broadcast via the broadcast port with the right payload
- **Handler**: for the 2FA message handler, cover a null payload, an unsupported type, `Add`/`Update` enabling 2FA, `Delete` disabling it, and self-broadcast messages being ignored.
- **Integration**: the persisted flag and change date in SQLite after the use case; a tenant MFA toggle propagates to users as the business rule requires.
- **E2E**:
  - toggle MFA on a dedicated test tenant through the API and read it back
  - create a user with `TwoFactorEnabled = true` and verify the flag
  - restore the original state at the end
- Token acquisition for E2E uses machine clients or test users **without** an interactive second factor. When a flow requires OTP, use a test-only TOTP secret stored as a pipeline secret and generate the code in the test.
- Never disable or bypass MFA globally in a shared environment to make tests pass.

## Coverage and Mutation

- Unit test coverage is collected in CI (`/p:CollectCoverage=true /p:CoverletOutputFormat=opencover`) and published to SonarQube. New code target: ≥ 80% line coverage.
- Stryker (`stryker-config.json` at the repository root): runs on the UnitTests project, `mutation-level: Standard`, thresholds `high: 80`, `low: 60`. `target-framework` must equal the test project TFM. Logging calls are ignored via `ignore-methods`.
- A surviving mutant in new code means a missing assertion. Add a test or justify the gap in the PR.

## Tests.Common

- `TestDataProvider`-style static builders return valid default entities/contracts. Override only what the test cares about (`with` expressions for records).
- `*Collection` classes hold well-known GUIDs/values (`TenantCollection.Tenant1Guid`).
- HTTP mocks for each external typed client (`<Vendor>HttpMock`), `SubscriptionsContextFactory`-style SQLite context factories, JSON helpers.
- No production logic and no references to test frameworks' runners in Tests.Common.
