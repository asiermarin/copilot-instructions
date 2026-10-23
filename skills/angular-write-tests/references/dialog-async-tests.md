# Dialog and Async Tests

## Page Action That Opens a Confirm Dialog

Cover each dialog result: confirmed (`true`), dismissed (`false`/`undefined`).

```ts
describe('onDeleteAsset', () => {
  function mockDialogResult(result: boolean | undefined): void {
    dialog.open.mockReturnValue({ afterClosed: () => of(result) } as MatDialogRef<ConfirmDialogComponent>);
  }

  it('should open the confirm dialog with the delete texts when deleting', () => {
    // Arrange
    createComponent();
    mockDialogResult(false);

    // Act
    component.onDeleteAsset(ASSET);

    // Assert
    expect(dialog.open).toHaveBeenCalledWith(ConfirmDialogComponent, {
      width: '500px',
      data: { title: 'assets.dialogs.deleteTitle', message: 'assets.dialogs.deleteMessage' },
    });
  });

  it('should delete and reload when the user confirms', () => {
    // Arrange
    createComponent();
    mockDialogResult(true);
    assetsService.getPaginatedAssets.mockClear();

    // Act
    component.onDeleteAsset(ASSET);

    // Assert
    expect(assetsService.deleteAsset).toHaveBeenCalledWith(ASSET.guid);
    expect(assetsService.getPaginatedAssets).toHaveBeenCalledTimes(1);
  });

  it.each([false, undefined])('should not delete when the dialog result is %p', result => {
    // Arrange
    createComponent();
    mockDialogResult(result);

    // Act
    component.onDeleteAsset(ASSET);

    // Assert
    expect(assetsService.deleteAsset).not.toHaveBeenCalled();
  });
});
```

## Dialog Component

```ts
describe('ConfirmDialogComponent', () => {
  let component: ConfirmDialogComponent;
  let dialogRef: jest.Mocked<MatDialogRef<ConfirmDialogComponent, boolean>>;

  beforeEach(async () => {
    dialogRef = { close: jest.fn() } as unknown as jest.Mocked<MatDialogRef<ConfirmDialogComponent, boolean>>;

    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [
        provideTranslateService(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { title: 'assets.dialogs.deleteTitle', message: 'assets.dialogs.deleteMessage' } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should close with true when the user confirms', () => {
    // Act
    component.onConfirm();

    // Assert
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('should close with false when the user cancels', () => {
    // Act
    component.onCancel();

    // Assert
    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });
});
```

## Timers and Debounce

```ts
it('should call the backend once when the user types quickly', fakeAsync(() => {
  // Arrange
  createComponent();
  assetsService.getPaginatedAssets.mockClear();

  // Act
  component.onFilterChange('l');
  tick(100);
  component.onFilterChange('la');
  tick(100);
  component.onFilterChange('laser');
  tick(300);

  // Assert
  expect(assetsService.getPaginatedAssets).toHaveBeenCalledTimes(1);
  expect(assetsService.getPaginatedAssets).toHaveBeenCalledWith(expect.objectContaining({ filter: 'laser' }));
}));
```

- `tick(ms)` advances virtual time; `flush()` drains all pending timers; `discardPeriodicTasks()` for intervals.
- Never use real `setTimeout` or `await new Promise(r => setTimeout(r, …))`.

## Controlling Emission Timing

Use a `Subject` when the test must observe intermediate state (loading flags):

```ts
it('should show the loading state until the response arrives', () => {
  // Arrange
  const response$ = new Subject<IPaginatedResponse<IAssetResponse>>();
  assetsService.getPaginatedAssets.mockReturnValue(response$);
  createComponent();

  // Act & Assert
  expect(component.isLoading()).toBe(true);
  response$.next(PAGED_ASSETS);
  response$.complete();
  expect(component.isLoading()).toBe(false);
});
```

## Promises

```ts
it('should resolve navigation when saving succeeds', async () => {
  // Arrange
  router.navigate.mockResolvedValue(true);

  // Act
  component.onSaved(FORM_VALUE);
  await fixture.whenStable();

  // Assert
  expect(router.navigate).toHaveBeenCalledWith(['/assets']);
});
```
