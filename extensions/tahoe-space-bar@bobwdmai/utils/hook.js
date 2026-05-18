let _destroyFunctions = [];
/**
 * Calls `callback` when the given upstream function gets called.
 */
export function hook(classObject, functionName, pos, callback) {
    const _originalFunction = classObject.prototype[functionName];
    if (pos === 'before') {
        classObject.prototype[functionName] = function (...args) {
            callback(this, ...args);
            _originalFunction.apply(this, args);
        };
    }
    else {
        classObject.prototype[functionName] = function (...args) {
            _originalFunction.apply(this, args);
            callback(this, ...args);
        };
    }
    _destroyFunctions.push(() => {
        classObject.prototype[functionName] = _originalFunction;
    });
}
export function destroyAllHooks() {
    for (const f of _destroyFunctions) {
        f();
    }
    _destroyFunctions = [];
}
