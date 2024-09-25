export const LanguageMap = {"language":"NO","created":"Wed, 25 Sep 2024 19:20:25 GMT","version":"2.1.3","functions":[{"base":"ACOS","name":"ARCCOS"},{"base":"ACOSH","name":"ARCCOSH"},{"base":"ADDRESS","name":"ADRESSE","arguments":["rad","kolonne","absolutt","a1","arknavn"]},{"base":"AND","name":"OG"},{"base":"ARG","name":"ARG","description":"Returnerer hovedargumentet til et komplekst tall (i radianer)"},{"base":"ASIN","name":"ARCSIN"},{"base":"ASINH","name":"ARCSINH"},{"base":"ATAN","name":"ARCTAN"},{"base":"ATAN2","name":"ARCTAN2"},{"base":"ATANH","name":"ARCTANH"},{"base":"AVERAGE","name":"GJENNOMSNITT","description":"Returnerer det aritmetiske gjennomsnittet av alle numeriske argumenter"},{"base":"AVERAGEIF","name":"GJENNOMSNITTHVIS","arguments":["område","kriterier"]},{"base":"AVERAGEIFS","name":"GJENNOMSNITT.HVIS.SETT","arguments":["verdiområde","kriterieområde","kriterier","kriterieområde","kriterier"]},{"base":"BETA.DIST","name":"BETA.FORDELING","description":"Beta-fordeling","arguments":["x","a","b","kumulativ"]},{"base":"BETA.INV","name":"BETA.INV","description":"Invers av beta-fordelingen","arguments":["sannsynlighet","a","b"]},{"base":"CEILING","name":"AVRUND.GJELDENDE.MULTIPLUM"},{"base":"CELL","name":"CELLE","description":"Returnerer data om en celle","arguments":["type","referanse"]},{"base":"CHAR","name":"TEGNKODE","arguments":["tall"]},{"base":"CHECKBOX","name":"CHECKBOX","arguments":["avkrysset"]},{"base":"CHOOSE","name":"VELG","description":"Returnerer ett av en liste med valg","arguments":["Valgt indeks","Valg 1..."]},{"base":"CODE","name":"KODE","arguments":["streng"]},{"base":"COLUMN","name":"KOLONNE","arguments":["referanse"]},{"base":"COLUMNS","name":"KOLONNER","arguments":["referanse"]},{"base":"COMPLEX","name":"KOMPLEKS","description":"Sikrer at den gitte verdien vil bli behandlet som et komplekst tall"},{"base":"COMPLEXLOG","name":"COMPLEXLOG","description":"Returnerer hovedverdien Log(z) av et komplekst tall z"},{"base":"CONCAT","name":"CONCAT","description":"Limer sammen strenger"},{"base":"CONCATENATE","name":"KJEDE.SAMMEN","description":"Limer sammen strenger"},{"base":"CONJUGATE","name":"CONJUGATE","description":"Returnerer konjugatet av et komplekst tall"},{"base":"CORREL","name":"KORRELASJON","description":"Returnerer korrelasjonen mellom to verdiområder","arguments":["A","B"]},{"base":"COS","name":"COS","arguments":["vinkel i radianer"]},{"base":"COSH","name":"COSH","arguments":["tall"]},{"base":"COUNT","name":"ANTALL","description":"Teller celler som inneholder tall"},{"base":"COUNTA","name":"ANTALLA","description":"Teller celler som ikke er tomme"},{"base":"COUNTIF","name":"ANTALL.HVIS","arguments":["område","kriterier"]},{"base":"COUNTIFS","name":"ANTALL.HVIS.SETT","arguments":["område","kriterier","område","kriterier"]},{"base":"COVAR","name":"KOVARIANS","description":"Returnerer kovariansen mellom to verdiområder","arguments":["A","B"]},{"base":"CUMIPMT","name":"SAMLET.RENTE","description":"Returnerer kumulativ rente betalt på et lån mellom to perioder","arguments":["Rente","Perioder","Nåverdi","Startperiode","Sluttperiode","Type"]},{"base":"CUMPRINC","name":"SAMLET.HOVEDSTOL","description":"Returnerer kumulativ hovedstol betalt på et lån mellom to perioder","arguments":["Rente","Perioder","Nåverdi","Startperiode","Sluttperiode","Type"]},{"base":"DATE","name":"DATO","description":"Konstruerer en dato fra år/måned/dag","arguments":["år","måned","dag"]},{"base":"DAY","name":"DAG","description":"Returnerer dag i måneden fra en dato","arguments":["dato"]},{"base":"DEGREES","name":"GRADER","description":"Konverterer radianer til grader","arguments":["Radianer"]},{"base":"DELTA","name":"DELTA","arguments":["tall","tall"]},{"base":"EDATE","name":"DAG.ETTER","arguments":["Startdato","Måneder"]},{"base":"EOMONTH","name":"MÅNEDSSLUTT","arguments":["Startdato","Måneder"]},{"base":"ERF","name":"FEILF"},{"base":"EXACT","name":"EKSAKT","arguments":["tekst","tekst"]},{"base":"EXP","name":"EKSP"},{"base":"FACT","name":"FAKULTET","description":"Returnerer fakultetet av et tall","arguments":["tall"]},{"base":"FILTER","name":"FILTER","description":"Filtrer en matrise ved hjelp av en annen matrise.","arguments":["kilde","filter"]},{"base":"FIND","name":"FINN","description":"Finn en streng (nål) i en annen streng (høystakk). Skiller mellom store og små bokstaver.","arguments":["Nål","Høystakk","Start"]},{"base":"FLOOR","name":"AVRUND.GJELDENDE.MULTIPLUM.NED"},{"base":"FORMULATEXT","name":"FORMELTEKST","description":"Returnerer en formel som en streng","arguments":["referanse"]},{"base":"FV","name":"SLUTTVERDI","description":"Returnerer sluttverdien av en investering","arguments":["Rente","Perioder","Betaling","Nåverdi","Type"]},{"base":"GAMMA","name":"GAMMA","description":"Returnerer gammafunksjonen for den gitte verdien","arguments":["verdi"]},{"base":"GAMMALN","name":"GAMMALN","description":"Returnerer den naturlige logaritmen av gammafunksjonen","arguments":["verdi"]},{"base":"GAMMALN.PRECISE","name":"GAMMALN.PRESIS","description":"Returnerer den naturlige logaritmen av gammafunksjonen","arguments":["verdi"]},{"base":"GCD","name":"SFF","description":"Finner den største felles divisoren av argumentene"},{"base":"GEOMEAN","name":"GJENNOMSNITT.GEOMETRISK","description":"Returnerer det geometriske gjennomsnittet av alle numeriske argumenter"},{"base":"HARMEAN","name":"GJENNOMSNITT.HARMONISK","description":"Returnerer det harmoniske gjennomsnittet av argumentene"},{"base":"HLOOKUP","name":"FINN.KOLONNE","arguments":["Oppslags verdi","Tabell","Resultat indeks","Unøyaktig"]},{"base":"IF","name":"HVIS","arguments":["testverdi","verdi hvis sann","verdi hvis usann"]},{"base":"IFERROR","name":"HVISFEIL","description":"Returnerer originalverdien","arguments":["originalverdi","alternativ verdi"]},{"base":"IMAGINARY","name":"IMAGINÆR","description":"Returnerer den imaginære delen av et komplekst tall (som reelt)"},{"base":"INDEX","name":"INDEKS","arguments":["område","rad","kolonne"]},{"base":"INDIRECT","name":"INDIREKTE","arguments":["referanse"]},{"base":"INT","name":"HELTALL"},{"base":"INTERCEPT","name":"SKJÆRINGSPUNKT","arguments":["kjent_y","kjent_x"]},{"base":"IPMT","name":"RAVDRAG","description":"Returnerer rentedelen av en betaling","arguments":["Rente","Periode","Perioder","Nåverdi","Fremtidig verdi","Type"]},{"base":"IRR","name":"IR","description":"Beregner internrenten for en serie kontantstrømmer","arguments":["Kontantstrømmer","Gjetning"]},{"base":"ISBLANK","name":"ERTOM","description":"Returnerer sann hvis referansen er tom","arguments":["Referanse"]},{"base":"ISCOMPLEX","name":"ISCOMPLEX","description":"Returnerer sann hvis referansen er et komplekst tall","arguments":["Referanse"]},{"base":"ISERR","name":"ERF","description":"Sjekker om en annen celle inneholder en feil","arguments":["referanse"]},{"base":"ISERROR","name":"ERFEIL","description":"Sjekker om en annen celle inneholder en feil","arguments":["referanse"]},{"base":"ISFORMULA","name":"ERFORMEL","description":"Returnerer sann hvis referansen er en formel","arguments":["Referanse"]},{"base":"ISLOGICAL","name":"ERLOGISK","description":"Returnerer sann hvis referansen er en logisk SANN eller USANN","arguments":["Referanse"]},{"base":"ISNA","name":"ERIT","description":"Sjekker om en annen celle inneholder en #I/T-feil","arguments":["referanse"]},{"base":"ISNUMBER","name":"ERTALL","description":"Returnerer sann hvis referansen er et tall","arguments":["Referanse"]},{"base":"ISTEXT","name":"ERTEKST","description":"Returnerer sann hvis referansen er tekst","arguments":["Referanse"]},{"base":"LARGE","name":"N.STØRST","description":"Returnerer den n-te numeriske verdien fra dataene","arguments":["verdier","indeks"]},{"base":"LCM","name":"MFM","description":"Returnerer det minste felles multiplum av argumentene"},{"base":"LEFT","name":"VENSTRE","arguments":["streng","antall"]},{"base":"LEN","name":"LENGDE","arguments":["streng"]},{"base":"LOWER","name":"SMÅ","description":"Konverterer tekst til små bokstaver","arguments":["tekst"]},{"base":"MATCH","name":"SAMMENLIGNE","arguments":["verdi","område","type"]},{"base":"MAX","name":"STØRST"},{"base":"MDETERM","name":"MDETERM","description":"Returnerer determinanten til en matrise","arguments":["matrise"]},{"base":"MEAN","name":"MEAN","description":"Returnerer det aritmetiske gjennomsnittet av alle numeriske argumenter"},{"base":"MEDIAN","name":"MEDIAN","description":"Returnerer medianverdien av dataområdet","arguments":["område"]},{"base":"MID","name":"DELTEKST","arguments":["streng","venstre","antall"]},{"base":"MINVERSE","name":"MINVERS","description":"Returnerer den inverse matrisen","arguments":["matrise"]},{"base":"MMULT","name":"MMULT","description":"Returnerer prikkproduktet A ⋅ B","arguments":["A","B"]},{"base":"MOD","name":"REST"},{"base":"MONTH","name":"MÅNED","description":"Returnerer måned fra dato","arguments":["dato"]},{"base":"NORM.DIST","name":"NORM.FORDELING","description":"Kumulativ normalfordeling","arguments":["verdi","gjennomsnitt","standardavvik","kumulativ"]},{"base":"NORM.INV","name":"NORM.INV","description":"Invers av den kumulative normalfordelingen","arguments":["sannsynlighet","gjennomsnitt","standardavvik"]},{"base":"NORM.S.DIST","name":"NORM.S.FORDELING","description":"Kumulativ normalfordeling","arguments":["verdi","kumulativ"]},{"base":"NORM.S.INV","name":"NORM.S.INV","description":"Invers av den kumulative standard normalfordelingen","arguments":["sannsynlighet"]},{"base":"NORMSDIST","name":"NORMSFORDELING","description":"Kumulativ normalfordeling","arguments":["verdi","kumulativ"]},{"base":"NORMSINV","name":"NORMSINV","description":"Invers av den kumulative standard normalfordelingen","arguments":["sannsynlighet"]},{"base":"NOT","name":"IKKE"},{"base":"NOW","name":"NÅ","description":"Returnerer gjeldende tid"},{"base":"NPER","name":"PERIODER","description":"Returnerer antall perioder for en investering","arguments":["Rente","Betaling","Nåverdi","Fremtidig verdi","Type"]},{"base":"NPV","name":"NNV","description":"Returnerer nåverdien av en serie fremtidige kontantstrømmer","arguments":["Rente","Kontantstrøm"]},{"base":"OFFSET","name":"FORSKYVNING","arguments":["referanse","rader","kolonner","høyde","bredde"]},{"base":"OR","name":"ELLER"},{"base":"PERCENTILE","name":"PERSENTIL","description":"Returnerer k-te persentilverdien fra dataområdet","arguments":["område","persentil"]},{"base":"PHI","name":"PHI","arguments":["x"]},{"base":"PMT","name":"AVDRAG","description":"Returnerer den periodiske betalingen av et lån","arguments":["Rente","Perioder","Nåverdi","Fremtidig verdi","Type"]},{"base":"POWER","name":"OPPHØYD.I","description":"Returnerer base opphøyd i den gitte potensen","arguments":["base","eksponent"]},{"base":"PPMT","name":"AMORT","description":"Returnerer hovedstoldelen av en betaling","arguments":["Rente","Periode","Perioder","Nåverdi","Fremtidig verdi","Type"]},{"base":"PRODUCT","name":"PRODUKT"},{"base":"PV","name":"NÅVERDI","description":"Returnerer nåverdien av en investering","arguments":["Rente","Perioder","Betaling","Fremtidig verdi","Type"]},{"base":"QUARTILE","name":"KVARTIL","description":"Returnerer den interpolerte kvartilen av datasettet (inkludert median)","arguments":["område","kvartil"]},{"base":"QUARTILE.EXC","name":"KVARTIL.EKS","description":"Returnerer den interpolerte kvartilen av datasettet (ekskludert median)","arguments":["område","kvartil"]},{"base":"QUARTILE.INC","name":"KVARTIL.INK","description":"Returnerer den interpolerte kvartilen av datasettet (inkludert median)","arguments":["område","kvartil"]},{"base":"RADIANS","name":"RADIANER","description":"Konverterer grader til radianer","arguments":["Grader"]},{"base":"RAND","name":"TILFELDIG"},{"base":"RANDBETWEEN","name":"TILFELDIGMELLOM","arguments":["min","maks"]},{"base":"RANK","name":"RANG","arguments":["Verdi","Kilde","Rekkefølge"]},{"base":"RATE","name":"RENTE","description":"Returnerer renten på et lån","arguments":["Perioder","Betaling","Nåverdi","Fremtidig verdi","Type"]},{"base":"REAL","name":"REAL","description":"Returnerer den reelle delen av et komplekst tall"},{"base":"RECTANGULAR","name":"RECTANGULAR","description":"Konverterer et komplekst tall i polar form til rektangulær form","arguments":["r","θ i radianer"]},{"base":"REGEXEXTRACT","name":"REGEXEXTRACT","description":"Trekk ut tekst ved hjelp av et regulært uttrykk","arguments":["tekst","mønster","returmodus","ikke skille mellom store og små bokstaver"]},{"base":"REGEXREPLACE","name":"REGEXREPLACE","description":"Erstatt tekst i en streng ved hjelp av regex","arguments":["tekst","mønster","erstatning","forekomst","ikke skille mellom store og små bokstaver"]},{"base":"REGEXTEST","name":"REGEXTEST","description":"Match tekst mot et regulært uttrykk","arguments":["tekst","mønster","ikke skille mellom store og små bokstaver"]},{"base":"RIGHT","name":"HØYRE","arguments":["streng","antall"]},{"base":"ROUND","name":"AVRUND"},{"base":"ROUNDDOWN","name":"AVRUND.NED"},{"base":"ROUNDUP","name":"AVRUND.OPP"},{"base":"ROW","name":"RAD","arguments":["referanse"]},{"base":"ROWS","name":"RADER","arguments":["referanse"]},{"base":"SEARCH","name":"SØK","description":"Finn en streng (nål) i en annen streng (høystakk). Skiller ikke mellom store og små bokstaver.","arguments":["Nål","Høystakk","Start"]},{"base":"SEQUENCE","name":"SEQUENCE","arguments":["rader","kolonner","start","trinn"]},{"base":"SIGN","name":"FORTEGN"},{"base":"SIMPLIFY","name":"SIMPLIFY","arguments":["verdi","signifikante siffer"]},{"base":"SIN","name":"SIN","arguments":["vinkel i radianer"]},{"base":"SINH","name":"SINH","arguments":["tall"]},{"base":"SLOPE","name":"STIGNINGSTALL","arguments":["kjent_y","kjent_x"]},{"base":"SMALL","name":"N.MINST","description":"Returnerer den n-te numeriske verdien fra dataene","arguments":["verdier","indeks"]},{"base":"SORT","name":"SORT","arguments":["verdier"]},{"base":"SPARKLINE.COLUMN","name":"SPARKLINE.COLUMN","arguments":["data","farge","negativ farge"]},{"base":"SPARKLINE.LINE","name":"SPARKLINE.LINE","arguments":["data","farge","linjebredde"]},{"base":"SQRT","name":"ROT","description":"Returnerer kvadratroten av argumentet"},{"base":"STDEV","name":"STDAV","description":"Returnerer standardavviket til et sett verdier","arguments":["data"]},{"base":"STDEV.P","name":"STDAV.P","description":"Returnerer standardavviket til et sett verdier","arguments":["data"]},{"base":"STDEV.S","name":"STDAV.S","description":"Returnerer standardavviket til et sett verdier","arguments":["data"]},{"base":"STDEVA","name":"STDAVVIKA","description":"Returnerer standardavviket til et sett verdier","arguments":["data"]},{"base":"STDEVPA","name":"STDAVVIKPA","description":"Returnerer standardavviket til et sett verdier","arguments":["data"]},{"base":"SUBSTITUTE","name":"BYTT.UT","arguments":["tekst","søk","erstatning","indeks"]},{"base":"SUBTOTAL","name":"DELSUM","arguments":["type","område"]},{"base":"SUM","name":"SUMMER","description":"Legger sammen argumenter og områder","arguments":["verdier eller områder"]},{"base":"SUMIF","name":"SUMMERHVIS","arguments":["område","kriterier"]},{"base":"SUMIFS","name":"SUMMER.HVIS.SETT","arguments":["verdiområde","kriterieområde","kriterier","kriterieområde","kriterier"]},{"base":"SUMPRODUCT","name":"SUMMERPRODUKT","description":"Returnerer summen av parvise produkter av to eller flere områder"},{"base":"SUMSQ","name":"SUMMERKVADRAT","description":"Returnerer summen av kvadratene av alle argumenter","arguments":["verdier eller områder"]},{"base":"TAN","name":"TAN","arguments":["vinkel i radianer"]},{"base":"TANH","name":"TANH","arguments":["tall"]},{"base":"TEXT","name":"TEKST","arguments":["verdi","tallformat"]},{"base":"TODAY","name":"IDAG","description":"Returnerer gjeldende dag"},{"base":"TRANSPOSE","name":"TRANSPONER","description":"Returnerer transponert av inngangsmatrisen","arguments":["matrise"]},{"base":"TRUNC","name":"AVKORT"},{"base":"UPPER","name":"STORE","description":"Konverterer tekst til store bokstaver","arguments":["tekst"]},{"base":"VALUE","name":"VERDI","arguments":["tekst"]},{"base":"VAR","name":"VARIANS","description":"Returnerer variansen til et sett verdier","arguments":["data"]},{"base":"VAR.P","name":"VARIANS.P","description":"Returnerer variansen til et sett verdier","arguments":["data"]},{"base":"VAR.S","name":"VARIANS.S","description":"Returnerer variansen til et sett verdier","arguments":["data"]},{"base":"VLOOKUP","name":"FINN.RAD","arguments":["Oppslags verdi","Tabell","Resultat indeks","Unøyaktig"]},{"base":"XIRR","name":"XIR","description":"returnerer internrenten for en ikke-periodisk strøm av betalinger","arguments":["Verdier","Datoer","Gjetning"]},{"base":"XLOOKUP","name":"XOPPSLAG","arguments":["Oppslags verdi","Oppslags matrise","Returmatrise","Ikke funnet","Matchmodus","Søkemodus"]},{"base":"XNPV","name":"XNNV","description":"returnerer NNV av en ikke-periodisk strøm av betalinger ved en gitt rente","arguments":["Diskonteringsrente","Verdier","Datoer"]},{"base":"YEAR","name":"ÅR","description":"Returnerer år fra dato","arguments":["dato"]},{"base":"YEARFRAC","name":"ÅRDEL","description":"Returnerer brøkdelen av et år mellom to datoer","arguments":["Start","Slutt","Grunnlag"]},{"base":"Z.TEST","name":"Z.TEST","arguments":["Matrise","x","Sigma"]}]};