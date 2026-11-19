import { expect, test } from "@playwright/test";
import { dragCardToColumn, signInToBoard } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signInToBoard(page);
});

test("loads the kanban board", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await dragCardToColumn(page, "card-card-1", "column-col-review");
  await expect(page.getByTestId("column-col-review").getByTestId("card-card-1")).toBeVisible();
});

test("edits a card", async ({ page }) => {
  const card = page.getByTestId("card-card-2");
  await card.getByRole("button", { name: "Edit Gather customer signals", exact: true }).click();
  await card.getByLabel("Edit title").fill("Edited by e2e");
  await card.getByLabel("Edit details").fill("New details");
  await card.getByRole("button", { name: /save/i }).click();
  await expect(card.getByText("Edited by e2e")).toBeVisible();
  await expect(card.getByText("New details")).toBeVisible();
});

test("deletes a card", async ({ page }) => {
  const column = page.getByTestId("column-col-review");
  await column.getByRole("button", { name: "Delete QA micro-interactions", exact: true }).click();
  await expect(column.getByText("QA micro-interactions")).toHaveCount(0);
});

test("renames a column", async ({ page }) => {
  const input = page.getByTestId("column-col-done").getByLabel("Column title");
  await input.fill("Shipped");
  await expect(input).toHaveValue("Shipped");
});
