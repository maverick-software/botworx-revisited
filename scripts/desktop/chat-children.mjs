import {expect} from '@playwright/test';
export async function openChatChildren(page){
 const trigger=page.getByRole('button',{name:'Subagents in this chat',exact:true});
 await expect(trigger).toBeVisible();
 if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();
 return page.getByRole('complementary',{name:'Subagents in this chat',exact:true});
}
export async function openChildChat(page,threadId){
 const panel=await openChatChildren(page);await panel.locator('[data-chat-child="'+threadId+'"]').click();
 await expect(page.getByRole('region',{name:'Subagent chat',exact:true})).toHaveAttribute('data-open-child',threadId);
}
