export type HerdrPane = Record<string, unknown>;

export interface HerdrWatcher {
  onEvent(): void;
  onLost(reason: Error): void;
}

export interface HerdrConnection {
  request(method: string, params: Record<string, unknown>): Promise<unknown>;
  subscribe(method: string, params: Record<string, unknown>, watcher: HerdrWatcher): () => void;
}

export class HerdrRefusal extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'HerdrRefusal';
    this.code = code;
  }
}

export function refusalCode(error: unknown): string | null {
  return error instanceof HerdrRefusal ? error.code : null;
}
