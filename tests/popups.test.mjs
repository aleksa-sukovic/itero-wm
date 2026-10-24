import assert from "node:assert/strict";
import test from "node:test";
import {load_method as read_method, load_module} from "./helpers.mjs";

const {Config} = await load_module("config.js", {
    "gi://GLib": {default: {get_user_config_dir: () => "/tmp"}},
    "gi://Gio": {default: {}},
});
const config = new Config();
config.float = [{class: "org.mozilla.firefox", title: "^Extension: "}];
const Tags = {Floating: 1, ForceTile: 3};
const Meta = {WindowType: {NORMAL: 0}};
const bitwarden_title = "Extension: (Bitwarden Password Manager) - Bitwarden — Mozilla Firefox";
const original_rect = {x: 100, y: 100, width: 420, height: 680};

function fixture({title = bitwarden_title, wm_class = "org.mozilla.firefox", mode = "float", attached = false, floating = false, force_tile = false} = {}) {
    const calls = [];
    const timers = [];
    const tags = new Set([...(floating ? [Tags.Floating] : []), ...(force_tile ? [Tags.ForceTile] : [])]);
    let rect = {...original_rect};
    const win = {
        entity: [1, 0], stack: null, new_window_managed: false, initial_floating_rect: null,
        meta: {
            minimized: false, window_type: 0,
            get_wm_class: () => wm_class, get_role: () => null,
            get_title: () => title, connect: () => 1,
        },
        title: () => title,
        name: () => "Firefox",
        is_transient: () => false,
        actor_exists: () => true,
        rect: () => ({...rect, clone: () => ({...rect})}),
        move: (_ext, next_rect) => {rect = {...next_rect}; calls.push("restore");},
    };
    const ext = {
        init: false,
        get_window: () => win,
        window_signals: {get_or: () => []},
        rounding: {refresh: () => {}},
        settings: {active_hint: () => false, default_window_mode: () => mode},
        contains_tag: (_entity, tag) => tags.has(tag),
        add_tag: (_entity, tag) => tags.add(tag),
        conf: {window_shall_float: (window_class, window_title) => config.window_shall_float(window_class, window_title)},
        center_floating: () => {rect = {x: 768, y: 139, width: 2304, height: 1915}; calls.push("center");},
        auto_tiler: {
            attached: {get: () => attached ? [2, 0] : null},
            detach_window: () => {attached = false; rect = {...original_rect}; calls.push("detach");},
            auto_tile: () => calls.push("tile"),
        },
        focus_window: () => null,
        show_border_on_focused: () => {},
        connect_window: () => calls.push("connect"),
        stack_for: () => null,
    };
    win.ext = ext;
    const GLib = {PRIORITY_LOW: 0, timeout_add: (_priority, delay, callback) => {timers.push({delay, callback});}};
    for (const name of ["has_floating_exception", "is_tilable", "apply_floating_exception", "title_changed", "wm_class_changed"]) {
        const method = read_method("window.js", "ShellWindow", name, {Tags, Meta});
        if (method) win[name] = method;
    }
    for (const name of ["center_new_floating", "manage_new_window", "on_window_create", "on_minimize", "is_floating"]) {
        ext[name] = read_method("extension.js", "Ext", name, {Tags, GLib});
    }
    return {win, ext, calls, timers, rect: () => rect, set_title: next => {title = next;}, set_class: next => {wm_class = next;}};
}

test("exception creation preserves geometry in all default modes", () => {
    for (const mode of ["tile", "float", "stack"]) {
        const f = fixture({mode});
        assert.equal(f.ext.manage_new_window(f.win), false);
        f.ext.on_window_create(f.win.meta, {connect: () => {}});
        assert.deepEqual(f.calls, []);
        assert.deepEqual(f.rect(), original_rect);
    }
});

test("late title restores startup geometry and prevents every resize retry", () => {
    const f = fixture({title: "Regular page — Mozilla Firefox"});
    assert.equal(f.ext.manage_new_window(f.win), true);
    assert.deepEqual(f.calls, ["center"]);
    f.timers[0].callback();
    f.set_title(bitwarden_title);
    f.win.title_changed();
    for (const timer of f.timers.slice(1)) timer.callback();
    assert.deepEqual(f.rect(), original_rect);
    assert.deepEqual(f.calls, ["center", "center", "restore"]);
    assert.equal(f.win.initial_floating_rect, null);
});

test("late class restores startup geometry and prevents retries", () => {
    const f = fixture({wm_class: "pending-browser"});
    f.ext.manage_new_window(f.win);
    f.set_class("org.mozilla.firefox");
    f.win.wm_class_changed();
    for (const timer of f.timers) timer.callback();
    assert.deepEqual(f.rect(), original_rect);
    assert.deepEqual(f.calls, ["center", "restore"]);
});

test("late exception detaches a tiled window without applying percentage geometry", () => {
    const f = fixture({attached: true});
    f.win.title_changed();
    assert.deepEqual(f.calls, ["detach"]);
    assert.deepEqual(f.rect(), original_rect);
});

test("restoring an exception skips both new tiling and a saved attachment", () => {
    for (const saved_attachment of [undefined, [[2, 0], true]]) {
        const f = fixture();
        f.win.was_attached_to = saved_attachment;
        f.ext.on_minimize(f.win);
        assert.deepEqual(f.calls, []);
    }
});

test("ordinary windows retain their floating resize retries", () => {
    const f = fixture({title: "Regular page — Mozilla Firefox"});
    f.ext.manage_new_window(f.win);
    for (const timer of f.timers) timer.callback();
    assert.deepEqual(f.calls, ["center", "center", "center", "center"]);
    assert.equal(f.win.initial_floating_rect, null);
});

test("manually floating windows stay floating on restore", () => {
    const f = fixture({title: "Regular page — Mozilla Firefox", floating: true});
    f.ext.on_minimize(f.win);
    assert.deepEqual(f.calls, []);
});

test("ordinary tiled windows still tile on restore", () => {
    const f = fixture({title: "Regular page — Mozilla Firefox"});
    f.ext.on_minimize(f.win);
    assert.deepEqual(f.calls, ["tile"]);
});

test("explicit force-tile overrides an exception", () => {
    const f = fixture({attached: true, force_tile: true});
    f.win.title_changed();
    f.ext.on_minimize(f.win);
    assert.deepEqual(f.calls, ["tile"]);
});
