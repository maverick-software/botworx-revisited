import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {cp} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {presentationRendererPatch} from './presentation-renderer-patch.mjs';
let pdfOutput='';
export default defineConfig({root:fileURLToPath(new URL('./ui',import.meta.url)),plugins:[react(),presentationRendererPatch(),{name:'pdf-assets',configResolved(config){pdfOutput=path.resolve(config.root,config.build.outDir);},async closeBundle(){for(const name of ['cmaps','standard_fonts','wasm'])await cp(fileURLToPath(new URL('../node_modules/pdfjs-dist/'+name,import.meta.url)),path.join(pdfOutput,'pdf',name),{recursive:true});}}],base:'/',build:{outDir:'../resources/ui',emptyOutDir:true,assetsInlineLimit:0,rollupOptions:{input:{app:fileURLToPath(new URL('./ui/index.html',import.meta.url)),document:fileURLToPath(new URL('./ui/document-viewer.html',import.meta.url)),pdfPages:fileURLToPath(new URL('./ui/pdf-pages.html',import.meta.url))}}},envDir:false});
