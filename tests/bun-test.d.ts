declare module "bun:test" {
  type SuiteCallback = () => void;
  type TestCallback = () => void | Promise<void>;
  type HookCallback = () => void | Promise<void>;
  type ThrowExpected = string | RegExp;

  type PromiseMatchers = {
    toEqual(expected: unknown): Promise<void>;
    toThrow(expected?: ThrowExpected): Promise<void>;
  };

  type Matchers = {
    resolves: PromiseMatchers;
    rejects: PromiseMatchers;
    toBe(expected: unknown): void;
    toBeDefined(): void;
    toEqual(expected: unknown): void;
    toMatchObject(expected: unknown): void;
  };

  export function beforeEach(callback: HookCallback): void;
  export function describe(name: string, callback: SuiteCallback): void;
  export function expect(actual: unknown): Matchers;
  export function mock<T>(implementation: T): T;
  export namespace mock {
    function module(specifier: string, factory: () => Record<string, unknown>): void;
  }
  export function test(name: string, callback: TestCallback): void;
}
