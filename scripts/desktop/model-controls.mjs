import {expect} from '@playwright/test';
// Follow the two-step composer UI rather than depending on a combined panel.
export async function openModelCatalog(page,scope=page){
 if(await page.locator('.catalog-popover').isVisible())return;
 if(!await page.locator('.effort-popover').isVisible())await scope.getByRole('button',{name:'Model and thinking',exact:true}).click();
 await page.getByRole('button',{name:'Select model',exact:true}).click();
}
export async function thinkingSlider(page){
 if(await page.locator('.catalog-popover').isVisible())await page.getByRole('button',{name:'Back to thinking',exact:true}).click();
 else if(!await page.locator('.effort-popover').isVisible())await page.getByRole('button',{name:'Model and thinking',exact:true}).click();
 const slider=page.getByRole('slider',{name:'Thinking level',exact:true});await expect(slider).toBeVisible();return slider;
}
