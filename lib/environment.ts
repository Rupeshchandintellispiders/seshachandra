import {loadEnvFile} from 'node:process';
try {loadEnvFile('.env');} catch(e) {if((e as {code?:string}).code!=='ENOENT')throw e;}
import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
const directory=path.resolve(process.env.UPLOAD_DIRECTORY||'data/uploads');
function filename(id:string){if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Invalid file identifier');return path.join(directory,id);}
export const env={...process.env,BUCKET:{async put(id:string,bytes:Uint8Array,_options?:unknown){await mkdir(directory,{recursive:true});await writeFile(filename(id),bytes);},async get(id:string){try{return {body:new Uint8Array(await readFile(filename(id)))};}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}},async delete(id:string){await unlink(filename(id)).catch(e=>{if(e.code!=='ENOENT')throw e;});}}};

