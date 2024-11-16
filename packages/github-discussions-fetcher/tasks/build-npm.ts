import { build, emptyDir } from "jsr:@deno/dnt@0.41.3";
import pkgJson from "../package.json" with { type: "json" };

const outDir = "./build/npm";
await emptyDir(outDir);

await build({
  entryPoints: ["mod.ts"],
  outDir,
  shims: {
    deno: true,
  },
  test: false,
  typeCheck: false,
  compilerOptions: {
    lib: ["DOM", "DOM.Iterable", "ScriptHost", "ES2022"],
    target: "ES2022",
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
      node: "18 || 20",
    },
    type: "module",
    sideEffects: false,
  },
});

await Deno.copyFile("README.md", `${outDir}/README.md`);
