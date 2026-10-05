/** A mensagem violou uma invariante do item (seq inteiro ≥ 0, run_id e SKU não vazios). */
export class InvalidReceivedItemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReceivedItemError";
  }
}

/**
 * Mensagem de /process já validada. `runId + seq` é a identidade definida pelo contrato:
 * a mesma mensagem pode chegar mais de uma vez (at-least-once) e fora de ordem.
 */
export class ReceivedItem {
  private constructor(
    readonly runId: string,
    readonly seq: number,
    /** Preservado como veio: é devolvido igual no callback. */
    readonly sku: string,
  ) {}

  static from(props: {
    runId: string;
    seq: number;
    sku: string;
  }): ReceivedItem {
    if (props.runId.trim() === "")
      throw new InvalidReceivedItemError("run_id must not be empty");
    if (!Number.isInteger(props.seq) || props.seq < 0) {
      throw new InvalidReceivedItemError(
        `seq must be an integer >= 0, got ${props.seq}`,
      );
    }
    if (props.sku.trim() === "")
      throw new InvalidReceivedItemError("sku must not be empty");

    return new ReceivedItem(props.runId, props.seq, props.sku);
  }

  get key(): string {
    return `${this.runId}:${this.seq}`;
  }
}
