import assert from "node:assert/strict";
import test from "node:test";
import {load_method, load_module} from "./helpers.mjs";

async function fixture() {
    const {Storage} = await load_module("ecs.js", {});
    const handlers = new Map();
    const timers = new Map();
    const events = [];
    let next_id = 0;
    let alive = true;
    let blocked = false;
    const win = {
        entity: [1, 0],
        actor_exists: () => alive,
        meta: {connect: (name, callback) => {handlers.set(++next_id, {name, callback}); return next_id;}},
    };
    const GLib = {
        PRIORITY_LOW: 0,
        timeout_add: (_priority, delay, callback) => {timers.set(++next_id, {delay, callback}); return next_id;},
        source_remove: id => timers.delete(id),
    };
    const scope = {
        GLib, Tags: {Blocked: 1},
        Events: {window_event: (_win, event) => event},
        WindowEvent: {Size: "size", Workspace: "workspace", Minimize: "minimize"},
    };
    const ext = {
        size_signals: new Storage(), window_signals: new Storage(), size_requests: new Map(),
        contains_tag: () => blocked,
        register: event => events.push(event),
    };
    for (const name of ["connect_window", "connect_meta", "connect_size_signal"]) {
        ext[name] = load_method("extension.js", "Ext", name, scope);
    }
    function emit(name) {
        for (const handler of handlers.values()) if (handler.name === name) handler.callback();
    }
    return {ext, win, handlers, timers, events, emit, destroy: () => {alive = false;}, block: () => {blocked = true;}};
}

test("repeated setup installs one handler per window signal", async () => {
    const f = await fixture();
    f.ext.connect_window(f.win);
    f.ext.connect_window(f.win);
    assert.equal(f.handlers.size, 4);
    assert.equal(f.ext.window_signals.get(f.win.entity).length, 4);
    f.emit("workspace-changed");
    f.emit("notify::minimized");
    assert.deepEqual(f.events, ["workspace", "minimize"]);
});

test("size and position changes retain the existing 500 ms debounce", async () => {
    const f = await fixture();
    f.ext.connect_window(f.win);
    f.emit("size-changed");
    f.emit("position-changed");
    assert.equal(f.timers.size, 1);
    const timer = [...f.timers.values()][0];
    assert.equal(timer.delay, 500);
    assert.equal(timer.callback(), false);
    assert.deepEqual(f.events, ["size"]);
    assert.equal(f.ext.size_requests.has(f.win.meta), false);
});

test("blocked and destroyed windows do not process geometry events", async () => {
    for (const state of ["block", "destroy"]) {
        const f = await fixture();
        f.ext.connect_window(f.win);
        f[state]();
        f.emit("size-changed");
        f.emit("notify::minimized");
        assert.equal(f.timers.size, 0);
        assert.equal(f.events.length, 0);
    }
});

test("reused entity slots still receive their own signal handlers", async () => {
    const f = await fixture();
    f.ext.connect_window(f.win);
    const next_win = {...f.win, entity: [1, 1]};
    f.ext.connect_window(next_win);
    assert.equal(f.handlers.size, 8);
    assert.equal(f.ext.window_signals.get(next_win.entity).length, 4);
});
