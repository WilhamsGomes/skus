export class InvalidEnrichmentResultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidEnrichmentResultError";
  }
}

export class EnrichmentResult {
  private constructor(
    readonly price: number,
    readonly stock: number,
  ) {}

  static from(props: { price: unknown; stock: unknown }): EnrichmentResult {
    const { price, stock } = props;
    if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
      throw new InvalidEnrichmentResultError(`price must be a number >= 0, got ${String(price)}`);
    }
    if (!Number.isInteger(stock) || (stock as number) < 0) {
      throw new InvalidEnrichmentResultError(`stock must be an integer >= 0, got ${String(stock)}`);
    }
    return new EnrichmentResult(price, stock as number);
  }
}
