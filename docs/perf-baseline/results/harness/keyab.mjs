// A/B the SongDetail AnimatePresence key fix under identical conditions (no git): temporarily revert ONLY that edit.
// Usage: node keyab.mjs revert|restore
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const F = 'C:/AntiGravity Projects/KADENCE/components/ui/SongDetail.tsx';
const BAK = path.join(os.tmpdir(), 'SongDetail.keyfix.bak.tsx');
const mode = process.argv[2];
if (mode === 'revert') {
  const src = fs.readFileSync(F, 'utf8');
  fs.writeFileSync(BAK, src);
  const nl = src.includes('\r\n') ? '\r\n' : '\n';
  let t = src.replace(/\r\n/g, '\n');
  const openFixed = /  return \(\n    <>\n      \{\/\* Static, always-present[\s\S]*?<AnimatePresence>\n      \{song && \(\n        \/\/ Constant key[\s\S]*?<Fragment key="song-detail">\n/;
  if (!openFixed.test(t)) throw new Error('fixed opening block not found');
  t = t.replace(openFixed, '  return (\n    <AnimatePresence>\n      <style>{WAVEFORM_STYLE}</style>\n      <GlassFilter />\n      {song && (\n        <>\n');
  const closeFixed = '        </Fragment>\n      )}\n      </AnimatePresence>\n    </>\n  )\n}';
  if (!t.includes(closeFixed)) throw new Error('fixed closing block not found');
  t = t.replace(closeFixed, '        </>\n      )}\n    </AnimatePresence>\n  )\n}');
  t = t.replace("import { Fragment, useEffect, useRef, useState } from 'react'", "import { useEffect, useRef, useState } from 'react'");
  fs.writeFileSync(F, t.replace(/\n/g, nl));
  console.log('reverted key fix (backup saved)');
} else if (mode === 'restore') {
  fs.copyFileSync(BAK, F);
  console.log('restored key fix from backup', fs.readFileSync(F, 'utf8').includes('<Fragment key="song-detail">'));
}
