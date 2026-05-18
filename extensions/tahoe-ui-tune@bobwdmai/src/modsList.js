import * as modScaleThumbnails from './modScaleThumbnails.js'
import * as modHideSearchInput from './modHideSearchInput.js'
import * as modRestoreThumbnailsBackground from './modRestoreThumbnailsBackground.js'
import * as modAlwaysShowThumbnails from './modAlwaysShowThumbnails.js'
import * as modFirefoxPipInOverview from './modFirefoxPipInOverview.js'

// This func can not be used from prefs.js due to mods being actually loaded when they're imported
export function get() {
    return {
        'increase-thumbnails-size': modScaleThumbnails.default,
        'hide-search': modHideSearchInput.default,
        'restore-thumbnails-background': modRestoreThumbnailsBackground.default,
        'always-show-thumbnails': modAlwaysShowThumbnails.default,
        'overview-firefox-pip': modFirefoxPipInOverview.default,
    }
}
