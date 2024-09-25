export const LanguageMap = {"language":"DA","created":"Wed, 25 Sep 2024 19:20:21 GMT","version":"2.1.3","functions":[{"base":"ACOS","name":"ARCCOS"},{"base":"ACOSH","name":"ARCCOSH"},{"base":"ADDRESS","name":"ADRESSE","arguments":["række","kolonne","absolut","a1","arknavn"]},{"base":"AND","name":"OG"},{"base":"ARG","name":"ARG","description":"Returnerer hovedargumentet for et komplekst tal (i radianer)"},{"base":"ASIN","name":"ARCSIN"},{"base":"ASINH","name":"ARCSINH"},{"base":"ATAN","name":"ARCTAN"},{"base":"ATAN2","name":"ARCTAN2"},{"base":"ATANH","name":"ARCTANH"},{"base":"AVERAGE","name":"MIDDEL","description":"Returnerer det aritmetiske gennemsnit af alle numeriske argumenter"},{"base":"AVERAGEIF","name":"MIDDEL.HVIS","arguments":["område","kriterier"]},{"base":"AVERAGEIFS","name":"MIDDEL.HVISER","arguments":["værdiområde","kriterieområde","kriterier","kriterieområde","kriterier"]},{"base":"BETA.DIST","name":"BETA.FORDELING","description":"Beta-fordeling","arguments":["x","a","b","kumulativ"]},{"base":"BETA.INV","name":"BETA.INV","description":"Invers af beta-fordelingen","arguments":["sandsynlighed","a","b"]},{"base":"CEILING","name":"AFRUND.LOFT"},{"base":"CELL","name":"CELLE","description":"Returnerer data om en celle","arguments":["type","reference"]},{"base":"CHAR","name":"CHAR","arguments":["tal"]},{"base":"CHECKBOX","name":"CHECKBOX","arguments":["markeret"]},{"base":"CHOOSE","name":"VÆLG","description":"Returnerer et af en liste af valg","arguments":["Valgt indeks","Valg 1..."]},{"base":"CODE","name":"KODE","arguments":["streng"]},{"base":"COLUMN","name":"KOLONNE","arguments":["reference"]},{"base":"COLUMNS","name":"KOLONNER","arguments":["reference"]},{"base":"COMPLEX","name":"KOMPLEKS","description":"Sikrer at den givne værdi behandles som et komplekst tal"},{"base":"COMPLEXLOG","name":"COMPLEXLOG","description":"Returnerer hovedværdien Log(z) af et komplekst tal z"},{"base":"CONCAT","name":"CONCAT","description":"Sætter strenge sammen"},{"base":"CONCATENATE","name":"SAMMENKÆDNING","description":"Sætter strenge sammen"},{"base":"CONJUGATE","name":"CONJUGATE","description":"Returnerer konjugatet af et komplekst tal"},{"base":"CORREL","name":"KORRELATION","description":"Returnerer korrelationen mellem to værdiområder","arguments":["A","B"]},{"base":"COS","name":"COS","arguments":["vinkel i radianer"]},{"base":"COSH","name":"COSH","arguments":["tal"]},{"base":"COUNT","name":"TÆL","description":"Tæller celler der indeholder tal"},{"base":"COUNTA","name":"TÆLV","description":"Tæller celler der ikke er tomme"},{"base":"COUNTIF","name":"TÆL.HVIS","arguments":["område","kriterier"]},{"base":"COUNTIFS","name":"TÆL.HVISER","arguments":["område","kriterier","område","kriterier"]},{"base":"COVAR","name":"KOVARIANS","description":"Returnerer kovariansen mellem to værdiområder","arguments":["A","B"]},{"base":"CUMIPMT","name":"AKKUM.RENTE","description":"Returnerer den akkumulerede rente betalt på et lån mellem to perioder","arguments":["Rente","Perioder","Nutidsværdi","Startperiode","Slutperiode","Type"]},{"base":"CUMPRINC","name":"AKKUM.HOVEDSTOL","description":"Returnerer den akkumulerede hovedstol betalt på et lån mellem to perioder","arguments":["Rente","Perioder","Nutidsværdi","Startperiode","Slutperiode","Type"]},{"base":"DATE","name":"DATO","description":"Konstruerer en dato fra år/måned/dag","arguments":["år","måned","dag"]},{"base":"DAY","name":"DAG","description":"Returnerer dag i måneden fra en dato","arguments":["dato"]},{"base":"DEGREES","name":"GRADER","description":"Konverterer radianer til grader","arguments":["Radianer"]},{"base":"DELTA","name":"DELTA","arguments":["tal","tal"]},{"base":"EDATE","name":"EDATO","arguments":["Startdato","Måneder"]},{"base":"EOMONTH","name":"SLUT.PÅ.MÅNED","arguments":["Startdato","Måneder"]},{"base":"ERF","name":"FEJLFUNK"},{"base":"EXACT","name":"EKSAKT","arguments":["tekst","tekst"]},{"base":"EXP","name":"EKSP"},{"base":"FACT","name":"FAKULTET","description":"Returnerer fakultetet af et tal","arguments":["tal"]},{"base":"FILTER","name":"FILTER","description":"Filtrerer et array ved hjælp af et andet array","arguments":["kilde","filter"]},{"base":"FIND","name":"FIND","description":"Find en streng (nål) i en anden streng (høstak). Skelner mellem store og små bogstaver","arguments":["Nål","Høstak","Start"]},{"base":"FLOOR","name":"AFRUND.GULV"},{"base":"FORMULATEXT","name":"FORMELTEKST","description":"Returnerer en formel som en streng","arguments":["reference"]},{"base":"FV","name":"FV","description":"Returnerer fremtidsværdien af en investering","arguments":["Rente","Perioder","Betaling","Nutidsværdi","Type"]},{"base":"GAMMA","name":"GAMMA","description":"Returnerer gammafunktionen for den givne værdi","arguments":["værdi"]},{"base":"GAMMALN","name":"GAMMALN","description":"Returnerer den naturlige logaritme af gammafunktionen","arguments":["værdi"]},{"base":"GAMMALN.PRECISE","name":"GAMMALN.PRECISE","description":"Returnerer den naturlige logaritme af gammafunktionen","arguments":["værdi"]},{"base":"GCD","name":"STØRSTE.FÆLLES.DIVISOR","description":"Finder den største fælles divisor af argumenterne"},{"base":"GEOMEAN","name":"GEOMIDDELVÆRDI","description":"Returnerer det geometriske gennemsnit af alle numeriske argumenter"},{"base":"HARMEAN","name":"HARMIDDELVÆRDI","description":"Returnerer det harmoniske gennemsnit af argumenterne"},{"base":"HLOOKUP","name":"VOPSLAG","arguments":["Opslagsværdi","Tabel","Resultatindeks","Unøjagtig"]},{"base":"IF","name":"HVIS","arguments":["testværdi","værdi hvis sand","værdi hvis falsk"]},{"base":"IFERROR","name":"HVIS.FEJL","description":"Returnerer den oprindelige værdi eller den alternative værdi hvis den oprindelige værdi indeholder en fejl","arguments":["oprindelig værdi","alternativ værdi"]},{"base":"IMAGINARY","name":"IMAGINÆR","description":"Returnerer den imaginære del af et komplekst tal (som reelt tal)"},{"base":"INDEX","name":"INDEKS","arguments":["område","række","kolonne"]},{"base":"INDIRECT","name":"INDIREKTE","arguments":["reference"]},{"base":"INT","name":"HELTAL"},{"base":"INTERCEPT","name":"SKÆRING","arguments":["kendt_y","kendt_x"]},{"base":"IPMT","name":"R.YDELSE","description":"Returnerer rentedelen af en betaling","arguments":["Rente","Periode","Perioder","Nutidsværdi","Fremtidsværdi","Type"]},{"base":"IRR","name":"IA","description":"Beregner den interne rente af en række pengestrømme","arguments":["Pengestrømme","Gæt"]},{"base":"ISBLANK","name":"ER.TOM","description":"Returnerer sand hvis referencen er tom","arguments":["Reference"]},{"base":"ISCOMPLEX","name":"ISCOMPLEX","description":"Returnerer sand hvis referencen er et komplekst tal","arguments":["Reference"]},{"base":"ISERR","name":"ER.FE","description":"Kontrollerer om en anden celle indeholder en fejl","arguments":["reference"]},{"base":"ISERROR","name":"ER.FEJL","description":"Kontrollerer om en anden celle indeholder en fejl","arguments":["reference"]},{"base":"ISFORMULA","name":"ER.FORMEL","description":"Returnerer sand hvis referencen er en formel","arguments":["Reference"]},{"base":"ISLOGICAL","name":"ER.LOGISK","description":"Returnerer sand hvis referencen er en logisk SAND eller FALSK","arguments":["Reference"]},{"base":"ISNA","name":"ER.IKKE.TILGÆNGELIG","description":"Kontrollerer om en anden celle indeholder en #I/T-fejl","arguments":["reference"]},{"base":"ISNUMBER","name":"ER.TAL","description":"Returnerer sand hvis referencen er et tal","arguments":["Reference"]},{"base":"ISTEXT","name":"ER.TEKST","description":"Returnerer sand hvis referencen er tekst","arguments":["Reference"]},{"base":"LARGE","name":"STØRSTE","description":"Returnerer den n'te numeriske værdi fra dataene i faldende rækkefølge","arguments":["værdier","indeks"]},{"base":"LCM","name":"MINDSTE.FÆLLES.MULTIPLUM","description":"Returnerer det mindste fælles multiplum af argumenterne"},{"base":"LEFT","name":"VENSTRE","arguments":["streng","antal"]},{"base":"LEN","name":"LÆNGDE","arguments":["streng"]},{"base":"LOWER","name":"/","description":"Konverterer tekst til små bogstaver","arguments":["tekst"]},{"base":"MATCH","name":"SAMMENLIGN","arguments":["værdi","område","type"]},{"base":"MAX","name":"MAKS"},{"base":"MDETERM","name":"MDETERM","description":"Returnerer determinanten af en matrix","arguments":["matrix"]},{"base":"MEAN","name":"MEAN","description":"Returnerer det aritmetiske gennemsnit af alle numeriske argumenter"},{"base":"MEDIAN","name":"MEDIAN","description":"Returnerer medianværdien af dataområdet","arguments":["område"]},{"base":"MID","name":"MIDT","arguments":["streng","venstre","antal"]},{"base":"MINVERSE","name":"MINVERT","description":"Returnerer den inverse matrix","arguments":["matrix"]},{"base":"MMULT","name":"MPRODUKT","description":"Returnerer prikproduktet A ⋅ B","arguments":["A","B"]},{"base":"MOD","name":"REST"},{"base":"MONTH","name":"MÅNED","description":"Returnerer måned fra dato","arguments":["dato"]},{"base":"NORM.DIST","name":"NORMAL.FORDELING","description":"Kumulativ normalfordeling","arguments":["værdi","middelværdi","standardafvigelse","kumulativ"]},{"base":"NORM.INV","name":"NORM.INV","description":"Invers af den kumulative normalfordeling","arguments":["sandsynlighed","middelværdi","standardafvigelse"]},{"base":"NORM.S.DIST","name":"STANDARD.NORM.FORDELING","description":"Kumulativ standardnormalfordeling","arguments":["værdi","kumulativ"]},{"base":"NORM.S.INV","name":"STANDARD.NORM.INV","description":"Invers af den kumulative standardnormalfordeling","arguments":["sandsynlighed"]},{"base":"NORMSDIST","name":"STANDARDNORMFORDELING","description":"Kumulativ normalfordeling","arguments":["værdi","kumulativ"]},{"base":"NORMSINV","name":"STANDARDNORMINV","description":"Invers af den kumulative standardnormalfordeling","arguments":["sandsynlighed"]},{"base":"NOT","name":"IKKE"},{"base":"NOW","name":"NU","description":"Returnerer aktuel tid"},{"base":"NPER","name":"NPER","description":"Returnerer antallet af perioder for en investering","arguments":["Rente","Betaling","Nutidsværdi","Fremtidsværdi","Type"]},{"base":"NPV","name":"NUTIDSVÆRDI","description":"Returnerer nutidsværdien af en række fremtidige pengestrømme","arguments":["Rente","Pengestrøm"]},{"base":"OFFSET","name":"FORSKYDNING","arguments":["reference","rækker","kolonner","højde","bredde"]},{"base":"OR","name":"ELLER"},{"base":"PERCENTILE","name":"FRAKTIL","description":"Returnerer den k'te fraktilværdi fra dataområdet","arguments":["område","fraktil"]},{"base":"PHI","name":"PHI","arguments":["x"]},{"base":"PMT","name":"YDELSE","description":"Returnerer den periodiske betaling af et lån","arguments":["Rente","Perioder","Nutidsværdi","Fremtidsværdi","Type"]},{"base":"POWER","name":"POTENS","description":"Returnerer grundtallet opløftet til den givne potens","arguments":["grundtal","eksponent"]},{"base":"PPMT","name":"H.YDELSE","description":"Returnerer hovedstolsdelen af en betaling","arguments":["Rente","Periode","Perioder","Nutidsværdi","Fremtidsværdi","Type"]},{"base":"PRODUCT","name":"PRODUKT"},{"base":"PV","name":"NV","description":"Returnerer nutidsværdien af en investering","arguments":["Rente","Perioder","Betaling","Fremtidsværdi","Type"]},{"base":"QUARTILE","name":"KVARTIL","description":"Returnerer den interpolerede kvartil af datasættet (inklusive median)","arguments":["område","kvartil"]},{"base":"QUARTILE.EXC","name":"KVARTIL.UDELAD","description":"Returnerer den interpolerede kvartil af datasættet (eksklusive median)","arguments":["område","kvartil"]},{"base":"QUARTILE.INC","name":"KVARTIL.MEDTAG","description":"Returnerer den interpolerede kvartil af datasættet (inklusive median)","arguments":["område","kvartil"]},{"base":"RADIANS","name":"RADIANER","description":"Konverterer grader til radianer","arguments":["Grader"]},{"base":"RAND","name":"SLUMP"},{"base":"RANDBETWEEN","name":"SLUMPMELLEM","arguments":["min","maks"]},{"base":"RANK","name":"PLADS","arguments":["Værdi","Kilde","Rækkefølge"]},{"base":"RATE","name":"RENTE","description":"Returnerer renten for et lån","arguments":["Perioder","Betaling","Nutidsværdi","Fremtidsværdi","Type"]},{"base":"REAL","name":"REAL","description":"Returnerer den reelle del af et komplekst tal"},{"base":"RECTANGULAR","name":"RECTANGULAR","description":"Konverterer et komplekst tal i polær form til rektangulær form","arguments":["r","θ i radianer"]},{"base":"REGEXEXTRACT","name":"REGEXEXTRACT","description":"Udtræk tekst ved hjælp af et regulært udtryk","arguments":["tekst","mønster","returneringstilstand","ikke-versalfølsom"]},{"base":"REGEXREPLACE","name":"REGEXREPLACE","description":"Erstat tekst i en streng ved hjælp af et regulært udtryk","arguments":["tekst","mønster","erstatning","forekomst","ikke-versalfølsom"]},{"base":"REGEXTEST","name":"REGEXTEST","description":"Match tekst mod et regulært udtryk","arguments":["tekst","mønster","ikke-versalfølsom"]},{"base":"RIGHT","name":"HØJRE","arguments":["streng","antal"]},{"base":"ROUND","name":"AFRUND"},{"base":"ROUNDDOWN","name":"RUND.NED"},{"base":"ROUNDUP","name":"RUND.OP"},{"base":"ROW","name":"RÆKKE","arguments":["reference"]},{"base":"ROWS","name":"RÆKKER","arguments":["reference"]},{"base":"SEARCH","name":"SØG","description":"Find en streng (nål) i en anden streng (høstak). Ikke-versalfølsom","arguments":["Nål","Høstak","Start"]},{"base":"SEQUENCE","name":"SEQUENCE","arguments":["rækker","kolonner","start","trin"]},{"base":"SIGN","name":"FORTEGN"},{"base":"SIMPLIFY","name":"SIMPLIFY","arguments":["værdi","signifikante cifre"]},{"base":"SIN","name":"SIN","arguments":["vinkel i radianer"]},{"base":"SINH","name":"SINH","arguments":["tal"]},{"base":"SLOPE","name":"STIGNING","arguments":["kendt_y","kendt_x"]},{"base":"SMALL","name":"MINDSTE","description":"Returnerer den n'te numeriske værdi fra dataene i stigende rækkefølge","arguments":["værdier","indeks"]},{"base":"SORT","name":"SORT","arguments":["værdier"]},{"base":"SPARKLINE.COLUMN","name":"SPARKLINE.COLUMN","arguments":["data","farve","negativ farve"]},{"base":"SPARKLINE.LINE","name":"SPARKLINE.LINE","arguments":["data","farve","linjebredde"]},{"base":"SQRT","name":"KVROD","description":"Returnerer kvadratroden af argumentet"},{"base":"STDEV","name":"STDAFV","description":"Returnerer standardafvigelsen af et sæt værdier svarende til en stikprøve af en population","arguments":["data"]},{"base":"STDEV.P","name":"STDAFV.P","description":"Returnerer standardafvigelsen af et sæt værdier svarende til en population","arguments":["data"]},{"base":"STDEV.S","name":"STDAFV.S","description":"Returnerer standardafvigelsen af et sæt værdier svarende til en stikprøve af en population","arguments":["data"]},{"base":"STDEVA","name":"STDAFVV","description":"Returnerer standardafvigelsen af et sæt værdier svarende til en stikprøve af en population","arguments":["data"]},{"base":"STDEVPA","name":"STDAFVPV","description":"Returnerer standardafvigelsen af et sæt værdier svarende til en population","arguments":["data"]},{"base":"SUBSTITUTE","name":"UDSKIFT","arguments":["tekst","søg","erstatning","indeks"]},{"base":"SUBTOTAL","name":"SUBTOTAL","arguments":["type","område"]},{"base":"SUM","name":"SUM","description":"Lægger argumenter og områder sammen","arguments":["værdier eller områder"]},{"base":"SUMIF","name":"SUM.HVIS","arguments":["område","kriterier"]},{"base":"SUMIFS","name":"SUM.HVISER","arguments":["værdiområde","kriterieområde","kriterier","kriterieområde","kriterier"]},{"base":"SUMPRODUCT","name":"SUMPRODUKT","description":"Returnerer summen af parvise produkter af to eller flere områder"},{"base":"SUMSQ","name":"SUMKV","description":"Returnerer summen af kvadraterne af alle argumenter","arguments":["værdier eller områder"]},{"base":"TAN","name":"TAN","arguments":["vinkel i radianer"]},{"base":"TANH","name":"TANH","arguments":["tal"]},{"base":"TEXT","name":"TEKST","arguments":["værdi","talformat"]},{"base":"TODAY","name":"IDAG","description":"Returnerer aktuel dag"},{"base":"TRANSPOSE","name":"TRANSPONER","description":"Returnerer transponeret af inputmatrix","arguments":["matrix"]},{"base":"TRUNC","name":"AFKORT"},{"base":"UPPER","name":"STORE.BOGSTAVER","description":"Konverterer tekst til store bogstaver","arguments":["tekst"]},{"base":"VALUE","name":"VÆRDI","arguments":["tekst"]},{"base":"VAR","name":"VARIANS","description":"Returnerer variansen af et sæt værdier svarende til en stikprøve af en population","arguments":["data"]},{"base":"VAR.P","name":"VARIANS.P","description":"Returnerer variansen af et sæt værdier svarende til en population","arguments":["data"]},{"base":"VAR.S","name":"VARIANS.S","description":"Returnerer variansen af et sæt værdier svarende til en stikprøve af en population","arguments":["data"]},{"base":"VLOOKUP","name":"LOPSLAG","arguments":["Opslagsværdi","Tabel","Resultatindeks","Unøjagtig"]},{"base":"XIRR","name":"INTERN.RENTE","description":"Returnerer den interne rente for en ikke-periodisk strøm af betalinger","arguments":["Værdier","Datoer","Gæt"]},{"base":"XLOOKUP","name":"XOPSLAG","arguments":["Opslagsværdi","Opslagsarray","Returarray","Ikke fundet","Matchtilstand","Søgetilstand"]},{"base":"XNPV","name":"NETTO.NUTIDSVÆRDI","description":"Returnerer NPV for en ikke-periodisk strøm af betalinger ved en given rente","arguments":["Diskonteringsrente","Værdier","Datoer"]},{"base":"YEAR","name":"ÅR","description":"Returnerer år fra dato","arguments":["dato"]},{"base":"YEARFRAC","name":"ÅR.BRØK","description":"Returnerer brøkdelen af et år mellem to datoer","arguments":["Start","Slut","Basis"]},{"base":"Z.TEST","name":"Z.TEST","arguments":["Array","x","Sigma"]}]};