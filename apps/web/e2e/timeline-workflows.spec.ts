import { expect, test } from "@playwright/test";

const ownedAccountPath =
  "/?view=accounts&record=account%3A00000000-0000-4000-8000-000000001001";

test("sales rep can create record timeline task, note, and activity entries", async ({ page }) => {
  const suffix = Date.now();
  const taskTitle = `E2E follow-up ${suffix}`;
  const noteBody = `E2E note ${suffix}`;
  const activitySubject = `E2E activity ${suffix}`;

  await page.goto(ownedAccountPath);

  await expect(page.getByText("Alex Rep")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Northstar Robotics" })).toBeVisible();
  const recordTimeline = page.getByRole("region", { name: "Record timeline" });

  const taskRegion = page.getByRole("region", { name: "Create follow-up task" });
  await taskRegion.getByRole("textbox", { name: "Title" }).fill(taskTitle);
  await taskRegion.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText("Task added")).toBeVisible();
  await expect(recordTimeline.getByText(taskTitle)).toBeVisible();

  const createdTask = page.locator("article").filter({ hasText: taskTitle });
  await expect(createdTask).toContainText("open / medium");
  await createdTask.getByRole("button", { name: `Complete ${taskTitle}` }).click();
  await expect(createdTask).toContainText("done / medium");
  await expect(createdTask.getByRole("button", { name: `Complete ${taskTitle}` })).toBeDisabled();

  const noteRegion = page.getByRole("region", { name: "Record notes" });
  await noteRegion.getByRole("textbox", { name: "Note" }).fill(noteBody);
  await noteRegion.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Note saved")).toBeVisible();
  await expect(recordTimeline.getByText(noteBody)).toBeVisible();

  const activityRegion = page.getByRole("region", { name: "Log activity" });
  await activityRegion.getByRole("textbox", { name: "Subject" }).fill(activitySubject);
  await activityRegion.getByRole("button", { name: "Log activity" }).click();
  await expect(page.getByText("Activity logged")).toBeVisible();
  await expect(recordTimeline.getByText(activitySubject)).toBeVisible();
});
