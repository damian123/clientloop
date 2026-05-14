import { expect, test } from "@playwright/test";
import { seedManagerId, seedTenantId } from "@clientloop/domain";

const apiBaseUrl = "http://127.0.0.1:4100";

test("manager can export contacts and import a contact CSV", async ({ page }) => {
  const suffix = Date.now();
  const firstName = `Import${suffix}`;
  const lastName = "Contact";
  const email = `import-${suffix}@example.com`;
  const phone = "+1 415 555 0199";

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

  const contactImport = page.getByRole("region", { name: "Contact import" });
  await contactImport
    .getByRole("textbox", { name: "Contact CSV" })
    .fill(["First Name,Last Name,Email,Phone", `${firstName},${lastName},${email},${phone}`].join("\n"));

  await contactImport.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText("1 valid rows from 1")).toBeVisible();
  await expect(page.getByLabel("Import preview")).toContainText("1");
  await expect(contactImport.getByRole("button", { name: "Import" })).toBeEnabled();

  await contactImport.getByRole("button", { name: "Import" }).click();
  await expect(page.getByText("Imported 1 contacts")).toBeVisible();

  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Contacts" }).click();
  await expect(page.getByRole("heading", { name: "Relationship map" })).toBeVisible();
  await expect(page.getByRole("button", { name: `${firstName} ${lastName}` })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
});
