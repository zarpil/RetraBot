const fs = require('fs');

const targetFiles = [
  'dashboard/src/App.tsx',
  'bot/src/index.ts',
  'bot/src/modules/cardGenerator.ts',
  'bot/src/modules/economy.ts',
];

const replaces = [
  ['Ââ€', ''],
  ['â€Å', ''],
  ['â€˜Â', ''],
  ['Å“Â', ''],
  ['â€', '—'],
  ['Â¡', '¡'],
  ['Â¿', '¿'],
  ['âœ…', '✅'],
  ['â Œ', '❌'],
  ['âšï', '⚠️'],
  ['âš', '⚠️'],
  ['âœ', '✏️'],
  ['Â', ''],
  ['Ã', ''],
];

for (const rel of targetFiles) {
  if (fs.existsSync(rel)) {
    let content = fs.readFileSync(rel, 'utf8');
    for (const [bad, good] of replaces) {
      content = content.split(bad).join(good);
    }
    fs.writeFileSync(rel, content, 'utf8');
    console.log(`Cleaned artifacts in ${rel}`);
  }
}
