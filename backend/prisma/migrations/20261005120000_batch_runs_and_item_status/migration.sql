-- CreateEnum
CREATE TYPE "batch_run_status" AS ENUM ('OPEN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "batch_item_status" AS ENUM ('RECEIVED', 'ENRICHED', 'FAILED');

-- AlterTable
ALTER TABLE "batch_items" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_error" TEXT,
ADD COLUMN     "price" DOUBLE PRECISION,
ADD COLUMN     "status" "batch_item_status" NOT NULL DEFAULT 'RECEIVED',
ADD COLUMN     "stock" INTEGER,
ADD COLUMN     "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "batch_runs" (
    "run_id" TEXT NOT NULL,
    "cid" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "status" "batch_run_status" NOT NULL DEFAULT 'OPEN',
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "batch_runs_pkey" PRIMARY KEY ("run_id")
);

-- CreateIndex
CREATE INDEX "batch_items_run_id_status_idx" ON "batch_items"("run_id", "status");

-- CreateIndex
CREATE INDEX "batch_items_status_updated_at_idx" ON "batch_items"("status", "updated_at");

