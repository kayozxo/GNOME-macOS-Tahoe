import { Settings } from './Settings.js';
export class WorkspaceNames {
    static init(workspaces) {
        this._instance = new WorkspaceNames(workspaces);
        return this._instance;
    }
    static getInstance() {
        return this._instance;
    }
    constructor(_ws) {
        this._ws = _ws;
        this._settings = Settings.getInstance();
    }
    insert(index) {
        const workspaceNames = this._getNames();
        if (index < workspaceNames.length) {
            workspaceNames.splice(index, 0, '');
        }
        else {
            setArrayValue(workspaceNames, index, '');
        }
        this._setNames(workspaceNames);
    }
    /**
     * Reorders workspace names according to the given map.
     *
     * Has the possibility to insert and to remove workspaces.
     *
     * @param reorderMap array where keys are new indexes and values are old indexes of workspaces
     */
    reorder(reorderMap) {
        const oldWorkspaceNames = this._getNames();
        const newWorkspaceNames = [];
        for (const [newIndex, oldIndex] of reorderMap.entries()) {
            if (oldIndex >= 0) {
                newWorkspaceNames[newIndex] = oldWorkspaceNames[oldIndex] ?? '';
            }
            else {
                newWorkspaceNames[newIndex] = '';
            }
        }
        this._setNames(newWorkspaceNames);
    }
    remove(index) {
        const workspaceNames = this._getNames();
        workspaceNames.splice(index, 1);
        this._setNames(workspaceNames);
    }
    rename(index, newName) {
        let workspaceNames = this._getNames();
        setArrayValue(workspaceNames, index, newName);
        this._setNames(workspaceNames);
        if (this._settings.smartWorkspaceNames.value && newName) {
            this._saveSmartWorkspaceName(index, newName);
        }
    }
    restoreSmartWorkspaceName(index) {
        const windowNames = this._getWindowNames(index);
        const workspacesNamesMap = this._settings.workspaceNamesMap.value;
        // Loop through windows on the workspace.
        for (const windowName of windowNames) {
            // Find the first associated name that is not already in use.
            if (workspacesNamesMap[windowName]?.length > 0) {
                const newName = workspacesNamesMap[windowName].find((name) => !this._getEnabledWorkspaceNames().includes(name));
                if (newName) {
                    let workspaceNames = this._getNames();
                    while (workspaceNames.length < index) {
                        workspaceNames.push('');
                    }
                    workspaceNames[index] = newName;
                    this._setNames(workspaceNames);
                    return;
                }
            }
        }
    }
    workspaceNameIsSupportedByWindows(workspace) {
        const windowNames = this._getWindowNames(workspace.index);
        const workspacesNamesMap = this._settings.workspaceNamesMap.value;
        for (const windowName of windowNames) {
            if (workspacesNamesMap[windowName]?.some((name) => name === workspace.name)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Associates windows on a workspace with a new workspace name.
     */
    _saveSmartWorkspaceName(index, newName) {
        const windowNames = this._getWindowNames(index);
        const workspacesNamesMap = this._settings.workspaceNamesMap.value;
        for (const windowName of windowNames) {
            workspacesNamesMap[windowName] = [
                ...(workspacesNamesMap[windowName] ?? []).filter((name) => 
                // We add `newName` at the end
                name !== newName &&
                    // Keep associations with other currently enabled workspaces and drop others
                    this._getEnabledWorkspaceNames().includes(name)),
                newName,
            ];
        }
        this._settings.workspaceNamesMap.value = workspacesNamesMap;
    }
    _getWindowNames(workspaceIndex) {
        const workspace = global.workspace_manager.get_workspace_by_index(workspaceIndex);
        let windows = workspace.list_windows();
        windows = windows.filter((window) => !window.is_on_all_workspaces());
        return windows
            .map((window) => window.get_wm_class())
            .filter((wmClass) => wmClass !== null);
    }
    _getNames() {
        return [...this._settings.workspaceNames.value];
    }
    _setNames(names) {
        while (names[names.length - 1] === '') {
            names.pop();
        }
        this._settings.workspaceNames.value = names;
    }
    _getEnabledWorkspaceNames() {
        return this._getNames().filter((_, index) => index < this._ws.numberOfEnabledWorkspaces);
    }
}
/**
 * Sets the array's value at the given index, padding any missing elements so all elements have
 * valid values.
 */
function setArrayValue(array, index, value) {
    while (array.length < index) {
        array.push('');
    }
    array[index] = value;
}
