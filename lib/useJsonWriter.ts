import { call, type Operation, resource } from "npm:effection@4.0.0-alpha.2";

export type JsonWriter = (data: unknown) => Operation<void>

export function useJsonWriter(destination: string | URL) {
  return resource<JsonWriter>(function* (provide) {
    const file = yield* call(() =>
      Deno.open(destination, {
        create: true,
        write: true,
      })
    );

    function* write(data: unknown): Operation<void> {
      yield* call(() =>
        file.write(new TextEncoder().encode(`${JSON.stringify(data)}\n`))
      );
    }

    try {
      yield* provide(write);
    } finally {
      file.close();
    }
  });
}
