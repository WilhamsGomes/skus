import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CacheQuery, type CacheSnapshot } from "../queries/cache.query";
import { DeliveriesQuery, type DeliveryRow } from "../queries/deliveries.query";
import { type ItemRow, ItemsQuery } from "../queries/items.query";
import { type Overview, OverviewQuery } from "../queries/overview.query";
import { type QueueSnapshot, QueuesQuery } from "../queries/queues.query";
import { type RegistrationRow, RegistrationsQuery } from "../queries/registrations.query";
import { type Page, type RunDetail, type RunSummary, RunsQuery } from "../queries/runs.query";
import { ItemsQueryDto } from "./dto/items.query.dto";
import { PaginationQueryDto } from "./dto/pagination.query.dto";

@ApiTags("dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(
    private readonly overview: OverviewQuery,
    private readonly runs: RunsQuery,
    private readonly items: ItemsQuery,
    private readonly queues: QueuesQuery,
    private readonly cache: CacheQuery,
    private readonly deliveries: DeliveriesQuery,
    private readonly registrations: RegistrationsQuery,
  ) {}

  @Get("overview")
  @ApiOperation({ summary: "KPIs, linha do tempo dos últimos lotes e alertas" })
  getOverview(): Promise<Overview> {
    return this.overview.get();
  }

  @Get("runs")
  @ApiOperation({ summary: "Histórico de lotes com contagem de itens e score" })
  listRuns(@Query() query: PaginationQueryDto): Promise<Page<RunSummary>> {
    return this.runs.list(query.limit, query.offset);
  }

  @Get("runs/:runId")
  @ApiOperation({ summary: "Detalhe do lote: itens, entregas e relatório" })
  async getRun(@Param("runId") runId: string): Promise<RunDetail> {
    const run = await this.runs.detail(runId);
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    return run;
  }

  @Get("items")
  @ApiOperation({ summary: "Itens com filtro por lote, status e SKU" })
  listItems(@Query() query: ItemsQueryDto): Promise<Page<ItemRow>> {
    return this.items.list(query);
  }

  @Get("queues")
  @ApiOperation({ summary: "Estado das filas BullMQ e jobs recentes" })
  getQueues(): Promise<QueueSnapshot[]> {
    return this.queues.snapshot();
  }

  @Get("cache")
  @ApiOperation({ summary: "Métricas do Redis e chaves por prefixo" })
  getCache(): Promise<CacheSnapshot> {
    return this.cache.snapshot();
  }

  @Get("deliveries")
  @ApiOperation({ summary: "Histórico de entregas (callbacks) e relatórios" })
  listDeliveries(@Query() query: PaginationQueryDto): Promise<Page<DeliveryRow>> {
    return this.deliveries.list(query.limit, query.offset);
  }

  @Get("deliveries/:id")
  @ApiOperation({ summary: "Relatório completo de uma entrega" })
  async getDelivery(@Param("id", ParseIntPipe) id: number) {
    const delivery = await this.deliveries.find(id);
    if (!delivery) throw new NotFoundException(`Delivery ${id} not found`);
    return delivery;
  }

  @Get("registrations")
  @ApiOperation({ summary: "Histórico de registros (sem token)" })
  listRegistrations(): Promise<RegistrationRow[]> {
    return this.registrations.list();
  }
}
