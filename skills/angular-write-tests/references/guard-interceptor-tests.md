# Guard, Interceptor and Resolver Tests

## Functional Guard

```ts
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { UserConfigService } from '@lantek360/authentication';
import { Observable, firstValueFrom, of } from 'rxjs';
import { AuthService } from '../services/auth/auth.service';
import { assetsGuard } from './assets.guard';

const ROUTE = {} as ActivatedRouteSnapshot;
const STATE = {} as RouterStateSnapshot;
const UNAUTHORIZED_TREE = {} as UrlTree;

describe('assetsGuard', () => {
  const executeGuard: CanActivateFn = (...args) => TestBed.runInInjectionContext(() => assetsGuard(...args));

  let authService: jest.Mocked<AuthService>;
  let router: jest.Mocked<Router>;

  beforeEach(() => {
    authService = {
      isSuperAdmin: jest.fn().mockReturnValue(false),
      isAdmin: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<AuthService>;
    router = { parseUrl: jest.fn().mockReturnValue(UNAUTHORIZED_TREE), navigateByUrl: jest.fn() } as unknown as jest.Mocked<Router>;

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        { provide: UserConfigService, useValue: { getConfig: jest.fn().mockReturnValue(of({})) } },
      ],
    });
  });

  it.each<[string, keyof AuthService]>([
    ['super admin', 'isSuperAdmin'],
    ['admin', 'isAdmin'],
  ])('should allow access when the user is %s', async (_role, roleCheck) => {
    // Arrange
    (authService[roleCheck] as jest.Mock).mockReturnValue(true);

    // Act
    const result = await firstValueFrom(executeGuard(ROUTE, STATE) as Observable<boolean | UrlTree>);

    // Assert
    expect(result).toBe(true);
  });

  it('should redirect to unauthorized when the user has no allowed role', async () => {
    // Act
    const result = await firstValueFrom(executeGuard(ROUTE, STATE) as Observable<boolean | UrlTree>);

    // Assert
    expect(result).toBe(UNAUTHORIZED_TREE);
    expect(router.parseUrl).toHaveBeenCalledWith('/unauthorized');
  });
});
```

For guards in the legacy style (`navigateByUrl` + `return false`), assert `result === false` and `router.navigateByUrl` called with `'/unauthorized'`.

## Functional Interceptor

```ts
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { correlationIdInterceptor } from './correlation-id.interceptor';

describe('correlationIdInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([correlationIdInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should add the correlation header when calling the backend', () => {
    // Act
    http.get('/api/v1.0/assets').subscribe();
    const req = httpMock.expectOne('/api/v1.0/assets');
    req.flush({});

    // Assert
    expect(req.request.headers.has('X-Correlation-Id')).toBe(true);
  });

  it('should not modify requests when calling external hosts', () => {
    // Act
    http.get('https://cdn.example.com/file.json').subscribe();
    const req = httpMock.expectOne('https://cdn.example.com/file.json');
    req.flush({});

    // Assert
    expect(req.request.headers.has('X-Correlation-Id')).toBe(false);
  });
});
```

## Resolver

```ts
const executeResolver: ResolveFn<IAssetResponse> = (...args) =>
  TestBed.runInInjectionContext(() => assetResolver(...args));

it('should return the asset when the route has a guid', async () => {
  // Arrange
  const route = { paramMap: convertToParamMap({ assetGuid: ASSET.guid }) } as ActivatedRouteSnapshot;

  // Act
  const result = await firstValueFrom(executeResolver(route, STATE) as Observable<IAssetResponse>);

  // Assert
  expect(assetsService.getAsset).toHaveBeenCalledWith(ASSET.guid);
  expect(result).toEqual(ASSET);
});
```
