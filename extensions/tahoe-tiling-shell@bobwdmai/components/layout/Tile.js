import { GObject } from "../../gi/shared.js";

class Tile {
  static $gtype = GObject.TYPE_JSOBJECT;
  x;
  y;
  width;
  height;
  groups;
  constructor({
    x,
    y,
    width,
    height,
    groups
  }) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.groups = groups;
  }
}

export {
  Tile as default
};
