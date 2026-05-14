import { expect, test } from "@playwright/test";
import { seedManagerId, seedTenantId, seedUserId } from "@clientloop/domain";

const ownedAccountPath =
  "/?view=accounts&record=account%3A00000000-0000-4000-8000-000000001001";
const apiBaseUrl = "http://127.0.0.1:4100";

const noCreateSession = {
  authenticated: true,
  tenantId: seedTenantId,
  user: {
    id: seedUserId,
    email: "alex.rep@clientloop.test",
    displayName: "Alex Rep",
    permissions: [
      { id: "e2e-account-read", resource: "account", action: "read", condition: "tenant" },
      { id: "e2e-contact-read", resource: "contact", action: "read", condition: "tenant" },
      { id: "e2e-lead-read", resource: "lead", action: "read", condition: "tenant" },
      { id: "e2e-opportunity-read", resource: "opportunity", action: "read", condition: "tenant" }
    ]
  },
  csrfToken: "e2e-csrf-token"
};

test("sales rep can edit custom fields on owned account records", async ({ page }) => {
  await page.goto(ownedAccountPath);

  await expect(page.getByText("Alex Rep")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Northstar Robotics" })).toBeVisible();

  const healthScore = page.getByRole("spinbutton", { name: "Health score" });
  const saveFields = page.getByRole("button", { name: "Save fields" });

  await expect(healthScore).toBeEnabled();
  await expect(saveFields).toBeDisabled();

  await healthScore.fill("77");

  await expect(saveFields).toBeEnabled();
});

test("sales rep cannot edit custom fields on manager-owned account records", async ({ page }) => {
  const accountName = `Manager-owned e2e ${Date.now()}`;
  const accountResponse = await page.request.post(`${apiBaseUrl}/v1/accounts`, {
    data: {
      name: accountName,
      domain: `${Date.now()}.manager-e2e.example`,
      ownerUserId: seedManagerId,
      status: "prospect",
      customFields: { health_score: 62 }
    },
    headers: {
      "x-tenant-id": seedTenantId,
      "x-user-id": seedManagerId
    }
  });
  expect(accountResponse.ok()).toBe(true);
  const account = await accountResponse.json();

  await page.goto(`/?view=accounts&record=account%3A${account.id}`);

  await expect(page.getByText("Alex Rep")).toBeVisible();
  await expect(page.getByRole("heading", { name: accountName })).toBeVisible();

  await expect(page.getByRole("spinbutton", { name: "Health score" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save fields" })).toBeDisabled();
});

test("sales rep create permissions enable contextual New in create-capable views", async ({ page }) => {
  for (const view of ["pipeline", "leads", "accounts", "contacts"]) {
    await page.goto(`/?view=${view}`);
    await expect(page.getByText("Alex Rep")).toBeVisible();
    await expect(page.getByRole("button", { name: "New", exact: true })).toBeEnabled();
  }

  await page.goto("/?view=data");
  await expect(page.getByText("Alex Rep")).toBeVisible();
  await expect(page.getByRole("button", { name: "New", exact: true })).toBeDisabled();
});

test("contextual New is disabled when the session lacks create permissions", async ({ page }) => {
  await page.route(`${apiBaseUrl}/v1/session`, async (route) => {
    await route.fulfill({ json: noCreateSession });
  });

  await page.goto("/?view=pipeline");

  await expect(page.getByText("Alex Rep")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pipeline" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New", exact: true })).toBeDisabled();
});

test("timeline create and correction controls are disabled without timeline permissions", async ({ page }) => {
  await page.route(`${apiBaseUrl}/v1/session`, async (route) => {
    await route.fulfill({ json: noCreateSession });
  });

  await page.goto(ownedAccountPath);

  await expect(page.getByText("Alex Rep")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Northstar Robotics" })).toBeVisible();

  await page
    .getByRole("region", { name: "Create follow-up task" })
    .getByRole("textbox", { name: "Title" })
    .fill("Permission blocked task");
  await expect(
    page.getByRole("region", { name: "Create follow-up task" }).getByRole("button", { name: "Add task" })
  ).toBeDisabled();

  await page
    .getByRole("region", { name: "Record notes" })
    .getByRole("textbox", { name: "Note" })
    .fill("Permission blocked note");
  await expect(
    page.getByRole("region", { name: "Record notes" }).getByRole("button", { name: "Save note" })
  ).toBeDisabled();

  await page
    .getByRole("region", { name: "Log activity" })
    .getByRole("textbox", { name: "Subject" })
    .fill("Permission blocked activity");
  await expect(
    page.getByRole("region", { name: "Log activity" }).getByRole("button", { name: "Log activity" })
  ).toBeDisabled();

  await expect(page.getByRole("button", { name: "Edit note" })).toBeDisabled();
});

test("task queue update controls follow task update permissions", async ({ page }) => {
  await page.goto("/?view=pipeline");

  await expect(page.getByText("Alex Rep")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Today and next" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Send discovery recap" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Complete Send discovery recap" })).toBeEnabled();
});

test("task queue update controls are disabled without task update permissions", async ({ page }) => {
  await page.route(`${apiBaseUrl}/v1/session`, async (route) => {
    await route.fulfill({ json: noCreateSession });
  });

  await page.goto("/?view=pipeline");

  await expect(page.getByText("Alex Rep")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Today and next" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Send discovery recap" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Complete Send discovery recap" })).toBeDisabled();
});
