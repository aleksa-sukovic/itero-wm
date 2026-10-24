import * as rectangle from './rectangle.js';

import type { Rectangle } from './rectangle.js';

import Meta from 'gi://Meta';

export enum Orientation {
    HORIZONTAL = 0,
    VERTICAL = 1,
}

export function current_monitor(): Rectangle {
    return rectangle.Rectangle.from_meta(global.display.get_monitor_geometry(global.display.get_current_monitor()) as Rectangular);
}

// Fetch rectangle that represents the cursor
export function cursor_rect(): Rectangle {
    let [x, y] = global.get_pointer();
    return new rectangle.Rectangle([x, y, 1, 1]);
}

export function is_keyboard_op(op: number): boolean {
    const window_flag_keyboard = Meta.GrabOp.KEYBOARD_MOVING & ~Meta.GrabOp.WINDOW_BASE;
    return (op & window_flag_keyboard) != 0;
}

export function is_resize_op(op: number): boolean {
    const window_dir_mask = (Meta.GrabOp.RESIZING_N | Meta.GrabOp.RESIZING_E | Meta.GrabOp.RESIZING_S | Meta.GrabOp.RESIZING_W) & ~Meta.GrabOp.WINDOW_BASE;
    return (op & window_dir_mask) != 0 || (op & Meta.GrabOp.KEYBOARD_RESIZING_UNKNOWN) == Meta.GrabOp.KEYBOARD_RESIZING_UNKNOWN;
}

export function is_move_op(op: number): boolean {
    return !is_resize_op(op);
}

export function round_increment(value: number, increment: number): number {
    return Math.round(value / increment) * increment;
}
