# Feature Templates

Replace `Asset` / `asset` / `assets` / `ASSETS` with the real names. Paths are relative to `src/app/`. Adjust imports to the real relative paths.

## Models

`core/models/paginated-response.interface.ts` (exists once per app)

```ts
export interface IPaginatedResponse<T> {
  readonly items: T[];
  readonly totalCount: number;
}
```

`core/models/enums/order-by-dir.enum.ts` (exists once per app)

```ts
export enum OrderByDir {
  Ascending = 'Ascending',
  Descending = 'Descending',
}
```

`core/models/asset/request/get-paginated-assets-request.interface.ts`

```ts
import { OrderByDir } from '../../enums/order-by-dir.enum';

export interface IGetPaginatedAssetsRequest {
  readonly page: number;
  readonly itemsPerPage: number;
  readonly tenantGuid?: string;
  readonly filter?: string;
  readonly orderBy?: string;
  readonly orderByDir?: OrderByDir;
}
```

`core/models/asset/request/asset-creation-request.interface.ts`

```ts
export interface IAssetCreationRequest {
  readonly tenantGuid: string;
  readonly name: string;
  readonly description?: string;
}
```

`core/models/asset/request/asset-update-request.interface.ts`

```ts
export interface IAssetUpdateRequest {
  readonly guid: string;
  readonly name: string;
  readonly description?: string;
}
```

`core/models/asset/response/asset-response.interface.ts`

```ts
export interface IAssetResponse {
  readonly guid: string;
  readonly name: string;
  readonly description?: string;
  readonly tenantName: string;
  readonly createdAt: string;
}
```

## API Service

`core/services/assets/assets.service.ts`

```ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IPaginatedResponse } from '../../models/paginated-response.interface';
import { IAssetCreationRequest } from '../../models/asset/request/asset-creation-request.interface';
import { IAssetUpdateRequest } from '../../models/asset/request/asset-update-request.interface';
import { IGetPaginatedAssetsRequest } from '../../models/asset/request/get-paginated-assets-request.interface';
import { IAssetResponse } from '../../models/asset/response/asset-response.interface';
import { ErrorHandlerService } from '../error-handler/error-handler.service';
import { ToastService } from '../toast/toast.service';

@Injectable({ providedIn: 'root' })
export class AssetsService {
  private readonly http = inject(HttpClient);
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly toastService = inject(ToastService);

  private readonly assetsUrl = `${environment.subscriptionsApiUri}/api/v1.0/assets`;

  public getPaginatedAssets(request: IGetPaginatedAssetsRequest): Observable<IPaginatedResponse<IAssetResponse>> {
    return this.http
      .get<IPaginatedResponse<IAssetResponse>>(`${this.assetsUrl}/paginated`, { params: AssetsService.toParams(request) })
      .pipe(catchError(error => this.errorHandler.handleError(error)));
  }

  public getAsset(assetGuid: string): Observable<IAssetResponse> {
    return this.http
      .get<IAssetResponse>(`${this.assetsUrl}/${assetGuid}`)
      .pipe(catchError(error => this.errorHandler.handleError(error)));
  }

  public createAsset(request: IAssetCreationRequest): Observable<IAssetResponse> {
    return this.http.post<IAssetResponse>(this.assetsUrl, request).pipe(
      tap(() => this.toastService.showToast('assets.messages.created', 'success')),
      catchError(error => this.errorHandler.handleError(error))
    );
  }

  public updateAsset(request: IAssetUpdateRequest): Observable<void> {
    return this.http.put<void>(this.assetsUrl, request).pipe(
      tap(() => this.toastService.showToast('assets.messages.updated', 'success')),
      catchError(error => this.errorHandler.handleError(error))
    );
  }

  public deleteAsset(assetGuid: string): Observable<void> {
    return this.http.delete<void>(`${this.assetsUrl}/${assetGuid}`).pipe(
      tap(() => this.toastService.showToast('assets.messages.deleted', 'success')),
      catchError(error => this.errorHandler.handleError(error))
    );
  }

  private static toParams(request: IGetPaginatedAssetsRequest): HttpParams {
    let params = new HttpParams().set('page', request.page).set('itemsPerPage', request.itemsPerPage);

    if (request.tenantGuid) {
      params = params.set('tenantGuid', request.tenantGuid);
    }
    if (request.filter) {
      params = params.set('filter', request.filter);
    }
    if (request.orderBy) {
      params = params.set('orderBy', request.orderBy);
    }
    if (request.orderByDir) {
      params = params.set('orderByDir', request.orderByDir);
    }

    return params;
  }
}
```

If `ToastService` doesn't translate keys itself, translate with `TranslateService.instant()` inside `ToastService`, not in each API service.

## State Service

Only when state is shared across routes/components. `core/services/shared/selected-asset-state.service.ts`

```ts
import { Injectable, computed, signal } from '@angular/core';
import { IAssetResponse } from '../../models/asset/response/asset-response.interface';

@Injectable({ providedIn: 'root' })
export class SelectedAssetStateService {
  private readonly selectedAssetSignal = signal<IAssetResponse | null>(null);

  readonly selectedAsset = this.selectedAssetSignal.asReadonly();
  readonly hasSelectedAsset = computed(() => this.selectedAssetSignal() !== null);

  setSelectedAsset(asset: IAssetResponse): void {
    this.selectedAssetSignal.set(asset);
  }

  clearSelectedAsset(): void {
    this.selectedAssetSignal.set(null);
  }
}
```

## Guard

`core/guards/assets.guard.ts`

```ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserConfigService } from '@lantek360/authentication';
import { map } from 'rxjs';
import { AuthService } from '../services/auth/auth.service';

export const assetsGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return inject(UserConfigService).getConfig().pipe(
    map(() => (authService.isSuperAdmin() || authService.isAdmin()) ? true : router.parseUrl('/unauthorized'))
  );
};
```

Returning a `UrlTree` is the modern form. When the repo's existing guards use `router.navigateByUrl('/unauthorized'); return false;`, keep that style for consistency.

## Shared Form Component

Used by both add and update pages. `share/components/forms/asset-form/asset-form.component.ts`

```ts
import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { IAssetResponse } from '../../../../core/models/asset/response/asset-response.interface';

export interface IAssetFormValue {
  readonly name: string;
  readonly description: string;
}

@Component({
  selector: 'app-asset-form',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, TranslatePipe],
  templateUrl: './asset-form.component.html',
  styleUrl: './asset-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetFormComponent {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly asset = input<IAssetResponse | null>(null);
  readonly isSaving = input(false);
  readonly saved = output<IAssetFormValue>();
  readonly cancelled = output<void>();

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)],
  });

  constructor() {
    // Patches the form when the parent loads the asset asynchronously.
    effect(() => {
      const asset = this.asset();
      if (asset) {
        this.form.patchValue({ name: asset.name, description: asset.description ?? '' });
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saved.emit(this.form.getRawValue());
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
```

`asset-form.component.html`

```html
<form [formGroup]="form" (ngSubmit)="onSubmit()">
  <mat-form-field appearance="outline">
    <mat-label>{{ 'assets.form.name' | translate }}</mat-label>
    <input matInput formControlName="name" data-testid="asset-name" />
    @if (form.controls.name.hasError('required')) {
      <mat-error>{{ 'common.validation.required' | translate }}</mat-error>
    }
  </mat-form-field>

  <mat-form-field appearance="outline">
    <mat-label>{{ 'assets.form.description' | translate }}</mat-label>
    <textarea matInput formControlName="description"></textarea>
  </mat-form-field>

  <div class="actions">
    <button mat-button type="button" (click)="onCancel()">{{ 'common.buttons.cancel' | translate }}</button>
    <button mat-flat-button type="submit" [disabled]="form.invalid || isSaving()" data-testid="asset-save">
      {{ 'common.buttons.save' | translate }}
    </button>
  </div>
</form>
```

## List Page

`pages/assets/list-assets/list-assets.component.ts`

```ts
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { EMPTY, Subject, catchError, debounceTime, distinctUntilChanged, filter, finalize, switchMap } from 'rxjs';
import { IAssetResponse } from '../../../core/models/asset/response/asset-response.interface';
import { AssetsService } from '../../../core/services/assets/assets.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ConfirmDialogComponent } from '../../../share/components/dialogs/confirm-dialog/confirm-dialog.component';

const DEFAULT_PAGE_SIZE = 25;
const FILTER_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-list-assets',
  imports: [FormsModule, MatTableModule, MatPaginatorModule, MatButtonModule, MatIconModule, TranslatePipe],
  templateUrl: './list-assets.component.html',
  styleUrl: './list-assets.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListAssetsComponent implements OnInit {
  private readonly assetsService = inject(AssetsService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly filterChanges = new Subject<string>();

  readonly displayedColumns = ['name', 'tenantName', 'createdAt', 'actions'] as const;
  readonly assets = signal<IAssetResponse[]>([]);
  readonly totalCount = signal(0);
  readonly currentPage = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly filterText = signal('');
  readonly isLoading = signal(false);
  // User config is already loaded: the route guard waits for it.
  readonly canManage = this.authService.isSuperAdmin() || this.authService.isAdmin();

  ngOnInit(): void {
    this.listenToFilterChanges();
    this.loadAssets();
  }

  loadAssets(): void {
    this.isLoading.set(true);
    this.assetsService
      .getPaginatedAssets({ page: this.currentPage(), itemsPerPage: this.pageSize(), filter: this.filterText() })
      .pipe(
        finalize(() => this.isLoading.set(false)),
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => {
        this.assets.set(response.items);
        this.totalCount.set(response.totalCount);
      });
  }

  onFilterChange(text: string): void {
    this.filterChanges.next(text);
  }

  onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
    this.loadAssets();
  }

  goToCreateAsset(): void {
    this.router.navigate(['/assets/add']);
  }

  goToEditAsset(asset: IAssetResponse): void {
    this.router.navigate(['/assets/edit', asset.guid]);
  }

  onDeleteAsset(asset: IAssetResponse): void {
    this.dialog
      .open(ConfirmDialogComponent, { width: '500px', data: { title: 'assets.dialogs.deleteTitle', message: 'assets.dialogs.deleteMessage' } })
      .afterClosed()
      .pipe(
        filter((confirmed): confirmed is true => confirmed === true),
        switchMap(() => this.assetsService.deleteAsset(asset.guid)),
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.loadAssets());
  }

  private listenToFilterChanges(): void {
    this.filterChanges
      .pipe(debounceTime(FILTER_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(text => {
        this.filterText.set(text);
        this.currentPage.set(1);
        this.loadAssets();
      });
  }
}
```

`list-assets.component.html`

```html
<div class="header">
  <h2>{{ 'assets.title' | translate }}</h2>
  @if (canManage) {
    <button mat-flat-button type="button" (click)="goToCreateAsset()" data-testid="create-asset">
      {{ 'assets.buttons.create' | translate }}
    </button>
  }
</div>

<input
  type="search"
  [ngModel]="filterText()"
  (ngModelChange)="onFilterChange($event)"
  [attr.aria-label]="'common.filter' | translate"
  [placeholder]="'common.filter' | translate" />

<table mat-table [dataSource]="assets()">
  <ng-container matColumnDef="name">
    <th mat-header-cell *matHeaderCellDef>{{ 'assets.columns.name' | translate }}</th>
    <td mat-cell *matCellDef="let asset">{{ asset.name }}</td>
  </ng-container>
  <!-- tenantName, createdAt columns follow the same shape -->
  <ng-container matColumnDef="actions">
    <th mat-header-cell *matHeaderCellDef></th>
    <td mat-cell *matCellDef="let asset">
      @if (canManage) {
        <button mat-icon-button type="button" (click)="goToEditAsset(asset)" [attr.aria-label]="'common.buttons.edit' | translate">
          <mat-icon>edit</mat-icon>
        </button>
        <button mat-icon-button type="button" (click)="onDeleteAsset(asset)" [attr.aria-label]="'common.buttons.delete' | translate">
          <mat-icon>delete</mat-icon>
        </button>
      }
    </td>
  </ng-container>
  <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
  <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
</table>

@if (!isLoading() && assets().length === 0) {
  <p class="empty">{{ 'assets.empty' | translate }}</p>
}

<mat-paginator
  [length]="totalCount()"
  [pageSize]="pageSize()"
  [pageIndex]="currentPage() - 1"
  [pageSizeOptions]="[10, 25, 50]"
  (page)="onPageChange($event)">
</mat-paginator>
```

Material table structural directives (`*matHeaderCellDef`, `*matCellDef`, `*matRowDef`) are library API and stay as-is.

## Add/Update Page

`pages/assets/update-assets/update-assets.component.ts` (the add page is the same without loading; it maps to `IAssetCreationRequest`)

```ts
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { EMPTY, catchError, finalize } from 'rxjs';
import { IAssetUpdateRequest } from '../../../core/models/asset/request/asset-update-request.interface';
import { IAssetResponse } from '../../../core/models/asset/response/asset-response.interface';
import { AssetsService } from '../../../core/services/assets/assets.service';
import { AssetFormComponent, IAssetFormValue } from '../../../share/components/forms/asset-form/asset-form.component';

@Component({
  selector: 'app-update-assets',
  imports: [AssetFormComponent],
  template: `<app-asset-form [asset]="asset()" [isSaving]="isSaving()" (saved)="onSaved($event)" (cancelled)="goToList()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateAssetsComponent implements OnInit {
  private readonly assetsService = inject(AssetsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // Bound from the :assetGuid route param via withComponentInputBinding().
  readonly assetGuid = input.required<string>();
  readonly asset = signal<IAssetResponse | null>(null);
  readonly isSaving = signal(false);

  ngOnInit(): void {
    this.assetsService
      .getAsset(this.assetGuid())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(asset => this.asset.set(asset));
  }

  onSaved(value: IAssetFormValue): void {
    this.isSaving.set(true);
    this.assetsService
      .updateAsset(this.toUpdateRequest(value))
      .pipe(
        // Already reported to the user by ErrorHandlerService.
        catchError(() => EMPTY),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.goToList());
  }

  goToList(): void {
    this.router.navigate(['/assets']);
  }

  private toUpdateRequest(value: IAssetFormValue): IAssetUpdateRequest {
    return { guid: this.assetGuid(), name: value.name.trim(), description: value.description.trim() || undefined };
  }
}
```

## Routing

`pages/assets/assets.routing.ts`

```ts
import { Routes } from '@angular/router';

export const ASSETS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./list-assets/list-assets.component').then(m => m.ListAssetsComponent) },
  { path: 'add', loadComponent: () => import('./add-assets/add-assets.component').then(m => m.AddAssetsComponent) },
  { path: 'edit/:assetGuid', loadComponent: () => import('./update-assets/update-assets.component').then(m => m.UpdateAssetsComponent) },
];
```

`app.routes.ts` (inside the `FullComponent` shell `children`)

```ts
{
  path: 'assets',
  canActivate: [assetsGuard],
  loadChildren: () => import('./pages/assets/assets.routing').then(m => m.ASSETS_ROUTES)
},
```

`app.config.ts` must register `provideRouter(routes, withComponentInputBinding())` for route params to bind to `input()`.

## Menu Entry

`app.config.ts` → `sidebarConfig.menuItems` (roles must match the guard):

```ts
{
  state: 'assets',
  name: 'assets.title',
  type: menuType.link,
  icon: 'inventory_2',
  roles: [environment.superAdminRole, environment.adminRole]
},
```

## i18n

Add to **every** `src/assets/i18n/<locale>.json` (English text as placeholder in locales without a translation yet):

```json
"assets": {
  "title": "Assets",
  "empty": "No assets found",
  "buttons": { "create": "New asset" },
  "columns": { "name": "Name", "tenantName": "Tenant", "createdAt": "Created" },
  "form": { "name": "Name", "description": "Description" },
  "dialogs": { "deleteTitle": "Delete asset", "deleteMessage": "Are you sure you want to delete this asset?" },
  "messages": { "created": "Asset created", "updated": "Asset updated", "deleted": "Asset deleted" }
}
```
