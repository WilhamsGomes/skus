import { Module } from "@nestjs/common";
import { BatchProcessingModule } from "../batch-processing/batch-processing.module";
import { DashboardController } from "./presentation/dashboard.controller";
import { CacheQuery } from "./queries/cache.query";
import { DeliveriesQuery } from "./queries/deliveries.query";
import { ItemsQuery } from "./queries/items.query";
import { OverviewQuery } from "./queries/overview.query";
import { QueuesQuery } from "./queries/queues.query";
import { RegistrationsQuery } from "./queries/registrations.query";
import { RunsQuery } from "./queries/runs.query";

@Module({
  imports: [BatchProcessingModule],
  controllers: [DashboardController],
  providers: [
    OverviewQuery,
    RunsQuery,
    ItemsQuery,
    QueuesQuery,
    CacheQuery,
    DeliveriesQuery,
    RegistrationsQuery,
  ],
})
export class DashboardModule {}
