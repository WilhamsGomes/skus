-- CreateTable
CREATE TABLE "callback_deliveries" (
    "id" SERIAL NOT NULL,
    "run_id" TEXT NOT NULL,
    "sent_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "report" JSONB,

    CONSTRAINT "callback_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "callback_deliveries_run_id_sent_at_idx" ON "callback_deliveries"("run_id", "sent_at");

-- CreateIndex
CREATE INDEX "callback_deliveries_sent_at_idx" ON "callback_deliveries"("sent_at");

-- AddForeignKey
ALTER TABLE "callback_deliveries" ADD CONSTRAINT "callback_deliveries_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "batch_runs"("run_id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill
INSERT INTO "callback_deliveries" ("run_id", "sent_at", "report")
SELECT "run_id", "callback_sent_at", "callback_report" FROM "batch_runs" WHERE "callback_sent_at" IS NOT NULL;
