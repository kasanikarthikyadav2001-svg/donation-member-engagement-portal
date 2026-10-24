import { test, expect, type Page } from "@playwright/test";
const password = process.env.DEMO_PASSWORD;
if (!password)
  throw new Error(
    "Set DEMO_PASSWORD before E2E tests. Use a seeded, isolated development database.",
  );
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Good to see you/ }),
  ).toBeVisible();
}
async function nav(page: Page, name: string) {
  const mobile = page.getByRole("button", { name: "Open navigation" });
  if (await mobile.isVisible()) await mobile.click();
  await page.getByRole("link", { name, exact: true }).click();
}

for (const outcome of ['Successful payment', 'Declined payment', 'Cancelled checkout']) {
  test(`dummy checkout persists ${outcome.toLowerCase()} without real card input`, async ({page}) => {
    await login(page,'donor@beacon.local');
    await nav(page,'Donations');
    await page.getByRole('button',{name:'Make a donation',exact:true}).click();
    const form=page.getByRole('dialog');
    await form.getByLabel('Amount (AUD)').fill('25.50');
    await form.getByLabel('Payment method').selectOption('dummy');
    await form.getByRole('button',{name:'Continue to checkout'}).click();
    await expect(page.getByRole('heading',{name:'Dummy checkout',exact:true})).toBeVisible();
    await page.getByRole('radio',{name:new RegExp(outcome)}).check();
    await page.getByRole('button',{name:'Simulate payment',exact:true}).click();
    const result=outcome==='Successful payment'?'Dummy payment successful':outcome==='Declined payment'?'Dummy payment declined':'Dummy checkout cancelled';
    await expect(page.getByRole('heading',{name:result,exact:true})).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading',{name:result,exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    if(outcome==='Successful payment') {
      const download=page.waitForEvent('download');
      await page.getByRole('button',{name:'Download simulation receipt'}).click();
      expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
    } else await expect(page.getByRole('button',{name:'Download simulation receipt'})).toHaveCount(0);
  });
}
test("administrator creates a person, records a donation and downloads a PDF", async ({
  page,
}) => {
  await login(page, "admin@beacon.local");
  await nav(page, "People");
  await page.getByRole("button", { name: "Add person", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const name = `E2E Person ${Date.now()}`;
  await dialog.getByLabel("Full name").fill(name);
  await dialog
    .getByLabel("Email address")
    .fill(`e2e-${Date.now()}@example.org`);
  await dialog.getByRole("button", { name: "Add person", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("textbox", { name: "Search name or email…" }).fill(name);
  await expect(page.getByRole("cell").filter({ hasText: name })).toBeVisible();
  await nav(page, "Donations");
  await page
    .getByRole("button", { name: "Record donation", exact: true })
    .click();
  await page.getByRole("dialog").getByLabel("Find a donor").fill(name);
  const donorSelect = page
    .getByRole("dialog")
    .getByLabel("Donor", { exact: true });
  await expect(
    donorSelect.locator("option").filter({ hasText: name }),
  ).toHaveCount(1);
  await donorSelect.selectOption(
    (await donorSelect
      .locator("option")
      .filter({ hasText: name })
      .getAttribute("value")) as string,
  );
  await page.getByLabel("Amount (AUD)").fill("27.50");
  await page.getByRole("button", { name: "Record received donation" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("$27.50");
  const download = page.waitForEvent("download");
  await row
    .getByRole("button", { name: `Download receipt for ${name}` })
    .click();
  expect((await download).suggestedFilename()).toMatch(/BCN-.*\.pdf/);
});
test("member submits an eligible survey and cannot access administrator routes", async ({
  page,
}) => {
  await login(page, "member@beacon.local");
  await page.goto("/administration");
  await expect(
    page.getByRole("heading", { name: /Good to see you/ }),
  ).toBeVisible();
  await nav(page, "Surveys");
  const card = page
    .locator(".survey-card")
    .filter({ hasText: "Shape our next community initiative" });
  const take = card.getByRole("button", { name: "Take survey" });
  if (await take.isVisible()) {
    await take.click();
    await page
      .getByLabel("Which initiative matters most to you? *")
      .selectOption("Food relief");
    await page
      .getByRole("dialog")
      .locator('input[type=radio][value="5"]')
      .check();
    await page.getByRole("button", { name: "Submit response" }).click();
    await expect(
      card.getByRole("button", { name: "Completed" }),
    ).toBeDisabled();
  } else
    await expect(
      card.getByRole("button", { name: "Completed" }),
    ).toBeDisabled();
});
test("survey draft can be created, published, reviewed and closed", async ({
  page,
}) => {
  await login(page, "admin@beacon.local");
  await nav(page, "Surveys");
  await page.getByRole("button", { name: "Create survey" }).click();
  const name = `E2E survey ${Date.now()}`;
  await page.getByLabel("Survey title").fill(name);
  await page
    .getByLabel("Question", { exact: true })
    .fill("What should we improve?");
  await page.getByRole("button", { name: "Save draft" }).click();
  const card = page.locator(".survey-card").filter({ hasText: name });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(card).toContainText("Published");
  await card.getByRole("button", { name: "Results", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("0 responses");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await card.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(card).toContainText("Closed");
});
test("dashboard and settings remain usable without viewport overflow", async ({
  page,
}) => {
  await login(page, "donor@beacon.local");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await nav(page, "Settings");
  await expect(
    page.getByRole("heading", { name: "Account settings" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
