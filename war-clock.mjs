const DAY=86400000,TAIPEI_OFFSET=28800000;
const pad=n=>String(n).padStart(2,'0');
export function warClockState(now=new Date()){
 const time=now.getTime(),local=new Date(time+TAIPEI_OFFSET);
 let end=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate(),1)-TAIPEI_OFFSET;
 if(end<=time)end+=DAY;
 const seconds=Math.ceil((end-time)/1000);
 return {current:`${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`,remaining:`${pad(Math.floor(seconds/3600))}:${pad(Math.floor(seconds/60)%60)}:${pad(seconds%60)}`,urgent:seconds<=1800};
}
const slot=typeof document!=='undefined'?document.querySelector('#war-clock'):null;
if(slot){
 slot.innerHTML='<span class="war-clock-current">台灣時間 <time></time></span><span class="war-clock-label">距公會戰 01:00 結束</span><strong class="war-clock-countdown"></strong>';
 const time=slot.querySelector('time'),count=slot.querySelector('strong');
 const tick=()=>{const s=warClockState();time.textContent=s.current;count.textContent=s.remaining;slot.classList.toggle('is-urgent',s.urgent);};
 tick();setInterval(tick,1000);document.addEventListener('visibilitychange',tick);window.addEventListener('pageshow',tick);
}
