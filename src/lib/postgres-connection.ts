import { resolve } from 'node:path';

const tlsModes = ['disable', 'prefer', 'require', 'verify-ca', 'verify-full', 'no-verify'];
const tlsFlags = ['0', '1', 'false', 'true', 'no-verify'];

export function postgresConnectionOptions(connectionString: string | undefined, env: NodeJS.ProcessEnv) {
  if (!connectionString || !URL.canParse(connectionString)) throw new Error('DATABASE_URL must be a PostgreSQL URL');
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Unsupported DATABASE_URL protocol');
  const params = url.searchParams;
  const options = Object.fromEntries(params);
  const max = Number(options.connection_limit ?? '10');
  const timeout = Number(options.pool_timeout ?? options.connect_timeout ?? '5');
  if (!Number.isSafeInteger(max) || max < 1 || !Number.isSafeInteger(timeout) || timeout < 0) {
    throw new Error('Invalid PostgreSQL connection limit or timeout');
  }

  // A legacy Prisma sslcert without a client key is a server CA relative to schema.prisma.
  if (options.sslcert && !options.sslkey && !options.sslrootcert) {
    params.set('sslrootcert', resolve(__dirname, '../../prisma', options.sslcert));
    params.delete('sslcert');
  }

  // Match pg's effective host and its precedence of URL options over PGSSLMODE.
  const host = (options.host || decodeURIComponent(url.hostname) || env.PGHOST || 'localhost').toLowerCase();
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host) || host.startsWith('/');
  const supabase = /\.supabase\.(co|com)\.?$/.test(host);
  const mode = options.sslmode || (options.ssl ? undefined : env.PGSSLMODE);
  if ((mode && !tlsModes.includes(mode)) || (!mode && options.ssl && !tlsFlags.includes(options.ssl))) {
    throw new Error('Invalid PostgreSQL TLS policy');
  }
  if (!local && !supabase && !mode && !options.ssl) {
    throw new Error('Set an explicit PostgreSQL TLS policy for this host (sslmode, ssl, or PGSSLMODE)');
  }
  if (!options.sslmode && options.ssl === 'false') params.set('ssl', '0');

  const setting = mode || options.ssl || '';
  if (supabase && !['disable', 'no-verify', 'false', '0'].includes(setting)) {
    params.set('sslmode', 'verify-full');
    if (!params.get('sslrootcert') && !env.NODE_EXTRA_CA_CERTS) {
      params.set('sslrootcert', resolve(__dirname, '../../prisma/supabase-ca.crt'));
    }
  }
  return { connectionString: url.toString(), max, connectionTimeoutMillis: timeout * 1000, schema: options.schema ?? 'public' };
}
