export async function expandWorkHistory(page){
 await page.locator('.chat-loading').waitFor({state:'hidden'});
 await page.locator('.turn-work-toggle').first().waitFor({state:'visible'});
 const collapsed=page.locator('.turn-work-toggle[aria-expanded="false"]');
 while(await collapsed.count())await collapsed.first().click();
}
