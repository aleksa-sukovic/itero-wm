import * as log from './log.js';

import Gio from 'gi://Gio';
import St from 'gi://St';

const SURFACE_SELECTORS = [
    '.app-folder-dialog',
    '.candidate-popup-content',
    '.datemenu-popover',
    '.modal-dialog',
    '.notification-banner',
    '.osd-window',
    '.popup-menu-content',
    '.quick-settings',
    '.resize-popup',
    '.screenshot-ui-panel',
    '.switcher-list',
    '.workspace-switcher',
    '#LookingGlassDialog',
];

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
            const css = `${SURFACE_SELECTORS.join(',\n')} {\n    border-radius: ${radius}px;\n}\n`;
            this.stylesheet.replace_contents(css, null, false, Gio.FileCreateFlags.NONE, null);
            theme.load_stylesheet(this.stylesheet);
            theme_context.set_theme(theme);
        } catch (error) {
            log.error(`failed to update shell rounding stylesheet: ${error}`);
        }
    }
}
