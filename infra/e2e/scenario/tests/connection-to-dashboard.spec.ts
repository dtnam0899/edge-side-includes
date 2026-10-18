import { expect, type Locator, type Page, test } from '@playwright/test';

/**
 * Phase 5 exit gate (docs/plan/README.md): one scripted scenario from connection to dashboard, through the
 * real portal, core, agents (scripted model, infra/e2e/agents) and SQL Server. Data comes from
 * infra/e2e/fixtures/target.sql: 25 customers, customer n has revenue 10 * n + 25, total 3875.
 */

const connectionString = process.env.E2E_TARGET_CONNECTION_STRING;
const connectionName = 'E2E sales database';
const tableName = 'Revenue by customer';
const kpiName = 'Total revenue';
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
    // The cell shows 275, not 275.00: JSON numbers lose the decimal scale in the browser (known, see README).
    await expect(result.getByRole('row').nth(1)).toContainText(/Canada\s*275$/);

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

  await test.step('ask for the total revenue and save it as a KPI', async () => {
    const answer = await ask(page, 'What is the total revenue?');
    await answer.getByRole('button', { name: 'Run query' }).click();
    const result = answer.getByRole('region', { name: 'Query result' });
    await expect(result).toContainText('Rows 1–1. No more rows.');
    await expect(result.getByRole('row').nth(1)).toHaveText(/^\s*3875\s*$/);

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

  await test.step('create a dashboard with both saved visualizations', async () => {
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

    for (const name of [tableName, kpiName]) {
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

  await test.step('the API agrees: two available items, no rows stored', async () => {
    const response = await request.get(`/api/dashboards/${dashboardId}`);
    expect(response.ok()).toBeTruthy();
    const dashboard = await response.json();
    expect(dashboard.items).toHaveLength(2);
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
