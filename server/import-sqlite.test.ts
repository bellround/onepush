import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { openDb, ROUND_COLUMNS } from './db.ts'

test('SQLite source UUID lowercase then uppercase retry deduplicates', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ion-import-test-'))
  const file = join(dir, 'fixture.db')
  const source = crypto.randomUUID().toLowerCase()
  const db = await openDb(process.env.TEST_DATABASE_URL)
  try {
    const sqlite = new DatabaseSync(file)
    sqlite.exec(`CREATE TABLE rounds (id INTEGER PRIMARY KEY, ${ROUND_COLUMNS.split(', ').map(c => `${c} ${['round', 'level_index', 'cleared', 'clear_ms', 'quit_ms', 'advanced_after_clear', 'reset_count', 'undo_count', 'first_move_ms', 'max_gap_ms'].includes(c) ? 'INTEGER' : 'TEXT'}`).join(', ')}, created_at TEXT)`)
    sqlite.prepare('INSERT INTO rounds VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(1, 'import-fixture', 'ch1', 1, 'ch1-1', 0, 1, 10, null, 0, 0, 0, 1, 2, '[{"kind":"move","direction":"up","t":1,"board":[[1]]}]', '2020-01-02 03:04:05')
    sqlite.close()
    const run = promisify(execFile)
    for (const identity of [source, source.toUpperCase()]) {
      await run(process.execPath, ['server/import-sqlite.ts', file, identity], { env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL } })
    }
    const result = await db.query('SELECT r.* FROM rounds r JOIN round_imports i ON i.round_id=r.id WHERE lower(i.source)=$1', [source])
    assert.equal(result.rows.length, 1)
    assert.equal(result.rows[0].round_id, null)
    assert.equal(result.rows[0].revision, null)
    assert.equal(result.rows[0].username, null)
    assert.equal(result.rows[0].created_at.toISOString(), '2020-01-02T03:04:05.000Z')
    assert.deepEqual(result.rows[0].actions[0].board, [[1]])
  } finally {
    await db.query('WITH removed AS (DELETE FROM round_imports WHERE lower(source)=$1 RETURNING round_id) DELETE FROM rounds WHERE id IN (SELECT round_id FROM removed)', [source])
    await db.end()
    await rm(dir, { recursive: true, force: true })
  }
})
