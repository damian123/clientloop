import { expect, test } from "@playwright/test";

const ownedAccountPath =
  "/?view=accounts&record=account%3A00000000-0000-4000-8000-000000001001";

test("sales rep can create record timeline task, note, and activity entries", async ({ page }) => {
  const suffix = Date.now();
  const taskTitle = `E2E follow-up ${suffix}`;
  const correctedTaskTitle = `E2E corrected follow-up ${suffix}`;
  const noteBody = `E2E note ${suffix}`;
  const correctedNoteBody = `E2E corrected note ${suffix}`;
  const activitySubject = `E2E activity ${suffix}`;
  const correctedActivitySubject = `E2E corrected activity ${suffix}`;

  await page.goto(ownedAccountPath);

  await expect(page.getByText("Alex Rep")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Northstar Robotics" })).toBeVisible();
  const recordTimeline = page.getByRole("region", { name: "Record timeline" });

  const taskRegion = page.getByRole("region", { name: "Create follow-up task" });
  await taskRegion.getByRole("textbox", { name: "Title" }).fill(taskTitle);
  await taskRegion.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText("Task added")).toBeVisible();
  await expect(recordTimeline.getByText(taskTitle)).toBeVisible();

  const taskTimelineRow = recordTimeline.locator(".timeline-record-row").filter({ hasText: taskTitle });
  await taskTimelineRow.getByRole("button", { name: "Edit task" }).click();
  await recordTimeline.locator(".activity-edit-form").getByRole("textbox").first().fill(correctedTaskTitle);
  await recordTimeline.locator(".activity-edit-form").getByRole("button", { name: "Save correction" }).click();
  await expect(recordTimeline.getByText(correctedTaskTitle)).toBeVisible();

  const createdTask = page.locator("article").filter({ hasText: correctedTaskTitle });
  await expect(createdTask).toContainText("open / medium");
  await createdTask.getByRole("button", { name: `Complete ${correctedTaskTitle}` }).click();
  await expect(createdTask).toContainText("done / medium");
  await expect(createdTask.getByRole("button", { name: `Complete ${correctedTaskTitle}` })).toBeDisabled();

  const noteRegion = page.getByRole("region", { name: "Record notes" });
  await noteRegion.getByRole("textbox", { name: "Note" }).fill(noteBody);
  await noteRegion.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Note saved")).toBeVisible();
  await expect(recordTimeline.getByText(noteBody)).toBeVisible();
  const noteTimelineRow = recordTimeline.locator(".timeline-record-row").filter({ hasText: noteBody });
  await noteTimelineRow.getByRole("button", { name: "Edit note" }).click();
  await recordTimeline.locator(".activity-edit-form").getByRole("textbox").first().fill(correctedNoteBody);
  await recordTimeline.locator(".activity-edit-form").getByRole("button", { name: "Save correction" }).click();
  await expect(recordTimeline.getByText(correctedNoteBody)).toBeVisible();

  const activityRegion = page.getByRole("region", { name: "Log activity" });
  await activityRegion.getByRole("textbox", { name: "Subject" }).fill(activitySubject);
  await activityRegion.getByRole("button", { name: "Log activity" }).click();
  await expect(page.getByText("Activity logged")).toBeVisible();
  await expect(recordTimeline.getByText(activitySubject)).toBeVisible();
  const activityTimelineRow = recordTimeline.locator(".timeline-record-row").filter({ hasText: activitySubject });
  await activityTimelineRow.getByRole("button", { name: "Edit activity" }).click();
  await recordTimeline.locator(".activity-edit-form").getByRole("textbox").first().fill(correctedActivitySubject);
  await recordTimeline.locator(".activity-edit-form").getByRole("button", { name: "Save correction" }).click();
  await expect(recordTimeline.getByText(correctedActivitySubject)).toBeVisible();
});
