import { expect, test } from "@playwright/test";
import { seedManagerId, seedTenantId } from "@clientloop/domain";

const apiBaseUrl = "http://127.0.0.1:4100";

test("manager can export contacts and import core record CSVs", async ({ page }) => {
  const suffix = Date.now();
  const accountName = `Import account ${suffix}`;
  const firstName = `Import${suffix}`;
  const lastName = "Contact";
  const email = `import-${suffix}@example.com`;
  const phone = "+1 415 555 0199";
  const opportunityName = `Import opportunity ${suffix}`;

  await page.route(`${apiBaseUrl}/v1/session/dev-login`, async (route) => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        "content-type": "application/json"
      },
      postData: JSON.stringify({ tenantId: seedTenantId, userId: seedManagerId })
    });
  });

  await page.goto("/?view=data");

  await expect(page.getByText("Morgan Manager")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Import and export" })).toBeVisible();

  const exportsRegion = page.getByRole("region", { name: "Exports" });
  const downloadPromise = page.waitForEvent("download");
  await exportsRegion.getByRole("button", { name: "Contacts" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("clientloop-contacts.csv");
  await expect(page.getByText("Exported contacts")).toBeVisible();

  const accountImport = page.getByRole("region", { name: "Account CSV import" });
  await accountImport
    .getByRole("textbox", { name: "Account CSV" })
    .fill(["name,domain,status", `${accountName},import-${suffix}.example,prospect`].join("\n"));
  await accountImport.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText("1 valid account rows from 1")).toBeVisible();
  await expect(accountImport.getByRole("button", { name: "Import" })).toBeEnabled();
  await accountImport.getByRole("button", { name: "Import" }).click();
  await expect(page.getByText("Imported 1 accounts")).toBeVisible();

  const contactImport = page.getByRole("region", { name: "Contact CSV import" });
  await contactImport
    .getByRole("textbox", { name: "Contact CSV" })
    .fill(["First Name,Last Name,Email,Phone", `${firstName},${lastName},${email},${phone}`].join("\n"));

  await contactImport.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText("1 valid rows from 1")).toBeVisible();
  await expect(page.getByLabel("Contact CSV import preview")).toContainText("1");
  await expect(contactImport.getByRole("button", { name: "Import" })).toBeEnabled();

  await contactImport.getByRole("button", { name: "Import" }).click();
  await expect(page.getByText("Imported 1 contacts")).toBeVisible();

  const opportunityImport = page.getByRole("region", { name: "Opportunity CSV import" });
  await opportunityImport
    .getByRole("textbox", { name: "Opportunity CSV" })
    .fill(
      [
        "name,accountId,ownerUserId,stage,amount,currency,probabilityPct",
        `${opportunityName},00000000-0000-4000-8000-000000001001,${seedManagerId},qualification,31000,USD,30`
      ].join("\n")
    );
  await opportunityImport.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText("1 valid opportunity rows from 1")).toBeVisible();
  await expect(opportunityImport.getByRole("button", { name: "Import" })).toBeEnabled();
  await opportunityImport.getByRole("button", { name: "Import" }).click();
  await expect(page.getByText("Imported 1 opportunities")).toBeVisible();

  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Accounts" }).click();
  await expect(page.getByRole("heading", { name: "Book of business" })).toBeVisible();
  await expect(page.getByRole("button", { name: accountName })).toBeVisible();

  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Contacts" }).click();
  await expect(page.getByRole("heading", { name: "Relationship map" })).toBeVisible();
  await expect(page.getByRole("button", { name: `${firstName} ${lastName}` })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Pipeline" }).click();
  await expect(page.getByRole("heading", { name: "Opportunities by stage" })).toBeVisible();
  await expect(page.getByText(opportunityName)).toBeVisible();
});
