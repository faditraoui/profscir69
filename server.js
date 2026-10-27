'use strict';
const express=require('express'),helmet=require('helmet'),rateLimit=require('express-rate-limit'),bcrypt=require('bcryptjs'),
  crypto=require('crypto'),Database=require('better-sqlite3'),path=require('path'),fs=require('fs');
const CFG=require('./public/lists.js');
const PROD=process.env.NODE_ENV==='production',PORT=+process.env.PORT||3000;
const DBFILE=process.env.DB_FILE||path.join(__dirname,'data','app.db');
fs.mkdirSync(path.dirname(DBFILE),{recursive:true});
const db=new Database(DBFILE);db.pragma('journal_mode=WAL');db.pragma('foreign_keys=ON');
db.exec(`
CREATE TABLE IF NOT EXISTS admin(id INTEGER PRIMARY KEY CHECK(id=1),username TEXT NOT NULL,hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(sid TEXT PRIMARY KEY,exp INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS teachers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,school TEXT DEFAULT '',commune TEXT DEFAULT '',
  token_hash TEXT UNIQUE,expires_at INTEGER,revoked INTEGER DEFAULT 0,used_at INTEGER,created_at INTEGER);
CREATE TABLE IF NOT EXISTS forms(teacher_id INTEGER PRIMARY KEY REFERENCES teachers(id) ON DELETE CASCADE,data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',submitted_at INTEGER,updated_at INTEGER);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,at INTEGER,action TEXT,detail TEXT);
`);
const now=()=>Date.now(),sha=s=>crypto.createHash('sha256').update(s).digest('hex'),rnd=()=>crypto.randomBytes(32).toString('base64url');
const log=(a,d)=>db.prepare('INSERT INTO audit(at,action,detail) VALUES(?,?,?)').run(now(),a,d||'');
const S=(v,n)=>String(v==null?'':v).slice(0,n||200).trim();

if(!db.prepare('SELECT 1 FROM admin').get()){
  const u=process.env.ADMIN_USER,p=process.env.ADMIN_PASSWORD;
  if(!u||!p){console.error('Premier démarrage : définissez ADMIN_USER et ADMIN_PASSWORD dans .env');process.exit(1)}
  db.prepare('INSERT INTO admin(id,username,hash) VALUES(1,?,?)').run(u,bcrypt.hashSync(p,12));log('admin_init',u);
  console.log('Compte administrateur créé. Retirez ADMIN_PASSWORD de .env.');
}

/* ---------- validation / nettoyage des fiches ---------- */
function clean(d){
  d=d||{};const o={};
  Object.values(CFG.SEC).forEach(s=>s.forEach(([k,,t])=>{let v=S(d[k]);if(CFG.LISTS[t]&&v&&!CFG.LISTS[t].includes(v))v='';o[k]=v}));
  const A=x=>Array.isArray(x)?x:[];
  o.dipl=A(d.dipl).slice(0,20).map(x=>({d:S(x&&x.d),dt:S(x&&x.dt,10),l:S(x&&x.l)})).filter(x=>x.d||x.dt||x.l);
  o.cours=A(d.cours).slice(0,30).map(x=>({c:S(x&&x.c,10),g:S(x&&x.g,4).replace(/\D/g,''),f:S(x&&x.f,4).replace(/\D/g,'')})).filter(x=>CFG.LISTS.crs.includes(x.c));
  o.hor=A(d.hor).slice(0,100).map(x=>({j:S(x&&x.j,12),c:S(x&&x.c,10),de:S(x&&x.de,5),a:S(x&&x.a,5)})).filter(x=>CFG.DAYS.includes(x.j)&&(x.c||x.de||x.a));
  return o;
}
const mailRe=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function required(o){
  if(!o.nom||!o.ecole||!o.tel||!o.mail)return'Veuillez remplir les champs obligatoires (*) : nom, école, téléphone et e-mail.';
  if(!mailRe.test(o.mail))return'L’adresse e-mail n’est pas valide.';
  return null;
}
const mk=days=>{const t=rnd();return{t,h:sha(t),exp:now()+Math.min(Math.max(+days||30,1),365)*864e5}};
const ck=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(c=>c.trim().split(/=(.*)/s).slice(0,2)).filter(x=>x[0]));

/* ---------- application ---------- */
const app=express();app.set('trust proxy',1);
app.use(helmet({hsts:PROD,contentSecurityPolicy:{directives:{
  defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:'],
  objectSrc:["'none'"],frameAncestors:["'none'"],formAction:["'self'"],...(PROD?{}:{upgradeInsecureRequests:null})}}}));
app.use(express.json({limit:'200kb'}));
// Protection CSRF : cookie SameSite=Strict + en-tête personnalisé obligatoire sur toute requête non-GET
app.use('/api',(req,res,next)=>{
  res.set('Cache-Control','no-store');
  if(req.method!=='GET'&&req.get('x-requested-with')!=='fetch')return res.status(403).json({error:'Requête refusée.'});
  next();
});
const loginLimiter=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:true,legacyHeaders:false,message:{error:'Trop de tentatives. Réessayez dans 15 minutes.'}});
const apiLimiter=rateLimit({windowMs:15*60*1000,limit:400,standardHeaders:true,legacyHeaders:false,message:{error:'Trop de requêtes. Réessayez plus tard.'}});
app.use('/api',apiLimiter);

/* --- administrateur --- */
const adm=(req,res,next)=>{
  const sid=ck(req).sid;
  if(sid){const s=db.prepare('SELECT exp FROM sessions WHERE sid=?').get(sha(sid));if(s&&s.exp>now())return next()}
  res.status(401).json({error:'Session expirée. Reconnectez-vous.'});
};
app.post('/api/admin/login',loginLimiter,(req,res)=>{
  const{u,p}=req.body||{},a=db.prepare('SELECT * FROM admin').get();
  const okPw=typeof p==='string'&&bcrypt.compareSync(p,a.hash);
  if(!(okPw&&typeof u==='string'&&u===a.username)){log('login_fail',req.ip);return res.status(401).json({error:'Identifiants incorrects.'})}
  db.prepare('DELETE FROM sessions WHERE exp<?').run(now());
  const sid=rnd();db.prepare('INSERT INTO sessions(sid,exp) VALUES(?,?)').run(sha(sid),now()+8*36e5);
  res.cookie('sid',sid,{httpOnly:true,sameSite:'strict',secure:PROD,maxAge:8*36e5,path:'/'});log('login_ok',req.ip);res.json({ok:true});
});
app.post('/api/admin/logout',(req,res)=>{const s=ck(req).sid;if(s)db.prepare('DELETE FROM sessions WHERE sid=?').run(sha(s));res.clearCookie('sid',{path:'/'});res.json({ok:true})});
app.get('/api/admin/me',adm,(q,r)=>r.json({ok:true}));
app.post('/api/admin/password',adm,(req,res)=>{
  const{old,nw}=req.body||{},a=db.prepare('SELECT * FROM admin').get();
  if(typeof old!=='string'||!bcrypt.compareSync(old,a.hash))return res.status(400).json({error:'Mot de passe actuel incorrect.'});
  if(typeof nw!=='string'||nw.length<12)return res.status(400).json({error:'Le nouveau mot de passe doit contenir au moins 12 caractères.'});
  db.prepare('UPDATE admin SET hash=? WHERE id=1').run(bcrypt.hashSync(nw,12));db.prepare('DELETE FROM sessions').run();log('password_change');
  res.clearCookie('sid',{path:'/'});res.json({ok:true});
});
app.get('/api/admin/teachers',adm,(q,r)=>r.json({teachers:db.prepare('SELECT id,name,school,commune,expires_at,revoked,used_at,created_at FROM teachers ORDER BY name').all()}));
app.post('/api/admin/teachers',adm,(req,res)=>{
  const b=req.body||{},name=S(b.name);if(!name)return res.status(400).json({error:'Le nom est obligatoire.'});
  const k=mk(b.days),r=db.prepare('INSERT INTO teachers(name,school,commune,token_hash,expires_at,created_at) VALUES(?,?,?,?,?,?)').run(name,S(b.school),S(b.commune),k.h,k.exp,now());
  log('teacher_create',name);res.json({id:+r.lastInsertRowid,link:'/t/'+k.t});
});
app.post('/api/admin/teachers/:id/renew',adm,(req,res)=>{
  const k=mk((req.body||{}).days),r=db.prepare('UPDATE teachers SET token_hash=?,expires_at=?,revoked=0,used_at=NULL WHERE id=?').run(k.h,k.exp,+req.params.id);
  if(!r.changes)return res.status(404).json({error:'Enseignant introuvable.'});log('link_renew',req.params.id);res.json({link:'/t/'+k.t});
});
app.post('/api/admin/teachers/:id/revoke',adm,(req,res)=>{db.prepare('UPDATE teachers SET revoked=1 WHERE id=?').run(+req.params.id);log('link_revoke',req.params.id);res.json({ok:true})});
app.delete('/api/admin/teachers/:id',adm,(req,res)=>{db.prepare('DELETE FROM teachers WHERE id=?').run(+req.params.id);log('teacher_delete',req.params.id);res.json({ok:true})});
app.get('/api/admin/forms',adm,(q,r)=>r.json({forms:db.prepare('SELECT * FROM forms').all().map(f=>({...f,data:JSON.parse(f.data)}))}));
app.put('/api/admin/forms/:id',adm,(req,res)=>{
  const id=+req.params.id;if(!db.prepare('SELECT 1 FROM teachers WHERE id=?').get(id))return res.status(404).json({error:'Enseignant introuvable.'});
  db.prepare(`INSERT INTO forms(teacher_id,data,status,updated_at) VALUES(?,?,'draft',?) ON CONFLICT(teacher_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at`)
    .run(id,JSON.stringify(clean((req.body||{}).data)),now());log('form_edit',id);res.json({ok:true});
});
app.get('/api/admin/export.csv',adm,(req,res)=>{
  const cols=[];Object.values(CFG.SEC).forEach(s=>s.forEach(f=>cols.push([f[0],f[1].replace(' *','')])));
  const q=v=>{v=String(v==null?'':v);if(/^[=+\-@\t\r]/.test(v))v="'"+v;return'"'+v.replace(/"/g,'""')+'"'};
  const rows=db.prepare('SELECT f.*,t.name FROM forms f JOIN teachers t ON t.id=f.teacher_id ORDER BY t.name').all();
  const head=cols.map(c=>c[1]).concat(['Diplômes','Cours (groupe/garçons/filles)','Horaires','Statut','Dernière modification']);
  const lines=[head.map(q).join(',')];
  rows.forEach(r=>{const d=JSON.parse(r.data);lines.push(cols.map(c=>q(d[c[0]])).concat([
    q(d.dipl.map(x=>[x.d,x.dt,x.l].join(' / ')).join(' ; ')),q(d.cours.map(x=>[x.c,x.g||0,x.f||0].join('/')).join(' ; ')),
    q(d.hor.map(h=>h.j+' '+h.c+' '+h.de+'-'+h.a).join(' ; ')),q(r.status==='submitted'?'Reçue':'Brouillon'),q(new Date(r.updated_at).toISOString())]).join(','))});
  log('export_csv',String(rows.length));
  res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="fiches_renseignements.csv"'}).send('\ufeff'+lines.join('\r\n'));
});

/* --- enseignant (jeton individuel dans l'en-tête X-Token) --- */
const tch=(req,res,next)=>{
  const t=db.prepare('SELECT * FROM teachers WHERE token_hash=?').get(sha(req.get('x-token')||''));
  if(!t||t.revoked||t.expires_at<now())return res.status(403).json({error:'Lien invalide, expiré ou révoqué. Contactez votre responsable.'});
  req.t=t;next();
};
app.get('/api/t/me',tch,(req,res)=>{
  db.prepare('UPDATE teachers SET used_at=COALESCE(used_at,?) WHERE id=?').run(now(),req.t.id);
  const f=db.prepare('SELECT * FROM forms WHERE teacher_id=?').get(req.t.id);
  res.json({name:req.t.name,school:req.t.school,commune:req.t.commune,expires_at:req.t.expires_at,status:f?f.status:'none',updated_at:f?f.updated_at:null,data:f?JSON.parse(f.data):null});
});
app.put('/api/t/form',tch,(req,res)=>{
  const b=req.body||{},o=clean(b.data),submit=b.submit===true;
  if(submit){const e=required(o);if(e)return res.status(400).json({error:e})}
  const t=now(),st=submit?'submitted':'draft';
  db.prepare(`INSERT INTO forms(teacher_id,data,status,submitted_at,updated_at) VALUES(@id,@d,@st,@sa,@t)
    ON CONFLICT(teacher_id) DO UPDATE SET data=@d,status=@st,submitted_at=CASE WHEN @st='submitted' THEN @t ELSE submitted_at END,updated_at=@t`)
    .run({id:req.t.id,d:JSON.stringify(o),st,sa:submit?t:null,t});
  const chk=db.prepare('SELECT status,updated_at FROM forms WHERE teacher_id=?').get(req.t.id); // vérification de l'enregistrement
  if(!chk||chk.updated_at!==t)return res.status(500).json({error:'L’enregistrement n’a pas pu être vérifié. Réessayez.'});
  log(submit?'form_submit':'form_draft',req.t.id);res.json(chk);
});

/* --- pages --- */
const P=path.join(__dirname,'public');
app.get('/',(q,r)=>r.sendFile(P+'/index.html'));
app.get('/admin',(q,r)=>r.sendFile(P+'/admin.html'));
app.get('/t/:token',(q,r)=>r.sendFile(P+'/teacher.html'));
app.use(express.static(P,{index:false}));
app.use((err,req,res,next)=>{console.error(err);res.status(err.status||500).json({error:err.status&&err.status<500?'Requête invalide.':'Erreur du serveur.'})});
app.listen(PORT,()=>console.log('Serveur démarré sur le port '+PORT));
