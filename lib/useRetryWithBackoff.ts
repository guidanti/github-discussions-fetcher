import { createContext, Operation, race, sleep } from "npm:effection@3.0.3";
import { useLogger } from "./useLogger.ts";
import { ensureContext } from "./ensureContext.ts";
import moment from "npm:moment@2.30.1";

interface UseRetryBackoffOptions {
  timeout?: number;
  operationName?: string | undefined | null;
}

export interface RetryWithContextDefaults {
  timeout: number;
  operationName: string;
}

const RetryWithBackoffContext = createContext<RetryWithContextDefaults>(
  "retry-with-context",
);

export function* useRetryWithBackoff<T>(
  fn: () => Operation<T>,
  options: UseRetryBackoffOptions,
): Operation<void> {
  const logger = yield* useLogger();
  const defaults = yield* RetryWithBackoffContext;
  const _options = {
    ...defaults,
    ...options,
  };
  let attempt = -1;

  function* body() {
    while (true) {
      try {
        const result = yield* fn();
        if (attempt !== -1) {
          logger.log(
            `Operation[${_options.operationName}] succeeded after ${
              attempt + 2
            } retry.`,
          );
        }
        return result;
      } catch(e) {
        // https://aws.amazon.com/ru/blogs/architecture/exponential-backoff-and-jitter/
        const backoff = Math.pow(2, attempt) * 1000;
        const delayMs = Math.round((backoff * (1 + Math.random())) / 2);
        
        logger.debug(e);
        logger.log(
          `Operation[${_options.operationName}] failed, will retry in ${moment.duration(delayMs).humanize()}.`
        );

        yield* sleep(delayMs);
        attempt++;
      }
    }
  }

  function* timeout() {
    yield* sleep(_options.timeout ?? defaults.timeout);
    logger.log(
      `Operation[${_options.operationName}] timedout after ${attempt + 2}`,
    );
  }

  yield* race([
    body(),
    timeout(),
  ]);
}

export function* initRetryWithBackoff(
  defaults: RetryWithContextDefaults,
) {
  // deno-lint-ignore require-yield
  function* init(): Operation<RetryWithContextDefaults> {
    return defaults;
  }

  return yield* ensureContext(
    RetryWithBackoffContext,
    init(),
  );
}
