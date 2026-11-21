import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HoverVideoPool } from '../lib/hoverVideoPool.ts'

class FakeVideo {
  src = ''; readyState = 0; paused = false; style = {}; loads = 0; removed = false
  pause() { this.paused = true }
  removeAttribute() { this.src = '' }
  load() { this.loads++ }
  remove() { this.removed = true }
}

test('returning to a buffered track reuses its player without reloading', () => {
  const pool = new HoverVideoPool(() => new FakeVideo())
  const first = pool.get('one')
  first.readyState = 4
  pool.stop('one')
  assert.equal(first.paused, true)
  assert.equal(first.style.opacity, '0')
  assert.equal(pool.get('one'), first)
  assert.equal(first.loads, 0)
  pool.dispose()
})

test('rapid fly-bys cancel unfinished media instead of accumulating downloads', () => {
  const pool = new HoverVideoPool(() => new FakeVideo())
  for (let i = 0; i < 40; i++) {
    const video = pool.get(String(i))
    pool.stop(String(i))
    assert.equal(video.src, '')
    assert.equal(video.paused, true)
    assert.equal(video.loads, 1)
    assert.equal(pool.videos.size, 0)
  }
})

test('recent players are bounded and all sources are released on disposal', () => {
  const created = []
  const pool = new HoverVideoPool(() => { const video = new FakeVideo(); created.push(video); return video })
  for (let i = 0; i < 20; i++) {
    const video = pool.get(String(i))
    video.readyState = 4
    pool.stop(String(i))
    assert.ok(pool.videos.size <= HoverVideoPool.LIMIT)
  }
  assert.ok(created.slice(0, -3).every(v => v.removed && v.src === ''))
  pool.dispose()
  assert.equal(pool.videos.size, 0)
  assert.ok(created.every(v => v.paused && v.src === '' && v.removed))
})
