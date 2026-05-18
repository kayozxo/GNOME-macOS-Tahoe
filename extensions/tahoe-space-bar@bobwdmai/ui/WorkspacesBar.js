import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { WindowPreview } from 'resource:///org/gnome/shell/ui/windowPreview.js';
import { Settings } from '../services/Settings.js';
import { Styles } from '../services/Styles.js';
import { Workspaces } from '../services/Workspaces.js';
import { Subject } from '../utils/Subject.js';
import { Timeout } from '../utils/Timeout.js';
import { WorkspacesBarMenu } from './WorkspacesBarMenu.js';
/**
 * Maximum number of milliseconds between button press and button release to be recognized as click.
 */
const MAX_CLICK_TIME_DELTA = 300;
/**
 * Time in milliseconds until a touch event is recognized as long press.
 */
const LONG_PRESS_DURATION = 500;
export class WorkspacesBar {
    constructor(_extension) {
        this._extension = _extension;
        this._name = `${this._extension.metadata.name}`;
        this._settings = Settings.getInstance();
        this._styles = Styles.getInstance();
        this._ws = Workspaces.getInstance();
        this._buttonSubject = new Subject(null);
        this._dragHandler = new WorkspacesBarDragHandler(() => this._updateWorkspaces());
        this._touchTimeout = new Timeout();
    }
    init() {
        this._initButton();
        this._initMenu();
        this._ws.onUpdate(() => this._updateWorkspaces());
        this._styles.onWorkspacesBarChanged(() => this._refreshTopBarConfiguration());
        this._styles.onWorkspaceLabelsChanged(() => this._updateWorkspaces());
        this._settings.alwaysShowNumbers.subscribe(() => this._updateWorkspaces());
        this._settings.enableCustomLabel.subscribe(() => this._updateWorkspaces());
        this._settings.customLabelNamed.subscribe(() => this._updateWorkspaces());
        this._settings.customLabelUnnamed.subscribe(() => this._updateWorkspaces());
        this._settings.indicatorStyle.subscribe(() => this._refreshTopBarConfiguration());
        this._settings.position.subscribe(() => this._refreshTopBarConfiguration());
        this._settings.positionIndex.subscribe(() => this._refreshTopBarConfiguration());
    }
    destroy() {
        this._button.destroy();
        this._menu.destroy();
        this._dragHandler.destroy();
        this._buttonSubject.complete();
        this._touchTimeout.destroy();
    }
    observeWidget() {
        return this._buttonSubject;
    }
    _refreshTopBarConfiguration() {
        this._button.destroy();
        this._menu.destroy();
        this._initButton();
        this._initMenu();
    }
    _initButton() {
        this._button = new WorkspacesButton(0.5, this._name);
        this._buttonSubject.next(this._button);
        this._button.styleClass = 'panel-button space-bar';
        switch (this._settings.indicatorStyle.value) {
            case 'current-workspace':
                this._initWorkspaceLabel();
                break;
            case 'workspaces-bar':
                this._initWorkspacesBar();
                break;
        }
        Main.panel.addToStatusArea(this._name, this._button, this._settings.positionIndex.value, this._settings.position.value);
        this._updateWorkspaces();
    }
    _initMenu() {
        this._menu = new WorkspacesBarMenu(this._extension, this._button.menu);
        this._menu.init();
    }
    _initWorkspaceLabel() {
        this._button.styleClass += ' workspace-label';
        this._wsLabel = new St.Label({
            yAlign: Clutter.ActorAlign.CENTER,
        });
        this._button.add_child(this._wsLabel);
        this._button.connect('button-press-event', (actor, event) => {
            switch (event.get_button()) {
                case 1:
                    if (this._settings.toggleOverview.value) {
                        Main.overview.toggle();
                    }
                    else {
                        this._button.menu.toggle();
                    }
                    return Clutter.EVENT_STOP;
                case 3:
                    this._button.menu.toggle();
                    return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }
    _initWorkspacesBar() {
        this._button._delegate = this._dragHandler;
        this._button.trackHover = false;
        this._wsBar = new St.BoxLayout({});
        this._button.add_child(this._wsBar);
    }
    _updateWorkspaces() {
        switch (this._settings.indicatorStyle.value) {
            case 'current-workspace':
                this._updateWorkspaceLabel();
                break;
            case 'workspaces-bar':
                this._updateWorkspacesBar();
                break;
        }
    }
    _updateWorkspaceLabel() {
        const workspace = this._ws.workspaces[this._ws.currentIndex];
        this._wsLabel.set_text(this._ws.getDisplayName(workspace));
    }
    _updateWorkspacesBar() {
        // destroy old workspaces bar buttons
        this._wsBar.destroy_all_children();
        this._dragHandler.wsBoxes = [];
        // display all current workspaces buttons
        for (let ws_index = 0; ws_index < this._ws.numberOfEnabledWorkspaces; ++ws_index) {
            const workspace = this._ws.workspaces[ws_index];
            if (workspace.isVisible) {
                const wsBox = this._createWsBox(workspace);
                this._wsBar.add_child(wsBox);
                this._dragHandler.wsBoxes.push({ workspace, wsBox });
            }
        }
    }
    _createWsBox(workspace) {
        const wsBox = new St.Bin({
            visible: true,
            reactive: true,
            canFocus: true,
            trackHover: true,
            styleClass: `workspace-box workspace-box-${workspace.index + 1}`,
        });
        wsBox._delegate = new WorkspaceBoxDragHandler(workspace);
        const label = this._createLabel(workspace);
        wsBox.set_child(label);
        let lastButton1PressEvent;
        wsBox.connect('button-press-event', (actor, event) => {
            switch (event.get_button()) {
                case 1:
                    lastButton1PressEvent = event;
                    break;
                case 3:
                    this._button.menu.toggle();
                    break;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        // Activate workspaces on button release to not interfere with drag and drop, but make sure
        // we saw a corresponding button-press event to avoid activating workspaces when the click
        // already triggered another action like closing a menu.
        wsBox.connect('button-release-event', (actor, event) => {
            switch (event.get_button()) {
                case 1:
                    if (lastButton1PressEvent) {
                        const timeDelta = event.get_time() - lastButton1PressEvent.get_time();
                        if (timeDelta <= MAX_CLICK_TIME_DELTA) {
                            this._ws.switchTo(workspace.index, 'click-on-label');
                        }
                        lastButton1PressEvent = null;
                    }
                    break;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        let lastTouchBeginEvent;
        wsBox.connect('touch-event', (actor, event) => {
            switch (event.type()) {
                case Clutter.EventType.TOUCH_BEGIN:
                    lastTouchBeginEvent = event;
                    this._touchTimeout
                        .once(LONG_PRESS_DURATION)
                        .then(() => this._button.menu.toggle());
                    break;
                case Clutter.EventType.TOUCH_END:
                    if (lastTouchBeginEvent) {
                        const timeDelta = event.get_time() - lastTouchBeginEvent.get_time();
                        if (timeDelta <= MAX_CLICK_TIME_DELTA) {
                            this._ws.switchTo(workspace.index, 'click-on-label');
                        }
                        lastTouchBeginEvent = null;
                    }
                    this._touchTimeout.clearTimeout();
                    break;
                case Clutter.EventType.TOUCH_CANCEL:
                    this._touchTimeout.clearTimeout();
                    break;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        this._dragHandler.setupDnd(wsBox, workspace, {
            onDragStart: () => this._touchTimeout.clearTimeout(),
        });
        return wsBox;
    }
    _createLabel(workspace) {
        const label = new St.Label({
            yAlign: Clutter.ActorAlign.CENTER,
            styleClass: 'space-bar-workspace-label',
        });
        if (workspace.index == this._ws.currentIndex) {
            label.styleClass += ' active';
        }
        else {
            label.styleClass += ' inactive';
        }
        if (workspace.hasWindows) {
            label.styleClass += ' nonempty';
        }
        else {
            label.styleClass += ' empty';
        }
        const text = this._ws.getDisplayName(workspace);
        label.set_text(text);
        if (text.trim() === '') {
            label.styleClass += ' no-text';
        }
        return label;
    }
}
var WorkspacesButton = GObject.registerClass(class WorkspacesButton extends PanelMenu.Button {
    vfunc_event() {
        return Clutter.EVENT_PROPAGATE;
    }
});
class WorkspacesBarDragHandler {
    constructor(_updateWorkspaces) {
        this._updateWorkspaces = _updateWorkspaces;
        this.wsBoxes = [];
        this._ws = Workspaces.getInstance();
        this._barWidthAtDragStart = null;
        this._hasLeftInitialPosition = false;
        this._workspacesBarOffset = null;
    }
    destroy() {
        this._setDragMonitor(false);
    }
    setupDnd(wsBox, workspace, hooks) {
        const draggable = DND.makeDraggable(wsBox, {});
        draggable.connect('drag-begin', () => {
            this._onDragStart(wsBox, workspace);
            hooks.onDragStart();
        });
        draggable.connect('drag-cancelled', () => {
            this._updateDragPlaceholder(this._initialDropPosition);
            this._onDragFinished(wsBox);
        });
        draggable.connect('drag-end', () => {
            this._updateWorkspaces();
        });
    }
    acceptDrop(source, actor, x, y) {
        if (source instanceof WorkspaceBoxDragHandler) {
            const dropPosition = this._getDropPosition();
            if (dropPosition) {
                if (this._draggedWorkspace.index !== dropPosition?.index) {
                    this._ws.reorderWorkspace(this._draggedWorkspace.index, dropPosition?.index);
                }
            }
            this._updateWorkspaces();
            this._onDragFinished(actor);
            return true;
        }
        else {
            return false;
        }
    }
    handleDragOver(source) {
        if (source instanceof WorkspaceBoxDragHandler) {
            const dropPosition = this._getDropPosition();
            this._updateDragPlaceholder(dropPosition);
        }
        return DND.DragMotionResult.CONTINUE;
    }
    _onDragStart(wsBox, workspace) {
        wsBox.add_style_class_name('dragging');
        this._draggedWorkspace = workspace;
        this._setDragMonitor(true);
        this._barWidthAtDragStart = this._getBarWidth();
        this._setUpBoxPositions(wsBox, workspace);
    }
    _onDragFinished(wsBox) {
        wsBox.remove_style_class_name('dragging');
        this._draggedWorkspace = null;
        this._wsBoxPositions = null;
        this._initialDropPosition = null;
        this._hasLeftInitialPosition = false;
        this._barWidthAtDragStart = null;
        this._setDragMonitor(false);
    }
    _setDragMonitor(add) {
        if (add) {
            this._dragMonitor = {
                dragMotion: this._onDragMotion.bind(this),
            };
            DND.addDragMonitor(this._dragMonitor);
        }
        else if (this._dragMonitor) {
            DND.removeDragMonitor(this._dragMonitor);
        }
    }
    _onDragMotion(dragEvent) {
        this._updateDragPlaceholder(this._initialDropPosition);
        return DND.DragMotionResult.CONTINUE;
    }
    _setUpBoxPositions(wsBox, workspace) {
        const boxIndex = this.wsBoxes.findIndex((box) => box.workspace === workspace);
        this._wsBoxPositions = this._getWsBoxPositions(boxIndex, wsBox.get_width());
        this._initialDropPosition = this._getDropPosition();
        this._updateDragPlaceholder(this._initialDropPosition);
    }
    _getDropPosition() {
        const draggedWsBox = this.wsBoxes.find(({ workspace }) => workspace === this._draggedWorkspace)?.wsBox;
        for (const { index, center, wsBox } of this._wsBoxPositions) {
            if (draggedWsBox.get_x() < center + this._getWorkspacesBarOffset()) {
                return { index, wsBox, position: 'before', width: draggedWsBox.get_width() };
            }
        }
        if (this._wsBoxPositions.length > 0) {
            const lastWsBox = this._wsBoxPositions[this._wsBoxPositions.length - 1].wsBox;
            return {
                index: this._ws.lastVisibleWorkspace,
                wsBox: lastWsBox,
                position: 'after',
                width: draggedWsBox.get_width(),
            };
        }
    }
    _getWsBoxPositions(draggedBoxIndex, draggedBoxWidth) {
        const positions = this.wsBoxes
            .filter(({ workspace }) => workspace !== this._draggedWorkspace)
            .map(({ workspace, wsBox }) => ({
            index: getDropIndex(this._draggedWorkspace, workspace),
            center: getHorizontalCenter(wsBox),
            wsBox,
        }));
        positions.forEach((position, index) => {
            if (index >= draggedBoxIndex) {
                position.center -= draggedBoxWidth;
            }
        });
        return positions;
    }
    _updateDragPlaceholder(dropPosition) {
        if (dropPosition?.index === this._initialDropPosition?.index &&
            dropPosition?.position === this._initialDropPosition?.position) {
            if (!this._getHasLeftInitialPosition()) {
                return;
            }
        }
        else {
            this._hasLeftInitialPosition = true;
        }
        for (const { wsBox } of this.wsBoxes) {
            if (wsBox === dropPosition?.wsBox) {
                if (dropPosition.position === 'before') {
                    wsBox?.set_style('margin-left: ' + dropPosition.width + 'px');
                }
                else {
                    wsBox?.set_style('margin-right: ' + dropPosition.width + 'px');
                }
            }
            else {
                wsBox.set_style(null);
            }
        }
    }
    _getBarWidth() {
        return this.wsBoxes[0].wsBox.get_parent().get_width();
    }
    _getHasLeftInitialPosition() {
        if (this._hasLeftInitialPosition) {
            return true;
        }
        if (this._barWidthAtDragStart !== this._getBarWidth()) {
            this._hasLeftInitialPosition = true;
        }
        return this._hasLeftInitialPosition;
    }
    _getWorkspacesBarOffset() {
        if (this._workspacesBarOffset === null) {
            this._workspacesBarOffset = 0;
            let widget = this.wsBoxes[0].wsBox.get_parent();
            while (widget) {
                this._workspacesBarOffset += widget.get_x();
                widget = widget.get_parent();
            }
        }
        return this._workspacesBarOffset;
    }
}
class WorkspaceBoxDragHandler {
    constructor(_workspace) {
        this._workspace = _workspace;
    }
    acceptDrop(source) {
        if (source instanceof WindowPreview) {
            source.metaWindow.change_workspace_by_index(this._workspace.index, false);
        }
    }
    handleDragOver(source) {
        if (source instanceof WindowPreview) {
            return DND.DragMotionResult.MOVE_DROP;
        }
        else {
            return DND.DragMotionResult.CONTINUE;
        }
    }
}
function getDropIndex(draggedWorkspace, workspace) {
    if (draggedWorkspace.index < workspace.index) {
        return workspace.index - 1;
    }
    else {
        return workspace.index;
    }
}
function getHorizontalCenter(widget) {
    return widget.get_x() + widget.get_width() / 2;
}
