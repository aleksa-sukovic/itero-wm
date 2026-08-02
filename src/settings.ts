// const Me = imports.misc.extensionUtils.getCurrentExtension();
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
import { get_current_path } from './paths.js';

const DARK = ['dark', 'adapta', 'plata', 'dracula'];

interface Settings extends GObject.Object {
    get_boolean(key: string): boolean;
    set_boolean(key: string, value: boolean): void;

    get_uint(key: string): number;
    set_uint(key: string, value: number): void;

    get_string(key: string): string;
    set_string(key: string, value: string): void;

    bind(key: string, object: GObject.Object, property: string, flags: any): void;
}

function settings_new_id(schema_id: string): Settings | null {
    try {
        return new Gio.Settings({ schema_id });
    } catch (why) {
        if (schema_id !== 'org.gnome.shell.extensions.user-theme') {
            // global.log(`failed to get settings for ${schema_id}: ${why}`);
        }

        return null;
    }
}

function settings_new_schema(schema: string): Settings {
    const GioSSS = Gio.SettingsSchemaSource;
    const schemaDir = Gio.File.new_for_path(get_current_path()).get_child('schemas');

    let schemaSource = schemaDir.query_exists(null) ? GioSSS.new_from_directory(schemaDir.get_path(), GioSSS.get_default(), false) : GioSSS.get_default();

    const schemaObj = schemaSource.lookup(schema, true);

    if (!schemaObj) {
        throw new Error('Schema ' + schema + ' could not be found for extension itero-wm' + '. Please check your installation.');
    }

    return new Gio.Settings({ settings_schema: schemaObj });
}

const ACTIVE_HINT = 'active-hint';
const ACTIVE_HINT_BORDER_RADIUS = 'active-hint-border-radius';
const STACKING_WITH_MOUSE = 'stacking-with-mouse';
const COLUMN_SIZE = 'column-size';
const EDGE_TILING = 'edge-tiling';
const GAP_INNER = 'gap-inner';
const GAP_OUTER = 'gap-outer';
const ROW_SIZE = 'row-size';
const SNAP_TO_GRID = 'snap-to-grid';
const HINT_COLOR_RGBA = 'hint-color-rgba';
const INACTIVE_TAB_COLOR_RGBA = 'inactive-tab-color-rgba';
const ACTIVE_TAB_FOREGROUND_RGBA = 'active-tab-foreground-rgba';
const INACTIVE_TAB_FOREGROUND_RGBA = 'inactive-tab-foreground-rgba';
const DEFAULT_RGBA_COLOR = 'rgba(251, 184, 108, 1)'; //pop-orange
const DEFAULT_INACTIVE_TAB_COLOR = 'rgba(220, 220, 220, 1)';
const DEFAULT_ACTIVE_TAB_FOREGROUND = 'rgba(0, 0, 0, 1)';
const DEFAULT_INACTIVE_TAB_FOREGROUND = 'rgba(80, 80, 80, 1)';
const LOG_LEVEL = 'log-level';
const TOP_BAR_VISIBLE = 'top-bar-visible';
const MOUSE_CURSOR_FOLLOWS_ACTIVE_WINDOW = 'mouse-cursor-follows-active-window';
const MOUSE_CURSOR_FOCUS_LOCATION = 'mouse-cursor-focus-location';
const FLOAT_DEFAULT_WIDTH_PERCENTAGE = 'float-default-width-percentage';
const FLOAT_DEFAULT_HEIGHT_PERCENTAGE = 'float-default-height-percentage';
const DEFAULT_WINDOW_MODE = 'default-window-mode';

export type WindowMode = 'float' | 'stack' | 'tile';

export class ExtensionSettings {
    ext: Settings = settings_new_schema('org.gnome.shell.extensions.itero-wm');
    int: Settings | null = settings_new_id('org.gnome.desktop.interface');
    mutter: Settings | null = settings_new_id('org.gnome.mutter');
    shell: Settings | null = settings_new_id('org.gnome.shell.extensions.user-theme');

    // Getters

    active_hint(): boolean {
        return this.ext.get_boolean(ACTIVE_HINT);
    }

    active_hint_border_radius(): number {
        return this.ext.get_uint(ACTIVE_HINT_BORDER_RADIUS);
    }

    stacking_with_mouse(): boolean {
        return this.ext.get_boolean(STACKING_WITH_MOUSE);
    }

    column_size(): number {
        return this.ext.get_uint(COLUMN_SIZE);
    }

    dynamic_workspaces(): boolean {
        return this.mutter ? this.mutter.get_boolean('dynamic-workspaces') : false;
    }

    gap_inner(): number {
        return this.ext.get_uint(GAP_INNER);
    }

    gap_outer(): number {
        return this.ext.get_uint(GAP_OUTER);
    }

    private color_rgba(key: string, fallback: string): string {
        const rgba = this.ext.get_string(key);
        return new Gdk.RGBA().parse(rgba) ? rgba : fallback;
    }

    hint_color_rgba() {
        return this.color_rgba(HINT_COLOR_RGBA, DEFAULT_RGBA_COLOR);
    }

    inactive_tab_color_rgba() {
        return this.color_rgba(INACTIVE_TAB_COLOR_RGBA, DEFAULT_INACTIVE_TAB_COLOR);
    }

    active_tab_foreground_rgba() {
        return this.color_rgba(ACTIVE_TAB_FOREGROUND_RGBA, DEFAULT_ACTIVE_TAB_FOREGROUND);
    }

    inactive_tab_foreground_rgba() {
        return this.color_rgba(INACTIVE_TAB_FOREGROUND_RGBA, DEFAULT_INACTIVE_TAB_FOREGROUND);
    }

    theme(): string {
        return this.shell ? this.shell.get_string('name') : this.int ? this.int.get_string('gtk-theme') : 'Adwaita';
    }

    is_dark(): boolean {
        const theme = this.theme().toLowerCase();
        return DARK.some(dark => theme.includes(dark));
    }

    is_high_contrast(): boolean {
        return this.theme().toLowerCase() === 'highcontrast';
    }

    row_size(): number {
        return this.ext.get_uint(ROW_SIZE);
    }

    snap_to_grid(): boolean {
        return this.ext.get_boolean(SNAP_TO_GRID);
    }

    workspaces_only_on_primary(): boolean {
        return this.mutter ? this.mutter.get_boolean('workspaces-only-on-primary') : false;
    }

    log_level(): number {
        return this.ext.get_uint(LOG_LEVEL);
    }

    top_bar_visible(): boolean {
        return this.ext.get_boolean(TOP_BAR_VISIBLE);
    }

    mouse_cursor_follows_active_window(): boolean {
        return this.ext.get_boolean(MOUSE_CURSOR_FOLLOWS_ACTIVE_WINDOW);
    }

    mouse_cursor_focus_location(): number {
        return this.ext.get_uint(MOUSE_CURSOR_FOCUS_LOCATION);
    }

    float_default_width_percentage(): number {
        return this.ext.get_uint(FLOAT_DEFAULT_WIDTH_PERCENTAGE);
    }

    float_default_height_percentage(): number {
        return this.ext.get_uint(FLOAT_DEFAULT_HEIGHT_PERCENTAGE);
    }

    default_window_mode(): WindowMode {
        const mode = this.ext.get_string(DEFAULT_WINDOW_MODE);
        return mode === 'float' || mode === 'stack' || mode === 'tile' ? mode : 'tile';
    }

    // Setters

    set_active_hint(set: boolean) {
        this.ext.set_boolean(ACTIVE_HINT, set);
    }

    set_active_hint_border_radius(set: number) {
        this.ext.set_uint(ACTIVE_HINT_BORDER_RADIUS, set);
    }

    set_stacking_with_mouse(set: boolean) {
        this.ext.set_boolean(STACKING_WITH_MOUSE, set);
    }

    set_column_size(size: number) {
        this.ext.set_uint(COLUMN_SIZE, size);
    }

    set_edge_tiling(enable: boolean) {
        this.mutter?.set_boolean(EDGE_TILING, enable);
    }

    set_gap_inner(gap: number) {
        this.ext.set_uint(GAP_INNER, gap);
    }

    set_gap_outer(gap: number) {
        this.ext.set_uint(GAP_OUTER, gap);
    }

    set_hint_color_rgba(rgba: string) {
        let valid_color = new Gdk.RGBA().parse(rgba);

        if (valid_color) {
            this.ext.set_string(HINT_COLOR_RGBA, rgba);
        } else {
            this.ext.set_string(HINT_COLOR_RGBA, DEFAULT_RGBA_COLOR);
        }
    }

    set_row_size(size: number) {
        this.ext.set_uint(ROW_SIZE, size);
    }

    set_snap_to_grid(set: boolean) {
        this.ext.set_boolean(SNAP_TO_GRID, set);
    }

    set_log_level(set: number) {
        this.ext.set_uint(LOG_LEVEL, set);
    }

    set_top_bar_visible(set: boolean) {
        this.ext.set_boolean(TOP_BAR_VISIBLE, set);
    }

    set_mouse_cursor_follows_active_window(set: boolean) {
        this.ext.set_boolean(MOUSE_CURSOR_FOLLOWS_ACTIVE_WINDOW, set);
    }

    set_mouse_cursor_focus_location(set: number) {
        this.ext.set_uint(MOUSE_CURSOR_FOCUS_LOCATION, set);
    }

    set_float_default_width_percentage(set: number) {
        this.ext.set_uint(FLOAT_DEFAULT_WIDTH_PERCENTAGE, set);
    }

    set_float_default_height_percentage(set: number) {
        this.ext.set_uint(FLOAT_DEFAULT_HEIGHT_PERCENTAGE, set);
    }

    set_default_window_mode(mode: WindowMode) {
        this.ext.set_string(DEFAULT_WINDOW_MODE, mode);
    }
}
