import {loadEnvFile} from 'node:process';
try {loadEnvFile('.env');} catch(e) {if((e as {code?:string}).code!=='ENOENT')throw e;}
import mysql from 'mysql2/promise';
let pool: mysql.Pool | undefined;
export function getPool(){return pool ??= mysql.createPool({host:process.env.MYSQL_HOST||'127.0.0.1',port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER||'root',password:process.env.MYSQL_PASSWORD||'',database:process.env.MYSQL_DATABASE||'seshachandra_creations',charset:'utf8mb4',connectionLimit:5});}
class Statement {
 constructor(public sql:string,public values:unknown[]=[]){}
 bind(...values:unknown[]){return new Statement(this.sql,values);}
 async first<T=Record<string,unknown>>():Promise<T|null>{return (await this.all<T>()).results[0]??null;}
 async all<T=Record<string,unknown>>():Promise<{results:T[]}>{const [rows]=await getPool().execute(this.sql,this.values as any[]);return {results:rows as T[]};}
 async run(){const [r]=await getPool().execute(this.sql,this.values as any[]);return {meta:{changes:(r as mysql.ResultSetHeader).affectedRows}};}
}
export const database={prepare:(sql:string)=>new Statement(sql),async batch(statements:Statement[]){const connection=await getPool().getConnection();try{await connection.beginTransaction();const results=[];for(const s of statements){const [r]=await connection.execute(s.sql,s.values as any[]);results.push(r);}await connection.commit();return results;}catch(e){await connection.rollback();throw e;}finally{connection.release();}}};

