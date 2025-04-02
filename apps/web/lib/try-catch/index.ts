export type Ok<T> = [T, null];

export function ok<T>(value: T): Ok<T> {
  return [value, null];
}

export type Err<E> = [null, E];

export function err<E>(error: E): Err<E> {
  return [null, error];
}

export async function wrap<Result>(
  promise: Promise<Result>
): Promise<Ok<Result> | Err<Error>> {
  try {
    return ok(await promise);
  } catch (error) {
    if (error instanceof Error) {
      return err(error);
    }
    return err(new Error(String(error)));
  }
}
