import { build, emptyDir } from "jsr:@deno/dnt@0.41.3";

const packageDir = Deno.cwd();
const outDir = `${packageDir}/build/npm`;
const pkgJson = JSON.parse(await Deno.readTextFile(`${packageDir}/package.json`));

await emptyDir(outDir);

await build({
  entryPoints: [`${packageDir}/mod.ts`],
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
    type: pkgJson.type,
    engines: {
      node: "18 || 20",
    },
    sideEffects: false,
  },
});

await Deno.copyFile("README.md", `${outDir}/README.md`);
