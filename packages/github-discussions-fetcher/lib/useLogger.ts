import { createContext, Operation } from "npm:effection@4.0.0-alpha.3";
import { ensureContext } from "./ensureContext.ts";

export type Logger = typeof console;

export const LoggerContext = createContext<Console>(
  "logger",
);

export function* initLoggerContext(logger: Console): Operation<Console> {

  // deno-lint-ignore require-yield
  function* init(): Operation<Logger> {
    return logger;
  }
  
  return yield* ensureContext(
    LoggerContext,
    init(),
  );
}

export function* useLogger(): Operation<Console> {
  return yield* LoggerContext.expect();
}
