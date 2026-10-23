# Component Tests

## Page Component (smart)

```ts
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AssetsService } from '../../../core/services/assets/assets.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ListAssetsComponent } from './list-assets.component';

const ASSET = { guid: 'a1', name: 'Laser 01', tenantName: 'Tenant A', createdAt: '2026-01-01' };
const PAGED_ASSETS = { items: [ASSET], totalCount: 1 };

describe('ListAssetsComponent', () => {
  let fixture: ComponentFixture<ListAssetsComponent>;
  let component: ListAssetsComponent;
  let assetsService: jest.Mocked<AssetsService>;
  let authService: jest.Mocked<AuthService>;
  let dialog: jest.Mocked<MatDialog>;
  let router: jest.Mocked<Router>;

  beforeEach(async () => {
    assetsService = {
      getPaginatedAssets: jest.fn().mockReturnValue(of(PAGED_ASSETS)),
      deleteAsset: jest.fn().mockReturnValue(of(void 0)),
    } as unknown as jest.Mocked<AssetsService>;
    authService = {
      isSuperAdmin: jest.fn().mockReturnValue(true),
      isAdmin: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<AuthService>;
    dialog = { open: jest.fn() } as unknown as jest.Mocked<MatDialog>;
    router = { navigate: jest.fn() } as unknown as jest.Mocked<Router>;

    await TestBed.configureTestingModule({
      imports: [ListAssetsComponent, NoopAnimationsModule],
      providers: [
        provideTranslateService(),
        { provide: AssetsService, useValue: assetsService },
        { provide: AuthService, useValue: authService },
        { provide: MatDialog, useValue: dialog },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
  });

  // Role-dependent fields are computed at construction, so create after arranging mocks.
  function createComponent(): void {
    fixture = TestBed.createComponent(ListAssetsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('ngOnInit', () => {
    it('should load the first page of assets when the page opens', () => {
      // Act
      createComponent();

      // Assert
      expect(assetsService.getPaginatedAssets).toHaveBeenCalledWith({ page: 1, itemsPerPage: 25, filter: '' });
      expect(component.assets()).toEqual([ASSET]);
      expect(component.totalCount()).toBe(1);
      expect(component.isLoading()).toBe(false);
    });
  });

  describe('onPageChange', () => {
    it('should request the selected page when the paginator changes', () => {
      // Arrange
      createComponent();

      // Act
      component.onPageChange({ pageIndex: 2, pageSize: 50, length: 1 } as PageEvent);

      // Assert
      expect(assetsService.getPaginatedAssets).toHaveBeenLastCalledWith({ page: 3, itemsPerPage: 50, filter: '' });
    });
  });

  describe('onFilterChange', () => {
    it('should reload from the first page after the debounce when the filter changes', fakeAsync(() => {
      // Arrange
      createComponent();

      // Act
      component.onFilterChange('laser');
      tick(300);

      // Assert
      expect(component.currentPage()).toBe(1);
      expect(assetsService.getPaginatedAssets).toHaveBeenLastCalledWith({ page: 1, itemsPerPage: 25, filter: 'laser' });
    }));
  });

  describe('template', () => {
    it('should hide the create button when the user cannot manage assets', () => {
      // Arrange
      authService.isSuperAdmin.mockReturnValue(false);

      // Act
      createComponent();

      // Assert
      expect(fixture.nativeElement.querySelector('[data-testid="create-asset"]')).toBeNull();
    });
  });

  describe('goToEditAsset', () => {
    it('should navigate to the edit route when an asset is chosen', () => {
      // Arrange
      createComponent();

      // Act
      component.goToEditAsset(ASSET);

      // Assert
      expect(router.navigate).toHaveBeenCalledWith(['/assets/edit', ASSET.guid]);
    });
  });
});
```

Dialog-driven actions (`onDeleteAsset`) are covered in [dialog-async-tests.md](./dialog-async-tests.md).

## Presentational / Form Component (signal inputs and outputs)

```ts
describe('AssetFormComponent', () => {
  let fixture: ComponentFixture<AssetFormComponent>;
  let component: AssetFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssetFormComponent, NoopAnimationsModule],
      providers: [provideTranslateService()],
    }).compileComponents();

    fixture = TestBed.createComponent(AssetFormComponent);
    component = fixture.componentInstance;
  });

  describe('asset input', () => {
    it('should patch the form when an asset is provided', () => {
      // Arrange
      fixture.componentRef.setInput('asset', { ...ASSET, description: 'Main laser' });

      // Act
      fixture.detectChanges();

      // Assert
      expect(component.form.getRawValue()).toEqual({ name: 'Laser 01', description: 'Main laser' });
    });
  });

  describe('onSubmit', () => {
    it('should emit the form value when the form is valid', () => {
      // Arrange
      fixture.detectChanges();
      const saved = jest.fn();
      component.saved.subscribe(saved);
      component.form.setValue({ name: 'Laser 02', description: '' });

      // Act
      component.onSubmit();

      // Assert
      expect(saved).toHaveBeenCalledWith({ name: 'Laser 02', description: '' });
    });

    it('should mark controls as touched and not emit when the form is invalid', () => {
      // Arrange
      fixture.detectChanges();
      const saved = jest.fn();
      component.saved.subscribe(saved);

      // Act
      component.onSubmit();

      // Assert
      expect(saved).not.toHaveBeenCalled();
      expect(component.form.controls.name.touched).toBe(true);
    });
  });

  describe('template', () => {
    it('should disable save when saving is in progress', () => {
      // Arrange
      fixture.componentRef.setInput('isSaving', true);
      component.form.setValue({ name: 'Laser', description: '' });

      // Act
      fixture.detectChanges();

      // Assert
      const button: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="asset-save"]');
      expect(button.disabled).toBe(true);
    });
  });
});
```

## Page With Route Input (add/update)

```ts
beforeEach(() => {
  fixture = TestBed.createComponent(UpdateAssetsComponent);
  component = fixture.componentInstance;
  fixture.componentRef.setInput('assetGuid', ASSET.guid);
});

it('should send the mapped update request and go back to the list when saved', () => {
  // Arrange
  fixture.detectChanges();

  // Act
  component.onSaved({ name: '  Laser 02 ', description: '' });

  // Assert
  expect(assetsService.updateAsset).toHaveBeenCalledWith({ guid: ASSET.guid, name: 'Laser 02', description: undefined });
  expect(router.navigate).toHaveBeenCalledWith(['/assets']);
  expect(component.isSaving()).toBe(false);
});

it('should stay on the page and re-enable saving when the update fails', () => {
  // Arrange
  assetsService.updateAsset.mockReturnValue(throwError(() => new Error('failed')));
  fixture.detectChanges();

  // Act
  component.onSaved({ name: 'Laser 02', description: '' });

  // Assert
  expect(router.navigate).not.toHaveBeenCalled();
  expect(component.isSaving()).toBe(false);
});
```

The page pipes `catchError(() => EMPTY)` after the service call (the `ErrorHandlerService` already toasted), so the error never reaches `subscribe` and the test stays synchronous.

## Heavy Layout Components

Test logic without rendering third-party layout templates:

```ts
await TestBed.configureTestingModule({ imports: [FullComponent], providers: [...] })
  .overrideComponent(FullComponent, { set: { template: '' } })
  .compileComponents();
```

Mock browser APIs (`matchMedia`, `ResizeObserver`) with `jest.fn()` objects and assert listeners are removed on destroy (`fixture.destroy()`).

## Pure Functions, Pipes and Validators

No TestBed:

```ts
describe('maxWordsValidator', () => {
  it.each([
    [null, 'one two'],
    [{ maxWords: { max: 3, actual: 4 } }, 'one two three four'],
  ])('should return %p when the value is "%s"', (expected, value) => {
    // Arrange
    const control = new FormControl(value);

    // Act
    const result = maxWordsValidator(3)(control);

    // Assert
    expect(result).toEqual(expected);
  });
});
```

Pipes: `new RoleNamePipe().transform(input)`; if the pipe uses `inject()`, use `TestBed.runInInjectionContext(() => new RoleNamePipe())`.
