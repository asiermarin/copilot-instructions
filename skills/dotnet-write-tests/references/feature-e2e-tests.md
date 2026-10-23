# Feature (E2E) Tests

Black-box tests against a **deployed** environment over HTTP with real identity tokens. Nothing is mocked. They run after a deployment (scheduled or release stage), never in the CI build gate.

## Base Class

```csharp
namespace <Root>.FeatureTests.Utils;

using System.Diagnostics.CodeAnalysis;
using System.Net.Http.Headers;
using System.Net.Http.Json;

[ExcludeFromCodeCoverage]
public abstract class FeatureTestBase
{
    protected static Uri ServiceUrl => new(Environment.GetEnvironmentVariable("SERVICE_URL") ?? throw MissingVariable("SERVICE_URL"));

    private static Uri TokenUrl => new((Environment.GetEnvironmentVariable("AUTH_URL") ?? throw MissingVariable("AUTH_URL")) + "/connect/token");

    protected HttpClient Client { get; private set; } = null!;

    [OneTimeSetUp]
    public void OneTimeSetUp() => Client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false }) { BaseAddress = ServiceUrl };

    [OneTimeTearDown]
    public void OneTimeTearDown() => Client.Dispose();

    protected async Task AuthenticateAsClientAsync(string clientIdVariable, string secretVariable, string scope)
    {
        var token = await RequestTokenAsync(new Dictionary<string, string>
        {
            ["grant_type"] = "client_credentials",
            ["client_id"] = Required(clientIdVariable),
            ["client_secret"] = Required(secretVariable),
            ["scope"] = scope
        });

        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    protected async Task AuthenticateAsUserAsync(string usernameVariable, string passwordVariable, string clientIdVariable, string scope)
    {
        var token = await RequestTokenAsync(new Dictionary<string, string>
        {
            ["grant_type"] = "password",
            ["client_id"] = Required(clientIdVariable),
            ["username"] = Required(usernameVariable),
            ["password"] = Required(passwordVariable),
            ["scope"] = scope
        });

        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    private async Task<string> RequestTokenAsync(Dictionary<string, string> form)
    {
        using var response = await Client.PostAsync(TokenUrl, new FormUrlEncodedContent(form));
        response.EnsureSuccessStatusCode();
        var token = await response.Content.ReadFromJsonAsync<Token>(JsonTestHelper.DefaultOptions);

        return token?.AccessToken ?? throw new InvalidOperationException("The identity server returned no access token.");
    }

    private static string Required(string variable) =>
        Environment.GetEnvironmentVariable(variable) ?? throw MissingVariable(variable);

    private static InvalidOperationException MissingVariable(string variable) =>
        new($"Environment variable '{variable}' is required for feature tests.");
}
```

## Scenario Template

```csharp
[TestFixture]
public sealed class AssetsFeatureTests : FeatureTestBase
{
    private static Guid _createdAssetGuid;

    [SetUp]
    public Task SetUpAsync() => AuthenticateAsUserAsync("AUTH_USERNAME", "AUTH_PASSWORD", "SERVICE_CLIENT", "api1");

    [Test, Order(1)]
    public async Task CreateAsset_ValidRequest_Returns201WithGuid()
    {
        // Arrange
        var request = new CreateAssetRequest { Name = $"E2E {Guid.NewGuid():N}", PlantGuid = TestEnvironment.PlantGuid };

        // Act
        using var response = await Client.PostAsJsonAsync("api/v1.0/assets", request);

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        _createdAssetGuid = await response.Content.ReadFromJsonAsync<Guid>(JsonTestHelper.DefaultOptions);
        _createdAssetGuid.ShouldNotBe(Guid.Empty);
    }

    [Test, Order(2)]
    public async Task GetAsset_ExistingAsset_Returns200WithBody()
    {
        // Act
        using var response = await Client.GetAsync($"api/v1.0/assets/{_createdAssetGuid}");

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var asset = await response.Content.ReadFromJsonAsync<AssetResponse>(JsonTestHelper.DefaultOptions);
        asset!.Guid.ShouldBe(_createdAssetGuid);
    }

    [Test, Order(3)]
    public async Task DeleteAsset_ExistingAsset_Returns204()
    {
        // Act
        using var response = await Client.DeleteAsync($"api/v1.0/assets/{_createdAssetGuid}");

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }
}
```

## Rules

- All URLs, client ids, secrets and test user credentials come from environment variables or pipeline secret variables. Never hard-code them; the `client_secret` too.
- Use dedicated E2E tenants and users. Generate unique names (`E2E {Guid}`) and clean up everything the fixture created, even on failure (`[OneTimeTearDown]` deletes leftovers by name prefix).
- Ordered scenarios (`[Order]`) are allowed only inside one fixture. Fixtures are independent of each other.
- Assert the status code first, then the body. Use the shared JSON options.
- Security cases: no token → 401, a token from a client without the policy → 403, another tenant's resource → 403/404.
- Run with `dotnet test <Root>.FeatureTests` in a release stage after deployment, with variables mapped from the environment's secret library.
