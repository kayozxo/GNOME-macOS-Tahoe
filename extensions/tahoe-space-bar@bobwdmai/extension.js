import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { KeyBindings } from './services/KeyBindings.js';
import { ScrollHandler } from './services/ScrollHandler.js';
import { Settings } from './services/Settings.js';
import { Styles } from './services/Styles.js';
import { TopBarAdjustments } from './services/TopBarAdjustments.js';
import { Workspaces } from './services/Workspaces.js';
import { WorkspacesBar } from './ui/WorkspacesBar.js';
import { destroyAllHooks } from './utils/hook.js';
export default class SpaceBarExtension extends Extension {
    constructor() {
        super(...arguments);
        this.workspacesBar = null;
        this.scrollHandler = null;
    }
    enable() {
        Settings.init(this);
        TopBarAdjustments.init();
        Workspaces.init();
        KeyBindings.init();
        Styles.init();
        this.workspacesBar = new WorkspacesBar(this);
        this.workspacesBar.init();
        this.scrollHandler = new ScrollHandler();
        this.scrollHandler.init(this.workspacesBar.observeWidget());
    }
    disable() {
        destroyAllHooks();
        Settings.destroy();
        TopBarAdjustments.destroy();
        Workspaces.destroy();
        KeyBindings.destroy();
        Styles.destroy();
        this.scrollHandler?.destroy();
        this.scrollHandler = null;
        this.workspacesBar?.destroy();
        this.workspacesBar = null;
    }
}
