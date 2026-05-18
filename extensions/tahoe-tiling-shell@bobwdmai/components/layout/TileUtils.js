import Tile from "./Tile.js";
import { buildRectangle } from "../../utils/ui.js";

class TileUtils {
  static apply_props(tile, container) {
    return buildRectangle({
      x: Math.round(container.width * tile.x + container.x),
      y: Math.round(container.height * tile.y + container.y),
      width: Math.round(container.width * tile.width),
      height: Math.round(container.height * tile.height)
    });
  }

  static apply_props_relative_to(tile, container) {
    return buildRectangle({
      x: Math.round(container.width * tile.x),
      y: Math.round(container.height * tile.y),
      width: Math.round(container.width * tile.width),
      height: Math.round(container.height * tile.height)
    });
  }

  static build_tile(rect, container) {
    return new Tile({
      x: (rect.x - container.x) / container.width,
      y: (rect.y - container.y) / container.height,
      width: rect.width / container.width,
      height: rect.height / container.height,
      groups: []
    });
  }
}

export {
  TileUtils as default
};
