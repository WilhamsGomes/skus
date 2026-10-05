import { IsIn, IsOptional, IsString } from "class-validator";
import type { ItemStatus } from "../../queries/items.query";
import { PaginationQueryDto } from "./pagination.query.dto";

export class ItemsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  runId?: string;

  @IsOptional()
  @IsIn(["RECEIVED", "ENRICHED", "FAILED"])
  status?: ItemStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
