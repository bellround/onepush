import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { openDb, ROUND_COLUMNS } from './db.ts'

// A source UUID identifies one original database, not a pathname or a row ID.
const [file, sourceInput] = process.argv.slice(2)
const source = sourceInput?.toLowerCase()
if (!file || !source || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(source)) {
  console.error('Usage: npm run migrate:sqlite -- /absolute/source.db SOURCE_UUID')
  process.exit(1)
}
let sqlite: DatabaseSync
try { sqlite = new DatabaseSync(file, { readOnly: true }) } catch {
  console.error('Migration unavailable: cannot open source SQLite database read-only')
  process.exit(1)
}
const db = await openDb().catch(() => {
  sqlite.close()
  console.error('Migration unavailable: check DATABASE_URL and database connectivity')
  process.exit(1)
})
const client = await db.connect().catch(async () => {
  sqlite.close()
  await db.end()
  console.error('Migration unavailable: database connection failed')
  process.exit(1)
})
try {
  await client.query('BEGIN')
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [source])
  const statement = sqlite.prepare('SELECT * FROM rounds ORDER BY id')
  statement.setReadBigInts(true)
  let imported = 0
  let skipped = 0
  for (const row of statement.iterate()) {
    const sourceId = String(row.id)
    const values = ROUND_COLUMNS.split(', ').map(column => {
      const value = row[column]
      if (column === 'actions') return JSON.stringify(JSON.parse(String(value)))
      if (column === 'cleared' || column === 'advanced_after_clear') return value === 1n
      return typeof value === 'bigint' ? value.toString() : value
    })
    const timestamp = String(row.created_at)
    const created = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp) ? timestamp.replace(' ', 'T') + 'Z' : timestamp).toISOString()
    values.push(created)
    const hash = createHash('sha256').update(JSON.stringify(values)).digest('hex')
    const existing = await client.query('SELECT content_hash FROM round_imports WHERE source=$1 AND source_id=$2', [source, sourceId])
    if (existing.rows.length) {
      if (existing.rows[0].content_hash !== hash) throw new Error('Source changed')
      skipped++
      continue
    }
    const result = await client.query(`INSERT INTO rounds (${ROUND_COLUMNS}, created_at) VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id::text`, values)
    await client.query('INSERT INTO round_imports (source, source_id, content_hash, round_id) VALUES ($1,$2,$3,$4)', [source, sourceId, hash, result.rows[0].id])
    imported++
  }
  await client.query('COMMIT')
  console.log(`Migration complete: ${imported} imported, ${skipped} previously imported`)
} catch {
  await client.query('ROLLBACK')
  console.error('Migration aborted; no records committed. Check connection, schema, and source identity/content.')
  process.exitCode = 1
} finally {
  sqlite.close()
  client.release()
  await db.end()
}
