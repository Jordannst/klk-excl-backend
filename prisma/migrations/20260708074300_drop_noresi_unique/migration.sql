-- Drop noResi uniqueness temporarily so invoice saves are not blocked by reused STT/noResi values.
DROP INDEX IF EXISTS "Transaksi_noResi_key";
