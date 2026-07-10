# Itero WM

Itero WM is a GNOME Shell tiling window manager extension used by [Itero](https://github.com/aleksa-sukovic/itero).
It is derived from [System76 Pop Shell](https://github.com/pop-os/shell) and keeps the same keyboard-driven tiling foundation while carrying Itero-specific defaults, branding, and changes.

## Attribution and License

This project is based on Pop Shell by System76 and Pop Shell contributors. Their copyright notices and the original license are preserved in this repository.

Itero WM remains open source under the same license terms as the upstream project. See [LICENSE](./LICENSE) and [debian/copyright](./debian/copyright) for details.

## Changes From Upstream

- Rebranded GNOME extension ID, settings schema, dconf path, config directory, settings titles, CSS classes, and extension metadata for Itero WM.
- `Super+f` maximizes the focused window while respecting outer gaps.
- `disable_active_border_on_float` suppresses the active hint border for matching floating window rules.
- `Super+Shift+m` toggles the GNOME top bar.
- `make reload-extension` reloads the extension on Wayland without logging out.

## GNOME integration

- Extension UUID: `itero-wm@itero`
- Settings schema: `org.gnome.shell.extensions.itero-wm`
- Dconf path: `/org/gnome/shell/extensions/itero-wm/`
- Config file: `$XDG_CONFIG_HOME/itero-wm/config.json`

## Development

```bash
make
make install
make reload-extension
```

To sync upstream changes:

```bash
git remote add upstream https://github.com/pop-os/shell.git
git fetch upstream
git merge upstream/master_noble
git push origin master
```
