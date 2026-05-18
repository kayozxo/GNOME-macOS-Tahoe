import { GObject } from "../gi/ext.js";

function registerGObjectClass(target, metaInfo = {}) {
  if (!metaInfo.GTypeName) {
    metaInfo.GTypeName = `TilingShell${target.name}`;
  }
  return GObject.registerClass(metaInfo, target);
}
export {
  registerGObjectClass
};
