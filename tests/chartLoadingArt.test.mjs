import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { CHART_LOADING_ART, CHART_LOADING_WIDTHS, chartLoadingSrc, chartLoadingSrcSet, getChartColors } from '../lib/chartLoadingArt.ts'
import { VIBE_CONFIGS } from '../lib/vibeConfig.ts'

const EXPECTED = {
  'global-top-50': 'Global Top 50 Loading.png',
  'viral-50': 'Viral 50 Loading.png',
  'new-music-friday': 'New Music Friday Loading.png',
  'hip-hop-central': 'HipHop Central Loading.png',
  'pop-rising': 'Pop Rising Loading.png',
  'dance-hits': 'Dance Hits.png',
  'mood-booster': 'Mood Booster.png',
  'late-night': 'Late Night.png',
  'workout': 'Workout.png',
  'chill-hits': 'Chill Hites.png', // supplied spelling on disk
  'top-telugu': 'Top Telugu.png',
  'top-tamil': 'Top Tamil.png',
  'top-hindi': 'Top Hindi.png',
  'top-kpop': 'Top K Pop.png',
}

test('every chart maps by ID to its exact supplied master, and Dev’s Universe uses the fallback', () => {
  const ids = VIBE_CONFIGS.map(v => v.id)
  assert.deepEqual(new Set(Object.keys(CHART_LOADING_ART)), new Set(ids))
  for (const [vibe, master] of Object.entries(EXPECTED)) {
    assert.equal(CHART_LOADING_ART[vibe]?.master, master, vibe)
    assert.ok(fs.existsSync(path.join('public/images/chart_loading', master)), `master exists for ${vibe}`)
  }
  assert.equal(CHART_LOADING_ART['dev-special'], null)
  const masters = Object.values(CHART_LOADING_ART).filter(Boolean).map(a => a.master)
  assert.equal(new Set(masters).size, 14, 'no two charts share artwork')
})

test('every served WebP derivative exists and the srcset lists them', () => {
  for (const vibe of Object.keys(EXPECTED)) {
    for (const w of CHART_LOADING_WIDTHS) {
      const file = path.join('public', chartLoadingSrc(vibe, w))
      assert.ok(fs.existsSync(file) && fs.statSync(file).size > 1024, file)
    }
    assert.match(chartLoadingSrcSet(vibe), new RegExp(`${vibe}-960\\.webp 960w, .*${vibe}-1672\\.webp 1672w`))
  }
  assert.equal(chartLoadingSrcSet('dev-special'), null)
})

test('transition colours come from VIBE_CONFIGS', () => {
  for (const v of VIBE_CONFIGS) {
    const c = getChartColors(v.id)
    assert.equal(c.primary, v.id === 'dev-special' ? v.accentColor : v.bgColor, v.id)
  }
})
