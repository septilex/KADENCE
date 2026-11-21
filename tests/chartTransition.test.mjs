import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  useChartTransition, startChartTransition, beginSceneWarmup, reportFirstFrame,
  whenChartRevealable, revealChartTransition, cancelChartTransition,
  FLASH_MS, MIN_LOADING_MS, REVEAL_MS,
} from '../store/chartTransitionStore.ts'

const flush = () => new Promise(resolve => setImmediate(resolve))
async function advance(t, ms) { t.mock.timers.tick(ms); await flush(); await flush() }
const settled = p => Promise.race([p.then(v => ({ v })), flush().then(() => null)])

test('reveal waits for both the minimum artwork time and the first rendered frame', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  startChartTransition('viral-50', 1, { x: 10, y: 20 })
  assert.equal(useChartTransition.getState().phase, 'flash')
  assert.equal(useChartTransition.getState().color, '#FF00E5')
  const reveal = whenChartRevealable(1)
  await advance(t, FLASH_MS)
  assert.equal(useChartTransition.getState().phase, 'loading')

  beginSceneWarmup(1)
  assert.equal(useChartTransition.getState().warmRequest, 1)
  reportFirstFrame(1)
  await advance(t, MIN_LOADING_MS - 1)
  assert.equal(await settled(reveal), null, 'not before the 2 s minimum')
  await advance(t, 1)
  assert.deepEqual(await settled(reveal), { v: true })

  revealChartTransition(1)
  assert.equal(useChartTransition.getState().phase, 'revealing')
  assert.equal(useChartTransition.getState().warmRequest, null)
  await advance(t, REVEAL_MS)
  assert.equal(useChartTransition.getState().phase, 'idle')
})

test('the timer alone does not reveal: it waits for the frame', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  startChartTransition('workout', 2)
  const reveal = whenChartRevealable(2)
  await advance(t, FLASH_MS)
  await advance(t, MIN_LOADING_MS + 500)
  beginSceneWarmup(2)
  await advance(t, 1000)
  assert.equal(await settled(reveal), null)
  reportFirstFrame(2)
  await flush()
  assert.deepEqual(await settled(reveal), { v: true })
  cancelChartTransition()
})

test('a newer selection supersedes the older one; stale reports are ignored', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  startChartTransition('late-night', 3)
  const stale = whenChartRevealable(3)
  startChartTransition('top-tamil', 4)
  assert.deepEqual(await settled(stale), { v: false })
  assert.equal(useChartTransition.getState().vibe, 'top-tamil')
  assert.equal(await whenChartRevealable(3), false)

  const current = whenChartRevealable(4)
  beginSceneWarmup(3) // stale: ignored
  assert.equal(useChartTransition.getState().warmRequest, null)
  await advance(t, FLASH_MS)
  await advance(t, MIN_LOADING_MS)
  reportFirstFrame(3) // stale: ignored
  await flush()
  assert.equal(await settled(current), null)
  cancelChartTransition()
  assert.deepEqual(await settled(current), { v: false })
})

test('cancel (error / Home) returns to idle and clears pending timers', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  startChartTransition('dev-special', 5)
  assert.equal(useChartTransition.getState().color, '#d4af37')
  const reveal = whenChartRevealable(5)
  cancelChartTransition(5)
  assert.equal(useChartTransition.getState().phase, 'idle')
  assert.deepEqual(await settled(reveal), { v: false })
  await advance(t, FLASH_MS + MIN_LOADING_MS)
  assert.equal(useChartTransition.getState().phase, 'idle', 'no late phase change after cancel')
})
