import {loadEnvFile} from 'node:process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import mysql from 'mysql2/promise';
import {workSchema} from '../lib/validation.ts';
loadEnvFile('.env');
const categories=[
 ['వేమన పద్యాలు','Vemana Poetry'],['శ్రీమద్రామాయణం','Ramayanam'],['భక్తి గీతాలు','Devotional Songs'],['జీవన & చైతన్య గీతాలు','Life & Motivational Songs'],['ప్రేమ గీతాలు','Love Songs'],['బొమ్మల నీతి కథలు','Animated Moral Stories']
];
const vemanaShorts=new Set(['7y0HMk_L6Do','Y7lO8TDtM70','4ivpGScsa_E','4CW83g9Y1Uk','m7qy_Bz4u2s','Wv3l8W5mamQ']);
function category(v){const t=v.title;if(/వేమన|నేమన|vemana/i.test(t)||vemanaShorts.has(v.id))return 0;if(/రామాయణ|రామాయణం|ramayan|రామజనన|సీతారామ|సీతాన్వేషణ|సౌమిత్రి|నికుంభిల|యుద్ధకాండ|సుందరకాండ|కిష్కింధ/i.test(t))return 1;if(/అయ్యప్ప|గణనాథా|హనుమంతుని భక్తి|రామా శ్రీరామ/i.test(t))return 2;if(/బొమ్మల|పరిష్కారం/.test(t))return 5;if(/ఓ ప్రేమా/.test(t))return 4;if(/అమ్మే|మనసా|కాలం ఆగ|క్రాంతి రథం|మనిషి బ్రతుకు|జీవిత గమన|ఓ మనిషి/.test(t))return 3;throw Error('Needs category review: '+v.id+' '+t);}
const records=JSON.parse(await readFile('outputs/youtube-metadata.json','utf8'));
const listing=JSON.parse(await readFile('outputs/youtube-channel.json','utf8'));
const expected=new Set(listing.entries.flatMap(t=>t.entries.map(v=>v.id)));
if(records.length!==expected.size||new Set(records.map(v=>v.id)).size!==expected.size)throw Error('Incomplete or duplicate metadata');
const planned=records.map(v=>{if(!expected.has(v.id)||v.channelId!=='UC_O6Rw1RpI2AwMCzaeptHiQ'||v.playability!=='OK')throw Error('Unverified video');const group=category(v);const work=workSchema.parse({type:'video',title:v.title,slug:'youtube-'+Buffer.from(v.id).toString('hex'),description:v.description,tags:[...(v.short?['Shorts']:[]),...(v.tags||[])].filter((s,i,a)=>typeof s==='string'&&s.trim()&&s.length<=80&&a.indexOf(s)===i).slice(0,30),status:'published',youtubeId:v.id,publicationDate:v.publishedDate,attribution:'Seshachandracreations · YouTube'});return {group,work,embedAllowed:v.embedAllowed};});
const counts=categories.map(([te,en],i)=>({nameTe:te,nameEn:en,count:planned.filter(v=>v.group===i).length}));
await writeFile('outputs/youtube-category-review.json',JSON.stringify({categories:counts,videos:planned.map(v=>({id:v.work.youtubeId,title:v.work.title,category:categories[v.group][0],publicationDate:v.work.publicationDate,embedAllowed:v.embedAllowed}))},null,2));
console.log(JSON.stringify({total:planned.length,shorts:records.filter(v=>v.short).length,categories:counts},null,2));
if(!process.argv.includes('--apply')){console.log('Preview only. Add --apply to import into local MySQL.');process.exit(0);}
const c=await mysql.createConnection({host:process.env.MYSQL_HOST,port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER,password:process.env.MYSQL_PASSWORD,database:process.env.MYSQL_DATABASE,charset:'utf8mb4'});
if(!['127.0.0.1','localhost'].includes(process.env.MYSQL_HOST||''))throw Error('This one-time import is restricted to local MySQL.');
let inserted=0,skipped=0;const report=[];
try{
 const [beforeWorks]=await c.query('SELECT * FROM works');const [beforeCats]=await c.query('SELECT * FROM categories');await mkdir('outputs/backups',{recursive:true});await writeFile('outputs/backups/before-youtube-import-'+Date.now()+'.json',JSON.stringify({works:beforeWorks,categories:beforeCats},null,2));
 await c.beginTransaction();const ids=[];
 for(let i=0;i<categories.length;i++){const [te,en]=categories[i];const [found]=await c.execute('SELECT id FROM categories WHERE name_te=? OR name_en=? LIMIT 1',[te,en]);let id=found[0]?.id;if(!id){id=crypto.randomUUID();await c.execute('INSERT INTO categories(id,name_te,name_en,position) VALUES(?,?,?,?)',[id,te,en,i]);}ids.push(id);}
 for(const item of [...planned].sort((a,b)=>a.work.publicationDate.localeCompare(b.work.publicationDate))){const w=item.work;const [old]=await c.execute('SELECT id FROM works WHERE youtube_id=?',[w.youtubeId]);if(old.length){skipped++;report.push({youtubeId:w.youtubeId,id:old[0].id,action:'preserved-existing'});continue;}const id=crypto.randomUUID();const now=new Date().toISOString();await c.execute('INSERT INTO works(id,slug,type,title,description,body,tags,category_id,status,featured,youtube_id,publication,publication_date,attribution,external_url,cover_id,attachment_ids,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,w.slug,w.type,w.title,w.description,'',JSON.stringify(w.tags),ids[item.group],w.status,0,w.youtubeId,'',w.publicationDate,w.attribution,'',null,'[]',now,now]);inserted++;report.push({youtubeId:w.youtubeId,id,categoryId:ids[item.group],action:'inserted'});}
 await c.commit();console.log(JSON.stringify({inserted,skipped}));await writeFile('outputs/youtube-import-result.json',JSON.stringify({importedAt:new Date().toISOString(),inserted,skipped,entries:report},null,2));
}catch(e){await c.rollback();throw e;}finally{await c.end();}
