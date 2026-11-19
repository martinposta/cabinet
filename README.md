# Kabinet kuriozit

Tvoje portfolio jako noční návštěva kabinetu kuriozit. Web je statický (GitHub Pages),
obsah se upravuje v lokálním adminu.

## Spuštění

Dvojklik na `Kabinet.command` na Macu, nebo na `Kabinet.cmd` na Windows (oba si poprvé nainstalují
závislosti; na Windows je potřeba mít [Node.js LTS](https://nodejs.org)). Projekt jde zkopírovat
z Macu na Windows i se složkou `node_modules`: `Kabinet.cmd` pozná, že knihovna na obrázky (sharp)
je zkompilovaná pro Mac, a nainstaluje ji znovu pro Windows. Nebo v Terminálu:

```bash
npm install
npm run admin
```

Správa běží na http://localhost:4322 – jedna stránka se čtyřmi sekcemi: **Stěna** (rozmísťování), **Exponáty** (texty a galerie), **Knihovna** (všechny obrázky, import – stačí přetáhnout soubory kamkoli do okna) a **Místnost** (tapeta, skříň a šuplíky, dveře, jmenovka, nastavení webu). Náhled webu je na http://localhost:4322/preview/ (dveře; stěna je na /preview/cabinet/, seznam na /preview/list/).

## Kde co je

- `assets-inbox/` – tvoje originály (do gitu nejdou), podrobnosti v `assets-inbox/README.md`
- `PODKLADY.md` – jak velké a jaké obrázky připravit
- `site/` – zdroj veřejného webu
- `docs/` – vygenerovaný web, ručně se needituje
- `data/cabinet.json` – veškerý obsah
- `PLAN.md` – plán, rozhodnutí a deník fází

## Stav

Fáze 0–4b, 6 a 3b hotové, vše jen lokálně. Na GitHub se nic nepublikuje, dokud to výslovně neřekneš.
