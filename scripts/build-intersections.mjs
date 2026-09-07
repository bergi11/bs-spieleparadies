/**
 * Erzeugt die Rätsel für "Schnittpunkte".
 *
 *   node scripts/build-intersections.mjs
 *
 * Ein Rätsel ist ein 4x4-Gitter: vier Zeilen sind Kategorien ("Tiere"), vier
 * Spalten Eigenschaften der Schreibweise ("beginnt mit S"). In jedes Feld
 * gehört ein Wort, das beides erfüllt – und das sich der Spieler selbst
 * ausdenkt. Vorgegeben ist nichts.
 *
 * Damit das Spiel eine Eingabe beurteilen kann, wandern Wortlisten und Regeln
 * mit in die erzeugte JSON. Das Skript sucht die Rätsel also nicht nur aus, es
 * liefert auch das Wissen, mit dem geprüft wird:
 *
 *   kategorien     – welche Wörter das Spiel als "Tier" durchgehen lässt
 *   eigenschaften  – die Regel als Daten, nicht als Code (siehe `erfuellt`)
 *   raetsel        – die Achsen und eine gültige Lösung für Tipp und Auflösung
 *
 * Ein Feld kommt nur ins Rätsel, wenn die Liste dafür mehrere Wörter kennt.
 * Sonst müsste man genau das eine Wort treffen, das wir zufällig aufgeschrieben
 * haben – das wäre Raten, nicht Denken.
 *
 * Die Wortlisten sind bewusst von Hand gepflegt. Automatisch beschaffte Listen
 * (Wikidata und Ähnliches) liefern Fachbegriffe, lateinische Namen und seltsame
 * Schreibweisen; hier zählt aber, dass ein Wort einem beim Grübeln einfällt.
 * Je länger die Listen, desto seltener wird eine gute Eingabe abgelehnt – neue
 * Wörter also hier ergänzen, nie in der erzeugten JSON.
 */
import { writeFile } from 'node:fs/promises';

const OUT = new URL('../src/games/intersections/daten.json', import.meta.url);

/** So viele Rätsel sollen entstehen. */
const ANZAHL = 220;
/**
 * Fester Startwert: derselbe Lauf ergibt dieselbe Datei. Sonst verschöben sich
 * unter bestehenden Spielständen die Rätselnummern.
 */
const SEED = 20260907;

/* ------------------------------------------------------------------ *
 * Kategorien – die Zeilenachse                                        *
 * ------------------------------------------------------------------ */

const KATEGORIEN = [
  {
    id: 'tiere',
    label: 'Tiere',
    woerter: `ELEFANT GIRAFFE NASHORN KROKODIL PINGUIN SCHILDKRÖTE EICHHÖRNCHEN FLAMINGO
      DELFIN PAPAGEI KAMEL LEOPARD GEPARD SEEHUND SCHIMPANSE GORILLA KÄNGURU BIBER
      MARDER FUCHS DACHS IGEL OTTER MURMELTIER FASAN AMSEL SPATZ MÖWE STORCH REIHER
      FROSCH KRÖTE EIDECHSE SPINNE HUMMEL LIBELLE HEUSCHRECKE SCHNECKE QUALLE HERING
      FORELLE KARPFEN ROBBE ZEBRA ANTILOPE LUCHS WIESEL HAMSTER MEERSCHWEINCHEN
      WALDKAUZ SPECHT KRANICH PELIKAN TINTENFISCH SEESTERN GRILLE AMEISE WESPE
      SCHMETTERLING REGENWURM MAULWURF FLEDERMAUS WILDSCHWEIN NILPFERD
      ROTKEHLCHEN BLAUWAL GOLDFISCH BRAUNBÄR GRAUGANS OHRWURM NASENBÄR
      OHRENQUALLE SILBERFISCH
      HUND KATZE PFERD KUH SCHWEIN SCHAF ZIEGE ESEL HUHN HAHN ENTE GANS TAUBE
      MAUS RATTE HASE KANINCHEN REH HIRSCH ELCH WOLF BÄR TIGER LÖWE PANDA KOALA
      AFFE FAULTIER WASCHBÄR STINKTIER STRAUSS PFAU ADLER FALKE RABE MEISE SCHWAN
      EULE KOLIBRI TUKAN BIENE FLIEGE MÜCKE KÄFER MARIENKÄFER RAUPE MOTTE FLOH
      LAUS ZECKE SCHLANGE LEGUAN CHAMÄLEON SKORPION HAI WAL ORCA KRABBE HUMMER
      GARNELE MUSCHEL KRAKE SEEPFERDCHEN AAL LACHS THUNFISCH MAKRELE SARDINE
      KABELJAU BARSCH WELS SCHOLLE OKTOPUS DACKEL PUDEL MOPS PONY FOHLEN LAMM
      KALB FERKEL KÜKEN WELPE`,
  },
  {
    id: 'laender',
    label: 'Länder',
    woerter: `FRANKREICH SPANIEN ITALIEN PORTUGAL SCHWEDEN NORWEGEN FINNLAND DÄNEMARK
      POLEN UNGARN RUMÄNIEN GRIECHENLAND TÜRKEI ÄGYPTEN MAROKKO KENIA NIGERIA
      BRASILIEN ARGENTINIEN CHILE MEXIKO KANADA JAPAN CHINA INDIEN THAILAND VIETNAM
      AUSTRALIEN NEUSEELAND ISLAND IRLAND BELGIEN NIEDERLANDE SCHWEIZ ÖSTERREICH
      TSCHECHIEN KROATIEN SERBIEN BULGARIEN UKRAINE PERU KUBA JAMAIKA MONGOLEI NEPAL
      IRAN SYRIEN JORDANIEN KATAR OMAN LIBANON ANGOLA GHANA SENEGAL UGANDA SAMBIA
      ALBANIEN LETTLAND ESTLAND LITAUEN SLOWAKEI SLOWENIEN MALTA ZYPERN INDONESIEN
      PHILIPPINEN PAKISTAN BOLIVIEN URUGUAY PARAGUAY VENEZUELA KOLUMBIEN ÄTHIOPIEN
      TANSANIA TUNESIEN ALGERIEN SUDAN SOMALIA
      DEUTSCHLAND ENGLAND SCHOTTLAND RUSSLAND SÜDAFRIKA ISRAEL AFGHANISTAN
      BANGLADESCH MALAYSIA SINGAPUR TAIWAN SÜDKOREA KASACHSTAN GEORGIEN ARMENIEN
      LUXEMBURG LIECHTENSTEIN MONACO ANDORRA KAMERUN KONGO MALI NIGER TSCHAD
      LIBYEN SIMBABWE NAMIBIA MOSAMBIK MADAGASKAR RUANDA GUATEMALA HONDURAS
      PANAMA ECUADOR HAITI BAHAMAS FIDSCHI MAZEDONIEN MONTENEGRO MOLDAWIEN`,
  },
  {
    id: 'staedte',
    label: 'Städte',
    woerter: `BERLIN HAMBURG MÜNCHEN KÖLN FRANKFURT STUTTGART LEIPZIG DRESDEN HANNOVER
      NÜRNBERG BREMEN ROSTOCK FREIBURG AUGSBURG BIELEFELD DORTMUND ESSEN BOCHUM
      PARIS LONDON MADRID LISSABON WIEN PRAG WARSCHAU BUDAPEST ATHEN STOCKHOLM OSLO
      HELSINKI KOPENHAGEN DUBLIN BRÜSSEL AMSTERDAM ZÜRICH MOSKAU KAIRO TOKIO PEKING
      SYDNEY TORONTO CHICAGO BOSTON DENVER SEATTLE HAVANNA BOGOTA NAIROBI TEHERAN
      ANKARA ISTANBUL VENEDIG FLORENZ NEAPEL MAILAND BARCELONA SEVILLA PORTO
      SALZBURG INNSBRUCK BASEL GENUA MARSEILLE DANZIG KRAKAU BUKAREST SOFIA BELGRAD
      ZAGREB TALLINN VILNIUS
      DUISBURG WUPPERTAL BONN MÜNSTER KARLSRUHE MANNHEIM WIESBADEN KIEL
      MAGDEBURG ERFURT JENA POTSDAM LÜBECK OSNABRÜCK PADERBORN KASSEL KOBLENZ
      TRIER ULM REGENSBURG WÜRZBURG BAMBERG BAYREUTH PASSAU KONSTANZ GÖTTINGEN
      HEIDELBERG DARMSTADT AACHEN KREFELD OBERHAUSEN HAGEN SIEGEN CHEMNITZ
      SCHWERIN FLENSBURG GERA COTTBUS
      MIAMI DALLAS HOUSTON ATLANTA DETROIT MONTREAL VANCOUVER LIMA SANTIAGO
      CARACAS QUITO CASABLANCA TUNIS ALGIER ACCRA LAGOS KAPSTADT JOHANNESBURG
      DUBAI DOHA BAGDAD KABUL DELHI MUMBAI BANGKOK JAKARTA MANILA SEOUL OSAKA
      SHANGHAI HONGKONG LYON BORDEAUX TURIN BOLOGNA VALENCIA BILBAO GRAZ LINZ
      BERN GENF LAUSANNE`,
  },
  {
    id: 'obst',
    label: 'Obst',
    woerter: `APFEL BIRNE BANANE KIRSCHE PFLAUME APRIKOSE PFIRSICH TRAUBE ERDBEERE
      HIMBEERE BROMBEERE JOHANNISBEERE HEIDELBEERE STACHELBEERE PREISELBEERE MELONE
      WASSERMELONE ANANAS MANGO PAPAYA KIWI ZITRONE MANDARINE PAMPELMUSE DATTEL
      FEIGE GRANATAPFEL LITSCHI QUITTE MIRABELLE NEKTARINE KOKOSNUSS AVOCADO OLIVE
      HOLUNDER SANDDORN RHABARBER HAGEBUTTE BLAUBEERE
      ZWETSCHGE CLEMENTINE POMELO GUAVE MARACUJA KAKI CRANBERRY SAUERKIRSCHE
      SCHLEHE VOGELBEERE WEINTRAUBE HONIGMELONE ZUCKERMELONE PHYSALIS
      DRACHENFRUCHT PASSIONSFRUCHT`,
  },
  {
    id: 'gemuese',
    label: 'Gemüse',
    woerter: `KAROTTE GURKE TOMATE PAPRIKA ZWIEBEL KNOBLAUCH KARTOFFEL KOHLRABI
      BLUMENKOHL BROKKOLI ROSENKOHL WIRSING WEISSKOHL ROTKOHL SPINAT RADIESCHEN
      RETTICH SELLERIE LAUCH KÜRBIS ZUCCHINI AUBERGINE ARTISCHOCKE SPARGEL ERBSE
      BOHNE LINSE MAIS PASTINAKE MANGOLD FENCHEL STECKRÜBE ZUCKERRÜBE SCHWARZWURZEL
      CHICOREE FELDSALAT GRÜNKOHL BLAUKRAUT
      SALAT KOPFSALAT EISBERGSALAT CHINAKOHL SPITZKOHL SÜSSKARTOFFEL OKRA
      ZUCKERSCHOTE STANGENSELLERIE RADICCHIO PORREE MÖHRE RÜBE KOHL KRESSE
      RUCOLA ROMANESCO TOPINAMBUR`,
  },
  {
    id: 'berufe',
    label: 'Berufe',
    woerter: `BÄCKER METZGER TISCHLER SCHLOSSER MAURER DACHDECKER GÄRTNER FRISEUR
      SCHNEIDER SCHUSTER KELLNER LEHRER ERZIEHER PROFESSOR RICHTER ANWALT NOTAR
      APOTHEKER TIERARZT ZAHNARZT HEBAMME PILOT KAPITÄN MATROSE SOLDAT POLIZIST
      BRIEFTRÄGER BUSFAHRER MECHANIKER ELEKTRIKER KLEMPNER INGENIEUR ARCHITEKT
      REPORTER MODERATOR SCHAUSPIELER SÄNGER TÄNZER MUSIKER BILDHAUER FOTOGRAF
      BUCHHALTER VERKÄUFER KASSIERER BIBLIOTHEKAR ASTRONAUT DETEKTIV IMKER FÖRSTER
      FISCHER WINZER MÜLLER SCHORNSTEINFEGER GOLDSCHMIED UHRMACHER STEUERBERATER
      DOLMETSCHER KRANKENPFLEGER SILBERSCHMIED
      ARZT KOCH BAUER MALER JOURNALIST SCHRIFTSTELLER DICHTER MASSEUR
      PHYSIOTHERAPEUT OPTIKER CHEMIKER BIOLOGE PHYSIKER MATHEMATIKER HISTORIKER
      ARCHÄOLOGE GEOLOGE METEOROLOGE PROGRAMMIERER INFORMATIKER DESIGNER
      LANDWIRT TIERPFLEGER FEUERWEHRMANN STAATSANWALT SCHAFFNER TAXIFAHRER
      KRANFÜHRER SCHWEISSER GLASER FLIESENLEGER ZIMMERMANN SCHREINER KONDITOR
      BARKEEPER PFARRER OFFIZIER DIPLOMAT MINISTER BÜRGERMEISTER FLUGBEGLEITER
      LOKFÜHRER TAUCHER BERGMANN HUFSCHMIED SATTLER WEBER DRUCKER BUCHBINDER
      ÜBERSETZER ZAUBERER CLOWN ARTIST JONGLEUR TRAINER SCHIEDSRICHTER`,
  },
  {
    id: 'koerperteile',
    label: 'Körperteile',
    woerter: `SCHULTER ELLBOGEN HANDGELENK DAUMEN ZEIGEFINGER FERSE WADE OBERSCHENKEL
      KNÖCHEL HÜFTE RIPPE WIRBEL SCHÄDEL STIRN AUGENBRAUE WIMPER KINN WANGE SCHLÄFE
      NACKEN KEHLE ZUNGE LIPPE LUNGE NIERE MAGEN MILZ MUSKEL SEHNE SCHIENBEIN
      FINGERNAGEL ZWERCHFELL BLINDDARM BAUCHNABEL SPEISERÖHRE
      KOPF ARM BEIN HAND FUSS AUGE OHR NASE MUND ZAHN HAAR HALS BAUCH RÜCKEN
      BRUST KNIE ZEH FINGER HERZ LEBER DARM HAUT KNOCHEN GEHIRN BECKEN OBERARM
      UNTERARM WIRBELSÄULE AUGENLID NASENLOCH ZAHNFLEISCH GAUMEN BLASE GALLE
      ADER VENE ARTERIE SOHLE HANDFLÄCHE HANDRÜCKEN FINGERKUPPE OHRLÄPPCHEN
      AUGAPFEL PUPILLE NETZHAUT KEHLKOPF SCHLÜSSELBEIN ELLENBOGEN`,
  },
  {
    id: 'instrumente',
    label: 'Instrumente',
    woerter: `KLAVIER FLÜGEL GEIGE BRATSCHE CELLO KONTRABASS HARFE GITARRE BANJO
      MANDOLINE UKULELE FLÖTE KLARINETTE OBOE FAGOTT SAXOFON TROMPETE POSAUNE TUBA
      AKKORDEON MUNDHARMONIKA TROMMEL PAUKE TRIANGEL XYLOFON ORGEL CEMBALO
      DUDELSACK LAUTE ZITHER BLOCKFLÖTE KEYBOARD SCHLAGZEUG TAMBURIN MARIMBA GONG
      PIANO SYNTHESIZER BASSGITARRE VIOLINE HACKBRETT PANFLÖTE QUERFLÖTE
      GLOCKENSPIEL RASSEL MARACAS KASTAGNETTEN BONGO DJEMBE CAJON DIDGERIDOO
      DREHORGEL ZIEHHARMONIKA HARMONIUM LEIER`,
  },
  {
    id: 'sport',
    label: 'Sportarten',
    woerter: `FUSSBALL HANDBALL BASKETBALL VOLLEYBALL TENNIS TISCHTENNIS BADMINTON
      SQUASH GOLF HOCKEY EISHOCKEY RUGBY BASEBALL SCHWIMMEN TURNEN LEICHTATHLETIK
      RUDERN SEGELN KLETTERN REITEN FECHTEN RINGEN BOXEN JUDO KARATE RADFAHREN
      SKIFAHREN SNOWBOARDEN EISLAUFEN TAUCHEN SURFEN WANDERN JOGGEN KEGELN BOULE
      BILLARD TRIATHLON WASSERBALL FAUSTBALL ARMDRÜCKEN
      MARATHON SPRINT HÜRDENLAUF WEITSPRUNG HOCHSPRUNG STABHOCHSPRUNG
      KUGELSTOSSEN SPEERWURF DISKUSWURF HAMMERWURF ZEHNKAMPF SIEBENKAMPF
      DREISPRUNG BOGENSCHIESSEN GEWICHTHEBEN YOGA PILATES TANZEN BALLETT
      EISKUNSTLAUF SKISPRINGEN LANGLAUF BIATHLON RODELN CURLING
      FALLSCHIRMSPRINGEN BERGSTEIGEN WINDSURFEN ANGELN MOTOCROSS SKATEBOARDEN
      PARKOUR CRICKET POLO FEDERBALL TISCHFUSSBALL SCHACH BOWLING MINIGOLF`,
  },
  {
    id: 'kleidung',
    label: 'Kleidung',
    woerter: `HEMD BLUSE PULLOVER JACKE MANTEL WESTE HOSE ROCK KLEID SCHAL MÜTZE
      HANDSCHUH SOCKE STRUMPF SCHUH STIEFEL SANDALE TURNSCHUH GÜRTEL KRAWATTE
      ANZUG SMOKING JEANS TRIKOT BADEHOSE BIKINI SCHLAFANZUG BADEMANTEL KAPUZE
      LATZHOSE OVERALL PONCHO PARKA WINDJACKE HAUSSCHUH PANTOFFEL ZYLINDER
      HALSTUCH LEDERJACKE REGENMANTEL KOPFTUCH OHRENSCHÜTZER
      TSHIRT HOODIE SWEATSHIRT STRICKJACKE BLAZER SAKKO MINIROCK FALTENROCK
      SOMMERKLEID ABENDKLEID BRAUTKLEID DIRNDL LEDERHOSE SHORTS LEGGINGS
      STRUMPFHOSE UNTERHEMD UNTERHOSE KNIESTRUMPF SNEAKER PUMPS GUMMISTIEFEL
      WANDERSCHUH FLIPFLOP KAPPE SCHIRMMÜTZE STIRNBAND SCHLIPS BADEANZUG
      NACHTHEMD MORGENMANTEL`,
  },
  {
    id: 'fahrzeuge',
    label: 'Fahrzeuge',
    woerter: `FAHRRAD MOTORRAD ROLLER LASTWAGEN STRASSENBAHN LOKOMOTIVE FLUGZEUG
      HUBSCHRAUBER SEGELBOOT DAMPFER FÄHRE KANU KAJAK FLOSS SCHLITTEN TRAKTOR BAGGER
      KRANKENWAGEN FEUERWEHRAUTO MÜLLWAGEN GABELSTAPLER SEILBAHN GONDEL KUTSCHE
      LIEFERWAGEN WOHNMOBIL RENNWAGEN OLDTIMER TRETBOOT RUDERBOOT SCHNELLZUG
      LUFTSCHIFF EINRAD MOPED PANZER
      AUTO BUS ZUG SCHIFF BOOT TAXI LIMOUSINE KOMBI CABRIO SPORTWAGEN
      GELÄNDEWAGEN WOHNWAGEN ANHÄNGER SATTELSCHLEPPER BETONMISCHER SCHNEEPFLUG
      MÄHDRESCHER QUAD SEGELFLUGZEUG ZEPPELIN HEISSLUFTBALLON UNTERSEEBOOT
      KREUZFAHRTSCHIFF FRACHTER YACHT TRETROLLER SKATEBOARD ROLLSTUHL
      KINDERWAGEN TANDEM MOUNTAINBIKE RENNRAD LASTENRAD`,
  },
  {
    id: 'moebel',
    label: 'Möbel',
    woerter: `TISCH STUHL SESSEL SOFA HOCKER BETT SCHRANK KOMMODE REGAL VITRINE TRUHE
      SPIEGEL TEPPICH VORHANG STEHLAMPE KRONLEUCHTER MATRATZE NACHTTISCH
      SCHREIBTISCH BÜCHERREGAL GARDEROBE SITZBANK ESSTISCH LIEGESTUHL SCHAUKELSTUHL
      KLEIDERSCHRANK WASCHBECKEN BADEWANNE COUCHTISCH WANDREGAL KOPFKISSEN
      OHRENSESSEL FUSSBANK HANDTUCHHALTER
      BANK HOCHBETT ETAGENBETT SCHLAFSOFA COUCH SCHEMEL BARHOCKER
      KLEIDERSTÄNDER SCHUHREGAL SIDEBOARD ANRICHTE LAMPE TISCHLAMPE HÄNGELAMPE
      SPIEGELSCHRANK AKTENSCHRANK GARDINE ROLLO JALOUSIE BETTDECKE LATTENROST
      KISSEN`,
  },
  {
    id: 'werkzeuge',
    label: 'Werkzeuge',
    woerter: `HAMMER SCHRAUBENZIEHER ZANGE SÄGE FEILE RASPEL BOHRER MEISSEL
      SCHRAUBSTOCK WASSERWAAGE ZOLLSTOCK BANDMASS SPACHTEL PINSEL LEITER SCHUBKARRE
      SCHAUFEL HARKE SENSE BEIL KELLE SCHLEIFPAPIER SCHRAUBE NAGEL DÜBEL STICHSÄGE
      KREISSÄGE AKKUSCHRAUBER LOTSCHNUR HOBEL AMBOSS DRAHTBÜRSTE HANDSÄGE
      HANDBOHRER HANDHOBEL HANDFEGER
      SCHRAUBENSCHLÜSSEL MAULSCHLÜSSEL INBUSSCHLÜSSEL ROHRZANGE KNEIFZANGE
      SEITENSCHNEIDER CUTTER TEPPICHMESSER SCHERE BLECHSCHERE HECKENSCHERE
      BOHRMASCHINE WINKELSCHLEIFER FRÄSE LÖTKOLBEN SCHRAUBZWINGE FUCHSSCHWANZ
      SPATEN HACKE PICKEL MISTGABEL SCHRAUBENDREHER STEMMEISEN BRECHEISEN
      TACKER MASSBAND`,
  },
  {
    id: 'getraenke',
    label: 'Getränke',
    woerter: `LIMONADE APFELSAFT MILCH KAKAO KAFFEE SPRUDEL WEIN CHAMPAGNER WHISKY
      WODKA LIKÖR SCHNAPS COCKTAIL SMOOTHIE EISTEE BUTTERMILCH MINERALWASSER
      GLÜHWEIN PUNSCH ORANGENSAFT TRAUBENSAFT MOLKE ESPRESSO CAPPUCCINO KRÄUTERTEE
      PFEFFERMINZTEE WEIZENBIER APFELWEIN SANGRIA ROTWEIN WEISSWEIN GRÜNTEE
      ROTBUSCHTEE
      WASSER TEE BIER SAFT COLA MALZBIER PILS RADLER SEKT PROSECCO PORTWEIN
      SHERRY GIN TEQUILA COGNAC KORN GROG EIERLIKÖR MILCHKAFFEE LATTEMACCHIATO
      KIRSCHSAFT TOMATENSAFT MULTIVITAMINSAFT SPEZI ENERGYDRINK KOKOSWASSER
      HEISSESCHOKOLADE`,
  },
  {
    id: 'pflanzen',
    label: 'Pflanzen',
    woerter: `ROSE TULPE NELKE LILIE ORCHIDEE SONNENBLUME GÄNSEBLÜMCHEN VEILCHEN
      NARZISSE HYAZINTHE KROKUS MOHNBLUME DISTEL FARN MOOS EICHE BUCHE BIRKE AHORN
      LINDE ESCHE ULME PAPPEL WEIDE TANNE FICHTE KIEFER LÄRCHE ZEDER PALME KAKTUS
      BAMBUS EFEU KASTANIE LAVENDEL BRENNNESSEL LÖWENZAHN KLEEBLATT SCHILFROHR
      SEEROSE ROTBUCHE GOLDREGEN SILBERTANNE BLAUFICHTE WEISSTANNE
      GRAS KLEE SCHILF GERANIE PETUNIE DAHLIE ASTER CHRYSANTHEME PFINGSTROSE
      RITTERSPORN GLOCKENBLUME VERGISSMEINNICHT MARGERITE KAMILLE RINGELBLUME
      SCHNEEGLÖCKCHEN MAIGLÖCKCHEN FLIEDER JASMIN HORTENSIE RHODODENDRON
      BUCHSBAUM WACHOLDER EIBE ERLE HASEL ZYPRESSE MAMMUTBAUM ALOE ALGE SEETANG`,
  },
  {
    id: 'faecher',
    label: 'Schulfächer',
    woerter: `MATHEMATIK DEUTSCH ENGLISCH FRANZÖSISCH LATEIN BIOLOGIE CHEMIE PHYSIK
      GESCHICHTE ERDKUNDE POLITIK RELIGION ETHIK MUSIK KUNST SPORT INFORMATIK
      WIRTSCHAFT PHILOSOPHIE PSYCHOLOGIE SOZIALKUNDE WERKEN TECHNIK SPANISCH
      RUSSISCH ASTRONOMIE
      SACHKUNDE HEIMATKUNDE GEOGRAFIE GEMEINSCHAFTSKUNDE HAUSWIRTSCHAFT
      GRIECHISCH ITALIENISCH TÜRKISCH CHINESISCH KUNSTGESCHICHTE THEATER CHOR
      NATURWISSENSCHAFT PÄDAGOGIK GEOMETRIE ALGEBRA`,
  },
  {
    id: 'wetter',
    label: 'Wetter und Natur',
    woerter: `REGEN SCHNEE HAGEL NEBEL GEWITTER BLITZ DONNER STURM ORKAN WIRBELSTURM
      RAUREIF FROST GLATTEIS REGENBOGEN WOLKE SONNENSCHEIN HITZEWELLE DÜRRE
      ÜBERSCHWEMMUNG LAWINE ERDBEBEN VULKAN TSUNAMI MONSUN NIESELREGEN SCHNEESTURM
      HOCHWASSER MORGENTAU EISZAPFEN WINDSTILLE SANDSTURM POLARLICHT GRAUPEL
      MORGENROT ABENDROT
      WIND BRISE HITZE KÄLTE SCHAUER PLATZREGEN WOLKENBRUCH SCHNEEFALL
      SCHNEEFLOCKE SCHNEEREGEN REIF TAU DUNST BODENFROST NACHTFROST HAGELKORN
      BLITZSCHLAG TORNADO TAIFUN HURRIKAN GEWITTERWOLKE HOCHDRUCK TIEFDRUCK
      SONNENAUFGANG SONNENUNTERGANG DÄMMERUNG FLUT EBBE BRANDUNG ERDRUTSCH
      WALDBRAND`,
  },
  {
    id: 'kueche',
    label: 'In der Küche',
    woerter: `TOPF PFANNE SCHÜSSEL TELLER TASSE BECHER BESTECK GABEL MESSER LÖFFEL
      SCHNEEBESEN REIBE TOASTER WASSERKOCHER BACKOFEN KÜHLSCHRANK SPÜLMASCHINE
      MIKROWELLE KAFFEEMASCHINE SCHNEIDEBRETT BRATPFANNE KOCHLÖFFEL DOSENÖFFNER
      KORKENZIEHER SCHNELLKOCHTOPF NUDELSIEB TEEKANNE SALZSTREUER PFANNENWENDER
      KUCHENFORM ZITRONENPRESSE
      HERD SPÜLE ARBEITSPLATTE BROTMESSER KÜCHENMESSER SPARSCHÄLER
      KARTOFFELPRESSE FLEISCHKLOPFER MÖRSER RÜHRSCHÜSSEL MESSBECHER KÜCHENWAAGE
      EIERBECHER TEESIEB KAFFEEFILTER STANDMIXER PÜRIERSTAB HANDMIXER
      WAFFELEISEN BACKBLECH TOPFLAPPEN GESCHIRRTUCH KAFFEEKANNE ZUCKERDOSE
      PFEFFERMÜHLE SALZMÜHLE SIEB TRICHTER SUPPENKELLE`,
  },
  {
    id: 'weltraum',
    label: 'Weltraum',
    woerter: `MERKUR VENUS MARS JUPITER SATURN URANUS NEPTUN PLUTO SONNE KOMET
      METEORIT ASTEROID GALAXIE STERNBILD SATELLIT RAKETE MILCHSTRASSE STERNSCHNUPPE
      SONNENFINSTERNIS TELESKOP RAUMSTATION MONDLANDUNG UMLAUFBAHN SCHWERKRAFT
      RAUMANZUG WELTALL KRATER RAUMFÄHRE ANDROMEDA
      MOND STERN PLANET SONNENSYSTEM NEUTRONENSTERN SUPERNOVA STERNWARTE
      RAUMSONDE MONDKRATER VOLLMOND NEUMOND HALBMOND MONDFINSTERNIS
      STERNENHIMMEL POLARSTERN ORION KASSIOPEIA SIRIUS LICHTJAHR
      SCHWERELOSIGKEIT`,
  },
];

/* ------------------------------------------------------------------ *
 * Eigenschaften – die Spaltenachse                                    *
 * ------------------------------------------------------------------ */

/**
 * Versteckte Wörter: kurz und geläufig, damit man sie im Vorbeilesen findet.
 *
 * Versteckte Zahlen und Tiere hat es nicht ins Spiel geschafft: dafür gibt es
 * im Deutschen zu wenige geläufige Wörter, die zugleich in eine der Kategorien
 * passen. Die Felder wären dann nur mit weit hergeholten Wortungetümen zu
 * füllen gewesen.
 */
const FARBEN = 'ROT BLAU GELB GRÜN GRAU BRAUN LILA ROSA GOLD SILBER WEISS SCHWARZ'.split(' ');
const KOERPERTEILE =
  `ARM BEIN OHR HAND FUSS MUND ZEH HAUT HERZ KINN BAUCH HALS NASE AUGE KNIE RÜCKEN
   LEBER DARM LIPPE ZUNGE KOPF FAUST`.split(/\s+/);

/**
 * Die Regeln stehen als Daten in der JSON, nicht als Code. Diese Auswertung
 * gibt es deshalb zweimal: hier und in `src/games/intersections/logic.ts`.
 * `npm run check:intersections` prüft beide gegeneinander.
 */
function erfuellt(regel, wort) {
  switch (regel.art) {
    case 'anfang':
      return wort.startsWith(regel.wert);
    case 'ende':
      return wort.endsWith(regel.wert);
    case 'laenge':
      return wort.length === regel.wert;
    case 'folge':
      return wort.includes(regel.wert);
    case 'doppel':
      return /(.)\1/.test(wort);
    case 'umlaut':
      return /[ÄÖÜ]/.test(wort);
    case 'ohne-e':
      return !wort.includes('E');
    case 'rahmen':
      return wort[0] === wort[wort.length - 1];
    case 'versteckt':
      return regel.wert.some((teil) => wort.includes(teil));
    default:
      throw new Error(`Unbekannte Regel: ${regel.art}`);
  }
}

const anfang = (b) => ({
  id: `anfang-${b}`,
  label: `beginnt mit ${b}`,
  familie: 'anfang',
  gewicht: 1,
  regel: { art: 'anfang', wert: b },
});

const endung = (e) => ({
  id: `ende-${e}`,
  label: `endet auf -${e}`,
  familie: 'ende',
  gewicht: 2,
  regel: { art: 'ende', wert: e },
});

const laenge = (n) => ({
  id: `laenge-${n}`,
  label: `genau ${n} Buchstaben`,
  familie: 'laenge',
  gewicht: 2,
  regel: { art: 'laenge', wert: n },
});

const folge = (teil) => ({
  id: `folge-${teil}`,
  label: `enthält ${teil}`,
  familie: 'folge',
  gewicht: 3,
  regel: { art: 'folge', wert: teil },
});

const EIGENSCHAFTEN = [
  ...'ABDEFGHKLMNPRSTWZ'.split('').map(anfang),
  ...['E', 'EL', 'ER', 'EN', 'T', 'S', 'A', 'O', 'IN', 'UNG', 'CHEN', 'IE'].map(endung),
  ...[4, 5, 6, 7, 8, 9, 10].map(laenge),
  ...['SCH', 'CK', 'PF', 'EI', 'AU', 'EU', 'ST', 'TT'].map(folge),
  {
    id: 'doppel',
    label: 'Doppelbuchstabe',
    familie: 'muster',
    gewicht: 3,
    regel: { art: 'doppel' },
  },
  {
    id: 'umlaut',
    label: 'enthält Umlaut',
    familie: 'muster',
    gewicht: 2,
    regel: { art: 'umlaut' },
  },
  {
    id: 'ohne-e',
    label: 'kein E im Wort',
    familie: 'muster',
    gewicht: 3,
    regel: { art: 'ohne-e' },
  },
  {
    id: 'rahmen',
    label: 'Anfang = Ende',
    familie: 'muster',
    gewicht: 4,
    // Knifflige Bedingungen dürfen dünner besetzt sein, sonst fielen sie ganz
    // aus dem Spiel – gerade sie machen aber den Reiz aus.
    mindestens: 3,
    regel: { art: 'rahmen' },
  },
  {
    id: 'versteckt-farbe',
    label: 'Farbe versteckt',
    familie: 'versteckt',
    gewicht: 4,
    mindestens: 3,
    regel: { art: 'versteckt', wert: FARBEN },
  },
  {
    id: 'versteckt-koerper',
    label: 'Körperteil versteckt',
    familie: 'versteckt',
    gewicht: 5,
    mindestens: 3,
    // Ein Körperteil in einem Körperteil wäre nicht zu entscheiden.
    verbietet: ['koerperteile'],
    regel: { art: 'versteckt', wert: KOERPERTEILE },
  },
];

/* ------------------------------------------------------------------ *
 * Wortpool                                                            *
 * ------------------------------------------------------------------ */

/** Wörter je Kategorie, aufgeräumt und auf Dopplungen geprüft. */
const POOL = new Map();
const herkunft = new Map();

for (const kategorie of KATEGORIEN) {
  const woerter = kategorie.woerter.split(/\s+/).filter(Boolean);
  for (const wort of woerter) {
    if (!/^[A-ZÄÖÜ]+$/.test(wort)) {
      throw new Error(`Ungültiges Wort in ${kategorie.id}: ${wort}`);
    }
    const schon = herkunft.get(wort);
    if (schon) {
      // Ein Wort in zwei Kategorien machte die Zeilenzuordnung mehrdeutig.
      throw new Error(`${wort} steht in ${schon} und in ${kategorie.id}`);
    }
    herkunft.set(wort, kategorie.id);
  }
  POOL.set(kategorie.id, woerter);
}

/* ------------------------------------------------------------------ *
 * Erzeugung                                                           *
 * ------------------------------------------------------------------ */

/** Kleiner, wiederholbarer Zufallsgenerator (mulberry32). */
function zufall(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = zufall(SEED);

const waehle = (liste, anzahl) => {
  const rest = [...liste];
  const gezogen = [];
  while (gezogen.length < anzahl && rest.length > 0) {
    gezogen.push(...rest.splice(Math.floor(rng() * rest.length), 1));
  }
  return gezogen;
};
/**
 * So viele Wörter muss die Liste je Feld hergeben. Bei weniger müsste man das
 * eine Wort treffen, das wir zufällig kennen – das wäre Raten, nicht Denken.
 * Einzelne Bedingungen setzen mit `mindestens` einen eigenen Wert.
 */
const MIND_KANDIDATEN = 4;
const mindestFuer = (eigenschaft) => eigenschaft.mindestens ?? MIND_KANDIDATEN;

/**
 * Baut ein Rätsel aus vier Kategorien und vier Eigenschaften. `null`, wenn ein
 * Feld zu dünn besetzt ist.
 */
function baue(kategorien, eigenschaften) {
  for (const eigenschaft of eigenschaften) {
    const verbietet = eigenschaft.verbietet ?? [];
    if (kategorien.some((k) => verbietet.includes(k.id))) return null;
  }

  const loesung = [];
  let engste = Infinity;

  for (const kategorie of kategorien) {
    const woerter = POOL.get(kategorie.id);
    for (const eigenschaft of eigenschaften) {
      // Ein Wort, das schon woanders im Gitter steht, zählt nicht mit: im Spiel
      // darf jedes Wort nur einmal vorkommen.
      const kandidaten = woerter.filter(
        (wort) => erfuellt(eigenschaft.regel, wort) && !loesung.includes(wort),
      );
      if (kandidaten.length < mindestFuer(eigenschaft)) return null;
      engste = Math.min(engste, kandidaten.length);
      loesung.push(kandidaten[Math.floor(rng() * kandidaten.length)]);
    }
  }

  return {
    zeilen: kategorien.map((k) => k.id),
    spalten: eigenschaften.map((e) => e.id),
    loesung,
    // Reihenfolge im Spiel: erst die Rätsel mit einfachen Bedingungen und
    // vielen möglichen Wörtern, dann die knappen.
    schwere: eigenschaften.reduce((summe, e) => summe + e.gewicht, 0) + 24 / engste,
    schluessel: [...kategorien.map((k) => k.id), ...eigenschaften.map((e) => e.id)].join('|'),
  };
}

/** Höchstens zwei Bedingungen derselben Sorte, sonst wird eine Achse eintönig. */
function achseTaugt(eigenschaften) {
  const familien = new Map();
  for (const e of eigenschaften) {
    const anzahl = (familien.get(e.familie) ?? 0) + 1;
    if (anzahl > 2) return false;
    familien.set(e.familie, anzahl);
  }
  return true;
}

/**
 * Wie viele Wörter jede Kategorie zu jeder Eigenschaft hergibt. Vier Zeilen und
 * vier Spalten blind zu würfeln, ergäbe fast nie ein volles Gitter – mit der
 * Tabelle suchen wir stattdessen zu den Spalten die Kategorien, die mitspielen.
 */
const VORRAT = new Map();
for (const kategorie of KATEGORIEN) {
  for (const eigenschaft of EIGENSCHAFTEN) {
    const anzahl = POOL.get(kategorie.id).filter((wort) =>
      erfuellt(eigenschaft.regel, wort),
    ).length;
    VORRAT.set(`${kategorie.id}|${eigenschaft.id}`, anzahl);
  }
}

/** Kategorien, die zu allen vier Eigenschaften genug Wörter haben. */
const traeger = (eigenschaften) =>
  KATEGORIEN.filter((kategorie) =>
    eigenschaften.every((eigenschaft) => {
      if ((eigenschaft.verbietet ?? []).includes(kategorie.id)) return false;
      return VORRAT.get(`${kategorie.id}|${eigenschaft.id}`) >= mindestFuer(eigenschaft);
    }),
  );

const raetsel = [];
const gesehen = new Set();
/** Damit nicht dieselben Kategorien und Eigenschaften ständig wiederkehren. */
const genutzt = new Map();
const zaehle = (id) => genutzt.get(id) ?? 0;
const OBERGRENZE = Math.ceil((ANZAHL * 4) / 14);

/**
 * Die knapp besetzten Bedingungen ("Farbe versteckt", "Anfang = Ende") kämen
 * beim gleichmäßigen Ziehen kaum vor: sie überleben nur, wenn zufällig auch die
 * anderen drei Spalten zu denselben vier Kategorien passen. Deshalb wird bei
 * jedem dritten Versuch gezielt eine von ihnen gesetzt.
 */
const KNAPPE = EIGENSCHAFTEN.filter((e) => e.mindestens !== undefined);
const REICHLICHE = EIGENSCHAFTEN.filter((e) => e.mindestens === undefined);

for (let versuch = 0; versuch < 400000 && raetsel.length < ANZAHL; versuch++) {
  const eigenschaften =
    rng() < 0.35
      ? [...waehle(KNAPPE, 1), ...waehle(REICHLICHE, 3)]
      : waehle(EIGENSCHAFTEN, 4);
  if (!achseTaugt(eigenschaften)) continue;
  if (eigenschaften.some((e) => zaehle(e.id) >= OBERGRENZE)) continue;

  const moegliche = traeger(eigenschaften).filter((k) => zaehle(k.id) < OBERGRENZE);
  if (moegliche.length < 4) continue;

  const kategorien = waehle(moegliche, 4);
  const kandidat = baue(kategorien, eigenschaften);
  if (!kandidat || gesehen.has(kandidat.schluessel)) continue;

  gesehen.add(kandidat.schluessel);
  for (const teil of [...kategorien, ...eigenschaften]) genutzt.set(teil.id, zaehle(teil.id) + 1);
  raetsel.push(kandidat);
}

raetsel.sort((a, b) => a.schwere - b.schwere);

const fertig = raetsel.map((eintrag, index) => ({
  id: index + 1,
  zeilen: eintrag.zeilen,
  spalten: eintrag.spalten,
  loesung: eintrag.loesung,
}));

/* ------------------------------------------------------------------ *
 * Gegenprobe                                                          *
 * ------------------------------------------------------------------ */

const nachId = new Map(EIGENSCHAFTEN.map((e) => [e.id, e]));

for (const eintrag of fertig) {
  if (new Set(eintrag.loesung).size !== 16) {
    throw new Error(`Rätsel ${eintrag.id} hat ein Wort doppelt`);
  }
  for (let zeile = 0; zeile < 4; zeile++) {
    for (let spalte = 0; spalte < 4; spalte++) {
      const wort = eintrag.loesung[zeile * 4 + spalte];
      if (herkunft.get(wort) !== eintrag.zeilen[zeile]) {
        throw new Error(`Rätsel ${eintrag.id}: ${wort} gehört nicht zu ${eintrag.zeilen[zeile]}`);
      }
      if (!erfuellt(nachId.get(eintrag.spalten[spalte]).regel, wort)) {
        throw new Error(`Rätsel ${eintrag.id}: ${wort} erfüllt ${eintrag.spalten[spalte]} nicht`);
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * Ausgabe                                                             *
 * ------------------------------------------------------------------ */

/** Nur die Eigenschaften, die auch vorkommen – die JSON wird im Spiel geladen. */
const gebraucht = new Set(fertig.flatMap((eintrag) => eintrag.spalten));

const daten = {
  kategorien: KATEGORIEN.map((kategorie) => ({
    id: kategorie.id,
    label: kategorie.label,
    woerter: POOL.get(kategorie.id),
  })),
  eigenschaften: EIGENSCHAFTEN.filter((e) => gebraucht.has(e.id)).map((e) => ({
    id: e.id,
    label: e.label,
    regel: e.regel,
  })),
  raetsel: fertig,
};

await writeFile(OUT, `${JSON.stringify(daten)}\n`);

console.log(`${fertig.length} Rätsel geschrieben.`);
console.log(
  `${herkunft.size} Wörter in ${KATEGORIEN.length} Kategorien, ` +
    `${daten.eigenschaften.length} Eigenschaften im Einsatz.`,
);
