export const LanguageMap = {"language":"FR","created":"Wed, 25 Sep 2024 19:20:23 GMT","version":"2.1.3","functions":[{"base":"ADDRESS","name":"ADRESSE","arguments":["ligne","colonne","absolu","a1","nom_feuille"]},{"base":"AND","name":"ET"},{"base":"ARG","name":"ARG","description":"Renvoie l'argument principal d'un nombre complexe (en radians)"},{"base":"AVERAGE","name":"MOYENNE","description":"Renvoie la moyenne arithmétique de tous les arguments numériques"},{"base":"AVERAGEIF","name":"MOYENNE.SI","arguments":["plage","critère"]},{"base":"AVERAGEIFS","name":"MOYENNE.SI.ENS","arguments":["plage_valeurs","plage_critères","critère","plage_critères","critère"]},{"base":"BETA.DIST","name":"LOI.BETA.N","description":"Distribution bêta","arguments":["x","a","b","cumulatif"]},{"base":"BETA.INV","name":"BETA.INVERSE.N","description":"Inverse de la distribution bêta","arguments":["probabilité","a","b"]},{"base":"CEILING","name":"PLAFOND"},{"base":"CELL","name":"CELLULE","description":"Renvoie des données sur une cellule","arguments":["type","référence"]},{"base":"CHAR","name":"CAR","arguments":["nombre"]},{"base":"CHECKBOX","name":"CHECKBOX","arguments":["coché"]},{"base":"CHOOSE","name":"CHOISIR","description":"Renvoie l'un des choix d'une liste","arguments":["Index sélectionné","Choix 1..."]},{"base":"CODE","name":"CODE","arguments":["chaîne"]},{"base":"COLUMN","name":"COLONNE","arguments":["référence"]},{"base":"COLUMNS","name":"COLONNES","arguments":["référence"]},{"base":"COMPLEX","name":"COMPLEXE","description":"Garantit que la valeur donnée sera traitée comme un nombre complexe"},{"base":"COMPLEXLOG","name":"COMPLEXLOG","description":"Renvoie la valeur principale Log(z) d'un nombre complexe z"},{"base":"CONCAT","name":"CONCAT","description":"Concatène des chaînes de caractères"},{"base":"CONCATENATE","name":"CONCATENER","description":"Concatène des chaînes de caractères"},{"base":"CONJUGATE","name":"CONJUGATE","description":"Renvoie le conjugué d'un nombre complexe"},{"base":"CORREL","name":"COEFFICIENT.CORRELATION","description":"Renvoie la corrélation entre deux plages de valeurs","arguments":["A","B"]},{"base":"COS","name":"COS","arguments":["angle en radians"]},{"base":"COSH","name":"COSH","arguments":["nombre"]},{"base":"COUNT","name":"NB","description":"Compte les cellules contenant des nombres"},{"base":"COUNTA","name":"NBVAL","description":"Compte les cellules non vides"},{"base":"COUNTIF","name":"NB.SI","arguments":["plage","critère"]},{"base":"COUNTIFS","name":"NB.SI.ENS","arguments":["plage","critère","plage","critère"]},{"base":"COVAR","name":"COVARIANCE","description":"Renvoie la covariance entre deux plages de valeurs","arguments":["A","B"]},{"base":"CUMIPMT","name":"CUMUL.INTER","description":"Renvoie les intérêts cumulés payés sur un prêt entre deux périodes","arguments":["Taux","Périodes","Valeur actuelle","Période de début","Période de fin","Type"]},{"base":"CUMPRINC","name":"CUMUL.PRINCPER","description":"Renvoie le principal cumulé payé sur un prêt entre deux périodes","arguments":["Taux","Périodes","Valeur actuelle","Période de début","Période de fin","Type"]},{"base":"DATE","name":"DATE","description":"Construit une date à partir de l'année/mois/jour","arguments":["année","mois","jour"]},{"base":"DAY","name":"JOUR","description":"Renvoie le jour du mois à partir d'une date","arguments":["date"]},{"base":"DEGREES","name":"DEGRES","description":"Convertit les radians en degrés","arguments":["Radians"]},{"base":"DELTA","name":"DELTA","arguments":["nombre","nombre"]},{"base":"EDATE","name":"MOIS.DECALER","arguments":["Date de début","Mois"]},{"base":"EOMONTH","name":"FIN.MOIS","arguments":["Date de début","Mois"]},{"base":"EXACT","name":"EXACT","arguments":["texte","texte"]},{"base":"FACT","name":"FACT","description":"Renvoie la factorielle d'un nombre","arguments":["nombre"]},{"base":"FILTER","name":"FILTER","description":"Filtre un tableau en utilisant un second tableau","arguments":["source","filtre"]},{"base":"FIND","name":"TROUVE","description":"Trouve une chaîne (aiguille) dans une autre chaîne (botte de foin). Sensible à la casse.","arguments":["Aiguille","Botte de foin","Début"]},{"base":"FLOOR","name":"PLANCHER"},{"base":"FORMULATEXT","name":"FORMULATEXT","description":"Renvoie une formule sous forme de chaîne de caractères","arguments":["référence"]},{"base":"FV","name":"VC","description":"Renvoie la valeur future d'un investissement","arguments":["Taux","Périodes","Paiement","Valeur actuelle","Type"]},{"base":"GAMMA","name":"GAMMA","description":"Renvoie la fonction gamma pour la valeur donnée","arguments":["valeur"]},{"base":"GAMMALN","name":"LNGAMMA","description":"Renvoie le logarithme naturel de la fonction gamma","arguments":["valeur"]},{"base":"GAMMALN.PRECISE","name":"LNGAMMA.PRECIS","description":"Renvoie le logarithme naturel de la fonction gamma","arguments":["valeur"]},{"base":"GCD","name":"PGCD","description":"Trouve le plus grand commun diviseur des arguments"},{"base":"GEOMEAN","name":"MOYENNE.GEOMETRIQUE","description":"Renvoie la moyenne géométrique de tous les arguments numériques"},{"base":"HARMEAN","name":"MOYENNE.HARMONIQUE","description":"Renvoie la moyenne harmonique des arguments"},{"base":"HLOOKUP","name":"RECHERCHEH","arguments":["Valeur recherchée","Table","Index résultat","Inexact"]},{"base":"IF","name":"SI","arguments":["valeur test","valeur si vrai","valeur si faux"]},{"base":"IFERROR","name":"SIERREUR","description":"Renvoie la valeur originale, ou la valeur alternative si la valeur originale contient une erreur","arguments":["valeur originale","valeur alternative"]},{"base":"IMAGINARY","name":"COMPLEXE.IMAGINAIRE","description":"Renvoie la partie imaginaire d'un nombre complexe (sous forme réelle)"},{"base":"INDEX","name":"INDEX","arguments":["plage","ligne","colonne"]},{"base":"INDIRECT","name":"INDIRECT","arguments":["référence"]},{"base":"INT","name":"ENT"},{"base":"INTERCEPT","name":"ORDONNEE.ORIGINE","arguments":["y_connus","x_connus"]},{"base":"IPMT","name":"INTPER","description":"Renvoie la partie intérêt d'un paiement","arguments":["Taux","Période","Périodes","Valeur actuelle","Valeur future","Type"]},{"base":"IRR","name":"TRI","description":"Calcule le taux de rentabilité interne d'une série de flux de trésorerie","arguments":["Flux de trésorerie","Estimation"]},{"base":"ISBLANK","name":"ESTVIDE","description":"Renvoie vrai si la référence est vide","arguments":["Référence"]},{"base":"ISCOMPLEX","name":"ISCOMPLEX","description":"Renvoie vrai si la référence est un nombre complexe","arguments":["Référence"]},{"base":"ISERR","name":"ESTERR","description":"Vérifie si une autre cellule contient une erreur","arguments":["référence"]},{"base":"ISERROR","name":"ESTERREUR","description":"Vérifie si une autre cellule contient une erreur","arguments":["référence"]},{"base":"ISFORMULA","name":"ISFORMULA","description":"Renvoie vrai si la référence est une formule","arguments":["Référence"]},{"base":"ISLOGICAL","name":"ESTLOGIQUE","description":"Renvoie vrai si la référence est une valeur logique VRAI ou FAUX","arguments":["Référence"]},{"base":"ISNA","name":"ESTNA","description":"Vérifie si une autre cellule contient une erreur #N/A","arguments":["référence"]},{"base":"ISNUMBER","name":"ESTNUM","description":"Renvoie vrai si la référence est un nombre","arguments":["Référence"]},{"base":"ISTEXT","name":"ESTTEXTE","description":"Renvoie vrai si la référence est du texte","arguments":["Référence"]},{"base":"LARGE","name":"GRANDE.VALEUR","description":"Renvoie la nième valeur numérique des données, par ordre décroissant","arguments":["valeurs","index"]},{"base":"LCM","name":"PPCM","description":"Renvoie le plus petit commun multiple des arguments"},{"base":"LEFT","name":"GAUCHE","arguments":["chaîne","nombre"]},{"base":"LEN","name":"NBCAR","arguments":["chaîne"]},{"base":"LOWER","name":"MINUSCULE","description":"Convertit le texte en minuscules","arguments":["texte"]},{"base":"MATCH","name":"EQUIV","arguments":["valeur","plage","type"]},{"base":"MDETERM","name":"DETERMAT","description":"Renvoie le déterminant d'une matrice","arguments":["matrice"]},{"base":"MEAN","name":"MEAN","description":"Renvoie la moyenne arithmétique de tous les arguments numériques"},{"base":"MEDIAN","name":"MEDIANE","description":"Renvoie la valeur médiane de la plage de données","arguments":["plage"]},{"base":"MID","name":"STXT","arguments":["chaîne","gauche","nombre"]},{"base":"MINVERSE","name":"INVERSEMAT","description":"Renvoie la matrice inverse","arguments":["matrice"]},{"base":"MMULT","name":"PRODUITMAT","description":"Renvoie le produit matriciel A ⋅ B","arguments":["A","B"]},{"base":"MONTH","name":"MOIS","description":"Renvoie le mois à partir d'une date","arguments":["date"]},{"base":"NORM.DIST","name":"LOI.NORMALE.N","description":"Distribution normale cumulée","arguments":["valeur","moyenne","écart-type","cumulatif"]},{"base":"NORM.INV","name":"LOI.NORMALE.INVERSE.N","description":"Inverse de la distribution normale cumulée","arguments":["probabilité","moyenne","écart-type"]},{"base":"NORM.S.DIST","name":"LOI.NORMALE.STANDARD.N","description":"Distribution normale standard cumulée","arguments":["valeur","cumulatif"]},{"base":"NORM.S.INV","name":"LOI.NORMALE.STANDARD.INVERSE.N","description":"Inverse de la distribution normale standard cumulée","arguments":["probabilité"]},{"base":"NORMSDIST","name":"LOI.NORMALE.STANDARD","description":"Distribution normale standard cumulée","arguments":["valeur","cumulatif"]},{"base":"NORMSINV","name":"LOI.NORMALE.STANDARD.INVERSE","description":"Inverse de la distribution normale standard cumulée","arguments":["probabilité"]},{"base":"NOT","name":"NON"},{"base":"NOW","name":"MAINTENANT","description":"Renvoie l'heure actuelle"},{"base":"NPER","name":"NPM","description":"Renvoie le nombre de périodes d'un investissement","arguments":["Taux","Paiement","Valeur actuelle","Valeur future","Type"]},{"base":"NPV","name":"VAN","description":"Renvoie la valeur actuelle d'une série de flux de trésorerie futurs","arguments":["Taux","Flux de trésorerie"]},{"base":"OFFSET","name":"DECALER","arguments":["référence","lignes","colonnes","hauteur","largeur"]},{"base":"OR","name":"OU"},{"base":"PERCENTILE","name":"CENTILE","description":"Renvoie la valeur du kième centile de la plage de données","arguments":["plage","centile"]},{"base":"PHI","name":"PHI","arguments":["x"]},{"base":"PMT","name":"VPM","description":"Renvoie le paiement périodique d'un prêt","arguments":["Taux","Périodes","Valeur actuelle","Valeur future","Type"]},{"base":"POWER","name":"PUISSANCE","description":"Renvoie la base élevée à la puissance donnée","arguments":["base","exposant"]},{"base":"PPMT","name":"PRINCPER","description":"Renvoie la partie principale d'un paiement","arguments":["Taux","Période","Périodes","Valeur actuelle","Valeur future","Type"]},{"base":"PRODUCT","name":"PRODUIT"},{"base":"PV","name":"VA","description":"Renvoie la valeur actuelle d'un investissement","arguments":["Taux","Périodes","Paiement","Valeur future","Type"]},{"base":"QUARTILE","name":"QUARTILE","description":"Renvoie le quartile interpolé de l'ensemble de données (y compris la médiane)","arguments":["plage","quartile"]},{"base":"QUARTILE.EXC","name":"QUARTILE.EXCLURE","description":"Renvoie le quartile interpolé de l'ensemble de données (excluant la médiane)","arguments":["plage","quartile"]},{"base":"QUARTILE.INC","name":"QUARTILE.INCLURE","description":"Renvoie le quartile interpolé de l'ensemble de données (y compris la médiane)","arguments":["plage","quartile"]},{"base":"RADIANS","name":"RADIANS","description":"Convertit les degrés en radians","arguments":["Degrés"]},{"base":"RAND","name":"ALEA"},{"base":"RANDBETWEEN","name":"ALEA.ENTRE.BORNES","arguments":["min","max"]},{"base":"RANK","name":"RANG","arguments":["Valeur","Source","Ordre"]},{"base":"RATE","name":"TAUX","description":"Renvoie le taux d'intérêt d'un prêt","arguments":["Périodes","Paiement","Valeur actuelle","Valeur future","Type"]},{"base":"REAL","name":"REAL","description":"Renvoie la partie réelle d'un nombre complexe"},{"base":"RECTANGULAR","name":"RECTANGULAR","description":"Convertit un nombre complexe en forme polaire en forme rectangulaire","arguments":["r","θ en radians"]},{"base":"REGEXEXTRACT","name":"REGEXEXTRACT","description":"Extrait du texte en utilisant une expression régulière","arguments":["texte","motif","mode de retour","insensible à la casse"]},{"base":"REGEXREPLACE","name":"REGEXREPLACE","description":"Remplace du texte dans une chaîne en utilisant une regex","arguments":["texte","motif","remplacement","occurrence","insensible à la casse"]},{"base":"REGEXTEST","name":"REGEXTEST","description":"Fait correspondre du texte à une expression régulière","arguments":["texte","motif","insensible à la casse"]},{"base":"RIGHT","name":"DROITE","arguments":["chaîne","nombre"]},{"base":"ROUND","name":"ARRONDI"},{"base":"ROUNDDOWN","name":"ARRONDI.INF"},{"base":"ROUNDUP","name":"ARRONDI.SUP"},{"base":"ROW","name":"LIGNE","arguments":["référence"]},{"base":"ROWS","name":"LIGNES","arguments":["référence"]},{"base":"SEARCH","name":"CHERCHE","description":"Trouve une chaîne (aiguille) dans une autre chaîne (botte de foin). Insensible à la casse.","arguments":["Aiguille","Botte de foin","Début"]},{"base":"SEQUENCE","name":"SEQUENCE","arguments":["lignes","colonnes","début","pas"]},{"base":"SIGN","name":"SIGNE"},{"base":"SIMPLIFY","name":"SIMPLIFY","arguments":["valeur","chiffres significatifs"]},{"base":"SIN","name":"SIN","arguments":["angle en radians"]},{"base":"SINH","name":"SINH","arguments":["nombre"]},{"base":"SLOPE","name":"PENTE","arguments":["y_connus","x_connus"]},{"base":"SMALL","name":"PETITE.VALEUR","description":"Renvoie la nième valeur numérique des données, par ordre croissant","arguments":["valeurs","index"]},{"base":"SORT","name":"SORT","arguments":["valeurs"]},{"base":"SPARKLINE.COLUMN","name":"SPARKLINE.COLUMN","arguments":["données","couleur","couleur négative"]},{"base":"SPARKLINE.LINE","name":"SPARKLINE.LINE","arguments":["données","couleur","largeur de ligne"]},{"base":"SQRT","name":"RACINE","description":"Renvoie la racine carrée de l'argument"},{"base":"STDEV","name":"ECARTYPE","description":"Renvoie l'écart-type d'un ensemble de valeurs, correspondant à un échantillon d'une population","arguments":["données"]},{"base":"STDEV.P","name":"ECARTYPE.PEARSON","description":"Renvoie l'écart-type d'un ensemble de valeurs, correspondant à une population","arguments":["données"]},{"base":"STDEV.S","name":"ECARTYPE.STANDARD","description":"Renvoie l'écart-type d'un ensemble de valeurs, correspondant à un échantillon d'une population","arguments":["données"]},{"base":"STDEVA","name":"STDEVA","description":"Renvoie l'écart-type d'un ensemble de valeurs, correspondant à un échantillon d'une population","arguments":["données"]},{"base":"STDEVPA","name":"STDEVPA","description":"Renvoie l'écart-type d'un ensemble de valeurs, correspondant à une population","arguments":["données"]},{"base":"SUBSTITUTE","name":"SUBSTITUE","arguments":["texte","recherche","remplacement","index"]},{"base":"SUBTOTAL","name":"SOUS.TOTAL","arguments":["type","plage"]},{"base":"SUM","name":"SOMME","description":"Additionne les arguments et les plages","arguments":["valeurs ou plages"]},{"base":"SUMIF","name":"SOMME.SI","arguments":["plage","critère"]},{"base":"SUMIFS","name":"SOMME.SI.ENS","arguments":["plage_valeurs","plage_critères","critère","plage_critères","critère"]},{"base":"SUMPRODUCT","name":"SOMMEPROD","description":"Renvoie la somme des produits par paires de deux ou plusieurs plages"},{"base":"SUMSQ","name":"SOMME.CARRES","description":"Renvoie la somme des carrés de tous les arguments","arguments":["valeurs ou plages"]},{"base":"TAN","name":"TAN","arguments":["angle en radians"]},{"base":"TANH","name":"TANH","arguments":["nombre"]},{"base":"TEXT","name":"TEXTE","arguments":["valeur","format numérique"]},{"base":"TODAY","name":"AUJOURDHUI","description":"Renvoie le jour actuel"},{"base":"TRANSPOSE","name":"TRANSPOSE","description":"Renvoie la transposée de la matrice d'entrée","arguments":["matrice"]},{"base":"TRUNC","name":"TRONQUE"},{"base":"UPPER","name":"MAJUSCULE","description":"Convertit le texte en majuscules","arguments":["texte"]},{"base":"VALUE","name":"CNUM","arguments":["texte"]},{"base":"VAR","name":"VAR","description":"Renvoie la variance d'un ensemble de valeurs, correspondant à un échantillon d'une population","arguments":["données"]},{"base":"VAR.P","name":"VAR.P","description":"Renvoie la variance d'un ensemble de valeurs, correspondant à une population","arguments":["données"]},{"base":"VAR.S","name":"VAR.S","description":"Renvoie la variance d'un ensemble de valeurs, correspondant à un échantillon d'une population","arguments":["données"]},{"base":"VLOOKUP","name":"RECHERCHEV","arguments":["Valeur recherchée","Table","Index résultat","Inexact"]},{"base":"XIRR","name":"TRI.PAIEMENTS","description":"Renvoie le taux de rentabilité interne d'un flux de paiements non périodique","arguments":["Valeurs","Dates","Estimation"]},{"base":"XLOOKUP","name":"RECHERCHEX","arguments":["Valeur recherchée","Tableau de recherche","Tableau de retour","Non trouvé","Mode de correspondance","Mode de recherche"]},{"base":"XNPV","name":"VAN.PAIEMENTS","description":"Renvoie la VAN d'un flux de paiements non périodique à un taux donné","arguments":["Taux d'actualisation","Valeurs","Dates"]},{"base":"YEAR","name":"ANNEE","description":"Renvoie l'année à partir d'une date","arguments":["date"]},{"base":"YEARFRAC","name":"FRACTION.ANNEE","description":"Renvoie la fraction d'une année entre deux dates","arguments":["Début","Fin","Base"]},{"base":"Z.TEST","name":"Z.TEST","arguments":["Tableau","x","Sigma"]}]};