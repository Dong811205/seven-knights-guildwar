// Private, viewport-lazy previews. Never create public or shareable image URLs.
export function mountCardThumbnails(root,db,{isAllowed=()=>true,Observer=globalThis.IntersectionObserver,urlAPI=URL}={}){
 let active=true;const urls=[],pending=[];let running=0;
 const valid=slot=>active&&slot.isConnected&&isAllowed();
 async function load(slot){
  if(!valid(slot))return;
  try{
   const {data,error}=await db.from('gvg_attachments').select('id,path,filename').eq('guide_id',slot.dataset.thumbGuide).order('created_at').limit(3);
   if(!valid(slot))return;if(error)throw error;
   slot.replaceChildren();if(!data?.length){slot.textContent='尚無截圖';return;}
   for(const [i,a]of data.entries()){
    if(!valid(slot))return;
    const tile=slot.ownerDocument.createElement('span');tile.className='quick-thumb';tile.textContent='載入中…';slot.append(tile);
    try{
     const {data:blob,error}=await db.storage.from('gvg-guides').download(a.path);
     if(!valid(slot))return;if(error)throw error;
     const url=urlAPI.createObjectURL(blob);urls.push(url);
     const img=slot.ownerDocument.createElement('img');img.src=url;img.alt=`截圖預覽 ${i+1}`;img.decoding='async';tile.replaceChildren(img);
    }catch{if(valid(slot))tile.textContent='預覽暫時無法載入';}
   }
   const extra=Number(slot.dataset.thumbCount)-data.length;
   if(extra>0&&valid(slot)){const badge=slot.ownerDocument.createElement('span');badge.className='quick-thumb-more';badge.textContent=`＋${extra} 張`;slot.append(badge);}
  }catch{if(valid(slot))slot.textContent='預覽暫時無法載入，點開查看截圖';}
 }
 function drain(){while(active&&running<2&&pending.length){const slot=pending.shift();running++;load(slot).finally(()=>{running--;drain();});}}
 const slots=[...root.querySelectorAll('[data-thumb-guide]')];
 const observer=Observer?new Observer(entries=>{for(const e of entries)if(e.isIntersecting){observer.unobserve(e.target);pending.push(e.target);}drain();},{rootMargin:'200px'}):null;
 if(observer)slots.forEach(s=>observer.observe(s));else{pending.push(...slots);drain();}
 return ()=>{active=false;observer?.disconnect();pending.length=0;urls.forEach(u=>urlAPI.revokeObjectURL(u));};
}
