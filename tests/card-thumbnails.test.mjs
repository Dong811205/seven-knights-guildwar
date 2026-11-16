import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountCardThumbnails} from '../card-thumbnails.mjs';
const tick=()=>new Promise(r=>setTimeout(r,10));
function setup(download){
 const dom=new JSDOM('<main><span data-thumb-guide="guide-a" data-thumb-count="5"></span></main>');
 let selected,limit;const paths=[],revoked=[];
 const db={from:table=>{assert.equal(table,'gvg_attachments');return {select(){return this},eq(key,value){selected=[key,value];return this},order(){return this},limit(n){limit=n;return Promise.resolve({data:[1,2,3].map(i=>({path:`private/${i}.png`}))})}}},storage:{from:bucket=>{assert.equal(bucket,'gvg-guides');return {download:path=>{paths.push(path);return download(path)}}}}};
 const stop=mountCardThumbnails(dom.window.document.querySelector('main'),db,{Observer:null,urlAPI:{createObjectURL:()=>`blob:private-${paths.length}`,revokeObjectURL:u=>revoked.push(u)}});
 return {dom,stop,paths,revoked,get selected(){return selected},get limit(){return limit}};
}
test('card previews download three private images, show remaining count and release blob URLs',async()=>{
 const t=setup(async()=>({data:new Blob(['image'])}));await tick();
 assert.deepEqual(t.selected,['guide_id','guide-a']);assert.equal(t.limit,3);assert.equal(t.dom.window.document.querySelectorAll('img').length,3);assert.equal(t.dom.window.document.querySelector('.quick-thumb-more').textContent,'＋2 張');
 assert.ok([...t.dom.window.document.querySelectorAll('img')].every(i=>i.src.startsWith('blob:')));t.stop();assert.equal(t.revoked.length,3);t.dom.window.close();
});
test('leaving the list while download is pending cannot restore private thumbnails',async()=>{
 let finish;const t=setup(()=>new Promise(r=>{finish=r}));await tick();t.stop();finish({data:new Blob(['image'])});await tick();assert.equal(t.dom.window.document.querySelectorAll('img').length,0);assert.equal(t.paths.length,1);t.dom.window.close();
});
