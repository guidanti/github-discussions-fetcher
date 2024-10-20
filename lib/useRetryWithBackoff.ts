import { createContext, Operation, race, sleep } from "npm:effection@3.0.3";
import { useLogger } from "./useLogger.ts";
import { ensureContext } from "./ensureContext.ts";
import { Duration, DateTime, Interval } from "npm:luxon@3.5.0";

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
    const expireTime = DateTime.now().plus(_options.timeout);
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
      } catch {
        // https://aws.amazon.com/ru/blogs/architecture/exponential-backoff-and-jitter/
        const backoff = Math.pow(2, attempt) * 1000;
        const delayMs = Math.round((backoff * (1 + Math.random())) / 2);
        const seconds = Math.round(Duration.fromMillis(delayMs).as('seconds'));
        const expireRemaining = Math.round(Interval.fromDateTimes(DateTime.now(), expireTime).length("seconds"));

        logger.log(
          `Operation[${_options.operationName}] failed, will retry in ${seconds || 1} ${seconds > 1 ? "seconds" : "second"}. ${expireRemaining} ${expireRemaining > 1 ? "seconds" : "second"} remaining.`,
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
