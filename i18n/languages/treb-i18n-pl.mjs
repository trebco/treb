export const LanguageMap = {"language":"PL","created":"Wed, 25 Sep 2024 19:20:25 GMT","version":"2.1.3","functions":[{"base":"ABS","name":"MODUŁ.LICZBY"},{"base":"ADDRESS","name":"ADRES","arguments":["wiersz","kolumna","bezwzględny","a1","nazwa arkusza"]},{"base":"AND","name":"ORAZ"},{"base":"ARG","name":"ARG","description":"Zwraca argument główny liczby zespolonej (w radianach)"},{"base":"AVERAGE","name":"ŚREDNIA","description":"Zwraca średnią arytmetyczną wszystkich argumentów liczbowych"},{"base":"AVERAGEIF","name":"ŚREDNIA.JEŻELI","arguments":["zakres","kryteria"]},{"base":"AVERAGEIFS","name":"ŚREDNIA.WARUNKÓW","arguments":["zakres wartości","zakres kryteriów","kryteria","zakres kryteriów","kryteria"]},{"base":"BETA.DIST","name":"ROZKŁ.BETA","description":"Rozkład beta","arguments":["x","a","b","skumulowany"]},{"base":"BETA.INV","name":"ROZKŁ.BETA.ODWR","description":"Odwrotność rozkładu beta","arguments":["prawdopodobieństwo","a","b"]},{"base":"CEILING","name":"ZAOKR.W.GÓRĘ"},{"base":"CELL","name":"KOMÓRKA","description":"Zwraca dane o komórce","arguments":["typ","odwołanie"]},{"base":"CHAR","name":"ZNAK","arguments":["liczba"]},{"base":"CHECKBOX","name":"CHECKBOX","arguments":["zaznaczone"]},{"base":"CHOOSE","name":"WYBIERZ","description":"Zwraca jeden z listy wyborów","arguments":["Wybrany indeks","Wybór 1..."]},{"base":"CODE","name":"KOD","arguments":["ciąg znaków"]},{"base":"COLUMN","name":"NR.KOLUMNY","arguments":["odwołanie"]},{"base":"COLUMNS","name":"LICZBA.KOLUMN","arguments":["odwołanie"]},{"base":"COMPLEX","name":"LICZBA.ZESP","description":"Zapewnia"},{"base":"COMPLEXLOG","name":"COMPLEXLOG","description":"Zwraca główną wartość Log(z) liczby zespolonej z"},{"base":"CONCAT","name":"CONCAT","description":"Łączy ciągi znaków"},{"base":"CONCATENATE","name":"ZŁĄCZ.TEKSTY","description":"Łączy ciągi znaków"},{"base":"CONJUGATE","name":"CONJUGATE","description":"Zwraca sprzężenie liczby zespolonej"},{"base":"CORREL","name":"WSP.KORELACJI","description":"Zwraca korelację między dwoma zakresami wartości","arguments":["A","B"]},{"base":"COS","name":"COS","arguments":["kąt w radianach"]},{"base":"COSH","name":"COSH","arguments":["liczba"]},{"base":"COUNT","name":"ILE.LICZB","description":"Zlicza komórki zawierające liczby"},{"base":"COUNTA","name":"ILE.NIEPUSTYCH","description":"Zlicza komórki"},{"base":"COUNTIF","name":"LICZ.JEŻELI","arguments":["zakres","kryteria"]},{"base":"COUNTIFS","name":"LICZ.WARUNKI","arguments":["zakres","kryteria","zakres","kryteria"]},{"base":"COVAR","name":"KOWARIANCJA","description":"Zwraca kowariancję między dwoma zakresami wartości","arguments":["A","B"]},{"base":"CUMIPMT","name":"SPŁAC.ODS","description":"Zwraca skumulowane odsetki zapłacone od pożyczki między dwoma okresami","arguments":["Stopa","Okresy","Wartość bieżąca","Okres początkowy","Okres końcowy","Typ"]},{"base":"CUMPRINC","name":"SPŁAC.KAPIT","description":"Zwraca skumulowaną kwotę główną zapłaconą od pożyczki między dwoma okresami","arguments":["Stopa","Okresy","Wartość bieżąca","Okres początkowy","Okres końcowy","Typ"]},{"base":"DATE","name":"DATA","description":"Tworzy datę z roku/miesiąca/dnia","arguments":["rok","miesiąc","dzień"]},{"base":"DAY","name":"DZIEŃ","description":"Zwraca dzień miesiąca z daty","arguments":["data"]},{"base":"DEGREES","name":"STOPNIE","description":"Konwertuje radiany na stopnie","arguments":["Radiany"]},{"base":"DELTA","name":"CZY.RÓWNE","arguments":["liczba","liczba"]},{"base":"EDATE","name":"NR.SER.DATY","arguments":["Data początkowa","Miesiące"]},{"base":"EOMONTH","name":"NR.SER.OST.DN.MIES","arguments":["Data początkowa","Miesiące"]},{"base":"ERF","name":"FUNKCJA.BŁ"},{"base":"EXACT","name":"PORÓWNAJ","arguments":["tekst","tekst"]},{"base":"FACT","name":"SILNIA","description":"Zwraca silnię liczby","arguments":["liczba"]},{"base":"FILTER","name":"FILTER","description":"Filtruje tablicę za pomocą drugiej tablicy","arguments":["źródło","filtr"]},{"base":"FIND","name":"ZNAJDŹ","description":"Znajduje ciąg znaków (igłę) w innym ciągu znaków (stogu). Uwzględnia wielkość liter.","arguments":["Igła","Stóg","Start"]},{"base":"FLOOR","name":"ZAOKR.W.DÓŁ"},{"base":"FORMULATEXT","name":"FORMUŁA.TEKST","description":"Zwraca formułę jako ciąg znaków","arguments":["odwołanie"]},{"base":"FV","name":"FV","description":"Zwraca wartość przyszłą inwestycji","arguments":["Stopa","Okresy","Płatność","Wartość bieżąca","Typ"]},{"base":"GAMMA","name":"GAMMA","description":"Zwraca funkcję gamma dla podanej wartości","arguments":["wartość"]},{"base":"GAMMALN","name":"ROZKŁAD.LIN.GAMMA","description":"Zwraca logarytm naturalny funkcji gamma","arguments":["wartość"]},{"base":"GAMMALN.PRECISE","name":"ROZKŁAD.LIN.GAMMA.DOKŁ","description":"Zwraca logarytm naturalny funkcji gamma","arguments":["wartość"]},{"base":"GCD","name":"NAJW.WSP.DZIEL","description":"Znajduje największy wspólny dzielnik argumentów"},{"base":"GEOMEAN","name":"ŚREDNIA.GEOMETRYCZNA","description":"Zwraca średnią geometryczną wszystkich argumentów liczbowych"},{"base":"HARMEAN","name":"ŚREDNIA.HARMONICZNA","description":"Zwraca średnią harmoniczną argumentów"},{"base":"HLOOKUP","name":"WYSZUKAJ.POZIOMO","arguments":["Szukana wartość","Tabela","Indeks wyniku","Niedokładne"]},{"base":"IF","name":"JEŻELI","arguments":["wartość testowa","wartość jeśli prawda","wartość jeśli fałsz"]},{"base":"IFERROR","name":"JEŻELI.BŁĄD","description":"Zwraca wartość oryginalną lub wartość alternatywną","arguments":["wartość oryginalna","wartość alternatywna"]},{"base":"IMAGINARY","name":"CZ.UROJ.LICZBY.ZESP","description":"Zwraca część urojoną liczby zespolonej (jako rzeczywistą)"},{"base":"INDEX","name":"INDEKS","arguments":["zakres","wiersz","kolumna"]},{"base":"INDIRECT","name":"ADR.POŚR","arguments":["odwołanie"]},{"base":"INT","name":"ZAOKR.DO.CAŁK"},{"base":"INTERCEPT","name":"ODCIĘTA","arguments":["znane_y","znane_x"]},{"base":"IPMT","name":"IPMT","description":"Zwraca część odsetkową płatności","arguments":["Stopa","Okres","Okresy","Wartość bieżąca","Wartość przyszła","Typ"]},{"base":"IRR","name":"IRR","description":"Oblicza wewnętrzną stopę zwrotu serii przepływów pieniężnych","arguments":["Przepływy pieniężne","Oszacowanie"]},{"base":"ISBLANK","name":"CZY.PUSTA","description":"Zwraca prawdę","arguments":["Odwołanie"]},{"base":"ISCOMPLEX","name":"ISCOMPLEX","description":"Zwraca prawdę","arguments":["Odwołanie"]},{"base":"ISERR","name":"CZY.BŁ","description":"Sprawdza","arguments":["odwołanie"]},{"base":"ISERROR","name":"CZY.BŁĄD","description":"Sprawdza","arguments":["odwołanie"]},{"base":"ISFORMULA","name":"CZY.FORMUŁA","description":"Zwraca prawdę","arguments":["Odwołanie"]},{"base":"ISLOGICAL","name":"CZY.LOGICZNA","description":"Zwraca prawdę","arguments":["Odwołanie"]},{"base":"ISNA","name":"CZY.BRAK","description":"Sprawdza","arguments":["odwołanie"]},{"base":"ISNUMBER","name":"CZY.LICZBA","description":"Zwraca prawdę","arguments":["Odwołanie"]},{"base":"ISTEXT","name":"CZY.TEKST","description":"Zwraca prawdę","arguments":["Odwołanie"]},{"base":"LARGE","name":"MAX.K","description":"Zwraca n-tą wartość liczbową z danych","arguments":["wartości","indeks"]},{"base":"LCM","name":"NAJMN.WSP.WIEL","description":"Zwraca najmniejszą wspólną wielokrotność argumentów"},{"base":"LEFT","name":"LEWY","arguments":["ciąg znaków","liczba"]},{"base":"LEN","name":"DŁ","arguments":["ciąg znaków"]},{"base":"LOWER","name":"LITERY.MAŁE","description":"Konwertuje tekst na małe litery","arguments":["tekst"]},{"base":"MATCH","name":"PODAJ.POZYCJĘ","arguments":["wartość","zakres","typ"]},{"base":"MDETERM","name":"WYZNACZNIK.MACIERZY","description":"Zwraca wyznacznik macierzy","arguments":["macierz"]},{"base":"MEAN","name":"MEAN","description":"Zwraca średnią arytmetyczną wszystkich argumentów liczbowych"},{"base":"MEDIAN","name":"MEDIANA","description":"Zwraca wartość mediany zakresu danych","arguments":["zakres"]},{"base":"MID","name":"FRAGMENT.TEKSTU","arguments":["ciąg znaków","od lewej","liczba"]},{"base":"MINVERSE","name":"MACIERZ.ODW","description":"Zwraca macierz odwrotną","arguments":["macierz"]},{"base":"MMULT","name":"MACIERZ.ILOCZYN","description":"Zwraca iloczyn macierzowy A ⋅ B","arguments":["A","B"]},{"base":"MONTH","name":"MIESIĄC","description":"Zwraca miesiąc z daty","arguments":["data"]},{"base":"NORM.DIST","name":"ROZKŁ.NORMALNY","description":"Skumulowany rozkład normalny","arguments":["wartość","średnia","odchylenie standardowe","skumulowany"]},{"base":"NORM.INV","name":"ROZKŁ.NORMALNY.ODWR","description":"Odwrotność skumulowanego rozkładu normalnego","arguments":["prawdopodobieństwo","średnia","odchylenie standardowe"]},{"base":"NORM.S.DIST","name":"ROZKŁ.NORMALNY.S","description":"Skumulowany standardowy rozkład normalny","arguments":["wartość","skumulowany"]},{"base":"NORM.S.INV","name":"ROZKŁ.NORMALNY.S.ODWR","description":"Odwrotność skumulowanego standardowego rozkładu normalnego","arguments":["prawdopodobieństwo"]},{"base":"NORMSDIST","name":"ROZKŁAD.NORMALNY.S","description":"Skumulowany standardowy rozkład normalny","arguments":["wartość","skumulowany"]},{"base":"NORMSINV","name":"ROZKŁAD.NORMALNY.S.ODW","description":"Odwrotność skumulowanego standardowego rozkładu normalnego","arguments":["prawdopodobieństwo"]},{"base":"NOT","name":"NIE"},{"base":"NOW","name":"TERAZ","description":"Zwraca bieżący czas"},{"base":"NPER","name":"NPER","description":"Zwraca liczbę okresów inwestycji","arguments":["Stopa","Płatność","Wartość bieżąca","Wartość przyszła","Typ"]},{"base":"NPV","name":"NPV","description":"Zwraca wartość bieżącą serii przyszłych przepływów pieniężnych","arguments":["Stopa","Przepływ pieniężny"]},{"base":"OFFSET","name":"PRZESUNIĘCIE","arguments":["odwołanie","wiersze","kolumny","wysokość","szerokość"]},{"base":"OR","name":"LUB"},{"base":"PERCENTILE","name":"PERCENTYL","description":"Zwraca k-tą wartość percentyla z zakresu danych","arguments":["zakres","percentyl"]},{"base":"PHI","name":"PHI","arguments":["x"]},{"base":"PMT","name":"PMT","description":"Zwraca okresową płatność pożyczki","arguments":["Stopa","Okresy","Wartość bieżąca","Wartość przyszła","Typ"]},{"base":"POWER","name":"POTĘGA","description":"Zwraca podstawę podniesioną do podanej potęgi","arguments":["podstawa","wykładnik"]},{"base":"PPMT","name":"PPMT","description":"Zwraca część kapitałową płatności","arguments":["Stopa","Okres","Okresy","Wartość bieżąca","Wartość przyszła","Typ"]},{"base":"PRODUCT","name":"ILOCZYN"},{"base":"PV","name":"PV","description":"Zwraca wartość bieżącą inwestycji","arguments":["Stopa","Okresy","Płatność","Wartość przyszła","Typ"]},{"base":"QUARTILE","name":"KWARTYL","description":"Zwraca interpolowany kwartyl zbioru danych (włącznie z medianą)","arguments":["zakres","kwartyl"]},{"base":"QUARTILE.EXC","name":"KWARTYL.PRZEDZ.OTW","description":"Zwraca interpolowany kwartyl zbioru danych (z wyłączeniem mediany)","arguments":["zakres","kwartyl"]},{"base":"QUARTILE.INC","name":"KWARTYL.PRZEDZ.ZAMK","description":"Zwraca interpolowany kwartyl zbioru danych (włącznie z medianą)","arguments":["zakres","kwartyl"]},{"base":"RADIANS","name":"RADIANY","description":"Konwertuje stopnie na radiany","arguments":["Stopnie"]},{"base":"RAND","name":"LOS"},{"base":"RANDBETWEEN","name":"LOS.ZAKR","arguments":["min","max"]},{"base":"RANK","name":"POZYCJA","arguments":["Wartość","Źródło","Kolejność"]},{"base":"RATE","name":"RATE","description":"Zwraca stopę procentową pożyczki","arguments":["Okresy","Płatność","Wartość bieżąca","Wartość przyszła","Typ"]},{"base":"REAL","name":"REAL","description":"Zwraca część rzeczywistą liczby zespolonej"},{"base":"RECTANGULAR","name":"RECTANGULAR","description":"Konwertuje liczbę zespoloną w postaci biegunowej na postać prostokątną","arguments":["r","θ w radianach"]},{"base":"REGEXEXTRACT","name":"REGEXEXTRACT","description":"Wyodrębnia tekst za pomocą wyrażenia regularnego","arguments":["tekst","wzorzec","tryb zwracania","bez rozróżniania wielkości liter"]},{"base":"REGEXREPLACE","name":"REGEXREPLACE","description":"Zastępuje tekst w ciągu znaków za pomocą wyrażenia regularnego","arguments":["tekst","wzorzec","zamiennik","wystąpienie","bez rozróżniania wielkości liter"]},{"base":"REGEXTEST","name":"REGEXTEST","description":"Dopasowuje tekst do wyrażenia regularnego","arguments":["tekst","wzorzec","bez rozróżniania wielkości liter"]},{"base":"RIGHT","name":"PRAWY","arguments":["ciąg znaków","liczba"]},{"base":"ROUND","name":"ZAOKR"},{"base":"ROUNDDOWN","name":"ZAOKR.DÓŁ"},{"base":"ROUNDUP","name":"ZAOKR.GÓRA"},{"base":"ROW","name":"WIERSZ","arguments":["odwołanie"]},{"base":"ROWS","name":"ILE.WIERSZY","arguments":["odwołanie"]},{"base":"SEARCH","name":"SZUKAJ.TEKST","description":"Znajduje ciąg znaków (igłę) w innym ciągu znaków (stogu). Nie uwzględnia wielkości liter.","arguments":["Igła","Stóg","Start"]},{"base":"SEQUENCE","name":"SEQUENCE","arguments":["wiersze","kolumny","start","krok"]},{"base":"SIGN","name":"ZNAK.LICZBY"},{"base":"SIMPLIFY","name":"SIMPLIFY","arguments":["wartość","znaczące cyfry"]},{"base":"SIN","name":"SIN","arguments":["kąt w radianach"]},{"base":"SINH","name":"SINH","arguments":["liczba"]},{"base":"SLOPE","name":"NACHYLENIE","arguments":["znane_y","znane_x"]},{"base":"SMALL","name":"MIN.K","description":"Zwraca n-tą wartość liczbową z danych","arguments":["wartości","indeks"]},{"base":"SORT","name":"SORT","arguments":["wartości"]},{"base":"SPARKLINE.COLUMN","name":"SPARKLINE.COLUMN","arguments":["dane","kolor","kolor ujemny"]},{"base":"SPARKLINE.LINE","name":"SPARKLINE.LINE","arguments":["dane","kolor","szerokość linii"]},{"base":"SQRT","name":"PIERWIASTEK","description":"Zwraca pierwiastek kwadratowy argumentu"},{"base":"STDEV","name":"ODCH.STANDARDOWE","description":"Zwraca odchylenie standardowe zbioru wartości","arguments":["dane"]},{"base":"STDEV.P","name":"ODCH.STAND.POPUL","description":"Zwraca odchylenie standardowe zbioru wartości","arguments":["dane"]},{"base":"STDEV.S","name":"ODCH.STANDARD.PRÓBKI","description":"Zwraca odchylenie standardowe zbioru wartości","arguments":["dane"]},{"base":"STDEVA","name":"ODCH.STANDARDOWE.A","description":"Zwraca odchylenie standardowe zbioru wartości","arguments":["dane"]},{"base":"STDEVPA","name":"ODCH.STANDARD.POPUL.A","description":"Zwraca odchylenie standardowe zbioru wartości","arguments":["dane"]},{"base":"SUBSTITUTE","name":"PODSTAW","arguments":["tekst","szukany","zamiennik","indeks"]},{"base":"SUBTOTAL","name":"SUMY.CZĘŚCIOWE","arguments":["typ","zakres"]},{"base":"SUM","name":"SUMA","description":"Dodaje argumenty i zakresy","arguments":["wartości lub zakresy"]},{"base":"SUMIF","name":"SUMA.JEŻELI","arguments":["zakres","kryteria"]},{"base":"SUMIFS","name":"SUMA.WARUNKÓW","arguments":["zakres wartości","zakres kryteriów","kryteria","zakres kryteriów","kryteria"]},{"base":"SUMPRODUCT","name":"SUMA.ILOCZYNÓW","description":"Zwraca sumę iloczynów par z dwóch lub więcej zakresów"},{"base":"SUMSQ","name":"SUMA.KWADRATÓW","description":"Zwraca sumę kwadratów wszystkich argumentów","arguments":["wartości lub zakresy"]},{"base":"TAN","name":"TAN","arguments":["kąt w radianach"]},{"base":"TANH","name":"TANH","arguments":["liczba"]},{"base":"TEXT","name":"TEKST","arguments":["wartość","format liczby"]},{"base":"TODAY","name":"DZIŚ","description":"Zwraca bieżący dzień"},{"base":"TRANSPOSE","name":"TRANSPONUJ","description":"Zwraca transpozycję macierzy wejściowej","arguments":["macierz"]},{"base":"TRUNC","name":"LICZBA.CAŁK"},{"base":"UPPER","name":"LITERY.WIELKIE","description":"Konwertuje tekst na wielkie litery","arguments":["tekst"]},{"base":"VALUE","name":"WARTOŚĆ","arguments":["tekst"]},{"base":"VAR","name":"WARIANCJA","description":"Zwraca wariancję zbioru wartości","arguments":["dane"]},{"base":"VAR.P","name":"WARIANCJA.POP","description":"Zwraca wariancję zbioru wartości","arguments":["dane"]},{"base":"VAR.S","name":"WARIANCJA.PRÓBKI","description":"Zwraca wariancję zbioru wartości","arguments":["dane"]},{"base":"VLOOKUP","name":"WYSZUKAJ.PIONOWO","arguments":["Szukana wartość","Tabela","Indeks wyniku","Niedokładne"]},{"base":"XIRR","name":"XIRR","description":"Zwraca wewnętrzną stopę zwrotu dla nieokresowego strumienia płatności","arguments":["Wartości","Daty","Oszacowanie"]},{"base":"XLOOKUP","name":"X.WYSZUKAJ","arguments":["Szukana wartość","Tablica wyszukiwania","Tablica zwracana","Nie znaleziono","Tryb dopasowania","Tryb wyszukiwania"]},{"base":"XNPV","name":"XNPV","description":"Zwraca NPV nieokresowego strumienia płatności przy danej stopie","arguments":["Stopa dyskontowa","Wartości","Daty"]},{"base":"YEAR","name":"ROK","description":"Zwraca rok z daty","arguments":["data"]},{"base":"YEARFRAC","name":"CZĘŚĆ.ROKU","description":"Zwraca ułamek roku między dwiema datami","arguments":["Początek","Koniec","Podstawa"]},{"base":"Z.TEST","name":"Z.TEST","arguments":["Tablica","x","Sigma"]}]};