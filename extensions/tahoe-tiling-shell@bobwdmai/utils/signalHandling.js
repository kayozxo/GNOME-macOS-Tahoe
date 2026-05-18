class SignalHandling {
  _signalsIds;
  constructor() {
    this._signalsIds = {};
  }

  connect(obj, key, fun) {
    const signalId = obj.connect(key, fun);
    this._signalsIds[key] = { id: signalId, obj };
    return signalId;
  }

  disconnect(obj) {
    if (!obj) {
      const toDelete = [];
      Object.keys(this._signalsIds).forEach((key) => {
        this._signalsIds[key].obj.disconnect(this._signalsIds[key].id);
        toDelete.push(key);
      });
      const result = toDelete.length > 0;
      toDelete.forEach((key) => delete this._signalsIds[key]);
      return result;
    } else {
      const keyFound = Object.keys(this._signalsIds).find(
        (key) => this._signalsIds[key].obj === obj
      );
      if (keyFound) {
        obj.disconnect(this._signalsIds[keyFound].id);
        delete this._signalsIds[keyFound];
      }
      return keyFound;
    }
  }
}

export {
  SignalHandling as default
};
