# Coverage

## Thresholds

`jest.config.js`:

```js
collectCoverageFrom: [
  'src/app/**/*.ts',
  '!src/app/**/*.spec.ts',
  '!src/app/**/*.routing.ts',
  '!src/app/app.config.ts',
  '!src/main.ts',
],
coverageThreshold: {
  global: { statements: 80, lines: 80, functions: 80, branches: 70 },
},
coverageReporters: ['lcov', 'text-summary'],
reporters: ['default', ['jest-sonar', { reportedFilePath: 'absolute' }]],
```

- `npm test` (`jest --coverage`) fails when a global threshold is not met.
- Changed lines in a PR must be ≥ 80% covered (Sonar new-code condition).

## Outputs

| File | Consumer |
|---|---|
| `coverage/lcov.info` | Sonar (`sonar.javascript.lcov.reportPaths`) |
| `coverage/sonar-report.xml` | Sonar test execution (`sonar.testExecutionReportPaths`) |
| `coverage/lcov-report/index.html` | Local inspection |

`coverage/` is a build output: keep it in `.gitignore`.

## Finding Gaps

1. Run a single area with coverage:

   ```powershell
   npx jest src/app/pages/assets --coverage --collectCoverageFrom="src/app/pages/assets/**/*.ts"
   ```

2. Open `coverage/lcov-report/index.html`; red lines are uncovered, yellow `E`/`I` markers are untaken `else`/`if` branches.
3. Typical missing branches in Angular code:
   - error path of `subscribe` / `catchError`
   - `@if` alternatives driven by roles
   - optional params in `HttpParams` builders (`if (request.filter)`)
   - `?.` / `??` fallbacks on optional data
   - dialog dismissed (`false`/`undefined`) result
   - guard deny branch
4. Add a scenario per missing branch. Don't add assertion-less tests to raise numbers.

## Excluding Code

Only bootstrap and declarative config are excluded (`main.ts`, `app.config.ts`, `*.routing.ts`, `environments/`). Never use `/* istanbul ignore */` to hide business logic; if code can't be tested, refactor it (extract a pure function, inject the browser API).
