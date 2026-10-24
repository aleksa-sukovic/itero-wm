import assert from "node:assert/strict";
import test from "node:test";
import {load_module} from "./helpers.mjs";

async function fixture() {
    let compilations = 0;
    class CountingRegExp extends RegExp {
        constructor(...args) { super(...args); compilations++; }
    }
    const {Config} = await load_module("config.js", {
        "gi://GLib": {default: {get_user_config_dir: () => "/tmp"}},
        "gi://Gio": {default: {}},
    }, {RegExp: CountingRegExp});
    return {Config, config: new Config(), compilations: () => compilations};
}

test("repeated float and border matches reuse compiled expressions", async () => {
    const f = await fixture();
    f.config.float = [{class: "^ExampleApp$", title: "dialog"}];
    f.config.active_border_exclusions = [{class: "^ExampleApp$", title: "dialog"}];
    for (let i = 0; i < 100; i++) {
        assert.equal(f.config.window_shall_float("exampleapp", "DIALOG"), true);
        assert.equal(f.config.window_shall_hide_border("exampleapp", "DIALOG"), true);
    }
    assert.equal(f.compilations(), 2);
});

test("rule order, disabled overrides, and optional fields retain their behavior", async () => {
    const f = await fixture();
    f.config.float = [
        {class: "ExampleApp", title: "dialog", disabled: true},
        {class: "ExampleApp"},
    ];
    assert.equal(f.config.window_shall_float("ExampleApp", "dialog"), false);
    assert.equal(f.config.window_shall_float("ExampleApp", "other"), true);
    f.config.active_border_exclusions = [{title: "dialog"}];
    assert.equal(f.config.window_shall_hide_border("OtherApp", "dialog"), true);
    assert.equal(f.config.window_shall_hide_border("OtherApp", "other"), false);
});

test("editing or replacing rules cannot reuse stale match results", async () => {
    const f = await fixture();
    const rule = {class: "ExampleApp", title: "first"};
    f.config.active_border_exclusions = [rule];
    assert.equal(f.config.window_shall_hide_border("ExampleApp", "first"), true);
    rule.title = "second";
    assert.equal(f.config.window_shall_hide_border("ExampleApp", "first"), false);
    assert.equal(f.config.window_shall_hide_border("ExampleApp", "second"), true);
    f.config.active_border_exclusions = [];
    assert.equal(f.config.window_shall_hide_border("ExampleApp", "second"), false);
    assert.equal(f.compilations(), 3);
});

test("reloading config applies new rules without serializing the cache", async () => {
    const f = await fixture();
    f.config.float = [{class: "ExampleApp", title: "before"}];
    assert.equal(f.config.window_shall_float("ExampleApp", "before"), true);
    f.Config.from_config = () => ({tag: 0, value: {float: [{class: "ExampleApp", title: "after"}], log_on_focus: false}});
    f.config.reload();
    assert.equal(f.config.window_shall_float("ExampleApp", "after"), true);
    const saved = JSON.parse(f.config.to_json());
    assert.deepEqual(Object.keys(saved).sort(), ["active_border_exclusions", "float", "log_on_focus"]);
    assert.equal(saved.float[0].title, "after");
});

test("invalid expressions still fail only when their rule is reached", async () => {
    const f = await fixture();
    f.config.active_border_exclusions = [{class: "ExampleApp"}, {class: "["}];
    assert.equal(f.config.window_shall_hide_border("ExampleApp", ""), true);
    assert.throws(() => f.config.window_shall_hide_border("OtherApp", ""), SyntaxError);
});
