export abstract class CallbackJobPublisher {
  abstract publish(runId: string): Promise<void>;
}
