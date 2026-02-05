# Testing

## Unit Testing

Unit tests are executed using `vitest` and are located in the `src/__tests__/` directory. To run the unit tests, use the following command:

```bash
npm test
```

These tests run in the CI environment as well.

More information about Vitest can be found in their [documentation](https://vitest.dev/).

## End-to-End Testing

E2E tests are located in the `e2e/` directory and are executed using `playwright`. To run the E2E tests, use the following command:

```bash
npx playwright test
```

These tests run in the CI environment as well.

If you want to observe the E2E tests how they execute in the browser, you can run them with the UI support:

```bash
npx playwright test --ui
```

More information about Playwright can be found in their [documentation](https://playwright.dev/docs/intro).