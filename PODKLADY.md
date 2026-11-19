# Podklady – požadavky na vlastní assety a grafiku

Stav k 13. 10. 2026. Všechno, co je teď na webu, jsou zástupné podklady, které
jsem převedl na obrázky a nahrál stejnou cestou jako tvoje. Každý z nich můžeš
nahradit vlastním a stačí přitom dodržet stejný rozměr (tabulka v oddílu 3).

## 1. Tři pravidla, na kterých záleží nejvíc

1. **Dávej velké originály, admin je zmenší sám.** Originál si nechá v
   `assets-inbox/_imported/` (do gitu nejde), takže look jde kdykoli přepočítat.
2. **Průhlednost = tvar věci. Nic víc.** Měkký stín pod každou věcí i stín od
   svíčky v ruce web **počítá z průhlednosti obrázku**. Co je v alfě kolem
   věci (záře, kouř, prach, poloprůhledný okraj, zapečený stín), vrhne stín
   taky. Výřez proto musí být čistý a stín nikdy nepeč.
3. **Fotit zpříma, světlo měkké a neutrální.** Noční náladu dělá web (tma,
   svíčka, look). Fotka, která je už tmavá a dramatická, bude na stěně
   „dvakrát noční“.

## 2. Měřítko: pixely světa

Stěna má vlastní souřadnice, **px světa**: 1 px světa = 1 px obrazovky při
zoomu 1. Nejbližší zoom je 1,25× a Retina má 2 px na 1 px obrazovky, proto:

> **Soubor = šířka ve světě × 2,5** (minimum pro plnou ostrost). Víc neuškodí,
> admin zmenší. Hodí se 3×, jako mají současné zástupné podklady.

| Šířka ve světě | Minimum souboru | Doporučeno |
|---|---|---|
| 100 | 250 px | 300+ |
| 200 | 500 px | 600+ |
| 350 | 875 px | 1050+ |
| 500 | 1250 px | 1500+ |
| 640 a víc | 1600 px (strop pro věci na stěně) | 2000+ (ostřejší už nebude) |

Pro představu: prostřední obraz má 500 px světa. Když je ve skutečnosti
asi 60 cm, vychází 1 cm ≈ 8 px světa.

## 3. Co je teď na stěně (tyhle rozměry můžeš nahradit 1 : 1)

Šířka ve světě × výška ve světě, v závorce soubor zástupného podkladu (3×).

| Položka | Ve světě | Soubor | Poznámka |
|---|---|---|---|
| Time Transit (prostřední) | 500 × 426 | 1500 × 1278 | rám s obrazem, drát nahoře |
| Mirror Puzzle | 324 × 370 | 972 × 1110 | |
| The Book | 300 × 406 | 900 × 1218 | |
| Home Lab | 356 × 312 | 1068 × 936 | |
| Local AI Workshop | 262 × 308 | 786 × 924 | kulatý rám |
| botanical-1 / -2 / -3 | 190 × 276 · 170 × 216 · 214 × 310 | 570–642 px na šířku | dekorace |
| landscape-1 | 282 × 268 | 846 × 804 | |
| moth-1, leaf-1, fern-1 | 126–176 na šířku | 378–528 px | malé preparáty |
| skull-1, belljar-1, travel-plans, hourglass-1, home-recipes, candle-1 | 146–196 na šířku | 438–588 px | polička s předmětem v jednom |
| Na skříni: books, film-animation, candle-2, hourglass-2 | 84–230 na šířku | 252–690 px | předmět bez poličky |
| V šuplících: asset-tracker, ai-programmer, letters | 170–190 × ~100 | 510–570 px | předmět shora |

Výška se vždycky dopočítá z poměru stran tvého obrázku. Šířku na stěně pak
změníš v editoru tažením za roh výběru.

## 4. Technické minimum pro všechny obrázky

- **Formáty:** `.png .tif .tiff .jpg .jpeg .webp`. Všechno s průhledností jako
  **PNG nebo TIFF**.
- **Barvy:** sRGB, 8 bit. 16bit TIFF projde, převede se.
- **Velikost:** strop 200 MB a 300 Mpx na soubor. Výstup je vždy WebP.
- **Metadata:** EXIF, GPS a údaje o fotoaparátu se zahodí. Nic z nich se na
  web nedostane.
- **Okraje:** **ořízni těsně.** Průhledný okraj se počítá do „krabice“ věci:
  posune střed, odsadí štítek a stojí paměť při každém vykreslení. Pár px
  rezervy kvůli prolnutí hrany je v pořádku.
- **Hrana výřezu:** čistá, 1–2 px prolnutí, bez bílého nebo zeleného halo
  z pozadí.

## 5. Podle druhu

| Druh v adminu | Formát | Minimum | Doporučeno | Admin zmenší na |
|---|---|---|---|---|
| **Věc na stěnu / předmět** | PNG/TIFF s průhledností | 400 px | 3× šířka ve světě | 1600 |
| **Tapeta** (dlaždice) | PNG/JPG, bez průhlednosti | 512 px | 1024–2048 | 2048 |
| **Špína a skvrny** | PNG s průhledností | 1600 px | ~2900 × 3200 | 3200 |
| **Skříň (korpus)** | PNG/JPG | 1600 px | 2600–4000 na šířku | 2560 |
| **Čelo šuplíku** | PNG/JPG | 600 px | stejné měřítko jako korpus | 1600 |
| **Samet do šuplíku** | JPG | 400 px | 800–1024 | 1024 |
| **Fotka do galerie** | JPG | 960 px | 2000–4000 | 2048 |
| **Dveře** | JPG/PNG | 1600 px | 2400–3200 na šířku | 3200 |
| **Vrznutí** | MP3 | – | do 1,5 s | nepřevádí se, strop 2 MB |

### 5.1 Obrazy (rám + obraz)

- **Jeden obrázek** (D5): rám a obraz spoj ve Photoshopu do jednoho výřezu.
- **Drát a hřebík** chceš-li, dej je do obrázku nad rám. Zástupné obrazy je
  mají: 46 px světa nad rámem, tedy 138 px při 3×.
- **Otvor:** po nahrání v editoru vyber obraz, klikni na **Nakreslit otvor…**
  a tažením označ, kde je samotný obraz. Z otvoru se počítá stín rámu uvnitř
  obrazu. Bez otvoru ten efekt u obrazu chybí.
- **Odlesky:** silný odlesk na skle nebo zlatě bude na tmavé stěně zářit.
  Fotit raději přes polarizační filtr, nebo odlesk utlumit.

### 5.2 Předměty a poličky

Máš dvě možnosti, obě fungují:

- **Polička i s předmětem v jednom obrázku**, jako mají teď zástupné poličky.
  Jednodušší na umístění.
- **Polička a předmět zvlášť.** Předmět pak jde vyměnit nebo posunout a
  v editoru se spodní hranou sám přichytí na horní hranu poličky. Proto u
  samotné poličky musí být **horní okraj obrázku = horní plocha desky** (nic
  nad ní) a u předmětu **spodní okraj = místo, kde stojí**.

### 5.3 Věci na skříni a v šuplících

- **Na skříni:** stojí spodní hranou na horní desce. Ořízni přesně ke
  spodku předmětu, jinak bude „levitovat“.
- **V šuplíku:** fotka shora nebo šikmo shora. Web ji zmenší nejvýš na 62 %
  výšky šuplíku (šuplíky jsou 150 a 172 px světa vysoké), takže věc má zhruba
  do 100 px světa výšky. Soubor 300–600 px stačí.

### 5.4 Svíčky a lampy (světlo)

- Obrázek svíčky nahraj jako běžnou věc. Pak ve **Správě → Knihovna** u
  obrázku vyplň **Světlo**:
  - **pozice plamene** 0–1 (0,5 / 0,15 = uprostřed, kousek pod horním okrajem);
  - **dosah** v px světa (340 jako zástupné svíčky, 500+ silná lampa).
- **Plamen bez záře v alfě.** Žlutá záře kolem plamene by vrhala stín. Záři
  kreslí web sám.

### 5.5 Svíčka místo kurzoru

- PNG s průhledností, **zhruba 140 × 350 px** (3× velikosti na obrazovce,
  ta je 118 px na výšku). Jeden statický obrázek, žádná animace.
- Plamen nahoře. Ve **Správě → Nastavení → Efekty** vybereš obrázek a
  zadáš, kde je plamen (0–1). Tenhle bod se kryje s polohou myši a vychází
  z něj světlo.
- Tác nebo svícen pod svíčkou klidně ano. Musí ale být malý, ať neschovává,
  na co se míří.

### 5.6 Tapeta

- **Bezešvá.** Ověř ve Photoshopu: Filtr → Jiné → Posun o polovinu šířky a
  výšky. Šev uprostřed by se na stěně opakoval.
- **Velikost na stěně** nastavíš ve **Správě → Stěna a skříň** jako „Dlaždice
  na stěně (px světa)“. Zástupný damašek má 140 px světa a soubor 560 × 800.
  Vzor 50 cm vychází kolem 400 px světa.
- **Rozlišení:** soubor aspoň **2× velikost na stěně** (400 px světa tedy
  800+, líp 1024).
- **Ladění:** spíš světlejší a měkčí, tmu přidá web. Výrazný kontrast vzoru
  ruší obrazy.

### 5.7 Špína a skvrny přes stěnu

- Jeden velký obrázek, **neopakuje se** a natáhne se přes celou stěnu (teď
  zhruba 2400 × 2650 px světa). Mírně na výšku, ~0,9 : 1, skvrny rozprostřené.
- **Jen tmavé tóny s průhledností.** Web nepoužívá prolínací režimy jako
  Multiply, takže světlá místa by byla světlá.

### 5.8 Skříň

- **Korpus:** fotka zpříma, bez perspektivy (teleobjektiv z dálky nebo
  srovnat ve Photoshopu). Na stěně má **1260 px světa**, soubor **2600+ px**.
  - **Horní okraj obrázku = horní deska.** Na ni se staví předměty, nad ní
    nesmí nic být.
  - **Otvory po šuplících prázdné** (tmavé díry). Čela jsou zvlášť a
    vyjíždějí dolů.
  - Spodek klidně pokračuje. Pohled končí kousek nad spodní hranou
    nejnižšího šuplíku, takže nohy nikdo neuvidí.
- **Čela šuplíků:** každé zvlášť, **ve stejném měřítku a světle jako
  korpus**, úchytky na čele.
- **Současné rozložení** (px světa od levého horního rohu skříně;
  ve fotce 2520 px široké je to přesně 2× tolik):

  | Šuplík | X | Y | Šířka | Výška | Čelo 3× |
  |---|---|---|---|---|---|
  | 1–3 (horní řada) | 48 / 441 / 835 | 58 | 377 | 150 | ~1130 × 450 |
  | 4–5 (dolní řada) | 48 / 638 | 224 | 574 | 172 | ~1720 × 516 |

  Rozložení nemusíš dodržet. Ve **Správě → Stěna a skříň** zadáš vlastní
  obdélníky podle své fotky (změřené ve Photoshopu a vydělené poměrem fotka :
  1260).
- **Samet:** jedna textura do všech šuplíků (tmavě zelená nebo vínová), bez
  vzoru, který by vadil při oříznutí.

### 5.9 Galerie exponátů

- Fotky a záběry z projektu, **2000+ px** na delší straně, JPG stačí.
- Nahrání: **Editor stěny** → vyber exponát → **Galerie → Nahrát fotky…**.
  První fotka je **obálka** a zároveň náhled odkazu při sdílení. Pořadí
  změníš šipkami, ke každé fotce můžeš napsat popisek (anglicky).
- Zástupné galerie mají 4 snímky na exponát (1600 px). Vlastní je nahradí,
  staré odebereš křížkem.

### 5.10 Úvodní dveře a vrznutí

- **Zavřené a pootevřené dveře: stejný záběr**, jen pootevřené křídlo.
  2400–3200 px na šířku. Import jako druh **Dveře**, přiřazení ve
  **Správě → Nastavení**. Zavřené dveře jsou zároveň náhled celého webu při
  sdílení.
- **Vrznutí:** **.mp3**, do 1,5 s, normalizované na −1 dBFS, ticho na
  začátku oříznuté. Nepřevádí se, publikuje se tak, jak je. Licence CC0
  nebo vlastní nahrávka.

### 5.10b Futra kolem dveří

Jeden obrázek s **průhledným otvorem** uprostřed, druh při importu
**Dveře**. V Místnosti → Úvodní dveře ho vybereš a tlačítkem „Nakreslit
otvor…“ označíš, kam patří dveře; dveře se do otvoru roztáhnou a futra se
kreslí přes jejich okraje (stín ve špaletě si nes v obrázku futer).

- **.png s průhledností**, ořízlé těsně kolem futer (žádný prázdný okraj).
- Otvor ať má **stejný poměr stran jako fotka dveří** (teď 751 × 1400), jinak
  se dveře do otvoru ořežou.
- Velikost: celé futra se vejdou na výšku okna, takže stačí ~**2000–2500 px**
  na výšku.
- Zástupná futra (tmavé dřevo, kanelované pilastry, římsa) jsou v Knihovně
  jako futra.png.

### 5.11 Jmenovka a štítky pod exponáty

Obě jsou prázdné desky bez textu, nápis na ně dá web živým písmem. Druh při
importu: **Cedulka**. Nastavuje se v Místnost → Jmenovka a štítky, včetně
písma, velikosti a barev.

- **Jmenovka:** **.png s průhledností**, ořízlá těsně kolem desky. Šířka na
  stěně je 540 px (nastavitelná), výška se dopočítá z poměru stran obrázku.
  Ideálně **1400–1600 px** na šířku. Plocha pro text uprostřed by měla být
  prázdná; když deska nemá střed tam, kde je střed obrázku, text posune
  „Posun textu dolů“.
- **Štítek:** **.png s průhledností**, široký, nízký proužek, třeba
  **600 × 120 px**. Kraje (šrouby, zaoblené rohy) zůstanou, jak jsou, a
  prostředek se natáhne podle délky názvu. Kolik procent z každé strany
  zůstane nedeformovaných, určuje nastavení „Okraje“. Prostředek proto musí
  snést natažení: rovný kov bez výrazné kresby nebo textury do strany.
- Stín si jmenovka udělá sama podle průhlednosti obrázku. Štítek stín nemá,
  takže si ho kresli do obrázku, pokud ho chceš.

### 5.12 Obložení místnosti (bok, římsa, lambrie)

Rám kolem celé místnosti. Druh při importu: **Obložení**. Nastavuje se v
Místnost → Obložení místnosti, velikost místnosti na Stěně tlačítkem
„Velikost místnosti“. Díly se kladou podél okrajů místnosti a opakují se,
takže fungují při jakékoli velikosti.

- **Bok – výplň:** opakuje se **svisle**. Spodní hrana musí plynule navazovat
  na horní (stejná kresba lišty, žádný světelný skok). Šířka na stěně 240 px
  (nastavitelná) → obrázek aspoň **600 px** široký, výška libovolná (typicky
  1,5× šířka). Kresli **levý** bok; pravý je jeho zrcadlo.
- **Bok – hlavice:** volitelný horní kus boku nad výplní, stejně široký,
  dole navazuje na výplň. Bez průhlednosti stačí, může ji mít.
- **Římsa:** opakuje se **vodorovně** po celé šířce místnosti, je nad boky.
  Levá a pravá hrana musí navazovat. Výška na stěně 120 px → obrázek aspoň
  **300 px** vysoký, šířka libovolná (např. 1200 px).
- **Lambrie:** opakuje se **vodorovně** podél spodku stěny za skříní, pod
  vším, co visí. Výška na stěně 420 px → obrázek aspoň **1000 px** vysoký;
  levá a pravá hrana navazují (např. dvě kazety na jeden obrázek, krajní
  sloupek rozpůlený na obou stranách).
- Navazování si ověříš nejlíp tak, že obrázek v editoru dáš dvakrát vedle
  sebe (nad sebe) a hledáš šev.
- Zástupné díly (tmavé mořené dřevo s kazetami) jsou v Knihovně jako
  bok-hlavice / bok-vypln / rimsa / lambrie – stačí je ve formuláři vyměnit.

### 5.13 Knihovna s policemi

Knihovna je obyčejný obrázek na stěnu (druh „Věc na stěnu“), ideálně
**.png s průhledností** ořízlý těsně kolem. Po importu v Knihovně klikni na
„Police…“ (nebo na Stěně v Inspektoru → Vzhled → „Nakreslit police…“) a
nakresli rámeček přes každou polici. Spodní hrana rámečku je místo, kam se
věc postaví. Police patří k obrázku, takže je mají všechny kopie té
knihovny. Na šířku stačí 1000–1500 px; věci na policích budou malé, tak ať
jsou police na obrázku dost hluboké, aby se do nich věc vešla.

## 6. Look a LUT

- Při importu můžeš zvolit look: Noční olej, Při svíčce, Vybledlý tisk nebo
  Studená noc. Ve výchozím stavu žádný. Look jde později změnit v Knihovně.
- **Vlastní LUT:** 3D `.cube` (DaVinci Resolve, nebo Photoshop: Export →
  Color Lookup Tables → CUBE), velikost 17–65, běžně 33. Dej ho do
  `assets-inbox/looks/`. 1D LUT podporovaný není.
- **Jednotnost:** stejný look na všechno. Jeden obraz v „Studené noci“ mezi
  „Nočním olejem“ bude trhat oči.

## 7. Výkon: proč na velikosti záleží

Plynulost posunu závisí na tom, kolik pixelů musí prohlížeč při každém
snímku poskládat:

- **Stropy:** věci na stěně 1600 px a galerie 2048 px stačí. Větší originál
  nevadí, admin ho zmenší.
- **Průhledný okraj** zabírá paměť stejně jako obraz. Ořezávej těsně.
- **Galerie** se načítají až při otevření exponátu, na posun stěny nemají vliv.
- **Pro představu:** 25 položek, skříň, tapeta, dveře a 40 fotek galerií
  mají teď dohromady 5,6 MB. Desítky dalších věcí v podobných velikostech
  jsou v pořádku.

## 8. Postup: od fotky na stěnu

1. **Připrav** výřez podle tabulek výše a ulož ho do `assets-inbox/` (do
   podsložky podle druhu, viz `assets-inbox/README.md`).
2. **Nahraj:**
   - **věci na stěnu:** Editor stěny → Knihovna vlevo → **Nahrát
     obrázky…**, nebo Správa → Import;
   - **ostatní druhy** (tapeta, skříň, čela, samet, dveře): Správa →
     **Import**, druh vyber v nabídce.
3. **Nahraď zástupný podklad:** v editoru vyber položku a v inspektoru změň
   **Obrázek**. Poloha i šířka zůstanou, výška se dopočítá. Novou věc jinak
   přetáhneš z Knihovny na stěnu.
4. **Doplň podle potřeby:**
   - exponát (název, obor, popis, štítky, galerie);
   - otvor u obrazu;
   - světlo u svíčky;
   - role ve Správě: tapeta, skříň, čela, samet, dveře, svíčka do kurzoru.
5. **Zkontroluj** v **Náhledu webu**. S `?fx=none` v adrese uvidíš podklady
   bez tmy a efektů.

## 9. Kontrolní seznam před importem

- [ ] PNG/TIFF s průhledností (věci), JPG (fotky do galerie, samet).
- [ ] Ořezáno těsně, okraje čisté, bez halo.
- [ ] Žádný zapečený stín ani záře v průhlednosti.
- [ ] Zpříma, bez perspektivy, měkké neutrální světlo.
- [ ] Velikost aspoň 2,5× šířky ve světě, ideálně 3×.
- [ ] Tapeta bezešvá (test posunem).
- [ ] Skříň: horní okraj = deska, prázdné otvory, čela ve stejném měřítku.
- [ ] Cizí zdroj: licence CC0 / public domain / vlastní, URL poznamenané.

## 10. Licence

Cizí obrázky a zvuky jen **CC0, public domain nebo vlastní**. U každého si
poznamenej URL a licenci a já to zapíšu do `CREDITS.md`. Nic z Pinterestu
ani odjinud bez jasné licence; „fair use“ licence není.
