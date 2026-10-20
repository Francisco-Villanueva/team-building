import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

const client = new pg.Client({ connectionString: url });
await client.connect();
for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  console.log('applying', file);
  await client.query(readFileSync(join(dir, file), 'utf8'));
}
await client.end();
console.log('done');
