import type { Ext } from './extension.js';
import type { ShellWindow } from './window.js';

import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

// Based on https://github.com/flexagoon/rounded-window-corners (GPL-3.0)
const EFFECT_NAME = 'itero-wm-rounded-corners';
const Cogl = imports.gi.Cogl;

const DECLARATIONS = `
uniform vec4 bounds;
uniform vec4 cornerRadii;
uniform vec2 pixelStep;

float circleBounds(vec2 point, vec2 center, float radius) {
    vec2 delta = point - center;
    float distanceSquared = dot(delta, delta);
    float outerRadius = radius + 0.5;

    if (distanceSquared >= outerRadius * outerRadius)
        return 0.0;

    float innerRadius = radius - 0.5;
    if (distanceSquared <= innerRadius * innerRadius)
        return 1.0;

    return outerRadius - sqrt(distanceSquared);
}

float pointOpacity(vec2 point) {
    if (point.x < bounds.x || point.x > bounds.z || point.y < bounds.y || point.y > bounds.w)
        return 0.0;

    float radius = 0.0;
    vec2 center;

    if (point.x < bounds.x + cornerRadii.x && point.y < bounds.y + cornerRadii.x) {
        radius = cornerRadii.x;
        center = vec2(bounds.x + radius, bounds.y + radius);
    } else if (point.x > bounds.z - cornerRadii.y && point.y < bounds.y + cornerRadii.y) {
        radius = cornerRadii.y;
        center = vec2(bounds.z - radius, bounds.y + radius);
    } else if (point.x > bounds.z - cornerRadii.z && point.y > bounds.w - cornerRadii.z) {
        radius = cornerRadii.z;
        center = vec2(bounds.z - radius, bounds.w - radius);
    } else if (point.x < bounds.x + cornerRadii.w && point.y > bounds.w - cornerRadii.w) {
        radius = cornerRadii.w;
        center = vec2(bounds.x + radius, bounds.w - radius);
    } else {
        return 1.0;
    }

    return radius > 0.0 ? circleBounds(point, center, radius) : 1.0;
}
`;

const CODE = `{
    vec2 point = cogl_tex_coord0_in.xy / pixelStep;
    cogl_color_out *= pointOpacity(point);
}`;

class Uniforms {
    bounds = 0;
    cornerRadii = 0;
    pixelStep = 0;
}

const RoundedCornersEffect = GObject.registerClass(
    {},
    class extends Shell.GLSLEffect {
        private uniforms = new Uniforms();

        constructor() {
            super();

            for (const key in this.uniforms) {
                this.uniforms[key as keyof Uniforms] = this.get_uniform_location(key);
            }
        }

        vfunc_build_pipeline() {
            this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, DECLARATIONS, CODE, false);
        }

        update(bounds: number[], corner_radii: number[]) {
            if (this.actor.width === 0 || this.actor.height === 0) return;

            this.set_uniform_float(this.uniforms.bounds, 4, bounds);
            this.set_uniform_float(this.uniforms.cornerRadii, 4, corner_radii);
            this.set_uniform_float(this.uniforms.pixelStep, 2, [1 / this.actor.width, 1 / this.actor.height]);
            this.queue_repaint();
        }
    },
);

export class RoundedCorners {
    private enabled = false;

    constructor(private ext: Ext) {}

    enable() {
        this.enabled = true;
        this.refreshAll();
    }

    disable() {
        this.enabled = false;

        for (const window of this.ext.windows.values()) {
            this.remove(window);
        }
    }

    refreshAll() {
        for (const window of this.ext.windows.values()) {
            this.refresh(window);
        }
    }

    refresh(window: ShellWindow) {
        if (!this.enabled) return;

        const actor = window.meta.get_compositor_private() as any;
        if (!actor) return;

        if (window.meta.is_fullscreen() || window.is_maximized()) {
            this.remove(window);
            return;
        }

        const effect_actor = this.effectActor(window, actor);
        if (!effect_actor) {
            if (!actor.iteroRoundingWaiting) {
                actor.iteroRoundingWaiting = true;
                const id = actor.connect('notify::first-child', () => {
                    actor.disconnect(id);
                    actor.iteroRoundingWaiting = false;
                    this.refresh(window);
                });
            }
            return;
        }

        let effect = effect_actor.get_effect(EFFECT_NAME) as InstanceType<typeof RoundedCornersEffect> | null;
        if (!effect) {
            effect = new RoundedCornersEffect();
            effect_actor.add_effect_with_name(EFFECT_NAME, effect);
        }

        const frame = window.meta.get_frame_rect();
        const buffer = window.meta.get_buffer_rect();
        const bounds = [
            frame.x - buffer.x + 1,
            frame.y - buffer.y + 1,
            frame.x - buffer.x + actor.width + frame.width - buffer.width,
            frame.y - buffer.y + actor.height + frame.height - buffer.height,
        ];
        const radius = Math.min(this.ext.settings.corner_radius(), (bounds[2] - bounds[0]) / 2, (bounds[3] - bounds[1]) / 2);
        const stacked = window.stack !== null && !window.has_floating_exception(this.ext);
        const corner_radii = stacked ? [0, 0, radius, radius] : [radius, radius, radius, radius];

        effect.update(bounds, corner_radii);
    }

    private remove(window: ShellWindow) {
        const actor = window.meta.get_compositor_private() as any;
        const effect_actor = actor && this.effectActor(window, actor);
        effect_actor?.remove_effect_by_name(EFFECT_NAME);
    }

    private effectActor(window: ShellWindow, actor: any): any | null {
        const x11 = (Meta as any).WindowClientType?.X11;
        if ((window.meta as any).get_client_type?.() === x11) {
            return actor.get_first_child?.() ?? actor.firstChild ?? null;
        }

        return actor;
    }
}
