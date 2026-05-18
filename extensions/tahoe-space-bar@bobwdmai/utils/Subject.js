export class Subject {
    get value() {
        return this._value;
    }
    constructor(value) {
        this._observers = [];
        this._value = value;
    }
    next(value) {
        this._value = value;
        for (const observer of this._observers) {
            observer(value);
        }
    }
    complete() {
        this._observers = [];
    }
    subscribe(callback) {
        this._observers.push(callback);
        callback(this._value);
    }
    unsubscribe(callback) {
        this._observers = this._observers.filter((cb) => cb !== callback);
    }
}
