import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { postgresConnectionOptions } from '../lib/postgres-connection';

const supabase = 'postgresql://db.example.supabase.co/postgres';
const local = 'postgresql://localhost/klk_test';
const remote = 'postgresql://db.example.org/klk_test';
const caPath = resolve(__dirname, '../../prisma/supabase-ca.crt');
const fixture = (url: string, env: NodeJS.ProcessEnv = {}) =>
  new URL(postgresConnectionOptions(url, env).connectionString).searchParams;

for (const url of [supabase, supabase + '?sslmode=require', 'postgresql://aws-0-test.pooler.supabase.com/postgres']) {
  assert.equal(fixture(url).get('sslmode'), 'verify-full');
  assert.equal(fixture(url).get('sslrootcert'), caPath);
}
const ca = new X509Certificate(readFileSync(caPath));
assert.ok(ca.ca && ca.verify(ca.publicKey), 'packaged Supabase root must be a self-signed CA');

const legacy = fixture(supabase + '?sslcert=custom-server.crt');
assert.equal(legacy.get('sslrootcert'), resolve(__dirname, '../../prisma/custom-server.crt'));
assert.equal(legacy.has('sslcert'), false);
assert.equal(fixture(supabase + '?sslrootcert=explicit.crt').get('sslrootcert'), 'explicit.crt');
const mutualTls = fixture(supabase + '?sslcert=client.crt&sslkey=client.key');
assert.equal(mutualTls.get('sslcert'), 'client.crt');
assert.equal(mutualTls.get('sslkey'), 'client.key');
assert.equal(mutualTls.get('sslrootcert'), caPath);
assert.equal(fixture(supabase + '?sslmode=require', { NODE_EXTRA_CA_CERTS: 'extra.pem' }).has('sslrootcert'), false);
for (const mode of ['disable', 'no-verify']) {
  assert.equal(fixture(supabase + '?sslmode=' + mode).get('sslmode'), mode);
  assert.equal(fixture(supabase + '?sslmode=' + mode).has('sslrootcert'), false);
}
assert.equal(fixture(supabase, { PGSSLMODE: 'disable' }).has('sslrootcert'), false);
assert.equal(fixture(supabase + '?sslmode=require', { PGSSLMODE: 'disable' }).get('sslrootcert'), caPath);

for (const host of ['localhost', '127.0.0.1', '[::1]']) {
  assert.equal(fixture('postgresql://' + host + '/klk_test').has('sslmode'), false);
}
assert.throws(() => fixture(remote), /TLS policy/);
assert.throws(() => fixture(local + '?host=db.example.org'), /TLS policy/);
assert.throws(() => fixture(remote, { PGSSLMODE: 'invalid' }), /TLS policy/);
assert.equal(fixture(remote + '?sslmode=verify-full').get('sslmode'), 'verify-full');
assert.equal(fixture(remote + '?ssl=1').get('ssl'), '1');
assert.equal(fixture(remote, { PGSSLMODE: 'require' }).has('sslrootcert'), false);

const pool = postgresConnectionOptions(local + '?connection_limit=3&connect_timeout=8&pool_timeout=2&schema=billing', {});
assert.equal(pool.max, 3);
assert.equal(pool.connectionTimeoutMillis, 2000);
assert.equal(pool.schema, 'billing');
assert.equal(postgresConnectionOptions(local + '?connect_timeout=8', {}).connectionTimeoutMillis, 8000);
assert.equal(postgresConnectionOptions(local, {}).schema, 'public');
assert.throws(() => postgresConnectionOptions(local + '?connection_limit=0', {}), /connection limit/);
console.log('postgres-connection check passed');
