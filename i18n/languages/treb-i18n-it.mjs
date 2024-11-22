export const LanguageMap = {"language":"IT","created":"Wed, 25 Sep 2024 19:20:23 GMT","version":"2.1.3","functions":[{"base":"ABS","name":"ASS"},{"base":"ACOS","name":"ARCCOS"},{"base":"ACOSH","name":"ARCCOSH"},{"base":"ADDRESS","name":"INDIRIZZO","arguments":["riga","colonna","assoluto","a1","nome foglio"]},{"base":"AND","name":"E"},{"base":"ARG","name":"ARG","description":"Restituisce l'argomento principale di un numero complesso (in radianti)"},{"base":"ASIN","name":"ARCSEN"},{"base":"ASINH","name":"ARCSENH"},{"base":"ATAN","name":"ARCTAN"},{"base":"ATAN2","name":"ARCTAN.2"},{"base":"ATANH","name":"ARCTANH"},{"base":"AVERAGE","name":"MEDIA","description":"Restituisce la media aritmetica di tutti gli argomenti numerici"},{"base":"AVERAGEIF","name":"MEDIA.SE","arguments":["intervallo","criteri"]},{"base":"AVERAGEIFS","name":"MEDIA.PIÙ.SE","arguments":["intervallo valori","intervallo criteri","criteri","intervallo criteri","criteri"]},{"base":"BETA.DIST","name":"DISTRIB.BETA.N","description":"Distribuzione beta","arguments":["x","a","b","cumulativa"]},{"base":"BETA.INV","name":"INV.BETA.N","description":"Inverso della distribuzione beta","arguments":["probabilità","a","b"]},{"base":"CEILING","name":"ARROTONDA.ECCESSO"},{"base":"CELL","name":"CELLA","description":"Restituisce dati su una cella","arguments":["tipo","riferimento"]},{"base":"CHAR","name":"CODICE.CARATT","arguments":["numero"]},{"base":"CHECKBOX","name":"CHECKBOX","arguments":["selezionato"]},{"base":"CHOOSE","name":"SCEGLI","description":"Restituisce una delle scelte da un elenco","arguments":["Indice selezionato","Scelta 1..."]},{"base":"CODE","name":"CODICE","arguments":["stringa"]},{"base":"COLUMN","name":"RIF.COLONNA","arguments":["riferimento"]},{"base":"COLUMNS","name":"COLONNE","arguments":["riferimento"]},{"base":"COMPLEX","name":"COMPLESSO","description":"Assicura che il valore dato venga trattato come un numero complesso"},{"base":"COMPLEXLOG","name":"COMPLEXLOG","description":"Restituisce il valore principale Log(z) di un numero complesso z"},{"base":"CONCAT","name":"CONCAT","description":"Incolla le stringhe insieme"},{"base":"CONCATENATE","name":"CONCATENA","description":"Incolla le stringhe insieme"},{"base":"CONJUGATE","name":"CONJUGATE","description":"Restituisce il coniugato di un numero complesso"},{"base":"CORREL","name":"CORRELAZIONE","description":"Restituisce la correlazione tra due intervalli di valori","arguments":["A","B"]},{"base":"COS","name":"COS","arguments":["angolo in radianti"]},{"base":"COSH","name":"COSH","arguments":["numero"]},{"base":"COUNT","name":"CONTA.NUMERI","description":"Conta le celle che contengono numeri"},{"base":"COUNTA","name":"CONTA.VALORI","description":"Conta le celle che non sono vuote"},{"base":"COUNTIF","name":"CONTA.SE","arguments":["intervallo","criteri"]},{"base":"COUNTIFS","name":"CONTA.PIÙ.SE","arguments":["intervallo","criteri","intervallo","criteri"]},{"base":"COVAR","name":"COVARIANZA","description":"Restituisce la covarianza tra due intervalli di valori","arguments":["A","B"]},{"base":"CUMIPMT","name":"INT.CUMUL","description":"Restituisce l'interesse cumulativo pagato su un prestito tra due periodi","arguments":["Tasso","Periodi","Valore attuale","Periodo iniziale","Periodo finale","Tipo"]},{"base":"CUMPRINC","name":"CAP.CUM","description":"Restituisce il capitale cumulativo pagato su un prestito tra due periodi","arguments":["Tasso","Periodi","Valore attuale","Periodo iniziale","Periodo finale","Tipo"]},{"base":"DATE","name":"DATA","description":"Costruisce una data da anno/mese/giorno","arguments":["anno","mese","giorno"]},{"base":"DAY","name":"GIORNO","description":"Restituisce il giorno del mese da una data","arguments":["data"]},{"base":"DEGREES","name":"GRADI","description":"Converte i radianti in gradi","arguments":["Radianti"]},{"base":"DELTA","name":"DELTA","arguments":["numero","numero"]},{"base":"EDATE","name":"DATA.MESE","arguments":["Data iniziale","Mesi"]},{"base":"EOMONTH","name":"FINE.MESE","arguments":["Data iniziale","Mesi"]},{"base":"ERF","name":"FUNZ.ERRORE"},{"base":"EXACT","name":"IDENTICO","arguments":["testo","testo"]},{"base":"FACT","name":"FATTORIALE","description":"Restituisce il fattoriale di un numero","arguments":["numero"]},{"base":"FILTER","name":"FILTER","description":"Filtra un array usando un secondo array","arguments":["origine","filtro"]},{"base":"FIND","name":"TROVA","description":"Trova una stringa (ago) in un'altra stringa (pagliaio). Sensibile alle maiuscole/minuscole.","arguments":["Ago","Pagliaio","Inizio"]},{"base":"FLOOR","name":"ARROTONDA.DIFETTO"},{"base":"FORMULATEXT","name":"TESTO.FORMULA","description":"Restituisce una formula come stringa","arguments":["riferimento"]},{"base":"FV","name":"VAL.FUT","description":"Restituisce il valore futuro di un investimento","arguments":["Tasso","Periodi","Pagamento","Valore attuale","Tipo"]},{"base":"GAMMA","name":"GAMMA","description":"Restituisce la funzione gamma per il valore dato","arguments":["valore"]},{"base":"GAMMALN","name":"LN.GAMMA","description":"Restituisce il logaritmo naturale della funzione gamma","arguments":["valore"]},{"base":"GAMMALN.PRECISE","name":"LN.GAMMA.PRECISO","description":"Restituisce il logaritmo naturale della funzione gamma","arguments":["valore"]},{"base":"GCD","name":"MCD","description":"Trova il massimo comune divisore degli argomenti"},{"base":"GEOMEAN","name":"MEDIA.GEOMETRICA","description":"Restituisce la media geometrica di tutti gli argomenti numerici"},{"base":"HARMEAN","name":"MEDIA.ARMONICA","description":"Restituisce la media armonica degli argomenti"},{"base":"HLOOKUP","name":"CERCA.ORIZZ","arguments":["Valore di ricerca","Tabella","Indice risultato","Inesatto"]},{"base":"IF","name":"SE","arguments":["valore di test","valore se vero","valore se falso"]},{"base":"IFERROR","name":"SE.ERRORE","description":"Restituisce il valore originale o il valore alternativo se il valore originale contiene un errore","arguments":["valore originale","valore alternativo"]},{"base":"IMAGINARY","name":"COMP.IMMAGINARIO","description":"Restituisce la parte immaginaria di un numero complesso (come reale)"},{"base":"INDEX","name":"INDICE","arguments":["intervallo","riga","colonna"]},{"base":"INDIRECT","name":"INDIRETTO","arguments":["riferimento"]},{"base":"INTERCEPT","name":"INTERCETTA","arguments":["y_noti","x_noti"]},{"base":"IPMT","name":"INTERESSI","description":"Restituisce la parte di interesse di un pagamento","arguments":["Tasso","Periodo","Periodi","Valore attuale","Valore futuro","Tipo"]},{"base":"IRR","name":"TIR.COST","description":"Calcola il tasso interno di rendimento di una serie di flussi di cassa","arguments":["Flussi di cassa","Stima"]},{"base":"ISBLANK","name":"VAL.VUOTO","description":"Restituisce vero se il riferimento è vuoto","arguments":["Riferimento"]},{"base":"ISCOMPLEX","name":"ISCOMPLEX","description":"Restituisce vero se il riferimento è un numero complesso","arguments":["Riferimento"]},{"base":"ISERR","name":"VAL.ERR","description":"Controlla se un'altra cella contiene un errore","arguments":["riferimento"]},{"base":"ISERROR","name":"VAL.ERRORE","description":"Controlla se un'altra cella contiene un errore","arguments":["riferimento"]},{"base":"ISFORMULA","name":"VAL.FORMULA","description":"Restituisce vero se il riferimento è una formula","arguments":["Riferimento"]},{"base":"ISLOGICAL","name":"VAL.LOGICO","description":"Restituisce vero se il riferimento è un VERO o FALSO logico","arguments":["Riferimento"]},{"base":"ISNA","name":"VAL.NON.DISP","description":"Controlla se un'altra cella contiene un errore #N/D","arguments":["riferimento"]},{"base":"ISNUMBER","name":"VAL.NUMERO","description":"Restituisce vero se il riferimento è un numero","arguments":["Riferimento"]},{"base":"ISTEXT","name":"VAL.TESTO","description":"Restituisce vero se il riferimento è testo","arguments":["Riferimento"]},{"base":"LARGE","name":"GRANDE","description":"Restituisce l'ennesimo valore numerico dai dati in ordine decrescente","arguments":["valori","indice"]},{"base":"LCM","name":"MCM","description":"Restituisce il minimo comune multiplo degli argomenti"},{"base":"LEFT","name":"SINISTRA","arguments":["stringa","conteggio"]},{"base":"LEN","name":"LUNGHEZZA","arguments":["stringa"]},{"base":"LOWER","name":"MINUSC","description":"Converte il testo in minuscolo","arguments":["testo"]},{"base":"MATCH","name":"CONFRONTA","arguments":["valore","intervallo","tipo"]},{"base":"MDETERM","name":"MATR.DETERM","description":"Restituisce il determinante di una matrice","arguments":["matrice"]},{"base":"MEAN","name":"MEAN","description":"Restituisce la media aritmetica di tutti gli argomenti numerici"},{"base":"MEDIAN","name":"MEDIANA","description":"Restituisce il valore mediano dell'intervallo di dati","arguments":["intervallo"]},{"base":"MID","name":"STRINGA.ESTRAI","arguments":["stringa","sinistra","conteggio"]},{"base":"MINVERSE","name":"MATR.INVERSA","description":"Restituisce la matrice inversa","arguments":["matrice"]},{"base":"MMULT","name":"MATR.PRODOTTO","description":"Restituisce il prodotto scalare A ⋅ B","arguments":["A","B"]},{"base":"MOD","name":"RESTO"},{"base":"MONTH","name":"MESE","description":"Restituisce il mese da una data","arguments":["data"]},{"base":"NORM.DIST","name":"DISTRIB.NORM.N","description":"Distribuzione normale cumulativa","arguments":["valore","media","deviazione standard","cumulativa"]},{"base":"NORM.INV","name":"INV.NORM.N","description":"Inverso della distribuzione normale cumulativa","arguments":["probabilità","media","deviazione standard"]},{"base":"NORM.S.DIST","name":"DISTRIB.NORM.ST.N","description":"Distribuzione normale cumulativa","arguments":["valore","cumulativa"]},{"base":"NORM.S.INV","name":"INV.NORM.S","description":"Inverso della distribuzione normale standard cumulativa","arguments":["probabilità"]},{"base":"NORMSDIST","name":"DISTRIB.NORM.ST","description":"Distribuzione normale cumulativa","arguments":["valore","cumulativa"]},{"base":"NORMSINV","name":"INV.NORM.ST","description":"Inverso della distribuzione normale standard cumulativa","arguments":["probabilità"]},{"base":"NOT","name":"NON"},{"base":"NOW","name":"ADESSO","description":"Restituisce l'ora corrente"},{"base":"NPER","name":"NUM.RATE","description":"Restituisce il numero di periodi di un investimento","arguments":["Tasso","Pagamento","Valore attuale","Valore futuro","Tipo"]},{"base":"NPV","name":"VAN","description":"Restituisce il valore attuale di una serie di flussi di cassa futuri","arguments":["Tasso","Flusso di cassa"]},{"base":"OFFSET","name":"SCARTO","arguments":["riferimento","righe","colonne","altezza","larghezza"]},{"base":"OR","name":"O"},{"base":"PERCENTILE","name":"PERCENTILE","description":"Restituisce il valore del k-esimo percentile dall'intervallo di dati","arguments":["intervallo","percentile"]},{"base":"PHI","name":"PHI","arguments":["x"]},{"base":"PI","name":"PI.GRECO"},{"base":"PMT","name":"RATA","description":"Restituisce il pagamento periodico di un prestito","arguments":["Tasso","Periodi","Valore attuale","Valore futuro","Tipo"]},{"base":"POWER","name":"POTENZA","description":"Restituisce la base elevata alla potenza data","arguments":["base","esponente"]},{"base":"PPMT","name":"P.RATA","description":"Restituisce la parte di capitale di un pagamento","arguments":["Tasso","Periodo","Periodi","Valore attuale","Valore futuro","Tipo"]},{"base":"PRODUCT","name":"PRODOTTO"},{"base":"PV","name":"VA","description":"Restituisce il valore attuale di un investimento","arguments":["Tasso","Periodi","Pagamento","Valore futuro","Tipo"]},{"base":"QUARTILE","name":"QUARTILE","description":"Restituisce il quartile interpolato del set di dati (inclusa la mediana)","arguments":["intervallo","quartile"]},{"base":"QUARTILE.EXC","name":"ESC.QUARTILE","description":"Restituisce il quartile interpolato del set di dati (esclusa la mediana)","arguments":["intervallo","quartile"]},{"base":"QUARTILE.INC","name":"INC.QUARTILE","description":"Restituisce il quartile interpolato del set di dati (inclusa la mediana)","arguments":["intervallo","quartile"]},{"base":"RADIANS","name":"RADIANTI","description":"Converte i gradi in radianti","arguments":["Gradi"]},{"base":"RAND","name":"CASUALE"},{"base":"RANDBETWEEN","name":"CASUALE.TRA","arguments":["min","max"]},{"base":"RANK","name":"RANGO","arguments":["Valore","Origine","Ordine"]},{"base":"RATE","name":"TASSO","description":"Restituisce il tasso di interesse di un prestito","arguments":["Periodi","Pagamento","Valore attuale","Valore futuro","Tipo"]},{"base":"REAL","name":"REAL","description":"Restituisce la parte reale di un numero complesso"},{"base":"RECTANGULAR","name":"RECTANGULAR","description":"Converte un numero complesso in forma polare in forma rettangolare","arguments":["r","θ in radianti"]},{"base":"REGEXEXTRACT","name":"REGEXEXTRACT","description":"Estrae il testo usando un'espressione regolare","arguments":["testo","pattern","modalità di ritorno","insensibile alle maiuscole/minuscole"]},{"base":"REGEXREPLACE","name":"REGEXREPLACE","description":"Sostituisce il testo in una stringa usando una regex","arguments":["testo","pattern","sostituzione","occorrenza","insensibile alle maiuscole/minuscole"]},{"base":"REGEXTEST","name":"REGEXTEST","description":"Confronta il testo con un'espressione regolare","arguments":["testo","pattern","insensibile alle maiuscole/minuscole"]},{"base":"RIGHT","name":"DESTRA","arguments":["stringa","conteggio"]},{"base":"ROUND","name":"ARROTONDA"},{"base":"ROUNDDOWN","name":"ARROTONDA.PER.DIF"},{"base":"ROUNDUP","name":"ARROTONDA.PER.ECC"},{"base":"ROW","name":"RIF.RIGA","arguments":["riferimento"]},{"base":"ROWS","name":"RIGHE","arguments":["riferimento"]},{"base":"SEARCH","name":"RICERCA","description":"Trova una stringa (ago) in un'altra stringa (pagliaio). Non sensibile alle maiuscole/minuscole.","arguments":["Ago","Pagliaio","Inizio"]},{"base":"SEQUENCE","name":"SEQUENCE","arguments":["righe","colonne","inizio","passo"]},{"base":"SIGN","name":"SEGNO"},{"base":"SIMPLIFY","name":"SIMPLIFY","arguments":["valore","cifre significative"]},{"base":"SIN","name":"SEN","arguments":["angolo in radianti"]},{"base":"SINH","name":"SENH","arguments":["numero"]},{"base":"SLOPE","name":"PENDENZA","arguments":["y_noti","x_noti"]},{"base":"SMALL","name":"PICCOLO","description":"Restituisce l'ennesimo valore numerico dai dati in ordine crescente","arguments":["valori","indice"]},{"base":"SORT","name":"SORT","arguments":["valori"]},{"base":"SPARKLINE.COLUMN","name":"SPARKLINE.COLUMN","arguments":["dati","colore","colore negativo"]},{"base":"SPARKLINE.LINE","name":"SPARKLINE.LINE","arguments":["dati","colore","larghezza linea"]},{"base":"SQRT","name":"RADQ","description":"Restituisce la radice quadrata dell'argomento"},{"base":"STDEV","name":"DEV.ST","description":"Restituisce la deviazione standard di un insieme di valori corrispondente a un campione di una popolazione","arguments":["dati"]},{"base":"STDEV.P","name":"DEV.ST.P","description":"Restituisce la deviazione standard di un insieme di valori corrispondente a una popolazione","arguments":["dati"]},{"base":"STDEV.S","name":"DEV.ST.C","description":"Restituisce la deviazione standard di un insieme di valori corrispondente a un campione di una popolazione","arguments":["dati"]},{"base":"STDEVA","name":"DEV.ST.VALORI","description":"Restituisce la deviazione standard di un insieme di valori corrispondente a un campione di una popolazione","arguments":["dati"]},{"base":"STDEVPA","name":"DEV.ST.POP.VALORI","description":"Restituisce la deviazione standard di un insieme di valori corrispondente a una popolazione","arguments":["dati"]},{"base":"SUBSTITUTE","name":"SOSTITUISCI","arguments":["testo","cerca","sostituzione","indice"]},{"base":"SUBTOTAL","name":"SUBTOTALE","arguments":["tipo","intervallo"]},{"base":"SUM","name":"SOMMA","description":"Somma argomenti e intervalli","arguments":["valori o intervalli"]},{"base":"SUMIF","name":"SOMMA.SE","arguments":["intervallo","criteri"]},{"base":"SUMIFS","name":"SOMMA.PIÙ.SE","arguments":["intervallo valori","intervallo criteri","criteri","intervallo criteri","criteri"]},{"base":"SUMPRODUCT","name":"MATR.SOMMA.PRODOTTO","description":"Restituisce la somma dei prodotti a coppie di due o più intervalli"},{"base":"SUMSQ","name":"SOMMA.Q","description":"Restituisce la somma dei quadrati di tutti gli argomenti","arguments":["valori o intervalli"]},{"base":"TAN","name":"TAN","arguments":["angolo in radianti"]},{"base":"TANH","name":"TANH","arguments":["numero"]},{"base":"TEXT","name":"TESTO","arguments":["valore","formato numerico"]},{"base":"TODAY","name":"OGGI","description":"Restituisce il giorno corrente"},{"base":"TRANSPOSE","name":"MATR.TRASPOSTA","description":"Restituisce la trasposta della matrice di input","arguments":["matrice"]},{"base":"TRUNC","name":"TRONCA"},{"base":"UPPER","name":"MAIUSC","description":"Converte il testo in maiuscolo","arguments":["testo"]},{"base":"VALUE","name":"VALORE","arguments":["testo"]},{"base":"VAR","name":"VAR","description":"Restituisce la varianza di un insieme di valori corrispondente a un campione di una popolazione","arguments":["dati"]},{"base":"VAR.P","name":"VAR.P","description":"Restituisce la varianza di un insieme di valori corrispondente a una popolazione","arguments":["dati"]},{"base":"VAR.S","name":"VAR.C","description":"Restituisce la varianza di un insieme di valori corrispondente a un campione di una popolazione","arguments":["dati"]},{"base":"VLOOKUP","name":"CERCA.VERT","arguments":["Valore di ricerca","Tabella","Indice risultato","Inesatto"]},{"base":"XIRR","name":"TIR.X","description":"Restituisce il tasso interno di rendimento di un flusso non periodico di pagamenti","arguments":["Valori","Date","Stima"]},{"base":"XLOOKUP","name":"CERCA.X","arguments":["Valore di ricerca","Matrice di ricerca","Matrice di restituzione","Non trovato","Modalità di corrispondenza","Modalità di ricerca"]},{"base":"XNPV","name":"VAN.X","description":"Restituisce il VAN di un flusso non periodico di pagamenti a un dato tasso","arguments":["Tasso di sconto","Valori","Date"]},{"base":"YEAR","name":"ANNO","description":"Restituisce l'anno da una data","arguments":["data"]},{"base":"YEARFRAC","name":"FRAZIONE.ANNO","description":"Restituisce la frazione di un anno tra due date","arguments":["Inizio","Fine","Base"]},{"base":"Z.TEST","name":"TESTZ","arguments":["Matrice","x","Sigma"]}]};