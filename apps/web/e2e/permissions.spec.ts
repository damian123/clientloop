import { expect, test } from "@playwright/test";
import { seedManagerId, seedTenantId } from "@clientloop/domain";

const ownedAccountPath =
  "/?view=accounts&record=account%3A00000000-0000-4000-8000-000000001001";
const apiBaseUrl = "http://127.0.0.1:4100";

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
