export const QUICK_IMAGE_LIMIT=10;
export const QUICK_IMAGE_BYTES=5*1024*1024;
export const QUICK_IMAGE_TYPES=['image/png','image/jpeg','image/webp'];
export function pickQuickFiles(incoming,current=0){const accepted=[],errors=[];for(const file of incoming){if(!QUICK_IMAGE_TYPES.includes(file.type)){errors.push('只支援PNG、JPG、WebP');continue;}if(file.size>QUICK_IMAGE_BYTES){errors.push('單張圖片上限5MB');continue;}if(current+accepted.length>=QUICK_IMAGE_LIMIT){errors.push('每篇最多10張圖片');continue;}accepted.push(file);}return {accepted,errors:[...new Set(errors)]};}
export const screenshotBuild=count=>({kind:'screenshots',quick_count:count,formation:'',heroes:[],pet:{name:'',condition:''},matchups:[],queue:[]});
