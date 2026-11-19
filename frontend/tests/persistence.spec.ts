import { expect, test } from "@playwright/test";
import { andSave, dragCardToColumn, signInToBoard } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signInToBoard(page);
});

test("renamed column persists after reload", async ({ page }) => {
  const input = page.getByTestId("column-col-done").getByLabel("Column title");
  await andSave(page, () => input.fill("Shipped"));
  await page.reload();
  await expect(page.getByTestId("column-col-done").getByLabel("Column title")).toHaveValue("Shipped");
});

test("added card persists after reload", async ({ page }) => {
  const column = page.getByTestId("column-col-discovery");
  await column.getByRole("button", { name: /add a card/i }).click();
  await column.getByPlaceholder("Card title").fill("Persistent card");
  await column.getByPlaceholder("Details").fill("Survives reload");
  await andSave(page, () => column.getByRole("button", { name: /add card/i }).click());
  await page.reload();
  await expect(page.getByTestId("column-col-discovery").getByText("Persistent card")).toBeVisible();
  await expect(page.getByTestId("column-col-discovery").getByText("Survives reload")).toBeVisible();
});

test("edited card persists after reload", async ({ page }) => {
  const card = page.getByTestId("card-card-3");
  await card.getByRole("button", { name: "Edit Prototype analytics view", exact: true }).click();
  await card.getByLabel("Edit title").fill("Edited and saved");
  await andSave(page, () => card.getByRole("button", { name: /save/i }).click());
  await page.reload();
  await expect(page.getByTestId("card-card-3").getByText("Edited and saved")).toBeVisible();
});

test("deleted card stays deleted after reload", async ({ page }) => {
  const column = page.getByTestId("column-col-done");
  await andSave(page, () =>
    column.getByRole("button", { name: "Delete Ship marketing page", exact: true }).click()
  );
  await page.reload();
  await expect(page.getByTestId("column-col-done")).toBeVisible();
  await expect(page.getByText("Ship marketing page")).toHaveCount(0);
});

test("moved card persists after reload", async ({ page }) => {
  await andSave(page, () => dragCardToColumn(page, "card-card-1", "column-col-review"));
  await page.reload();
  await expect(page.getByTestId("column-col-review").getByTestId("card-card-1")).toBeVisible();
  await expect(page.getByTestId("column-col-backlog").getByTestId("card-card-1")).toHaveCount(0);
});
