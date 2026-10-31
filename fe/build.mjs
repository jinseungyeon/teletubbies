import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('./',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
const [template,logic,auth]=await Promise.all([read('src/senspace.template.html'),read('src/senspace.js'),read('src/senspace-auth.html')]);
await writeFile(new URL('senspace-preview.html',root),template.replace('<!-- AUTH_SCREEN -->',auth).replace('<!-- APP_LOGIC -->',`<script type="text/x-dc" data-dc-script>${logic}</script>`));
await writeFile(new URL('senspace-components.html',root),template.replace('<!-- AUTH_SCREEN -->',auth).replace('<!-- APP_LOGIC -->',`<script type="text/x-dc" data-dc-script>${logic}</script>`));
console.log('Built isolated Senspace preview; the existing app entry is unchanged.');
