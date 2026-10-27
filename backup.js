const Database=require('better-sqlite3'),path=require('path'),fs=require('fs');
const src=process.env.DB_FILE||path.join(__dirname,'data','app.db');
fs.mkdirSync(path.join(__dirname,'backups'),{recursive:true});
const dst=path.join(__dirname,'backups','app-'+new Date().toISOString().replace(/[:.]/g,'-')+'.db');
new Database(src,{readonly:true}).backup(dst).then(()=>console.log('Sauvegarde créée :',dst)).catch(e=>{console.error(e);process.exit(1)});
