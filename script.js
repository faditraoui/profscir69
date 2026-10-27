/* Fonctions partagées + espace enseignant */
var LBL={};
Object.keys(CFG.SEC).forEach(function(id){CFG.SEC[id].forEach(function(f){LBL[f[0]]=f[1].replace(' *','')})});
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function fd(s){var m=/^(\d{4})-(\d\d)-(\d\d)$/.exec(s||'');return m?m[3]+'/'+m[2]+'/'+m[1]:(s||'')}
function api(method,url,body,hdr){
  var h={'Content-Type':'application/json','X-Requested-With':'fetch'};for(var k in hdr||{})h[k]=hdr[k];
  return fetch(url,{method:method,headers:h,credentials:'same-origin',body:body?JSON.stringify(body):undefined}).then(function(r){
    return r.json().catch(function(){return{}}).then(function(j){
      if(!r.ok){var e=new Error(j.error||'Erreur '+r.status);e.status=r.status;throw e}return j})
  },function(){var e=new Error('Réseau indisponible. Vérifiez votre connexion et réessayez.');e.status=0;throw e});
}
function toState(o){
  var S={dipl:[{}],cours:[{}],hor:{}};o=o||{};
  Object.keys(LBL).forEach(function(k){S[k]=o[k]||''});
  if(o.dipl&&o.dipl.length)S.dipl=o.dipl.map(function(x){return{d:x.d,dt:x.dt,l:x.l}});
  if(o.cours&&o.cours.length)S.cours=o.cours.map(function(x){return{c:x.c,g:x.g,f:x.f}});
  (o.hor||[]).forEach(function(h){(S.hor[h.j]=S.hor[h.j]||[]).push({c:h.c,de:h.de,a:h.a})});
  return S;
}
function toOut(S){
  var o={};Object.keys(LBL).forEach(function(k){o[k]=S[k]||''});
  o.dipl=S.dipl.filter(function(d){return d.d||d.dt||d.l});
  o.cours=S.cours.filter(function(c){return c.c});
  o.hor=[];
  CFG.DAYS.forEach(function(d){(S.hor[d]||[]).forEach(function(s){if(s.c||s.de||s.a)o.hor.push({j:d,c:s.c||'',de:s.de||'',a:s.a||''})})});
  return o;
}

/* ---- formulaire (reproduit fidèlement le fichier d'origine) ---- */
function mountForm(root,S){
  var T={s1:'Identité',s2:'Lieu d’exercice',s3:'Situation professionnelle',s4:'Coordonnées de l’enseignant(e)'};
  function fld(f){
    var k=f[0],t=f[2],v=S[k]||'',h='<label>'+f[1];
    if(CFG.LISTS[t])h+='<select data-k="'+k+'"><option value="">—</option>'+CFG.LISTS[t].map(function(o){return'<option'+(v==o?' selected':'')+'>'+o+'</option>'}).join('')+'</select>';
    else h+='<input data-k="'+k+'" type="'+t+'" value="'+esc(v)+'"'+(t=='number'?' min="0"':'')+'>';
    return h+'</label>';
  }
  function sec(id){return'<section><h2>'+T[id]+'</h2><div class="g">'+CFG.SEC[id].map(fld).join('')+'</div></section>'}
  root.innerHTML=sec('s1')+sec('s2')+sec('s3')+
    '<section><h2>Diplômes, dates et lieux d’obtention</h2><div class="dipl"></div><button type="button" data-add="d">+ Ajouter un diplôme</button></section>'+
    sec('s4')+
    '<section><h2>Cours à charge et effectifs</h2><div class="cours"></div><button type="button" data-add="c">+ Ajouter un cours</button><p class="sub cnt" style="margin-top:10px"></p></section>'+
    '<section><h2>Horaires de travail</h2><div class="hor"></div></section>';
  var q=function(s){return root.querySelector(s)};
  function rDipl(){
    q('.dipl').innerHTML=S.dipl.map(function(d,i){return'<div class="row"><div class="rt">Diplôme n° '+(i+1)+(S.dipl.length>1?'<button class="x" type="button" data-rd="'+i+'">Supprimer</button>':'')+'</div><div class="g"><label>Diplôme<input data-a="dipl" data-i="'+i+'" data-f="d" value="'+esc(d.d)+'"></label><label>Date<input type="date" data-a="dipl" data-i="'+i+'" data-f="dt" value="'+esc(d.dt)+'"></label><label>Lieu<input data-a="dipl" data-i="'+i+'" data-f="l" value="'+esc(d.l)+'"></label></div></div>'}).join('');
  }
  function cnt(){
    var n=S.cours.filter(function(c){return c.c}).length,a=S.cours.filter(function(c){return/^4AP/.test(c.c||'')}).length,b=S.cours.filter(function(c){return/^5AP/.test(c.c||'')}).length;
    q('.cnt').textContent='Nombre de cours à charge : '+n+' — dont 4AP : '+a+' — dont 5AP : '+b;
  }
  function rCours(){
    q('.cours').innerHTML=S.cours.map(function(c,i){return'<div class="row"><div class="rt">Cours n° '+(i+1)+(S.cours.length>1?'<button class="x" type="button" data-rc="'+i+'">Supprimer</button>':'')+'</div><div class="g"><label>Groupe<select data-a="cours" data-i="'+i+'" data-f="c" data-sch="1"><option value="">—</option>'+CFG.LISTS.crs.map(function(o){return'<option'+(c.c==o?' selected':'')+'>'+o+'</option>'}).join('')+'</select></label><label>Nbre garçons<input type="number" min="0" data-a="cours" data-i="'+i+'" data-f="g" value="'+esc(c.g)+'"></label><label>Nbre filles<input type="number" min="0" data-a="cours" data-i="'+i+'" data-f="f" value="'+esc(c.f)+'"></label></div></div>'}).join('');
    cnt();rHor();
  }
  function grp(){var g=S.cours.map(function(c){return c.c}).filter(Boolean);return g.length?g.filter(function(x,i){return g.indexOf(x)==i}):CFG.LISTS.crs}
  function rHor(){
    q('.hor').innerHTML=CFG.DAYS.map(function(d){
      var L=S.hor[d]||[];
      return'<div class="day"><span>'+d+'</span>'+(L.length?'<button class="x" type="button" data-cd="'+d+'">Effacer le jour</button>':'')+'</div>'+(L.length?'':'<p class="sub" style="margin:0 0 8px">Pas de cours ce jour.</p>')+L.map(function(s,i){
        var o=grp();if(s.c&&o.indexOf(s.c)<0)o=o.concat(s.c);
        return'<div class="tm"><label>Groupe<select data-h="'+d+'" data-i="'+i+'" data-f="c"><option value="">—</option>'+o.map(function(x){return'<option'+(s.c==x?' selected':'')+'>'+x+'</option>'}).join('')+'</select></label><label>de<input type="time" data-h="'+d+'" data-i="'+i+'" data-f="de" value="'+esc(s.de)+'"></label><label>à<input type="time" data-h="'+d+'" data-i="'+i+'" data-f="a" value="'+esc(s.a)+'"></label><button class="x" type="button" data-rs="'+d+'|'+i+'" title="Supprimer" aria-label="Supprimer la séance">✕</button></div>'}).join('')+'<button type="button" data-as="'+d+'">+ Ajouter un groupe</button>'}).join('');
  }
  rDipl();rCours();
  root.addEventListener('input',function(e){
    var t=e.target,D=t.dataset;
    if(D.k)S[D.k]=t.value;
    else if(D.a){S[D.a][D.i][D.f]=t.value;if(D.a=='cours'){cnt();if(D.sch)rHor()}}
    else if(D.h)S.hor[D.h][D.i][D.f]=t.value;
  });
  root.addEventListener('click',function(e){
    var D=e.target.dataset;
    if(D.add=='d'){S.dipl.push({});rDipl()}
    if(D.add=='c'){S.cours.push({});rCours()}
    if(D.rd!=null){S.dipl.splice(+D.rd,1);rDipl()}
    if(D.rc!=null){S.cours.splice(+D.rc,1);rCours()}
    if(D.as){(S.hor[D.as]=S.hor[D.as]||[]).push({});rHor()}
    if(D.cd){S.hor[D.cd]=[];rHor()}
    if(D.rs){var p=D.rs.split('|');S.hor[p[0]].splice(+p[1],1);rHor()}
  });
}

/* ---- fiche imprimable A4 + aperçu ---- */
function fiche(o){
  var f=function(k){return'<div><b>'+LBL[k]+'</b> '+esc(/^(naiss|recr|inst|du|au|eff|insp)$/.test(k)?fd(o[k]):o[k])+'</div>'};
  var g=function(t,id){return'<h3>'+t+'</h3><div class="fg">'+CFG.SEC[id].map(function(x){return f(x[0])}).join('')+'</div>'};
  var dip=(o.dipl||[]).map(function(d){return'<tr><td>'+esc(d.d)+'</td><td>'+esc(fd(d.dt))+'</td><td>'+esc(d.l)+'</td></tr>'}).join('');
  var cs=(o.cours||[]).map(function(c){return'<tr><td>'+esc(c.c)+'</td><td>'+esc(c.g||0)+'</td><td>'+esc(c.f||0)+'</td><td>'+((+c.g||0)+(+c.f||0))+'</td></tr>'}).join('');
  var hr=CFG.DAYS.map(function(d){var L=(o.hor||[]).filter(function(h){return h.j==d});return'<tr><td><b>'+d+'</b></td><td>'+(L.map(function(h){return esc(h.c)+' '+esc(h.de)+'–'+esc(h.a)}).join(' ; ')||'—')+'</td></tr>'}).join('');
  return'<h2>FICHE DE RENSEIGNEMENTS</h2>'+g('Identité','s1')+g('Lieu d’exercice','s2')+g('Situation professionnelle','s3')+g('Coordonnées','s4')+
    '<h3>Diplômes</h3><table><tr><th>Diplôme</th><th>Date</th><th>Lieu</th></tr>'+(dip||'<tr><td colspan="3">—</td></tr>')+'</table>'+
    '<h3>Cours à charge</h3><table><tr><th>Groupe</th><th>Garçons</th><th>Filles</th><th>Total</th></tr>'+(cs||'<tr><td colspan="4">—</td></tr>')+'</table>'+
    '<h3>Horaires</h3><table>'+hr+'</table>';
}
function preview(list){
  var old=document.getElementById('pv');if(old)old.remove();
  var pv=document.createElement('div');pv.id='pv';
  pv.innerHTML='<div class="pvbar"><button class="p" id="pvp" type="button">Imprimer (A4)</button><button id="pvc" type="button">Fermer</button></div>'+list.map(function(o){return'<article class="fiche">'+fiche(o)+'</article>'}).join('');
  document.body.appendChild(pv);
  document.getElementById('pvp').onclick=function(){window.print()};
  document.getElementById('pvc').onclick=function(){pv.remove()};
}

/* ---- espace enseignant ---- */
(function(){
  var root=document.getElementById('tform');if(!root)return;
  var tok=location.pathname.split('/')[2]||'',H={'X-Token':tok},S,msgEl=document.getElementById('msg'),btns=['sv','send'];
  function msg(t,c){msgEl.innerHTML='<div class="msg '+(c||'')+'">'+t+'</div>';msgEl.scrollIntoView({block:'nearest'})}
  function busy(b){btns.forEach(function(i){document.getElementById(i).disabled=b})}
  api('GET','/api/t/me',null,H).then(function(me){
    var d=me.data||{};d.nom=d.nom||me.name;d.ecole=d.ecole||me.school;d.commune=d.commune||me.commune;
    S=toState(d);mountForm(root,S);
    document.getElementById('who').textContent=me.name+' — '+(me.status=='submitted'?'fiche déjà envoyée (vous pouvez la modifier et la renvoyer)':me.status=='draft'?'brouillon enregistré':'fiche à remplir')+' — lien valable jusqu’au '+new Date(me.expires_at).toLocaleDateString('fr-FR');
  }).catch(function(e){root.innerHTML='';document.querySelector('.bar').remove();document.getElementById('who').textContent='';msg(esc(e.message),'er')});
  function save(submit){
    var o=toOut(S);
    if(submit&&(!o.nom||!o.ecole||!o.tel||!o.mail)){msg('Veuillez remplir les champs obligatoires (*) : nom, école, téléphone et e-mail.','er');return}
    busy(true);
    api('PUT','/api/t/form',{data:o,submit:submit},H).then(function(r){
      msg(submit?'✔ Votre fiche a bien été reçue et enregistrée. Merci ! Vous pouvez la modifier et la renvoyer avec le même lien.':'✔ Brouillon enregistré.','ok');
    }).catch(function(e){msg(esc(e.message)+(e.status==0?' Vos données saisies sont conservées sur cette page : réessayez.':''),'er')}).then(function(){busy(false)});
  }
  document.getElementById('sv').onclick=function(){save(false)};
  document.getElementById('send').onclick=function(){save(true)};
  document.getElementById('pr').onclick=function(){if(S)preview([toOut(S)])};
})();
