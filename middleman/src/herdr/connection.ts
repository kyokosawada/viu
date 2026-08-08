export type HerdrPane = Record<string, unknown>;

export interface HerdrConnection {
  request(method: string, params: Record<string, unknown>): Promise<unknown>;
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
