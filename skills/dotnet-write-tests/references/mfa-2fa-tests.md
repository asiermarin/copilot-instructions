# 2FA / MFA Test Scenarios

MFA state exists at two levels: the tenant (`Tenant.MFAEnabled`, `MFAChangeDate`) and the user (`User.TwoFactorEnabled`). It changes through the API (`PUT api/v1.0/tenants/{tenantGuid}/mfa`) and through integration messages from the identity service (`Tenant2FAHandler` on the two-factor topic). Every change is broadcast to other services.

## Scenario Matrix

| # | Level | Scenario | Expected |
|---|---|---|---|
| 1 | Unit (service) | Admin enables tenant MFA when it is disabled | Flag true, change date set, one `CompleteAsync`, one broadcast |
| 2 | Unit (service) | Admin disables tenant MFA when it is enabled | Flag false, change date set, persisted, broadcast |
| 3 | Unit (service) | Requested state equals current state | No persist, no broadcast (or the documented behavior) |
| 4 | Unit (service) | Tenant does not exist | `NotFoundException`, nothing persisted |
| 5 | Unit (service) | Caller user does not exist | `NotFoundException` |
| 6 | Unit (service) | Caller lacks admin rights / other tenant | `ForbiddenException`, nothing persisted |
| 7 | Unit (service) | Update user 2FA status | `TwoFactorEnabled` updated, persisted once |
| 8 | Unit (handler) | Payload null | No throw, service not called |
| 9 | Unit (handler) | Unsupported message type | No throw, service not called |
| 10 | Unit (handler) | `Add` / `Update` | Service called with `enabled = true` |
| 11 | Unit (handler) | `Delete` | Service called with `enabled = false` |
| 12 | Unit (handler) | Message broadcast by this service | Ignored |
| 13 | Unit (controller) | Toggle endpoint | Delegates with route tenant + body. Returns the documented status |
| 14 | Integration | Toggle tenant MFA through real DI + SQLite | Flag and change date persisted. Producer called once |
| 15 | Integration (HTTP) | Toggle without the admin policy claims | 403 ProblemDetails |
| 16 | E2E | Toggle MFA on the dedicated E2E tenant and read it back | Values match. The original state is restored in teardown |
| 17 | E2E | Create a user with `TwoFactorEnabled = true` | Read-back shows true. The user is deleted in teardown |

## Unit Example

```csharp
[Test]
public async Task ToggleMfaAsync_TenantMfaDisabled_EnablesPersistsAndBroadcasts()
{
    // Arrange
    var tenant = TestDataProvider.GetTestTenant();
    tenant.MFAEnabled = false;
    _tenantRepositoryMock
        .Setup(r => r.GetTenantByGuidAsync(tenant.TenantGuid, It.IsAny<CancellationToken>()))
        .ReturnsAsync(tenant);

    // Act
    await _sut.ToggleMfaAsync(tenant.TenantGuid, enabled: true);

    // Assert
    tenant.MFAEnabled.ShouldBeTrue();
    tenant.MFAChangeDate.ShouldNotBeNull();
    _transactionUnitMock.Verify(u => u.CompleteAsync(It.IsAny<CancellationToken>()), Times.Once);
    _broadcastServiceMock.Verify(b => b.BroadcastTenantMFAMessageAsync(It.Is<Tenant>(t => t.MFAEnabled), It.IsAny<CancellationToken>()), Times.Once);
}
```

Adapt the method names (`ToggleMfaAsync`, `BroadcastTenantMFAMessageAsync`) to the real port signatures.

## Token Acquisition with MFA in E2E

- Use machine clients (`client_credentials`) or E2E test users that have **no interactive second factor** to obtain tokens for setup.
- To test a flow that requires an OTP, give the E2E user a TOTP secret stored only as a pipeline secret (`E2E_TOTP_SECRET`). Generate the current code in the test with an RFC 6238 implementation (e.g. `Otp.NET`) and send it with the login request.
- Never disable MFA globally, never add test-only bypass endpoints, and never log OTP codes or secrets.
- Always restore the tenant/user MFA state in `[OneTimeTearDown]` so other suites start from a known state.
