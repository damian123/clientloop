import { expect, test } from "@playwright/test";
import { seedTenantId, seedUserId } from "@clientloop/domain";

const apiBaseUrl = "http://127.0.0.1:4100";
const ownedAccountId = "00000000-0000-4000-8000-000000001001";

test("sales rep can advance an owned opportunity stage", async ({ page }) => {
  const suffix = Date.now();
  const opportunityName = `E2E stage movement ${suffix}`;

  const response = await page.request.post(`${apiBaseUrl}/v1/opportunities`, {
    data: {
      accountId: ownedAccountId,
      name: opportunityName,
      stage: "qualification",
      amount: 42000,
      currency: "USD",
      expectedCloseDate: "2026-07-30",
      ownerUserId: seedUserId,
      probabilityPct: 20,
      customFields: {}
    },
    headers: {
      "x-tenant-id": seedTenantId,
      "x-user-id": seedUserId
    }
  });
  expect(response.ok()).toBe(true);

  await page.goto("/?view=pipeline");

  await expect(page.getByText("Alex Rep")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Opportunities by stage" })).toBeVisible();

  const qualificationColumn = page.getByRole("region", { name: "Qualification" });
  const discoveryColumn = page.getByRole("region", { name: "Discovery" });
  await expect(qualificationColumn.getByText(opportunityName)).toBeVisible();

  await qualificationColumn.getByRole("button", { name: `Advance ${opportunityName}` }).click();

  await expect(discoveryColumn.getByText(opportunityName)).toBeVisible();
  await expect(qualificationColumn.getByText(opportunityName)).toBeHidden();
});
