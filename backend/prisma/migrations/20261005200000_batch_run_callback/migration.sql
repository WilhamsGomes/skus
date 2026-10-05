-- AlterTable
ALTER TABLE "batch_runs" ADD COLUMN     "callback_report" JSONB,
ADD COLUMN     "callback_sent_at" TIMESTAMPTZ(3);

