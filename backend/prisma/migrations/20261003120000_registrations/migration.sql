-- CreateTable
CREATE TABLE "registrations" (
    "cid" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "webhook" TEXT NOT NULL,
    "registered_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("cid")
);

-- CreateIndex
CREATE INDEX "registrations_registered_at_idx" ON "registrations"("registered_at");
