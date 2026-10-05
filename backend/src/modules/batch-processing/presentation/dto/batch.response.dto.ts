import type { BurstTicket } from '../../application/ports/batch-platform.client';

export class BatchResponseDto implements BurstTicket {
  runId!: string;
  total!: number;
  startedAt!: Date;
}
