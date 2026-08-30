import { expect, test } from "@playwright/test";
import { seedManagerId, seedTenantId } from "@clientloop/domain";

const apiBaseUrl = `http://127.0.0.1:${process.env.CLIENTLOOP_E2E_API_PORT ?? 4100}`;

test("manager can run account-first conference prospecting workflow", async ({ page }) => {
  const suffix = Date.now();
  const conferenceName = `Northwind Product Summit ${suffix}`;
  const companyName = `Harbor Analytics ${suffix}`;
  const personName = `Avery Prospect ${suffix}`;

  await page.route(`${apiBaseUrl}/v1/session/dev-login`, async (route) => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        "content-type": "application/json"
      },
      postData: JSON.stringify({ tenantId: seedTenantId, userId: seedManagerId })
    });
  });

  await page.goto("/?view=conferences");

  await expect(page.getByText("Morgan Manager")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Account first prospecting" })).toBeVisible();

  await page.getByRole("button", { name: "New", exact: true }).click();
  const createConference = page.getByRole("region", { name: "Create conference" });
  await createConference.getByLabel("Conference").fill(conferenceName);
  await createConference.getByLabel("Start").fill("2026-09-14");
  await createConference.getByLabel("End").fill("2026-09-15");
  await createConference.getByLabel("Location").fill("New York, NY");
  await createConference.getByLabel("Audience").fill("Enterprise software and partnerships");
  await createConference.getByRole("button", { name: "Create conference" }).click();

  await expect(page.getByText(`Created ${conferenceName}`)).toBeVisible();
  await expect(page.getByRole("heading", { name: conferenceName })).toBeVisible();

  const companyImport = page.getByRole("region", { name: "Conference company CSV import" });
  await companyImport
    .getByRole("textbox", { name: "Conference company CSV" })
    .fill(
      [
        "Company,Website,Conference role,Sector,Product fit,Expansion fit,Budget fit,Market entry relevance,Partnership relevance,Company score,Source URL",
        `${companyName},https://harbor-analytics.example,sponsor,Enterprise data infrastructure,true,true,false,true,true,18,https://example.com/sponsors`
      ].join("\n")
    );
  await companyImport.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText("1 valid company rows from 1")).toBeVisible();
  await companyImport.getByRole("button", { name: "Import" }).click();
  await expect(page.getByText("Imported 1 companies")).toBeVisible();
  await expect(page.getByText(companyName)).toBeVisible();
  await page.getByRole("table").getByRole("button", { name: "Account" }).click();
  await expect(page.getByText(`Linked ${companyName} to ${companyName}`)).toBeVisible();

  await page.getByRole("button", { name: "People" }).click();
  const personImport = page.getByRole("region", { name: "Conference people CSV import" });
  await personImport
    .getByRole("textbox", { name: "Conference people CSV" })
    .fill(
      [
        "Name,Title,Company,LinkedIn,Conference signal,ICP category,Buying signal,Relationship path,Outreach status,Source type,Source,Lawful basis notes,Opt out status,Seniority score,Company fit score,Signal score,Conference signal score,Warm intro score,Timing score",
        `${personName},Head of Partnerships,${companyName},https://linkedin.com/in/avery-prospect,Speaker on platform integrations panel,partner,Partnership expansion,Ask Morgan,not_started,speaker_agenda,Agenda page,No email stored,not_opted_out,4,4,5,3,1,2`
      ].join("\n")
    );
  await personImport.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText("1 valid people rows from 1")).toBeVisible();
  await personImport.getByRole("button", { name: "Import" }).click();
  await expect(page.getByText("Imported 1 people")).toBeVisible();
  await page.getByRole("table").getByRole("button", { name: "Contact" }).click();
  await expect(page.getByText(`Created contact ${personName}`)).toBeVisible();

  const filters = page.getByRole("region", { name: "Conference people filters" });
  await filters.getByRole("combobox", { name: "Priority" }).selectOption("request_meeting");
  await expect(filters.getByText("Showing 1 of 1 people / 0 selected")).toBeVisible();
  await expect(page.getByRole("table").getByText(personName, { exact: true })).toBeVisible();
  await expect(page.getByText("19/20")).toBeVisible();

  await page.getByLabel(`Select ${personName}`).check();
  await expect(filters.getByText("Showing 1 of 1 people / 1 selected")).toBeVisible();
  await filters.getByRole("button", { name: "Request" }).click();
  await expect(page.getByText("Updated 1 people to meeting requested")).toBeVisible();
  await expect(page.getByRole("table").getByText("meeting requested")).toBeVisible();

  await filters.getByRole("button", { name: "Tasks" }).click();
  await expect(page.getByText("Created 1 tasks")).toBeVisible();

  await page.getByRole("button", { name: "Meetings" }).click();
  const meetingImport = page.getByRole("region", { name: "Conference meeting CSV import" });
  await meetingImport
    .getByRole("textbox", { name: "Conference meeting CSV" })
    .fill(
      [
        "Name,Company,Reason to meet,Proposed ask,Intro path,Meeting requested,Meeting booked,Notes,Next step",
        `${personName},${companyName},Compare notes on a product partnership,15-minute meeting,Warm intro,yes,false,Prioritize before event,Request intro`
      ].join("\n")
    );
  await meetingImport.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText("1 valid meeting rows from 1")).toBeVisible();
  await meetingImport.getByRole("button", { name: "Import" }).click();
  await expect(page.getByText("Imported 1 meetings")).toBeVisible();
  await expect(page.getByRole("table").getByText("Compare notes on a product partnership")).toBeVisible();

  await page.getByRole("button", { name: "Templates" }).click();
  await expect(page.getByRole("region", { name: "Conference CSV templates" })).toContainText("Conference name");
  await expect(page.getByRole("region", { name: "Conference CSV templates" })).toContainText("Meeting requested");
});
