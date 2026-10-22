import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const file='scripts/desktop/test-google-documents64-ui.mjs';let source=await readFile(file,'utf8');
const before="await page.evaluate(()=>window.mode='error');await menu().click();await page.getByRole('menuitem',{name:'Open in Google Slides…',exact:true}).click();";
const after="await page.evaluate(()=>window.mode='error');await page.getByRole('link',{name:'Sample.docx',exact:true}).click({button:'right'});await page.getByRole('menuitem',{name:'Import into Google Docs…',exact:true}).click();";
assert(source.includes(before));source=source.replace(before,after);await writeFile(file,source);
