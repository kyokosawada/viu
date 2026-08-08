export interface HerdrConnection {
  request(method: string, params: Record<string, unknown>): Promise<unknown>;
}
