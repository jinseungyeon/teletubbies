import {createAdapter} from './data.js';
import {referenceCharacter,referencePeople} from './reference-model.js';
const api=createAdapter(localStorage);
const params=new URLSearchParams(location.search),mode=params.get('component')||'';
document.documentElement.dataset.component=mode;
window.SenspaceSession={api, characterFor:referenceCharacter, referencePeople, current:await api.me(), users:await api.list(), mode,floor:Number(params.get('floor'))||3};
await import('/vendor/dc-runtime.js');
