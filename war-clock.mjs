const DAY=86400000,TAIPEI_OFFSET=28800000;
const pad=n=>String(n).padStart(2,'0');
const duration=seconds=>`${pad(Math.floor(seconds/3600))}:${pad(Math.floor(seconds/60)%60)}:${pad(seconds%60)}`;
// All schedule boundaries are Taiwan time, independent of the viewer's device timezone.
export function warClockState(now=new Date()){
 const time=now.getTime(),local=new Date(time+TAIPEI_OFFSET);
 const midnight=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate())-TAIPEI_OFFSET;
 const events=[];
 for(let offset=-1;offset<=7;offset++){
  const day=midnight+offset*DAY,weekday=new Date(day+TAIPEI_OFFSET).getUTCDay();
  const kind=[1,3,6].includes(weekday)?'attack':[0,2,5].includes(weekday)?'defense':null;
  if(kind)events.push({kind,start:day+8*3600000,end:day+(kind==='attack'?25:19)*3600000,weekday});
 }
 const event=events.find(e=>e.start<=time&&time<e.end)||events.find(e=>e.start>time);
 const active=event.start<=time,seconds=Math.ceil(((active?event.end:event.start)-time)/1000);
 const action=event.kind==='attack'?'出刀':'防守更新';
 const label=active?(event.kind==='attack'?'提醒出刀 · 距 01:00 結束':'請更新防守隊伍 · 距 19:00 結束'):`距下次${action}開始（週${'日一二三四五六'[event.weekday]} 08:00）`;
 return {current:`${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`,remaining:duration(seconds),urgent:active&&seconds<=1800,kind:event.kind,active,label};
}
const slot=typeof document!=='undefined'?document.querySelector('#war-clock'):null;
if(slot){
 slot.innerHTML='<span class="war-clock-current">台灣時間 <time></time></span><span class="war-clock-label"></span><strong class="war-clock-countdown"></strong>';
 const time=slot.querySelector('time'),count=slot.querySelector('strong'),label=slot.querySelector('.war-clock-label');
 const tick=()=>{const s=warClockState();time.textContent=s.current;count.textContent=s.remaining;label.textContent=s.label;slot.classList.toggle('is-urgent',s.urgent);slot.classList.toggle('is-waiting',!s.active);};
 tick();setInterval(tick,1000);document.addEventListener('visibilitychange',tick);window.addEventListener('pageshow',tick);
}
