// `npm run check-release`: is the site ready to go public? Read-only. Exit code 1 when there are errors.
import { releaseReport, sortLevel } from './release-check.mjs';

const MARK = { error: '✗', warn: '!', info: '·' };
const { all } = await releaseReport();
const byArea = new Map();
for (const f of all.sort((a, b) => sortLevel(a) - sortLevel(b))) (byArea.get(f.area) || byArea.set(f.area, []).get(f.area)).push(f);
for (const [area, list] of byArea) {
  console.log(`\n${area}`);
  for (const f of list) console.log(`  ${MARK[f.level]} ${f.msg}`);
}
const n = l => all.filter(f => f.level === l).length;
console.log(`\n${n('error')} chyb, ${n('warn')} upozornění.`);
process.exit(n('error') ? 1 : 0);
