import * as log from './log.js';

import Gio from 'gi://Gio';
import St from 'gi://St';

const ROUNDED_SELECTORS = [
    // Outer surfaces
    '.app-folder-dialog',
    '.candidate-popup-content',
    '.datemenu-popover',
    '.keyboard-subkeys-boxpointer',
    '.modal-dialog',
    '.notification-banner',
    '.osd-break-countdown-label',
    '.osd-monitor-label',
    '.osd-window',
    '.popup-menu-content',
    '.quick-settings',
    '.resize-popup',
    '.screenshot-ui-panel',
    '.search-section-content',
    '.switcher-list',
    '.workspace-background',
    '.workspace-switcher',
    '#dash .dash-background',
    '#LookingGlassDialog',
    '#LookingGlassPropertyInspector',

    // Panel and popup controls
    '.button',
    '.icon-button',
    '.popup-menu-item',
    '#panel .panel-button',
    '#panel .panel-button.clock-display .clock',

    // Calendar and notifications
    '.calendar',
    '.calendar .calendar-day',
    '.calendar .calendar-day-heading',
    '.calendar .calendar-month-header .calendar-month-label',
    '.calendar .calendar-month-header .pager-button',
    '.calendar .calendar-week-number',
    '.datemenu-today-button',
    '.events-button',
    '.events-button .event-box',
    '.message',
    '.message .message-header .message-close-button',
    '.message .message-header .message-expand-button',
    '.message-media-control',
    '.message-notification-group .message-collapse-button',
    '.notification-button',
    '.weather-button',
    '.world-clocks-button',

    // Quick settings
    '.quick-slider .slider-bin',
    '.quick-toggle',
    '.quick-toggle-has-menu',
    '.quick-toggle-menu',
    '.quick-toggle-menu-button',

    // Dialogs and entries
    'StEntry',
    '.audio-device-selection-dialog .audio-selection-device',
    '.candidate-box',
    '.login-dialog-auth-list-item',
    '.login-dialog-user-list-item',
    '.modal-dialog .modal-dialog-button',

    // Overview and app grid
    '.grid-search-result',
    '.list-search-result',
    '.overview-tile',
    '.search-provider-icon',
    '.workspace-thumbnail-indicator',
    '.workspace-thumbnails .workspace-thumbnail',

    // On-screen keyboard and screenshot UI
    '.keyboard-key',
    '.screenshot-ui-shot-cast-button',
    '.screenshot-ui-shot-cast-container',
    '.screenshot-ui-show-pointer-button',
    '.screenshot-ui-type-button',

    // Labels and tooltips
    '.dash-label',
    '.screenshot-ui-tooltip',
    '.window-caption',
];

const SQUARE_SELECTORS = [
    '.popup-sub-menu .popup-menu-item',
];

const LEFT_ROUNDED_SELECTORS = [
    '.quick-toggle-has-menu .quick-toggle:ltr',
    '.quick-toggle-has-menu .quick-toggle-menu-button:rtl',
];

const RIGHT_ROUNDED_SELECTORS = [
    '.quick-toggle-has-menu .quick-toggle:rtl',
    '.quick-toggle-has-menu .quick-toggle-menu-button:ltr',
];

const TOP_ROUNDED_SELECTORS = [
    '.popup-menu-item:checked',
];

const BOTTOM_ROUNDED_SELECTORS = [
    '.popup-sub-menu',
    '.popup-sub-menu .popup-menu-item:last-child',
    '.popup-sub-menu .popup-menu-section:last-child .popup-menu-item:last-child',
];

const FULL_RADIUS_OVERRIDE_SELECTORS = [
    '.quick-toggle-has-menu .quick-toggle:last-child',
];

function radius_rule(selectors: string[], radius: string) {
    return `${selectors.join(',\n')} {\n    border-radius: ${radius} !important;\n}`;
}

/** Keeps GNOME Shell surface rounding aligned with managed windows. */
export class ShellRounding {
    private enabled = false;
    private stylesheet: any | null = null;

    enable(radius: number) {
        this.enabled = true;

        if (!this.stylesheet) {
            const [stylesheet, stream] = Gio.File.new_tmp('itero-wm-shell-rounding-XXXXXX');
            stream.close(null);
            this.stylesheet = stylesheet;
        }

        this.refresh(radius);
    }

    disable() {
        this.enabled = false;
        if (!this.stylesheet) return;

        try {
            const theme_context = St.ThemeContext.get_for_stage(global.stage);
            const theme = theme_context.get_theme();
            if (theme) {
                theme.unload_stylesheet(this.stylesheet);
                theme_context.set_theme(theme);
            }
            this.stylesheet.delete(null);
        } catch (error) {
            log.error(`failed to remove shell rounding stylesheet: ${error}`);
        } finally {
            this.stylesheet = null;
        }
    }

    refresh(radius: number) {
        if (!this.enabled || !this.stylesheet) return;

        try {
            const theme_context = St.ThemeContext.get_for_stage(global.stage);
            const theme = theme_context.get_theme();
            if (!theme) return;

            theme.unload_stylesheet(this.stylesheet);
            const value = `${radius}px`;
            const css = [
                radius_rule(ROUNDED_SELECTORS, value),
                radius_rule(SQUARE_SELECTORS, '0'),
                radius_rule(LEFT_ROUNDED_SELECTORS, `${value} 0 0 ${value}`),
                radius_rule(RIGHT_ROUNDED_SELECTORS, `0 ${value} ${value} 0`),
                radius_rule(TOP_ROUNDED_SELECTORS, `${value} ${value} 0 0`),
                radius_rule(BOTTOM_ROUNDED_SELECTORS, `0 0 ${value} ${value}`),
                radius_rule(FULL_RADIUS_OVERRIDE_SELECTORS, value),
            ].join('\n\n');
            this.stylesheet.replace_contents(css, null, false, Gio.FileCreateFlags.NONE, null);
            theme.load_stylesheet(this.stylesheet);
            theme_context.set_theme(theme);
        } catch (error) {
            log.error(`failed to update shell rounding stylesheet: ${error}`);
        }
    }
}
