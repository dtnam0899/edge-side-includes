import { expect, type Locator, type Page, test } from '@playwright/test';

/**
 * Phase 5 exit gate (docs/plan/README.md): one scripted scenario from connection to dashboard, through the
 * real portal, core, agents (scripted model, infra/e2e/agents) and SQL Server. Data comes from
 * infra/e2e/fixtures/target.sql: 25 customers, customer n has revenue 10 * n + 25, total 3875.
 * Charts (ADR-0009, ADR-0010): the same result as a bar chart of its current page, saved and on the dashboard.
 */

const connectionString = process.env.E2E_TARGET_CONNECTION_STRING;
const connectionName = 'E2E sales database';
const tableName = 'Revenue by customer';
const kpiName = 'Total revenue';
const chartName = 'Revenue chart';
const dashboardName = 'Sales overview';

test.describe.configure({ mode: 'serial' });

test('a user goes from a new connection to a live dashboard', async ({ page, request }) => {
  expect(connectionString, 'E2E_TARGET_CONNECTION_STRING must be set').toBeTruthy();
  let connectionId = '';
  let dashboardId = '';

  await test.step('accept the consent terms and add a read-only connection', async () => {
    await page.goto('/assistant');
    await page.getByRole('complementary').getByRole('button', { name: 'Add connection' }).click();

    const terms = page.getByRole('dialog', { name: 'Data access and security terms' });
    await expect(terms).toBeVisible();
    await terms.getByLabel(/I have read and accept these terms/).check();
    await terms.getByRole('button', { name: 'Accept terms' }).click();
    await expect(terms).toBeHidden();

    const form = page.getByRole('dialog', { name: 'Add a SQL Server connection' });
    await expect(form).toBeVisible();
    await expect(form.getByText('Use a read-only database login.')).toBeVisible();
    await form.getByLabel('Name').fill(connectionName);
    await form.getByLabel('Connection string').fill(connectionString!);
    await form.getByRole('button', { name: 'Add connection' }).click();
    await expect(form).toBeHidden();

    await page.getByRole('complementary').getByRole('link', { name: new RegExp(connectionName) }).click();
    await expect(page.getByRole('heading', { level: 2, name: connectionName })).toBeVisible();
    connectionId = page.url().match(/connections\/([^/?#]+)/)![1];
  });

  await test.step('test the connection', async () => {
    await page.getByRole('button', { name: 'Test connection' }).click();
    await expect(page.getByText(/Connected to SQL Server .* in \d+ ms\./)).toBeVisible();
  });

  await test.step('the connection string never comes back from the API', async () => {
    const response = await request.get(`/api/connections/${connectionId}`);
    expect(response.ok()).toBeTruthy();
    const body = await response.text();
    expect(body).not.toContain('E2eReader');
    expect(body.toLowerCase()).not.toContain('password');
  });

  await test.step('ask for revenue by customer, review the SQL and run it with paging', async () => {
    const answer = await ask(page, 'Show revenue by customer');
    const sql = answer.getByRole('region', { name: 'Generated SELECT' });
    await expect(sql).toContainText('SELECT c.Name AS Customer');
    await expect(sql).toContainText(/Uses .*dbo\.Customers/);
    // Nothing runs before the user asks for it.
    await expect(answer.getByRole('region', { name: 'Query result' })).toHaveCount(0);

    await answer.getByRole('button', { name: 'Run query' }).click();
    const result = answer.getByRole('region', { name: 'Query result' });
    await expect(result).toContainText('Rows 1–20. 5 more rows after this page.');
    await expect(result.getByRole('row').nth(1)).toContainText('Customer 25');
    // decimal(38,2): the cell keeps the scale (ESI-66).
    await expect(result.getByRole('row').nth(1)).toContainText(/Canada\s*275\.00$/);

    await result.getByRole('button', { name: '2', exact: true }).click();
    await expect(result).toContainText('Rows 21–25. No more rows.');
    await expect(result.getByRole('row').last()).toContainText('Customer 01');
  });

  await test.step('visualize the result as a table and save it', async () => {
    const answer = lastAnswer(page);
    await answer.getByRole('button', { name: 'Table', exact: true }).click();
    const preview = answer.getByRole('group', { name: 'Visualization preview' });
    await expect(preview).toContainText('Revenue by customer');
    // The preview binds the page the result shows (page 2 after the paging above).
    await expect(preview).toContainText('Customer 05');
    await expect(preview).toContainText('rows 21–25 of 25');
    await saveVisualization(page, answer, tableName);
  });

  await test.step('visualize the first page as a chart, view it as a table and save it', async () => {
    const answer = lastAnswer(page);
    const result = answer.getByRole('region', { name: 'Query result' });
    await result.getByRole('button', { name: '1', exact: true }).click();
    await expect(result).toContainText('Rows 1–20. 5 more rows after this page.');

    await answer.getByRole('button', { name: 'Chart', exact: true }).click();
    const preview = answer.getByRole('group', { name: 'Visualization preview' });
    // Chart.js is loaded on demand; the canvas carries the text alternative (ADR-0009).
    const canvas = preview.getByRole('img');
    await expect(canvas).toHaveAttribute('aria-label', /Revenue by customer\. Bar chart of 20 values/);
    await expect(preview).toContainText('First 20 of 25 rows');

    const toggle = preview.getByRole('button', { name: 'View as table' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const table = preview.getByRole('table');
    await expect(table.getByRole('row')).toHaveCount(21);
    // ORDER BY Revenue DESC: customer 25 (275) first; numbers are text in the table view.
    await expect(table.getByRole('row').nth(1)).toContainText(/Customer 25\s*275/);
    await toggle.click();
    await expect(canvas).toBeVisible();
    await saveVisualization(page, answer, chartName);
  });

  await test.step('ask for the total revenue and save it as a KPI', async () => {
    const answer = await ask(page, 'What is the total revenue?');
    await answer.getByRole('button', { name: 'Run query' }).click();
    const result = answer.getByRole('region', { name: 'Query result' });
    await expect(result).toContainText('Rows 1–1. No more rows.');
    await expect(result.getByRole('row').nth(1)).toHaveText(/^\s*3875\.00\s*$/);

    await answer.getByRole('button', { name: 'KPI', exact: true }).click();
    const preview = answer.getByRole('group', { name: 'Visualization preview' });
    await expect(preview).toContainText('Total revenue');
    await expect(preview).toContainText('3,875');
    await saveVisualization(page, answer, kpiName);
  });

  await test.step('a request to change data gets no runnable SQL, and core rejects it anyway', async () => {
    const answer = await ask(page, 'Delete all customers');
    await expect(answer).toContainText('No SQL was produced');
    await expect(answer.getByRole('button', { name: 'Run query' })).toHaveCount(0);

    const direct = await request.post(`/api/connections/${connectionId}/executions`, {
      data: { sql: 'DELETE FROM dbo.Customers', page: 1 },
    });
    expect(direct.status()).toBe(422);
    expect((await direct.json()).type).toBe('urn:esi:problem:sql-rejected');

    const count = await request.post(`/api/connections/${connectionId}/executions`, {
      data: { sql: 'SELECT COUNT(*) AS Customers FROM dbo.Customers', page: 1 },
    });
    expect(count.ok()).toBeTruthy();
    expect(JSON.stringify(await count.json())).toContain('25');
  });

  await test.step('create a dashboard with the three saved visualizations', async () => {
    await page.getByRole('tab', { name: 'Dashboards' }).click();
    await page.getByRole('button', { name: 'New dashboard' }).click();
    const dialog = page.getByRole('dialog', { name: 'New dashboard' });
    await dialog.getByLabel('Name').fill(dashboardName);
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog).toBeHidden();

    if (!/\/dashboards\//.test(page.url())) {
      await page.getByRole('link', { name: new RegExp(dashboardName) }).click();
    }
    await expect(page.getByRole('heading', { level: 2, name: dashboardName })).toBeVisible();
    dashboardId = page.url().match(/dashboards\/([^/?#]+)/)![1];

    for (const name of [tableName, kpiName, chartName]) {
      await page.getByRole('button', { name: 'Add visualization' }).click();
      const picker = page.getByRole('dialog', { name: 'Add a saved visualization' });
      await picker.getByRole('button', { name: `Add ${name}` }).click();
      await expect(dashboardItem(page, name)).toBeVisible();
      if (await picker.isVisible()) await page.keyboard.press('Escape');
      await expect(picker).toBeHidden();
    }
  });

  await test.step('each dashboard item loads live data on its own', async () => {
    await expect(dashboardItem(page, tableName)).toContainText('Customer 25');
    await expect(dashboardItem(page, kpiName)).toContainText('3,875');
    // The chart runs its saved SELECT (page 1) and keeps its caption and table toggle inside the tile.
    const chart = dashboardItem(page, chartName);
    await expect(chart.getByRole('img')).toHaveAttribute('aria-label', /Bar chart of 20 values/);
    await expect(chart).toContainText('First 20 of 25 rows');
    // The tile is placed below the others: bring it on screen, then the toggle must be visible without
    // scrolling inside the tile.
    await chart.scrollIntoViewIfNeeded();
    await expect(chart.getByRole('button', { name: 'View as table' })).toBeInViewport();
  });

  await test.step('move an item with the keyboard; the layout survives a reload', async () => {
    const kpi = dashboardItem(page, kpiName);
    const before = await kpi.evaluate((el) => (el as HTMLElement).style.gridColumn);
    await page.getByRole('button', { name: `Move or resize ${kpiName}` }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Layout saved.')).toBeVisible();
    const after = await kpi.evaluate((el) => (el as HTMLElement).style.gridColumn);
    expect(after).not.toBe(before);

    await page.reload();
    await expect(dashboardItem(page, kpiName)).toContainText('3,875');
    expect(await dashboardItem(page, kpiName).evaluate((el) => (el as HTMLElement).style.gridColumn)).toBe(after);
    await expect(dashboardItem(page, tableName)).toContainText('Customer 25');
    await page.screenshot({ path: 'results/dashboard.png', fullPage: true });
  });

  await test.step('the API agrees: three available items, one a chart, no rows stored', async () => {
    const response = await request.get(`/api/dashboards/${dashboardId}`);
    expect(response.ok()).toBeTruthy();
    const dashboard = await response.json();
    expect(dashboard.items).toHaveLength(3);
    expect(dashboard.items.map((item: { status: string }) => item.status)).toEqual(['available', 'available', 'available']);
    const chart = dashboard.items.find((item: { artifact: { name: string } }) => item.artifact.name === chartName);
    expect(chart.artifact.kind).toBe('chart');
    expect(chart.artifact.dsl.catalogId).toBe('dtnam0899.github.io:esi-catalog-v0_9-1');
    const text = JSON.stringify(dashboard);
    expect(text).not.toContain('Customer 25');
    expect(text).not.toContain('E2eReader');
  });
});

/** Sends a question and returns the assistant's answer (the last list item of the conversation). */
async function ask(page: Page, question: string): Promise<Locator> {
  const before = await page.getByRole('list', { name: 'Conversation' }).getByRole('listitem').count();
  await page.getByLabel('Ask a question about this database').fill(question);
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  const thread = page.getByRole('list', { name: 'Conversation' });
  await expect(thread.getByRole('listitem')).toHaveCount(before + 2, { timeout: 120_000 });
  await expect(thread.getByLabel('Generating an answer')).toHaveCount(0, { timeout: 120_000 });
  return lastAnswer(page);
}

function lastAnswer(page: Page): Locator {
  return page.getByRole('list', { name: 'Conversation' }).getByRole('listitem').last();
}

async function saveVisualization(page: Page, answer: Locator, name: string): Promise<void> {
  await answer.getByRole('button', { name: 'Save as artifact' }).click();
  const dialog = page.getByRole('dialog', { name: 'Save visualization' });
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(answer.getByText(`Saved as “${name}”.`)).toBeVisible();
}

function dashboardItem(page: Page, name: string): Locator {
  return page.getByRole('article', { name });
}
