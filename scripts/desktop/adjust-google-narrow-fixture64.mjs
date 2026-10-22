import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const file='scripts/desktop/test-google-documents64-ui.mjs';let source=await readFile(file,'utf8');const resize="await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(620,900));";assert.equal(source.split(resize).length,2);source=source.replace(resize,'');const anchor="const dialog=page.getByRole('dialog',{name:'Open in Google',exact:true});";assert.equal(source.split(anchor).length,2);source=source.replace(anchor,anchor+resize);await writeFile(file,source);
