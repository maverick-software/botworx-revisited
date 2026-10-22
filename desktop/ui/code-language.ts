import {HighlightStyle,syntaxHighlighting} from '@codemirror/language';
import {tags} from '@lezer/highlight';
import {javascript} from '@codemirror/lang-javascript';
import {markdown} from '@codemirror/lang-markdown';
import {json} from '@codemirror/lang-json';
import {html} from '@codemirror/lang-html';
import {css} from '@codemirror/lang-css';
import {python} from '@codemirror/lang-python';
import {sql} from '@codemirror/lang-sql';
export const codeHighlighting=syntaxHighlighting(HighlightStyle.define([{tag:tags.keyword,color:'var(--code-keyword)'},{tag:[tags.string,tags.regexp],color:'var(--code-string)'},{tag:[tags.number,tags.bool,tags.null],color:'var(--code-number)'},{tag:[tags.propertyName,tags.typeName,tags.function(tags.variableName)],color:'var(--code-name)'},{tag:tags.comment,color:'var(--muted)'},{tag:tags.heading,color:'var(--focus)',fontWeight:'bold'},{tag:tags.link,color:'var(--focus)',textDecoration:'underline'}]));
export function codeLanguage(name:string){const ext=name.split('.').at(-1)?.toLowerCase();return ext&&['js','jsx','ts','tsx','mjs','cjs'].includes(ext)?javascript({typescript:ext.includes('ts'),jsx:ext.endsWith('x')}):ext&&['md','markdown'].includes(ext)?markdown():ext==='json'?json():ext&&['html','htm'].includes(ext)?html():ext==='css'?css():ext==='py'?python():ext==='sql'?sql():[];}
