export class CallbackRejectedError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(`POST /callback responded ${status}${detail ? `: ${detail}` : ""}`);
    this.name = "CallbackRejectedError";
  }
}

export class RunNotFoundError extends Error {
  constructor(readonly runId: string) {
    super(`Run ${runId} not found`);
    this.name = "RunNotFoundError";
  }
}
