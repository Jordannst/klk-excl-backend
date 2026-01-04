-- CreateTable
CREATE TABLE "Invoice" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" INTEGER NOT NULL DEFAULT 0,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaksi" (
    "id" SERIAL NOT NULL,
    "tanggal" DATE NOT NULL,
    "pengirim" TEXT NOT NULL,
    "penerima" TEXT NOT NULL,
    "coly" INTEGER NOT NULL,
    "berat" INTEGER NOT NULL,
    "min" INTEGER NOT NULL DEFAULT 10,
    "tarif" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "noResi" TEXT NOT NULL,
    "keterangan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId" INTEGER,

    CONSTRAINT "Transaksi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaksi_noResi_key" ON "Transaksi"("noResi");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "Transaksi" ADD CONSTRAINT "Transaksi_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
