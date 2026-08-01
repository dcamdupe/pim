import { chromium } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 1100 } });
const page = await context.newPage();

await page.goto('http://localhost:5173/login');
await page.locator('#email').fill('testuser@example.com');
await page.locator('#password').fill('TestPassword123!');
await page.getByRole('button', { name: 'Log in' }).click();
await page.waitForURL(/\/dashboard$/);
await page.getByText('Recent transactions').waitFor();
await page.waitForTimeout(300);

const chartsRow = await page.locator('.charts-row').boundingBox();
const recentCard = await page.locator('.recent-card').boundingBox();
console.log('charts-row bottom:', chartsRow.y + chartsRow.height);
console.log('recent-card top:', recentCard.y);
console.log('gap:', recentCard.y - (chartsRow.y + chartsRow.height));

const recentCardStyle = await page.locator('.recent-card').evaluate((el) => {
  const s = getComputedStyle(el);
  return { marginTop: s.marginTop, class: el.className };
});
console.log('recent-card computed style:', JSON.stringify(recentCardStyle));

const recentHeadStyle = await page.locator('.recent-head').evaluate((el) => {
  const s = getComputedStyle(el);
  return { display: s.display, justifyContent: s.justifyContent, class: el.className };
});
console.log('recent-head computed style:', JSON.stringify(recentHeadStyle));

const viewAllExists = await page.locator('.view-all').count();
console.log('view-all count:', viewAllExists);
if (viewAllExists) {
  const viewAllStyle = await page.locator('.view-all').evaluate((el) => {
    const s = getComputedStyle(el);
    return { fontWeight: s.fontWeight, fontSize: s.fontSize, color: s.color, textDecoration: s.textDecoration, class: el.className };
  });
  console.log('view-all computed style:', JSON.stringify(viewAllStyle));
  const viewAllBox = await page.locator('.view-all').boundingBox();
  const recentHeadBox = await page.locator('.recent-head').boundingBox();
  console.log('view-all right edge:', viewAllBox.x + viewAllBox.width, 'recent-head right edge:', recentHeadBox.x + recentHeadBox.width);
} else {
  console.log('NO .view-all ELEMENT FOUND - checking for RouterLink text instead');
  const linkText = await page.getByText('View all').count();
  console.log('"View all" text count:', linkText);
}

await browser.close();
