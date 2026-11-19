// `npm run rebuild`: regenerate docs/ from data/cabinet.json + site/.
import { buildSite } from './build.mjs';

const res = await buildSite();
console.log(`Hotovo: ${res.pages} stránek, ${res.items} položek.`);
