import { build, emptyDir } from "jsr:@deno/dnt@0.41.3";
import pkgJson from "../package.json" with { type: "json" };

const outDir = "./build/npm";
await emptyDir(outDir);

await build({
  entryPoints: ["./main.ts"],
  outDir,
  shims: {
    deno: false,
  },
  test: false,
  typeCheck: false,
  scriptModule: false,
  compilerOptions: {
    lib: ["ESNext", "DOM"],
    target: "ES2020",
    sourceMap: true,
  },
  package: {
    name: pkgJson.name,
    version: pkgJson.version,
    license: pkgJson.license,
    author: pkgJson.author,
    repository: pkgJson.repository,
    bugs: pkgJson.bugs,
    engines: {
      node: ">= 16",
    },
    type: "module",
    sideEffects: false,
  },
});

await Deno.copyFile("README.md", `${outDir}/README.md`);
