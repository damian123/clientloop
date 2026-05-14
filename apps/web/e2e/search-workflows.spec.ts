import { expect, test } from "@playwright/test";

test("sales rep can open a record from global search results", async ({ page }) => {
  await page.goto("/?view=pipeline");

  await expect(page.getByText("Alex Rep")).toBeVisible();
  await page.getByRole("textbox", { name: "Search records" }).fill("Northstar");

  const searchResults = page.getByRole("region", { name: "Search results" });
  await expect(searchResults.getByText("Northstar Robotics")).toBeVisible();
  await searchResults.locator("button").filter({ hasText: "Northstar Robotics" }).click();

  await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Northstar Robotics" })).toBeVisible();
});

test("sales rep can open a global search result with the keyboard", async ({ page }) => {
  await page.goto("/?view=pipeline");

  await expect(page.getByText("Alex Rep")).toBeVisible();
  await page.getByRole("textbox", { name: "Search records" }).fill("Northstar");

  const searchResults = page.getByRole("region", { name: "Search results" });
  await expect(searchResults.getByText("Northstar Robotics")).toBeVisible();

  await page.getByRole("textbox", { name: "Search records" }).press("Enter");

  await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Northstar Robotics" })).toBeVisible();
});
