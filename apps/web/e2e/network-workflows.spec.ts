import { expect, test } from "@playwright/test";
import { seedManagerId, seedTenantId } from "@clientloop/domain";

const apiBaseUrl = `http://127.0.0.1:${process.env.CLIENTLOOP_E2E_API_PORT ?? 4100}`;

test("manager can review the network prospect queue", async ({ page }) => {
  await page.route(`${apiBaseUrl}/v1/session/dev-login`, async (route) => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        "content-type": "application/json"
      },
      postData: JSON.stringify({ tenantId: seedTenantId, userId: seedManagerId })
    });
  });

  await page.goto("/?view=network");

  await expect(page.getByRole("heading", { name: "Client network expansion" })).toBeVisible();
  await expect(page.getByLabel("Network prospecting summary")).toContainText("Prospects0");
  await expect(page.getByLabel("Network prospecting summary")).toContainText("Pending invites0");
  await expect(page.getByLabel("Network queue filters")).toContainText("0 of 0");
  await expect(page.getByText("No network prospects match the filters.")).toBeVisible();
});
