import Gio from 'gi://Gio';

const IFACE: string = `<node>
  <interface name="io.itero.IteroWM">
    <method name="FocusLeft"/>
    <method name="FocusRight"/>
    <method name="FocusUp"/>
    <method name="FocusDown"/>
    <method name="WindowFocus">
        <arg type="(uu)" direction="in" name="window"/>
    </method>
    <method name="WindowList">
        <arg type="a((uu)sss)" direction="out" name="args"/>
    </method>
    <method name="WindowQuit">
        <arg type="(uu)" direction="in" name="window"/>
    </method>
  </interface>
</node>`;

export class Service {
    dbus: any;

    FocusLeft: () => void = () => {};
    FocusRight: () => void = () => {};
    FocusUp: () => void = () => {};
    FocusDown: () => void = () => {};
    WindowFocus: (window: [number, number]) => void = () => {};
    WindowList: () => Array<[[number, number], string, string, string]> = () => [];
    WindowQuit: (window: [number, number]) => void = () => {};

    constructor() {
        this.dbus = Gio.DBusExportedObject.wrapJSObject(IFACE, this);

        const onBusAcquired = (conn: any) => {
            this.dbus.export(conn, '/io/itero/IteroWM');
        };

        function onNameAcquired() {}

        function onNameLost() {}

        Gio.bus_own_name(Gio.BusType.SESSION, 'io.itero.IteroWM', Gio.BusNameOwnerFlags.NONE, onBusAcquired, onNameAcquired, onNameLost);
    }
}
