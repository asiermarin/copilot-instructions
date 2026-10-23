# Integration Tests

Real DI composition and real EF Core on SQLite in-memory. Only true externals are mocked. Stack: NUnit, Shouldly, Moq (for externals), `Microsoft.EntityFrameworkCore.Sqlite`, `coverlet.collector`.

## Service-Level Fixture

```csharp
namespace <Root>.IntegrationTests.Fixtures;

using <Root>.Application.Configurators;
using <Root>.Persistence.Abstractions.Units;
using <Root>.Persistence.Contexts;
using <Root>.Persistence.Projections.Units;
using <Root>.Persistence.Transactions.Units;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using NUnit.Framework;

public abstract class IntegrationTestBase
{
    private SqliteConnection _connection = null!;

    protected ServiceProvider ServiceProvider { get; private set; } = null!;

    protected Mock<IProducer> ProducerMock { get; private set; } = null!;

    [SetUp]
    public async Task SetUpAsync()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        await _connection.OpenAsync();

        var configuration = new ConfigurationBuilder()
            .AddJsonFile("testappsettings.json", optional: true)
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Storage:Containers:ProfileImage:SubFolder"] = "Images/Profiles" })
            .Build();

        ProducerMock = new Mock<IProducer>();

        var services = new ServiceCollection();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddLogging();
        services.AddDbContext<ServiceContext>(options => options.UseSqlite(_connection));
        services.AddSingleton<ITenantContext>(TestTenantContext.For(TenantCollection.Tenant1Guid.ToGuid()));
        services.AddSingleton(ProducerMock.Object);

        services.AddApplicationDependencies();
        services.AddScoped<IProjectionUnit, ProjectionUnit>();
        services.AddScoped<ITransactionUnit, TransactionUnit>();

        ServiceProvider = services.BuildServiceProvider();

        using var scope = ServiceProvider.CreateScope();
        await scope.ServiceProvider.GetRequiredService<ServiceContext>().Database.EnsureCreatedAsync();
        await SeedAsync(scope.ServiceProvider);
    }

    [TearDown]
    public async Task TearDownAsync()
    {
        await ServiceProvider.DisposeAsync();
        await _connection.DisposeAsync();
    }

    protected virtual Task SeedAsync(IServiceProvider services) => Task.CompletedTask;
}
```

When the production configurators register external adapters (HTTP clients, storage, producers), register those configurators and then override the externals with mocks after them. The last registration wins for single-service resolution.

## Test Template

```csharp
public sealed class AssetServiceIntegrationTests : IntegrationTestBase
{
    protected override async Task SeedAsync(IServiceProvider services)
    {
        var transactionUnit = services.GetRequiredService<ITransactionUnit>();
        await transactionUnit.TenantRepository.InsertAsync(TestDataProvider.GetTestTenant());
        await transactionUnit.CompleteAsync();
    }

    [Test]
    public async Task CreateAssetAsync_ValidRequest_PersistsAssetForCurrentTenant()
    {
        // Arrange
        using var scope = ServiceProvider.CreateScope();
        var sut = scope.ServiceProvider.GetRequiredService<IAssetService>();
        var request = new CreateAssetRequest { Name = "Laser 01", PlantGuid = PlantCollection.Plant1Guid.ToGuid() };

        // Act
        var assetGuid = await sut.CreateAssetAsync(request);

        // Assert
        using var assertScope = ServiceProvider.CreateScope();
        var asset = await assertScope.ServiceProvider.GetRequiredService<ServiceContext>()
            .Assets.AsNoTracking().SingleAsync(a => a.AssetGuid == assetGuid);
        asset.Name.ShouldBe(request.Name);
        ProducerMock.Verify(p => p.ProduceAsync(It.IsAny<string>(), It.IsAny<Message<It.IsAnyType>>(), null), Times.Once);
    }
}
```

Use a separate scope to assert, so values are read from the database and not from the change tracker.

## HTTP Pipeline

```csharp
public sealed class TestWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        _connection.Open();
        builder.UseEnvironment("Testing");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<DbContextOptions<ServiceContext>>();
            services.AddDbContext<ServiceContext>(options => options.UseSqlite(_connection));

            services.RemoveAll<IProducer>();
            services.AddSingleton(Mock.Of<IProducer>());

            services.AddAuthentication(TestAuthHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        _connection.Dispose();
    }
}
```

`TestAuthHandler` issues a `ClaimsPrincipal` whose claims (role, `client_id`, tenant) are set per test through a header or a static scenario, so authorization policies run for real. Test cases:
- 401 without a token
- 403 with the wrong policy claims
- 200/201 with the right claims
- 400 ProblemDetails for an invalid body
- 404 ProblemDetails for an unknown id

## Rules

- SQLite in-memory only. Never `UseInMemoryDatabase`.
- Fresh connection and database per test (or per fixture when it is read-only and clearly documented).
- No real external calls: replace them with Tests.Common HTTP mocks (`<Vendor>HttpMock`) or Moq.
- Non-secret environment variables go in `.runsettings`. Settings go in `testappsettings.json` (copied to output).
