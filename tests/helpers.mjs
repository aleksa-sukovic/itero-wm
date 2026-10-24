import fs from "node:fs";
import vm from "node:vm";

export async function load_module(file, mocks, globals = {}) {
    const context = vm.createContext(globals);
    const source = fs.readFileSync(new URL(`../target/${file}`, import.meta.url), "utf8");
    const module = new vm.SourceTextModule(source, {context});
    await module.link(specifier => {
        const exports = mocks[specifier];
        if (!exports) throw new Error(`Missing mock: ${specifier}`);
        return new vm.SyntheticModule(Object.keys(exports), function () {
            for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
        }, {context});
    });
    await module.evaluate();
    return module.namespace;
}
