import { build, emptyDir } from "jsr:@deno/dnt@0.41.3";

const packageDir = Deno.cwd();
const outDir = `${packageDir}/build/npm`;
const pkgJson = JSON.parse(await Deno.readTextFile(`${packageDir}/package.json`));
const { workspaces } = JSON.parse(await Deno.readTextFile(`${packageDir}/../../package.json`));

const pkgJsons = await Promise.all(
  workspaces.map(
    (packagePath: string) =>
      import(`../${packagePath}/package.json`, { with: { type: "json" } })
  )
);

const packages = Object.fromEntries(
  pkgJsons.map(({ default: pkg }) => [ pkg.name, pkg.version ])
);

const dependencies = Object.fromEntries(Object.entries(pkgJson.dependencies).map(([dependency, version]) => {
  if (version === "*") {
    if (dependency in packages) {
      return [dependency, packages[dependency]];
    }
  }
  return [dependency, version];
}));

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
    dependencies,
  }
});

await Deno.copyFile("README.md", `${outDir}/README.md`);
