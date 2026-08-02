export type Success<T> = {
  readonly ok: true;
  readonly value: T;
};

export type Failure<E> = {
  readonly ok: false;
  readonly error: E;
};

export type Result<T, E> = Success<T> | Failure<E>;

export const success = <T>(value: T): Success<T> => ({
  ok: true,
  value,
});

export const failure = <E>(error: E): Failure<E> => ({
  ok: false,
  error,
});

export const tryResult = <T>(operation: () => T): Result<T, unknown> => {
  try {
    return success(operation());
  } catch (error) {
    return failure(error);
  }
};

export const tryAsyncResult = async <T>(operation: () => Promise<T>): Promise<Result<T, unknown>> => {
  try {
    return success(await operation());
  } catch (error) {
    return failure(error);
  }
};

export const mapResult = <T, U, E>(result: Result<T, E>, mapper: (value: T) => U): Result<U, E> =>
  result.ok ? success(mapper(result.value)) : result;
