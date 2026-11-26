-- Some databases already have these fields from Prisma db push.
DO $$
BEGIN
    IF to_regtype(format('%I.%I', current_schema(), 'InvoiceDateMode')) IS NULL THEN
        CREATE TYPE "InvoiceDateMode" AS ENUM ('enabled', 'blank-column', 'hidden-column');
    END IF;

    IF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder)
        FROM pg_enum WHERE enumtypid = '"InvoiceDateMode"'::regtype)
        IS DISTINCT FROM ARRAY['enabled', 'blank-column', 'hidden-column'] THEN
        RAISE EXCEPTION 'InvoiceDateMode differs from the expected Prisma enum';
    END IF;
END $$;

ALTER TABLE "Invoice"
    ADD COLUMN IF NOT EXISTS "dateMode" "InvoiceDateMode" NOT NULL DEFAULT 'enabled',
    ADD COLUMN IF NOT EXISTS "showKeteranganColumn" BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS "printSettings" JSONB;

ALTER TABLE "Transaksi" ALTER COLUMN "tanggal" DROP NOT NULL;

-- IF NOT EXISTS alone would accept an incompatible pre-existing column.
DO $$
DECLARE
    incompatible_column text;
BEGIN
    SELECT format('%s.%I', expected.rel, expected.col) INTO incompatible_column
    FROM (VALUES
        ('"Invoice"'::regclass, 'dateMode', '"InvoiceDateMode"'::regtype, true,
         format('%L::%s', 'enabled', '"InvoiceDateMode"'::regtype)),
        ('"Invoice"'::regclass, 'showKeteranganColumn', 'boolean'::regtype, true, 'true'),
        ('"Invoice"'::regclass, 'printSettings', 'jsonb'::regtype, false, NULL),
        ('"Transaksi"'::regclass, 'tanggal', 'date'::regtype, false, NULL)
    ) AS expected(rel, col, datatype, required, default_expr)
    LEFT JOIN pg_attribute a ON a.attrelid = expected.rel AND a.attname = expected.col
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.atttypid IS DISTINCT FROM expected.datatype::oid
       OR a.attnotnull IS DISTINCT FROM expected.required
       OR pg_get_expr(d.adbin, d.adrelid) IS DISTINCT FROM expected.default_expr
    LIMIT 1;

    IF incompatible_column IS NOT NULL THEN
        RAISE EXCEPTION 'Column % differs from the expected Prisma schema', incompatible_column;
    END IF;
END $$;
