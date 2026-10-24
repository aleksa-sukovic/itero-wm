import assert from "node:assert/strict";
import test from "node:test";
import {load_module} from "./helpers.mjs";

async function create_effect() {
    let effect_class;
    class GLSLEffect {
        actor = {width: 800, height: 600};
        writes = [];
        repaints = 0;
        get_uniform_location(name) { return name; }
        set_uniform_float(name, count, values) { this.writes.push({name, count, values: [...values]}); }
        queue_repaint() { this.repaints++; }
        add_glsl_snippet() {}
    }
    await load_module("rounding.js", {
        "gi://GObject": {default: {registerClass: (_metadata, value) => {effect_class = value; return value;}}},
        "gi://Meta": {default: {}},
        "gi://Shell": {default: {GLSLEffect}},
    }, {imports: {gi: {Cogl: {SnippetHook: {FRAGMENT: 0}}}}});
    return new effect_class();
}

test("identical rounding inputs write uniforms and request repaint only once", async () => {
    const effect = await create_effect();
    for (let i = 0; i < 100; i++) effect.update([0, 0, 800, 600], [8, 8, 8, 8]);
    assert.equal(effect.writes.length, 3);
    assert.equal(effect.repaints, 1);
});

test("bounds, radii, and actor dimensions invalidate the cached inputs", async () => {
    const effect = await create_effect();
    const bounds = [0, 0, 800, 600];
    const radii = [8, 8, 8, 8];
    effect.update(bounds, radii);
    bounds[2] = 700;
    effect.update(bounds, radii);
    radii[0] = 0;
    effect.update(bounds, radii);
    effect.actor.width = 900;
    effect.update(bounds, radii);
    effect.actor.height = 700;
    effect.update(bounds, radii);
    assert.equal(effect.repaints, 5);
    assert.equal(effect.writes.length, 15);
});

test("a rebuilt pipeline receives uniforms again", async () => {
    const effect = await create_effect();
    effect.update([0, 0, 800, 600], [0, 0, 0, 0]);
    effect.vfunc_build_pipeline();
    effect.update([0, 0, 800, 600], [0, 0, 0, 0]);
    assert.equal(effect.repaints, 2);
});

test("empty actors and separate effects do not share cached inputs", async () => {
    const effect = await create_effect();
    effect.actor.width = 0;
    effect.update([0, 0, 800, 600], [0, 0, 0, 0]);
    assert.equal(effect.writes.length, 0);
    effect.actor.width = 800;
    effect.update([0, 0, 800, 600], [0, 0, 0, 0]);
    const other = await create_effect();
    other.update([0, 0, 800, 600], [0, 0, 0, 0]);
    assert.equal(effect.repaints, 1);
    assert.equal(other.repaints, 1);
});
