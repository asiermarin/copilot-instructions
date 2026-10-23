# Service Tests

## API Service

```ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IPaginatedResponse } from '../../models/paginated-response.interface';
import { IAssetResponse } from '../../models/asset/response/asset-response.interface';
import { ErrorHandlerService } from '../error-handler/error-handler.service';
import { ToastService } from '../toast/toast.service';
import { AssetsService } from './assets.service';

const ASSETS_URL = `${environment.subscriptionsApiUri}/api/v1.0/assets`;
const ASSET: IAssetResponse = {
  guid: 'a1b2c3',
  name: 'Laser 01',
  tenantName: 'Tenant A',
  createdAt: '2026-01-01T00:00:00Z',
};
const PAGED_ASSETS: IPaginatedResponse<IAssetResponse> = { items: [ASSET], totalCount: 1 };

describe('AssetsService', () => {
  let service: AssetsService;
  let httpMock: HttpTestingController;
  let toastService: jest.Mocked<ToastService>;
  let errorHandler: jest.Mocked<ErrorHandlerService>;

  beforeEach(() => {
    toastService = { showToast: jest.fn() } as unknown as jest.Mocked<ToastService>;
    errorHandler = {
      handleError: jest.fn().mockImplementation((error: unknown) => throwError(() => error)),
    } as unknown as jest.Mocked<ErrorHandlerService>;

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toastService },
        { provide: ErrorHandlerService, useValue: errorHandler },
      ],
    });

    service = TestBed.inject(AssetsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getPaginatedAssets', () => {
    it('should send page, size and filter as query params when a filter is provided', () => {
      // Arrange
      let result: IPaginatedResponse<IAssetResponse> | undefined;

      // Act
      service.getPaginatedAssets({ page: 2, itemsPerPage: 25, filter: 'laser' }).subscribe(r => (result = r));
      const req = httpMock.expectOne(r => r.url === `${ASSETS_URL}/paginated`);
      req.flush(PAGED_ASSETS);

      // Assert
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('itemsPerPage')).toBe('25');
      expect(req.request.params.get('filter')).toBe('laser');
      expect(result).toEqual(PAGED_ASSETS);
    });

    it('should omit optional params when they are not provided', () => {
      // Act
      service.getPaginatedAssets({ page: 1, itemsPerPage: 25 }).subscribe();
      const req = httpMock.expectOne(r => r.url === `${ASSETS_URL}/paginated`);
      req.flush(PAGED_ASSETS);

      // Assert
      expect(req.request.params.has('filter')).toBe(false);
      expect(req.request.params.has('orderBy')).toBe(false);
    });
  });

  describe('deleteAsset', () => {
    it('should show a success toast when the asset is deleted', () => {
      // Act
      service.deleteAsset(ASSET.guid).subscribe();
      const req = httpMock.expectOne(`${ASSETS_URL}/${ASSET.guid}`);
      req.flush(null);

      // Assert
      expect(req.request.method).toBe('DELETE');
      expect(toastService.showToast).toHaveBeenCalledWith('assets.messages.deleted', 'success');
    });

    it('should delegate to the error handler and not toast success when the request fails', () => {
      // Arrange
      const onError = jest.fn();

      // Act
      service.deleteAsset(ASSET.guid).subscribe({ error: onError });
      httpMock.expectOne(`${ASSETS_URL}/${ASSET.guid}`).flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });

      // Assert
      expect(errorHandler.handleError).toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    });
  });
});
```

Per method, cover: URL, HTTP method, params/body, result, success side effect, error delegation.

## State Service

No TestBed needed when the service has no dependencies.

```ts
import { SelectedAssetStateService } from './selected-asset-state.service';

describe('SelectedAssetStateService', () => {
  let service: SelectedAssetStateService;

  beforeEach(() => {
    service = new SelectedAssetStateService();
  });

  describe('setSelectedAsset', () => {
    it('should expose the asset and flag it as selected when an asset is set', () => {
      // Act
      service.setSelectedAsset(ASSET);

      // Assert
      expect(service.selectedAsset()).toEqual(ASSET);
      expect(service.hasSelectedAsset()).toBe(true);
    });
  });

  describe('clearSelectedAsset', () => {
    it('should reset the selection when it is cleared', () => {
      // Arrange
      service.setSelectedAsset(ASSET);

      // Act
      service.clearSelectedAsset();

      // Assert
      expect(service.selectedAsset()).toBeNull();
      expect(service.hasSelectedAsset()).toBe(false);
    });
  });
});
```

If the service uses `inject()`, create it with `TestBed.inject(...)` instead of `new`.

## Wrapper Service (ErrorHandlerService)

```ts
describe('ErrorHandlerService', () => {
  let service: ErrorHandlerService;
  let toastService: jest.Mocked<ToastService>;

  beforeEach(() => {
    toastService = { showToast: jest.fn() } as unknown as jest.Mocked<ToastService>;
    TestBed.configureTestingModule({ providers: [{ provide: ToastService, useValue: toastService }] });
    service = TestBed.inject(ErrorHandlerService);
  });

  it.each([
    [0, 'common.errors.noConnection', 'error'],
    [500, 'common.errors.server', 'error'],
    [400, 'common.errors.badRequest', 'warning'],
  ])('should toast %s as "%s" when the request fails', async (status, messageKey, type) => {
    // Arrange
    const error = new HttpErrorResponse({ status });

    // Act
    const result = firstValueFrom(service.handleError(error));

    // Assert
    await expect(result).rejects.toThrow(messageKey);
    expect(toastService.showToast).toHaveBeenCalledWith(messageKey, type);
  });
});
```

Use `it.each` for data-driven cases instead of copy-pasted tests.
