import Gtk from 'gi://Gtk';

import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
const Settings = Gio.Settings;
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as settings from './settings.js';
import * as log from './log.js';
import * as focus from './focus.js';
import { get_current_path } from './paths.js';

interface AppWidgets {
    stacking_with_mouse: any;
    inner_gap: any;
    mouse_cursor_follows_active_window: any;
    outer_gap: any;
    snap_to_grid: any;
    mouse_cursor_focus_position: any;
    log_level: any;
    active_hint: any;
    disable_active_border_on_float: any;
    active_hint_border_radius: any;
    hint_color_rgba: any;
    floating_exceptions: any;
}

export default class IteroWMPreferences extends ExtensionPreferences {
    getPreferencesWidget() {
        globalThis.iteroWmExtension = this;
        let dialog = settings_dialog_new();
        if (dialog.show_all) {
            dialog.show_all();
        } else {
            dialog.show();
        }
        log.debug(JSON.stringify(dialog));
        return dialog;
    }
}

function settings_dialog_new(): Gtk.Container {
    let [app, grid] = settings_dialog_view();

    let ext = new settings.ExtensionSettings();

    app.snap_to_grid.set_active(ext.snap_to_grid());
    app.snap_to_grid.connect('state-set', (_widget: any, state: boolean) => {
        ext.set_snap_to_grid(state);
        Settings.sync();
    });

    app.outer_gap.set_text(String(ext.gap_outer()));
    app.outer_gap.connect('activate', (widget: any) => {
        let parsed = parseInt((widget.get_text() as string).trim());
        if (!isNaN(parsed)) {
            ext.set_gap_outer(parsed);
            Settings.sync();
        }
    });

    app.inner_gap.set_text(String(ext.gap_inner()));
    app.inner_gap.connect('activate', (widget: any) => {
        let parsed = parseInt((widget.get_text() as string).trim());
        if (!isNaN(parsed)) {
            ext.set_gap_inner(parsed);
            Settings.sync();
        }
    });

    app.log_level.set_active(ext.log_level());
    app.log_level.connect('changed', () => {
        let active_id = app.log_level.get_active_id();
        ext.set_log_level(active_id);
    });

    app.mouse_cursor_follows_active_window.set_active(ext.mouse_cursor_follows_active_window());
    app.mouse_cursor_follows_active_window.connect('state-set', (_widget: any, state: boolean) => {
        ext.set_mouse_cursor_follows_active_window(state);
        Settings.sync();
    });

    app.mouse_cursor_focus_position.set_active(ext.mouse_cursor_focus_location());
    app.mouse_cursor_focus_position.connect('changed', () => {
        let active_id = app.mouse_cursor_focus_position.get_active_id();
        ext.set_mouse_cursor_focus_location(active_id);
    });

    app.stacking_with_mouse.set_active(ext.stacking_with_mouse());
    app.stacking_with_mouse.connect('state-set', (_widget: any, state: boolean) => {
        ext.set_stacking_with_mouse(state);
        Settings.sync();
    });

    app.active_hint.set_active(ext.active_hint());
    app.active_hint.connect('state-set', (_widget: any, state: boolean) => {
        ext.set_active_hint(state);
        Settings.sync();
    });

    app.disable_active_border_on_float.set_active(ext.disable_active_border_on_float());
    app.disable_active_border_on_float.connect('state-set', (_widget: any, state: boolean) => {
        ext.set_disable_active_border_on_float(state);
        Settings.sync();
    });

    app.active_hint_border_radius.set_text(String(ext.active_hint_border_radius()));
    app.active_hint_border_radius.connect('activate', (widget: any) => {
        let parsed = parseInt((widget.get_text() as string).trim());
        if (!isNaN(parsed)) {
            ext.set_active_hint_border_radius(parsed);
            Settings.sync();
        }
    });

    const hint_color = new Gdk.RGBA();
    hint_color.parse(ext.hint_color_rgba());
    app.hint_color_rgba.set_rgba(hint_color);
    app.hint_color_rgba.connect('color-set', (widget: any) => {
        ext.set_hint_color_rgba(widget.get_rgba().to_string());
        Settings.sync();
    });

    app.floating_exceptions.connect('clicked', () => {
        const path = `${get_current_path()}/floating_exceptions/main.js`;
        Gio.Subprocess.new(['gjs', '--module', path], Gio.SubprocessFlags.NONE);
    });

    return grid;
}

function settings_dialog_view(): [AppWidgets, Gtk.Container] {
    const grid = new Gtk.Grid({
        column_spacing: 12,
        row_spacing: 12,
        margin_start: 10,
        margin_end: 10,
        margin_bottom: 10,
        margin_top: 10,
    });

    const snap_label = new Gtk.Label({
        label: 'Snap to Grid (Floating Mode)',
        xalign: 0.0,
    });

    const mouse_section_label = new Gtk.Label({
        label: 'Mouse',
        xalign: 0.0,
    });

    const mouse_cursor_follows_active_window_label = new Gtk.Label({
        label: 'Mouse Cursor Follows Active Window',
        xalign: 0.0,
        margin_start: 24,
    });

    const stacking_with_mouse = new Gtk.Label({
        label: 'Allow stacking with mouse',
        xalign: 0.0,
        margin_start: 24,
    });

    const border_section_label = new Gtk.Label({
        label: 'Border',
        xalign: 0.0,
    });

    const active_hint_label = new Gtk.Label({
        label: 'Show Active Hint',
        xalign: 0.0,
        margin_start: 24,
    });

    const disable_active_border_on_float_label = new Gtk.Label({
        label: 'Disable Active Border on Floating Windows',
        xalign: 0.0,
        margin_start: 24,
    });

    const active_hint_border_radius_label = new Gtk.Label({
        label: 'Active Border Radius',
        xalign: 0.0,
        margin_start: 24,
    });

    const hint_color_rgba_label = new Gtk.Label({
        label: 'Active Hint Color (RGBA)',
        xalign: 0.0,
        margin_start: 24,
    });

    const floating_exceptions_label = new Gtk.Label({
        label: 'Floating Window Exceptions',
        xalign: 0.0,
    });

    const [inner_gap, outer_gap] = gaps_section(grid, 5);

    const settings = {
        inner_gap,
        outer_gap,
        stacking_with_mouse: new Gtk.Switch({ halign: Gtk.Align.END }),
        snap_to_grid: new Gtk.Switch({ halign: Gtk.Align.END }),
        mouse_cursor_follows_active_window: new Gtk.Switch({ halign: Gtk.Align.END }),
        mouse_cursor_focus_position: build_combo(grid, 4, focus.FocusPosition, 'Mouse Cursor Focus Position', 24),
        log_level: build_combo(grid, 14, log.LOG_LEVELS, 'Log Level'),
        active_hint: new Gtk.Switch({ halign: Gtk.Align.END }),
        disable_active_border_on_float: new Gtk.Switch({ halign: Gtk.Align.END }),
        active_hint_border_radius: number_entry(),
        hint_color_rgba: new Gtk.ColorButton({ use_alpha: true }),
        floating_exceptions: new Gtk.Button({ label: 'Open' }),
    };

    grid.attach(snap_label, 0, 0, 1, 1);
    grid.attach(settings.snap_to_grid, 1, 0, 1, 1);

    grid.attach(mouse_section_label, 0, 1, 1, 1);

    grid.attach(stacking_with_mouse, 0, 2, 1, 1);
    grid.attach(settings.stacking_with_mouse, 1, 2, 1, 1);

    grid.attach(mouse_cursor_follows_active_window_label, 0, 3, 1, 1);
    grid.attach(settings.mouse_cursor_follows_active_window, 1, 3, 1, 1);

    grid.attach(border_section_label, 0, 8, 1, 1);

    grid.attach(active_hint_label, 0, 9, 1, 1);
    grid.attach(settings.active_hint, 1, 9, 1, 1);

    grid.attach(disable_active_border_on_float_label, 0, 10, 1, 1);
    grid.attach(settings.disable_active_border_on_float, 1, 10, 1, 1);

    grid.attach(active_hint_border_radius_label, 0, 11, 1, 1);
    grid.attach(settings.active_hint_border_radius, 1, 11, 1, 1);

    grid.attach(hint_color_rgba_label, 0, 12, 1, 1);
    grid.attach(settings.hint_color_rgba, 1, 12, 1, 1);

    grid.attach(floating_exceptions_label, 0, 13, 1, 1);
    grid.attach(settings.floating_exceptions, 1, 13, 1, 1);

    return [settings, grid];
}

function gaps_section(grid: any, top: number): [any, any] {
    let outer_label = new Gtk.Label({
        label: 'Outer',
        xalign: 0.0,
        margin_start: 24,
    });

    let outer_entry = number_entry();

    let inner_label = new Gtk.Label({
        label: 'Inner',
        xalign: 0.0,
        margin_start: 24,
    });

    let inner_entry = number_entry();

    let section_label = new Gtk.Label({
        label: 'Gaps (in pixels)',
        xalign: 0.0,
    });

    grid.attach(section_label, 0, top, 1, 1);
    grid.attach(outer_label, 0, top + 1, 1, 1);
    grid.attach(outer_entry, 1, top + 1, 1, 1);
    grid.attach(inner_label, 0, top + 2, 1, 1);
    grid.attach(inner_entry, 1, top + 2, 1, 1);

    return [inner_entry, outer_entry];
}

function number_entry(): Gtk.Widget {
    return new Gtk.Entry({ input_purpose: Gtk.InputPurpose.NUMBER });
}

function build_combo(grid: any, top_index: number, iter_enum: any, label: string, margin_start: number = 0) {
    let label_ = new Gtk.Label({
        label: label,
        halign: Gtk.Align.START,
        margin_start,
    });

    grid.attach(label_, 0, top_index, 1, 1);

    let combo = new Gtk.ComboBoxText();

    for (const [index, key] of Object.keys(iter_enum).entries()) {
        if (typeof iter_enum[key] == 'string') {
            combo.append(`${index}`, iter_enum[key]);
        }
    }

    grid.attach(combo, 1, top_index, 1, 1);
    return combo;
}
