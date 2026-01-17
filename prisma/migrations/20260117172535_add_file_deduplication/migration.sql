-- CreateTable
CREATE TABLE "FileBlob" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hash" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedBy" INTEGER NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "FileBlob_hash_key" ON "FileBlob"("hash");

-- CreateIndex
CREATE INDEX "FileBlob_hash_idx" ON "FileBlob"("hash");
