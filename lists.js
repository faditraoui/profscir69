var CFG={
LISTS:{ec:["Célibataire","Marié-e","Divorcé-e","Veuf-ve"],corps:["MEP","PEP","PEPC1","PEPC2","PEEP"],qual:["Stagiaire","Titulaire","Suppléant"],post:["MEP","PEP","PPEP","PEPC1","PFEP","PEPC2"],crs:["4AP-G1","4AP-G2","4AP-G3","4AP-G4","4AP-G5","4AP-G6","5AP-G1","5AP-G2","5AP-G3","5AP-G4","5AP-G5","5AP-G6"]},
DAYS:["Dimanche","Lundi","Mardi","Mercredi","Jeudi"],
SEC:{
s1:[["nom","Nom et prénom *","text"],["naiss","Date de naissance","date"],["lieun","Lieu de naissance","text"],["ec","État civil","ec"],["enf","Nombre d’enfants","number"]],
s2:[["ecole","École *","text"],["commune","Commune","text"],["mailE","E-mail (école/directeur)","email"],["telD","Téléphone (directeur)","tel"]],
s3:[["corps","Corps","corps"],["qual","Qualité","qual"],["recr","Date de recrutement","date"],["inst","Date d’installation au poste actuel","date"],["post","Dernier poste occupé","post"],["du","Du","date"],["au","Au","date"],["ech","Dernier échelon","text"],["eff","Date d’effet","date"],["insp","Date de la dernière inspection","date"],["note","Note","number"]],
s4:[["tel","N° de téléphone *","tel"],["mail","E-mail *","email"],["hebdo","Horaire hebdomadaire assuré","text"]]}
};
if(typeof module!=='undefined')module.exports=CFG;
