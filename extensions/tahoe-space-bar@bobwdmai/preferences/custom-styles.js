import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
export function addCustomCssDialogButton({ window, group, settings, }) {
    const row = new Adw.ActionRow({
        title: 'Custom styles',
        activatable: true,
        valign: Gtk.Align.CENTER,
    });
    group.add(row);
    const enabledLabel = buildEnabledLabel({ settings, window });
    row.add_suffix(enabledLabel);
    const icon = new Gtk.Image({ iconName: 'go-next-symbolic' });
    row.add_suffix(icon);
    row.connect('activated', () => showDialog({ window, settings }));
}
function buildEnabledLabel({ settings, window, }) {
    const enabledLabel = new Gtk.Label();
    function updateEnabledLabel() {
        if (settings.get_boolean('custom-styles-enabled')) {
            enabledLabel.set_label('On');
        }
        else {
            enabledLabel.set_label('Off');
        }
    }
    updateEnabledLabel();
    const changed = settings.connect('changed::custom-styles-enabled', updateEnabledLabel);
    window.connect('unmap', () => settings.disconnect(changed));
    return enabledLabel;
}
function showDialog({ window, settings, }) {
    const dialog = new Adw.Dialog({
        title: 'Custom Styles',
        contentWidth: 600,
        contentHeight: 2000,
    });
    const toastOverlay = new Adw.ToastOverlay();
    const toolbarView = new Adw.ToolbarView();
    toastOverlay.set_child(toolbarView);
    let savedCustomStyles = settings.get_string('custom-styles') ?? '';
    let textViewCustomStyles = savedCustomStyles;
    function updateApplyButton() {
        const hasChanged = textViewCustomStyles !== savedCustomStyles;
        applyButton.set_sensitive(hasChanged);
    }
    function customStylesChanged(text) {
        textViewCustomStyles = text;
        updateApplyButton();
    }
    const { headerBar, applyButton } = buildHeaderBar({
        settings,
        showAppStyles: () => {
            toolbarView.set_content(applicationStylesBox({ settings }));
        },
        showCustomStyles: () => {
            toolbarView.set_content(customStylesBox({ settings, customStylesChanged }));
        },
    });
    updateApplyButton();
    applyButton.connect('clicked', () => {
        const isEnabled = settings.get_boolean('custom-styles-enabled');
        settings.set_string('custom-styles', textViewCustomStyles);
        // In case of invalid styles, custom-styles-enabled will be set to false
        // automatically when setting custom-styles. Only enable if it was
        // previously disabled.
        if (!isEnabled) {
            settings.set_boolean('custom-styles-enabled', true);
        }
        savedCustomStyles = textViewCustomStyles;
        updateApplyButton();
    });
    toolbarView.add_top_bar(headerBar);
    toolbarView.set_content(customStylesBox({ settings, customStylesChanged }));
    const unregisterFailedToast = registerFailedToast({ toastOverlay, settings });
    dialog.connect('closed', unregisterFailedToast);
    dialog.set_child(toastOverlay);
    dialog.present(window);
}
function registerFailedToast({ toastOverlay, settings, }) {
    let toast;
    function showFailedToast() {
        toast?.dismiss();
        if (settings.get_boolean('custom-styles-failed')) {
            toast = new Adw.Toast({
                title: 'Failed to load styles. Custom styles have been disabled.',
                timeout: 3,
            });
            toastOverlay.add_toast(toast);
        }
    }
    const showFailedToastConnection = settings.connect(`changed::custom-styles-failed`, showFailedToast);
    return () => settings.disconnect(showFailedToastConnection);
}
function buildHeaderBar({ settings, showAppStyles, showCustomStyles, }) {
    const titleBox = new Gtk.Box({
        spacing: 6,
    });
    const appStylesButton = new Gtk.ToggleButton({
        label: 'Application Styles',
        cssClasses: ['flat'],
    });
    appStylesButton.connect('notify::active', (button) => button.active && showAppStyles());
    const customStylesButton = new Gtk.ToggleButton({
        label: 'Custom Styles',
        cssClasses: ['flat'],
        group: appStylesButton,
        active: true,
    });
    customStylesButton.connect('notify::active', (button) => button.active && showCustomStyles());
    titleBox.append(appStylesButton);
    titleBox.append(customStylesButton);
    const headerBar = new Adw.HeaderBar({
        titleWidget: titleBox,
    });
    const enabledToggle = new Gtk.Switch({
        active: settings.get_boolean('custom-styles-enabled'),
        marginStart: 12,
    });
    settings.bind('custom-styles-enabled', enabledToggle, 'active', Gio.SettingsBindFlags.DEFAULT);
    headerBar.pack_start(enabledToggle);
    const applyButton = new Gtk.Button({
        label: 'Apply',
        cssClasses: ['suggested-action'],
        marginEnd: 4,
    });
    headerBar.pack_end(applyButton);
    return { headerBar, applyButton };
}
function applicationStylesBox({ settings }) {
    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        halign: Gtk.Align.FILL,
        marginStart: 24,
        marginEnd: 24,
        marginTop: 12,
        marginBottom: 24,
    });
    const descriptionLabel = new Gtk.Label({
        label: "The application styles that are generated based on the extension's appearance preferences. " +
            'You cannot change these styles here, but you can override them with custom styles.',
        cssClasses: ['description_label'],
        wrap: true,
        marginBottom: 12,
        xalign: 0,
        naturalWrapMode: Gtk.NaturalWrapMode.NONE,
    });
    box.append(descriptionLabel);
    const frame = new Gtk.Frame({
        vexpand: true,
    });
    box.append(frame);
    const scrolled = new Gtk.ScrolledWindow({});
    frame.set_child(scrolled);
    const textView = new Gtk.TextView({
        editable: false,
        monospace: true,
        wrapMode: Gtk.WrapMode.WORD_CHAR,
        leftMargin: 12,
        rightMargin: 12,
        topMargin: 12,
        bottomMargin: 12,
    });
    scrolled.set_child(textView);
    const text = settings.get_string('application-styles') ?? '';
    textView.buffer.set_text(text, -1);
    return box;
}
function customStylesBox({ settings, customStylesChanged, }) {
    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        halign: Gtk.Align.FILL,
        marginStart: 24,
        marginEnd: 24,
        marginTop: 12,
        marginBottom: 24,
    });
    const descriptionLabel = new Gtk.Label({
        label: 'Add any custom styles to override application styles.',
        cssClasses: ['description_label'],
        wrap: true,
        marginBottom: 12,
        xalign: 0,
        naturalWrapMode: Gtk.NaturalWrapMode.NONE,
    });
    box.append(descriptionLabel);
    const frame = new Gtk.Frame({
        vexpand: true,
    });
    box.append(frame);
    const scrolled = new Gtk.ScrolledWindow({});
    frame.set_child(scrolled);
    const textView = new Gtk.TextView({
        editable: true,
        monospace: true,
        cursorVisible: true,
        wrapMode: Gtk.WrapMode.WORD_CHAR,
        leftMargin: 12,
        rightMargin: 12,
        topMargin: 12,
        bottomMargin: 12,
    });
    scrolled.set_child(textView);
    const initialText = settings.get_string('custom-styles') ?? '';
    textView.buffer.set_text(initialText, -1);
    textView.buffer.connect('changed', () => {
        const text = textView.buffer.get_text(textView.buffer.get_start_iter(), textView.buffer.get_end_iter(), false) ?? '';
        customStylesChanged(text);
    });
    return box;
}
