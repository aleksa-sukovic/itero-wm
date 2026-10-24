import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

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

export function load_method(file, class_name, name, scope = {}) {
    const path = new URL(`../target/${file}`, import.meta.url);
    const source = ts.createSourceFile(file, fs.readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
    const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name.text === class_name);
    const method = declaration.members.find(node => node.name?.getText(source) === name);
    return Function(...Object.keys(scope), `return ({${method.getText(source)}}).${name}`)(...Object.values(scope));
}
