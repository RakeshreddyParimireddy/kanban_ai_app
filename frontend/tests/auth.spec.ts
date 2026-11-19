import { expect, test } from "@playwright/test";
import { signIn, signInToBoard } from "./helpers";

test("shows login before the board", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(0);
});

test("rejects wrong password", async ({ page }) => {
  await signIn(page, "wrong");
  await expect(page.getByText("Invalid username or password")).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(0);
});

test("signs in, keeps session on reload, and logs out", async ({ page }) => {
  await signInToBoard(page);
  await page.reload();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
