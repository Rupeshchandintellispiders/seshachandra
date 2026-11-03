import './check-node.mjs';
import {loadEnvFile} from 'node:process';
try {loadEnvFile('.env');} catch(e) {if(e.code!=='ENOENT')throw e;}
import mysql from 'mysql2/promise';
import {readFile,readdir} from 'node:fs/promises';
const name=process.env.MYSQL_DATABASE||'seshachandra_creations';
if(!/^[a-zA-Z0-9_]+$/.test(name))throw Error('MYSQL_DATABASE must contain letters, numbers or underscores.');
const c=await mysql.createConnection({host:process.env.MYSQL_HOST||'127.0.0.1',port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER||'root',password:process.env.MYSQL_PASSWORD||'',charset:'utf8mb4'});
try{
 await c.query('CREATE DATABASE IF NOT EXISTS `'+name+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
 await c.changeUser({database:name});
 await c.query('CREATE TABLE IF NOT EXISTS sc_migrations (name VARCHAR(180) PRIMARY KEY, statement_count INT NOT NULL DEFAULT 0, completed TINYINT NOT NULL DEFAULT 0)');
 for(const file of (await readdir('migrations/mysql')).filter(f=>f.endsWith('.sql')).sort()){
 const [rows]=await c.execute('SELECT * FROM sc_migrations WHERE name=?',[file]);
 if(rows[0]?.completed){console.log('Already applied:',file);continue;}
 await c.execute('INSERT IGNORE INTO sc_migrations(name) VALUES (?)',[file]);
 const statements=(await readFile('migrations/mysql/'+file,'utf8')).split(';').map(s=>s.trim()).filter(Boolean);
 for(let i=rows[0]?.statement_count||0;i<statements.length;i++){
 await c.query(statements[i]);await c.execute('UPDATE sc_migrations SET statement_count=? WHERE name=?',[i+1,file]);}
 await c.execute('UPDATE sc_migrations SET completed=1 WHERE name=?',[file]);console.log('Applied:',file);
 }
 console.log('MySQL database ready:',name);
}finally{await c.end();}

