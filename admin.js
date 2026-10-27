(function(){
  var app=document.getElementById('app'),T=[],F={},Q='';
  function h(s){app.innerHTML=s}
  function note(s,c){var m=document.getElementById('amsg');if(m)m.innerHTML=s?'<div class="msg '+(c||'')+'">'+s+'</div>':''}
  function dt(ms){return ms?new Date(ms).toLocaleString('fr-FR'):'—'}
  function login(e){
    h('<main class="narrow"><section><h1>Espace Administrateur</h1><p class="sub">Gestion des enseignants</p><div id="amsg">'+(e?'<div class="msg er">'+esc(e)+'</div>':'')+'</div><label>Nom d’utilisateur<input id="u" autocomplete="username"></label><label>Mot de passe<input id="pw" type="password" autocomplete="current-password"></label><button class="p" id="go" type="button">Se connecter</button></section></main>');
    function go(){api('POST','/api/admin/login',{u:document.getElementById('u').value,p:document.getElementById('pw').value}).then(start).catch(function(x){login(x.message)})}
    document.getElementById('go').onclick=go;
    document.getElementById('pw').onkeydown=function(ev){if(ev.key=='Enter')go()};
  }
  function load(){return Promise.all([api('GET','/api/admin/teachers'),api('GET','/api/admin/forms')]).then(function(r){T=r[0].teachers;F={};r[1].forms.forEach(function(f){F[f.teacher_id]=f})})}
  function start(){load().then(render).catch(function(x){login(x.status==401?'':x.message)})}
  function ts(t){var n=Date.now();return t.revoked?'Révoqué':t.expires_at<n?'Expiré':t.used_at?'Utilisé':'Non utilisé'}
  function fs(t){var f=F[t.id];return!f?'En attente':f.status=='submitted'?'Reçue':'Brouillon'}
  function card(n,l){return'<div class="card"><strong>'+n+'</strong><span>'+l+'</span></div>'}
  function by(k){var m={};T.forEach(function(t){var v=t[k]||'—';m[v]=(m[v]||0)+1});return Object.keys(m).sort().map(function(v){return'<tr><td>'+esc(v)+'</td><td>'+m[v]+'</td></tr>'}).join('')}
  function render(){
    var rec=T.filter(function(t){return F[t.id]&&F[t.id].status=='submitted'}),inc=T.filter(function(t){return F[t.id]&&F[t.id].status!='submitted'}).length,att=T.filter(function(t){return!F[t.id]}).length;
    var last=rec.sort(function(a,b){return F[b.id].submitted_at-F[a.id].submitted_at}).slice(0,5).map(function(t){return'<tr><td>'+esc(t.name)+'</td><td>'+esc(t.school)+'</td><td>'+dt(F[t.id].submitted_at)+'</td></tr>'}).join('');
    h('<main><header class="top"><h1>Espace Administrateur — Gestion des enseignants</h1><div class="bar"><a class="btn" href="/api/admin/export.csv">Exporter CSV</a><button id="pwd" type="button">Mot de passe</button><button id="out" type="button">Déconnexion</button></div></header><div id="amsg"></div>'+
    '<section><h2>Tableau de bord</h2><div class="cards">'+card(T.length,'Enseignants')+card(rec.length,'Fiches reçues')+card(att,'En attente')+card(inc,'Incomplètes (brouillon)')+'</div>'+
    '<div class="g"><div class="sc"><table><tr><th>École</th><th>Enseignants</th></tr>'+by('school')+'</table></div><div class="sc"><table><tr><th>Commune</th><th>Enseignants</th></tr>'+by('commune')+'</table></div><div class="sc"><table><tr><th>Dernières fiches reçues</th><th>École</th><th>Date</th></tr>'+(last||'<tr><td colspan="3">Aucune</td></tr>')+'</table></div></div></section>'+
    '<section><h2>Ajouter un enseignant et générer son lien</h2><div class="g"><label>Nom et prénom *<input id="nn"></label><label>École<input id="ns"></label><label>Commune<input id="nc"></label><label>Validité du lien (jours)<input id="nd" type="number" min="1" max="365" value="30"></label></div><button class="p" id="add" type="button" style="margin-top:12px">Créer le lien</button></section>'+
    '<section><h2>Enseignants</h2><div class="g"><label>Recherche (nom, école, commune)<input id="q" type="search" value="'+esc(Q)+'"></label><label>Fiche<select id="fs"><option value="">Toutes</option><option>Reçue</option><option>Brouillon</option><option>En attente</option></select></label></div><div class="sc" style="margin-top:10px"><table id="tb"></table></div><div class="bar"><button id="ps" type="button">Imprimer la sélection</button></div></section></main>');
    drawT();
    document.getElementById('q').oninput=function(){Q=this.value;drawT()};
    document.getElementById('fs').onchange=drawT;
  }
  function drawT(){
    var q=Q.toLowerCase(),f=document.getElementById('fs').value;
    var rows=T.filter(function(t){return(!q||(t.name+' '+t.school+' '+t.commune).toLowerCase().indexOf(q)>=0)&&(!f||fs(t)==f)});
    document.getElementById('tb').innerHTML='<tr><th></th><th>Nom</th><th>École</th><th>Commune</th><th>Fiche</th><th>Lien</th><th>Dernière modif.</th><th>Actions</th></tr>'+
    (rows.map(function(t){var u=F[t.id];return'<tr><td><input type="checkbox" data-sel="'+t.id+'" aria-label="Sélectionner"></td><td>'+esc(t.name)+'</td><td>'+esc(t.school)+'</td><td>'+esc(t.commune)+'</td><td>'+fs(t)+'</td><td>'+ts(t)+'</td><td>'+dt(u&&u.updated_at)+'</td><td><button data-act="edit" data-id="'+t.id+'">Voir / modifier</button> <button data-act="print" data-id="'+t.id+'">Imprimer</button> <button data-act="renew" data-id="'+t.id+'">Nouveau lien</button> <button data-act="rev" data-id="'+t.id+'">Révoquer</button> <button class="x" data-act="del" data-id="'+t.id+'">Supprimer</button></td></tr>'}).join('')||'<tr><td colspan="8">Aucun enseignant.</td></tr>');
  }
  function showLink(p){
    var u=location.origin+p;
    note('Lien individuel (affiché une seule fois — copiez-le maintenant) :<br><input readonly id="lk" value="'+esc(u)+'"> <button id="cp" type="button">Copier</button>','ok');
    document.getElementById('cp').onclick=function(){var i=document.getElementById('lk');i.select();try{navigator.clipboard.writeText(u)}catch(e){document.execCommand('copy')}this.textContent='Copié ✔'};
  }
  function fail(x){if(x.status==401)login('Session expirée. Reconnectez-vous.');else note(esc(x.message),'er')}
  function edit(id){
    var t=T.find(function(x){return x.id==id}),f=F[id],d=f?f.data:{nom:t.name,ecole:t.school,commune:t.commune};
    var S=toState(d),ov=document.createElement('div');ov.className='ov';
    ov.innerHTML='<div><h2>Fiche — '+esc(t.name)+'</h2><div id="ef"></div><div id="em"></div><div class="bar"><button class="p" id="es" type="button">Enregistrer</button><button id="ec" type="button">Fermer</button></div></div>';
    document.body.appendChild(ov);mountForm(ov.querySelector('#ef'),S);
    ov.querySelector('#ec').onclick=function(){ov.remove()};
    ov.querySelector('#es').onclick=function(){api('PUT','/api/admin/forms/'+id,{data:toOut(S)}).then(load).then(function(){ov.remove();render();note('✔ Fiche enregistrée.','ok')}).catch(function(x){ov.querySelector('#em').innerHTML='<div class="msg er">'+esc(x.message)+'</div>'})};
  }
  app.addEventListener('click',function(e){
    var b=e.target,a=b.dataset.act,id=b.dataset.id;
    if(b.id=='out')api('POST','/api/admin/logout').then(function(){login()});
    if(b.id=='add'){api('POST','/api/admin/teachers',{name:document.getElementById('nn').value,school:document.getElementById('ns').value,commune:document.getElementById('nc').value,days:document.getElementById('nd').value}).then(function(r){return load().then(function(){render();showLink(r.link)})}).catch(fail)}
    if(b.id=='pwd'){var o=prompt('Mot de passe actuel :');if(!o)return;var n=prompt('Nouveau mot de passe (12 caractères minimum) :');if(!n)return;api('POST','/api/admin/password',{old:o,nw:n}).then(function(){login('Mot de passe modifié. Reconnectez-vous.')}).catch(fail)}
    if(b.id=='ps'){var ids=[].slice.call(document.querySelectorAll('[data-sel]:checked')).map(function(c){return+c.dataset.sel});var l=T.filter(function(t){return F[t.id]&&(!ids.length||ids.indexOf(t.id)>=0)}).map(function(t){return F[t.id].data});if(l.length)preview(l);else note('Aucune fiche à imprimer.','er')}
    if(a=='edit')edit(id);
    if(a=='print'){if(F[id])preview([F[id].data]);else note('Cette fiche n’a pas encore été reçue.','er')}
    if(a=='renew'){var d=prompt('Durée de validité du nouveau lien (jours) :','30');if(d)api('POST','/api/admin/teachers/'+id+'/renew',{days:d}).then(function(r){return load().then(function(){render();showLink(r.link)})}).catch(fail)}
    if(a=='rev'){if(confirm('Révoquer ce lien ?'))api('POST','/api/admin/teachers/'+id+'/revoke').then(load).then(render).catch(fail)}
    if(a=='del'){if(confirm('Supprimer définitivement cet enseignant et sa fiche ?'))api('DELETE','/api/admin/teachers/'+id).then(load).then(render).catch(fail)}
  });
  start();
})();
