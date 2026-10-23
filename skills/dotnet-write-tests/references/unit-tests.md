# Unit Tests

Stack: NUnit 4, Moq, Shouldly, `coverlet.msbuild`. One SUT per test class, every port mocked.

## Service Test Template

```csharp
namespace <Root>.UnitTests.Application.Services;

using <Root>.Application.Abstractions.Services;
using <Root>.Application.Contracts.Entities.Requests;
using <Root>.Application.Services;
using <Root>.Persistence.Abstractions.ReadRepositories;
using <Root>.Persistence.Abstractions.Repositories;
using <Root>.Persistence.Abstractions.Units;
using <Root>.Persistence.Entities.Entities;
using <Root>.Tests.Common.Builders;
using <Root>.UnitTests.Utils;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NUnit.Framework;
using Shouldly;

public sealed class AssetServiceTests
{
    private Mock<IProjectionUnit> _projectionUnitMock = null!;
    private Mock<ITransactionUnit> _transactionUnitMock = null!;
    private Mock<IAssetReadRepository> _assetReadRepositoryMock = null!;
    private Mock<ITenantReadRepository> _tenantReadRepositoryMock = null!;
    private Mock<IPlantReadRepository> _plantReadRepositoryMock = null!;
    private Mock<IAssetRepository> _assetRepositoryMock = null!;
    private Mock<ITenantContext> _tenantContextMock = null!;
    private Mock<IBroadcastService> _broadcastServiceMock = null!;
    private AssetService _sut = null!;

    private readonly Guid _tenantGuid = Guid.NewGuid();

    [SetUp]
    public void SetUp()
    {
        _projectionUnitMock = new Mock<IProjectionUnit>();
        _transactionUnitMock = new Mock<ITransactionUnit>();
        _assetReadRepositoryMock = new Mock<IAssetReadRepository>();
        _tenantReadRepositoryMock = new Mock<ITenantReadRepository>();
        _plantReadRepositoryMock = new Mock<IPlantReadRepository>();
        _assetRepositoryMock = new Mock<IAssetRepository>();
        _tenantContextMock = new Mock<ITenantContext>();
        _broadcastServiceMock = new Mock<IBroadcastService>();

        _projectionUnitMock.SetupGet(u => u.AssetReadRepository).Returns(_assetReadRepositoryMock.Object);
        _projectionUnitMock.SetupGet(u => u.TenantReadRepository).Returns(_tenantReadRepositoryMock.Object);
        _projectionUnitMock.SetupGet(u => u.PlantReadRepository).Returns(_plantReadRepositoryMock.Object);
        _transactionUnitMock.SetupGet(u => u.AssetRepository).Returns(_assetRepositoryMock.Object);
        _tenantContextMock.SetupGet(c => c.TenantId).Returns(_tenantGuid);

        _sut = new AssetService(
            _projectionUnitMock.Object,
            _transactionUnitMock.Object,
            _tenantContextMock.Object,
            _broadcastServiceMock.Object,
            NullLogger<AssetService>.Instance);
    }

    [Test]
    public async Task GetAssetAsync_AssetExists_ReturnsMappedResponse()
    {
        // Arrange
        var asset = TestDataProvider.GetTestAsset();
        _assetReadRepositoryMock
            .Setup(r => r.GetAssetByGuidAsQueryable(_tenantGuid, asset.AssetGuid))
            .Returns(new TestAsyncEnumerable<Asset>([asset]));

        // Act
        var result = await _sut.GetAssetAsync(asset.AssetGuid);

        // Assert
        result.Guid.ShouldBe(asset.AssetGuid);
        result.Name.ShouldBe(asset.Name);
    }

    [Test]
    public async Task GetAssetAsync_AssetDoesNotExist_ThrowsNotFoundException()
    {
        // Arrange
        _assetReadRepositoryMock
            .Setup(r => r.GetAssetByGuidAsQueryable(_tenantGuid, It.IsAny<Guid>()))
            .Returns(new TestAsyncEnumerable<Asset>([]));

        // Act & Assert
        await Should.ThrowAsync<NotFoundException>(() => _sut.GetAssetAsync(Guid.NewGuid()));
    }

    [Test]
    public async Task CreateAssetAsync_ValidRequest_PersistsOnceAndBroadcasts()
    {
        // Arrange
        var request = new CreateAssetRequest { Name = "Laser 01", PlantGuid = Guid.NewGuid() };
        _tenantReadRepositoryMock
            .Setup(r => r.GetTenantIdByGuidAsync(_tenantGuid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(42);
        _plantReadRepositoryMock
            .Setup(r => r.ExistsInTenantAsync(42, request.PlantGuid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var assetGuid = await _sut.CreateAssetAsync(request);

        // Assert
        assetGuid.ShouldNotBe(Guid.Empty);
        _assetRepositoryMock.Verify(r => r.InsertAsync(It.Is<Asset>(a => a.Name == request.Name && a.TenantId == 42), It.IsAny<CancellationToken>()), Times.Once);
        _transactionUnitMock.Verify(u => u.CompleteWithExpectedAtLeastOneChangeAsync(It.IsAny<CancellationToken>()), Times.Once);
        _broadcastServiceMock.Verify(b => b.BroadcastAssetMessageAsync(It.IsAny<AssetResponse>(), MessageType.Add, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task CreateAssetAsync_PlantNotInTenant_ThrowsForbiddenExceptionAndPersistsNothing()
    {
        // Arrange
        var request = new CreateAssetRequest { Name = "Laser 01", PlantGuid = Guid.NewGuid() };
        _plantReadRepositoryMock
            .Setup(r => r.ExistsInTenantAsync(It.IsAny<long>(), request.PlantGuid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        // Act & Assert
        await Should.ThrowAsync<ForbiddenException>(() => _sut.CreateAssetAsync(request));
        _assetRepositoryMock.Verify(r => r.InsertAsync(It.IsAny<Asset>(), It.IsAny<CancellationToken>()), Times.Never);
        _broadcastServiceMock.VerifyNoOtherCalls();
    }
}
```

`TestAsyncEnumerable<T>` / `TestAsyncQueryProvider<T>` live in the test project's `Utils` (or Tests.Common). They make `ToListAsync`, `SingleOrDefaultAsync` and similar work over in-memory lists.

## Controller Test Template

```csharp
[SetUp]
public void SetUp()
{
    _assetServiceMock = new Mock<IAssetService>();
    _sut = new AssetsController(_assetServiceMock.Object)
    {
        ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
    };
}

[Test]
public async Task GetAssetAsync_ServiceReturnsAsset_ReturnsOkWithBody()
{
    // Arrange
    var response = new AssetResponse { Guid = Guid.NewGuid(), Name = "Laser 01" };
    _assetServiceMock.Setup(s => s.GetAssetAsync(response.Guid, It.IsAny<CancellationToken>())).ReturnsAsync(response);

    // Act
    var result = await _sut.GetAssetAsync(response.Guid, CancellationToken.None);

    // Assert
    var ok = result.Result.ShouldBeOfType<OkObjectResult>();
    ok.Value.ShouldBe(response);
}
```

If routes or actions read the API version, add the feature: `httpContext.Features.Set<IApiVersioningFeature>(new ApiVersioningFeature(httpContext) { RequestedApiVersion = new ApiVersion(1, 0) });`.

## Message Handler Test Template

Handlers expose `protected HandleMessageAsync`. Test them through a small derived test class or `InternalsVisibleTo` + an `internal` entry point. Keep the mocks per test.

```csharp
[TestCase(MessageType.Add)]
[TestCase(MessageType.Update)]
public async Task HandleMessageAsync_SupportedType_DelegatesToService(MessageType type)
{
    // Arrange
    var message = MessageBuilder.ForTenant(TenantCollection.Tenant1Guid.ToGuid())
        .WithType(type)
        .WithPayload(new Tenant2FA { TenantGuid = TenantCollection.Tenant1Guid.ToGuid(), UserGuid = UserCollection.User1Guid.ToGuid(), Broadcaster = Broadcaster.Auth })
        .Build();

    // Act
    await _sut.InvokeAsync(message);

    // Assert
    _userProfileServiceMock.Verify(s => s.Update2FAStatusAsync(It.IsAny<Guid>(), true), Times.Once);
}
```

Mandatory handler cases: payload null (no throw, no call), unsupported type (no throw, warning), self-broadcast ignored, each supported type.

## Rules

- Mock interfaces only. Use real records, mappers and static helpers.
- Use `It.Is<T>(predicate)` to check the meaningful arguments, and `It.IsAny<CancellationToken>()` for tokens.
- Don't assert log calls unless logging is the requirement.
- Pure `private static` helpers are covered through public methods, or made `internal static` and tested directly with `InternalsVisibleTo`.
- Time-dependent logic: pass the time in, or inject `TimeProvider` and use `FakeTimeProvider` (`Microsoft.Extensions.TimeProvider.Testing`).
