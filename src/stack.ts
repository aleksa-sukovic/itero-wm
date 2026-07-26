import type { Entity } from './ecs.js';
import type { Ext } from './extension.js';
import type { ShellWindow } from './window.js';

import * as Ecs from './ecs.js';
import * as a from './arena.js';

const Arena = a.Arena;
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

const ACTIVE_TAB = 'itero-wm-tab itero-wm-tab-active';
const INACTIVE_TAB = 'itero-wm-tab itero-wm-tab-inactive';
const URGENT_TAB = 'itero-wm-tab itero-wm-tab-urgent';
const TAB_COLOR_SETTINGS = ['hint-color-rgba', 'inactive-tab-color-rgba', 'active-tab-foreground-rgba', 'inactive-tab-foreground-rgba'];

export var TAB_HEIGHT: number = 24;

interface Tab {
    active: boolean;
    entity: Entity;
    button: number;
    button_signal: SignalID | null;
    signals: Array<SignalID>;
}

interface StackWidgets {
    tabs: St.Widget;
}

function stack_widgets_new(): StackWidgets {
    let tabs = new St.BoxLayout({
        style_class: 'itero-wm-stack',
        x_expand: true,
    });

    tabs.get_layout_manager()?.set_homogeneous(true);

    return { tabs };
}

interface TabButton extends St.Button {
    set_title: (title: string) => void;
}

const TabButton = GObject.registerClass(
    {
        Signals: { activate: {} },
    },
    class TabButton extends St.Button {
        _init(window: ShellWindow) {
            const label = new St.Label({
                x_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                style: 'text-align: center',
                text: window.title(),
            });

            super._init({
                child: label,
                x_expand: true,
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
            });

            this._title = label;
        }

        set_title(text: string) {
            if (this._title) {
                this._title.text = text;
            }
        }
    },
);

export class Stack {
    ext: Ext;

    widgets: null | StackWidgets = null;

    active: Entity;

    /** Whether this stack keeps its windows floating. */
    floating: boolean;

    /** Whether newly opened windows join this stack. */
    accepts_new_windows: boolean = true;

    active_id: number = 0;

    prev_active: null | Entity = null;
    prev_active_id: number = 0;

    tabs: Array<Tab> = new Array();

    monitor: number;

    workspace: number;

    buttons: a.Arena<TabButton> = new Arena();

    tabs_height: number = TAB_HEIGHT;

    private active_signals: [SignalID, SignalID] | null = null;

    private rect: Rectangular = { width: 0, height: 0, x: 0, y: 0 };

    private restacker: SignalID | null = global.display.connect('restacked', () => this.restack());

    private tabs_destroy: SignalID | null;

    private destroyed: boolean = false;

    constructor(ext: Ext, active: Entity, workspace: number, monitor: number, floating: boolean = false) {
        this.ext = ext;
        this.active = active;
        this.floating = floating;
        this.monitor = monitor;
        this.workspace = workspace;
        this.tabs_height = TAB_HEIGHT * this.ext.dpi;
        this.widgets = stack_widgets_new();

        global.window_group.add_child(this.widgets.tabs);

        this.reposition();

        this.tabs_destroy = this.widgets.tabs.connect('destroy', () => this.recreate_widgets());
    }

    /** Adds a new window to the stack */
    add(window: ShellWindow) {
        if (!this.widgets) return;

        const entity = window.entity;
        const active = Ecs.entity_eq(entity, this.active);

        const button = new TabButton(window);
        const id = this.buttons.insert(button);

        const tab: Tab = { active, entity, signals: [], button: id, button_signal: null };
        const comp = this.tabs.length;
        this.tabs.push(tab);
        this.bind_hint_events(tab);
        this.watch_signals(comp, id, window);
        this.widgets.tabs.add_child(button);
    }

    /** Activates a tab based on the previously active entry */
    auto_activate(): null | Entity {
        if (this.tabs.length === 0) return null;

        if (this.tabs.length <= this.active_id) {
            this.active_id = this.tabs.length - 1;
        }

        const c = this.tabs[this.active_id];

        this.activate(c.entity);
        return c.entity;
    }

    activate_prev() {
        if (this.prev_active) {
            this.activate(this.prev_active);
        }
    }

    /** Activates the tab of this entity */
    activate(entity: Entity) {
        const permitted = this.permitted_to_show();

        if (this.widgets) this.widgets.tabs.visible = permitted;

        this.reset_visibility(permitted);

        const win = this.ext.windows.get(entity);
        if (!win) return;

        if (this.floating && this.rect.width > 0 && this.rect.height > 0) {
            win.move(this.ext, this.rect);
        }

        if (!Ecs.entity_eq(entity, this.active)) {
            this.prev_active = this.active;
            this.prev_active_id = this.active_id;
        }

        this.active_connect(win.meta, entity);

        for (const [index, component] of this.tabs.entries()) {
            this.window_exec(index, component.entity, window => {
                const actor = window.meta.get_compositor_private();
                component.active = Ecs.entity_eq(entity, component.entity);

                if (component.active) {
                    this.active_id = index;
                    if (actor) actor.show();
                } else if (actor) {
                    actor.hide();
                }

                const button = this.buttons.get(component.button);
                if (button) {
                    button.set_style_class_name(component.active ? ACTIVE_TAB : INACTIVE_TAB);
                    button.set_style(this.tab_style(component, index));
                }
            });
        }

        this.reset_visibility(permitted);
        this.ext.show_border_on_focused();
    }

    // returns the tab button border radius based on it's order.
    // Only curving the corners on the edges.
    private get_tab_border_radius(idx: number): string {
        let result = `0px 0px 0px 0px`;

        let radius = this.ext.settings.active_hint_border_radius();
        // only allow a radius up to half the tab_height
        radius = Math.min(radius, Math.trunc(this.tabs_height / 2));
        // set each corner's radius based on it's order
        if (this.tabs.length === 1) result = `${radius}px ${radius}px 0px 0px`;
        else if (idx === 0) result = `${radius}px 0px 0px 0px`;
        else if (idx === this.tabs.length - 1) result = `0px ${radius}px 0px 0px`;

        return result;
    }

    /** Connects `on_window_changed` callbacks to the newly-active window */
    private active_connect(window: Meta.Window, active: Entity) {
        // Disconnect before attaching new window as active window
        this.active_disconnect();

        // Memorize them for future calls
        this.active = active;

        this.active_reconnect(window);
    }

    private active_reconnect(window: Meta.Window) {
        // Attach this callback on both signals of the window
        const on_window_changed = () =>
            this.on_grab(() => {
                const window = this.ext.windows.get(this.active);
                if (window) {
                    this.window_changed();
                } else {
                    this.active_disconnect();
                }
            });

        this.active_signals = [window.connect('size-changed', on_window_changed), window.connect('position-changed', on_window_changed)];
    }

    /** Disconnects signals from the active window in the stack */
    private active_disconnect() {
        const active_meta = this.active_meta();

        if (this.active_signals && active_meta) {
            for (const s of this.active_signals) active_meta.disconnect(s);
        }

        this.active_signals = null;
    }

    private active_meta(): Meta.Window | undefined {
        return this.ext.windows.get(this.active)?.meta;
    }

    private bind_hint_events(tab: Tab) {
        let settings = this.ext.settings;
        let button = this.buttons.get(tab.button);
        if (button) {
            let change_id = settings.ext.connect('changed', (_, key) => {
                if (TAB_COLOR_SETTINGS.includes(key)) this.change_tab_color(tab);
                return false;
            });
            button.connect('destroy', () => {
                settings.ext.disconnect(change_id);
            });
        }
        this.change_tab_color(tab);
    }

    private tab_style(tab: Tab, index: number): string {
        const settings = this.ext.settings;
        const colors = tab.active
            ? `background: ${settings.hint_color_rgba()}; color: ${settings.active_tab_foreground_rgba()}`
            : `background: ${settings.inactive_tab_color_rgba()}; color: ${settings.inactive_tab_foreground_rgba()}`;

        return `${colors}; border-radius: ${this.get_tab_border_radius(index)}; padding: 4px 1em;`;
    }

    private change_tab_color(tab: Tab) {
        const button = this.buttons.get(tab.button);
        const index = this.tabs.indexOf(tab);
        if (button && index !== -1) button.set_style(this.tab_style(tab, index));
    }

    /** Moves a tab one position without changing the active window. */
    move_tab(entity: Entity, direction: -1 | 1): boolean {
        const index = this.tabs.findIndex(tab => Ecs.entity_eq(tab.entity, entity));
        const next_index = index + direction;
        if (index < 0 || next_index < 0 || next_index >= this.tabs.length) return false;

        const tab = this.tabs[index];
        const next_tab = this.tabs[next_index];
        this.tabs[index] = next_tab;
        this.tabs[next_index] = tab;

        const button = this.buttons.get(tab.button);
        const next_button = this.buttons.get(next_tab.button);
        if (this.widgets && button && next_button) {
            if (direction < 0) {
                this.widgets.tabs.set_child_below_sibling(button, next_button);
            } else {
                this.widgets.tabs.set_child_above_sibling(button, next_button);
            }
        }

        this.activate(this.active);
        return true;
    }

    /** Clears watched tabs and removes all tabs */
    clear() {
        this.active_disconnect();
        for (const c of this.tabs.splice(0)) this.tab_disconnect(c);
        this.widgets?.tabs.destroy_all_children();
        this.buttons.truncate(0);
    }

    /** Disconnects a tab from the stack */
    tab_disconnect(c: Tab) {
        const window = this.ext.windows.get(c.entity);
        if (window) {
            for (const s of c.signals) window.meta.disconnect(s);
            if (this.workspace === this.ext.active_workspace()) window.meta.get_compositor_private()?.show();
        }

        c.signals = [];

        if (c.button_signal) {
            const b = this.buttons.get(c.button);
            if (b) {
                b.disconnect(c.button_signal);
                c.button_signal = null;
            }
        }
    }

    /** Deactivate the signals belonging to an entity */
    deactivate(w: ShellWindow) {
        for (const c of this.tabs)
            if (Ecs.entity_eq(c.entity, w.entity)) {
                this.tab_disconnect(c);
            }

        if (this.active_signals && Ecs.entity_eq(this.active, w.entity)) {
            this.active_disconnect();
        }
    }

    /** Disconnects this stack's signal, and destroys its widgets */
    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;

        if (this.restacker !== null) {
            global.display.disconnect(this.restacker);
            this.restacker = null;
        }

        this.active_disconnect();

        // Disconnect stack signals from each window, and unhide them.
        for (const c of this.tabs) {
            this.tab_disconnect(c);
            if (this.workspace === this.ext.active_workspace()) {
                const win = this.ext.windows.get(c.entity);
                if (win) {
                    win.meta.get_compositor_private()?.show();
                    win.stack = null;
                }
            }
        }

        this.tabs.splice(0);
        this.buttons.truncate(0);

        if (this.widgets) {
            const tabs = this.widgets.tabs;
            if (this.tabs_destroy !== null) tabs.disconnect(this.tabs_destroy);
            this.tabs_destroy = null;
            this.widgets = null;
            tabs.destroy();
        }
    }

    private on_grab(or: () => void) {
        if (this.ext.grab_op !== null) {
            if (Ecs.entity_eq(this.ext.grab_op.entity, this.active)) {
                if (this.widgets) {
                    const parent = this.widgets.tabs.get_parent();
                    const actor = this.active_meta()?.get_compositor_private();
                    if (actor && parent) {
                        parent.set_child_below_sibling(this.widgets.tabs, actor);
                    }
                }

                return;
            }
        }

        or();
    }

    /** Workaround for when GNOME Shell destroys our widgets when they're reparented
     *  in an active workspace change. */
    recreate_widgets() {
        if (!this.destroyed && this.widgets !== null) {
            if (this.tabs_destroy !== null) this.widgets.tabs.disconnect(this.tabs_destroy);
            this.widgets = stack_widgets_new();

            global.window_group.add_child(this.widgets.tabs);

            this.tabs_destroy = this.widgets.tabs.connect('destroy', () => this.recreate_widgets());

            this.active_disconnect();

            for (const c of this.tabs.splice(0)) {
                this.tab_disconnect(c);
                const window = this.ext.windows.get(c.entity);
                if (window) this.add(window);
            }

            this.update_positions(this.rect);
            this.restack();

            const window = this.ext.windows.get(this.active);
            if (!window) return;

            this.active_reconnect(window.meta);
        }
    }

    remove_by_pos(idx: number) {
        const c = this.tabs[idx];
        if (c) this.remove_tab_component(c, idx);
    }

    remove_tab_component(c: Tab, idx: number) {
        if (!this.widgets) return;

        this.tab_disconnect(c);

        const b = this.buttons.get(c.button);
        if (b) {
            this.widgets.tabs.remove_child(b);
            b.destroy();
            this.buttons.remove(c.button);
        }

        this.tabs.splice(idx, 1);
    }

    /** Removes the tab associated with the entity */
    remove_tab(entity: Entity): null | number {
        if (!this.widgets) return null;

        if (this.prev_active && Ecs.entity_eq(entity, this.prev_active)) {
            this.prev_active = null;
            this.prev_active_id = 0;
        }

        let idx = 0;
        for (const c of this.tabs) {
            if (Ecs.entity_eq(c.entity, entity)) {
                this.remove_tab_component(c, idx);
                if (this.active_id > idx) {
                    this.active_id -= 1;
                }
                return idx;
            }
            idx += 1;
        }

        return null;
    }

    replace(window: ShellWindow) {
        if (!this.widgets) return;
        const c = this.tabs[this.active_id],
            actor = window.meta.get_compositor_private();
        if (c && actor) {
            this.tab_disconnect(c);

            if (Ecs.entity_eq(window.entity, this.active)) {
                this.active_connect(window.meta, window.entity);
                actor.show();
            } else {
                actor.hide();
            }

            this.watch_signals(this.active_id, c.button, window);
            this.buttons.get(c.button)?.set_title(window.title());
            this.activate(window.entity);
        }
    }

    /** Repositions the stack, arranging the stack's actors around the active window */
    reposition() {
        if (!this.widgets) return;

        const window = this.ext.windows.get(this.active);
        if (!window) return;

        const actor = window.meta.get_compositor_private();
        if (!actor) {
            this.active_disconnect();
            return;
        }

        actor.show();

        const parent = actor.get_parent();

        if (!parent) {
            return;
        }

        const stack_parent = this.widgets.tabs.get_parent();
        if (stack_parent !== parent) {
            if (stack_parent) {
                stack_parent.remove_child(this.widgets.tabs);
            }

            parent.add_child(this.widgets.tabs);
        }

        // Reposition actors on the screen, being careful about not displaying over maximized windows
        if (!window.meta.is_fullscreen() && !window.is_maximized() && !this.ext.maximized_on_active_display()) {
            parent.set_child_above_sibling(this.widgets.tabs, actor);
        } else {
            parent.set_child_below_sibling(this.widgets.tabs, actor);
        }
    }

    permitted_to_show(workspace?: number): boolean {
        const active_workspace = workspace ?? global.workspace_manager.get_active_workspace_index();
        const primary = global.display.get_primary_monitor();
        const only_primary = this.ext.settings.workspaces_only_on_primary();

        return active_workspace === this.workspace || (only_primary && this.monitor != primary);
    }

    reset_visibility(permitted: boolean) {
        let idx = 0;

        for (const c of this.tabs) {
            this.actor_exec(idx, c.entity, actor => {
                if (permitted && this.active_id === idx) {
                    actor.show();
                    return;
                }

                actor.hide();
            });

            idx += 1;
        }
    }

    /** Repositions the stack, and hides all but the active window in the stack */
    restack() {
        this.on_grab(() => {
            if (!this.widgets) return;

            const permitted = this.permitted_to_show();

            this.widgets.tabs.visible = permitted;

            if (permitted) this.reposition();

            this.reset_visibility(permitted);
        });
    }

    /** Changes visibility of the stack's actors */
    set_visible(visible: boolean) {
        if (!this.widgets) return;

        this.widgets.tabs.visible = visible;

        if (visible) {
            this.widgets.tabs.show();
        } else {
            this.widgets.tabs.hide();
        }
    }

    /** Updates the dimensions and positions of the stack's actors */
    update_positions(rect: Rectangular) {
        if (!this.widgets || rect.width <= 0 || rect.height <= 0) return;

        this.rect = rect;

        this.tabs_height = TAB_HEIGHT * this.ext.dpi;

        this.widgets.tabs.x = rect.x;
        this.widgets.tabs.y = rect.y - this.tabs_height;
        this.widgets.tabs.height = this.tabs_height;
        this.widgets.tabs.width = rect.width;
    }

    private watch_signals(comp: number, button: number, window: ShellWindow) {
        const entity = window.entity;
        const widget = this.buttons.get(button);
        if (!widget) return;

        const c = this.tabs[comp];

        // Detach button signal if it's still attached
        if (c.button_signal) widget.disconnect(c.button_signal);

        // Connect tab-clicked signal
        c.button_signal = widget.connect('clicked', () => {
            this.activate(entity);
            this.window_exec(comp, entity, window => {
                const actor = window.meta.get_compositor_private();
                if (actor) {
                    actor.show();
                    window.activate(false);

                    this.reposition();

                    for (const comp of this.tabs) {
                        this.buttons.get(comp.button)?.set_style_class_name(INACTIVE_TAB);
                    }

                    widget.set_style_class_name(ACTIVE_TAB);
                }
            });
        });

        // Detach signals if they're still attached
        if (this.tabs[comp].signals) {
            for (const c of this.tabs[comp].signals) window.meta.disconnect(c);
        }

        // Attach new signals
        this.tabs[comp].signals = [
            window.meta.connect('notify::title', () => {
                this.window_exec(comp, entity, window => {
                    this.buttons.get(button)?.set_title(window.title());
                });
            }),

            window.meta.connect('notify::urgent', () => {
                this.window_exec(comp, entity, window => {
                    if (!window.meta.has_focus()) {
                        this.buttons.get(button)?.set_style_class_name(URGENT_TAB);
                    }
                });
            }),
        ];
    }

    private window_changed() {
        this.ext.show_border_on_focused();
    }

    private actor_exec(comp: number, entity: Entity, func: (window: Clutter.Actor) => void) {
        this.window_exec(comp, entity, window => {
            func(window.meta.get_compositor_private() as Clutter.Actor);
        });
    }

    private window_exec(comp: number, entity: Entity, func: (window: ShellWindow) => void) {
        const window = this.ext.windows.get(entity);
        if (window && window.actor_exists()) {
            func(window);
        } else {
            const tab = this.tabs[comp];
            if (tab) this.tab_disconnect(tab);
        }
    }
}
