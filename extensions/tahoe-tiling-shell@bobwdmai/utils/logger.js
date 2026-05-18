function rect_to_string(rect) {
  return `{x: ${rect.x}, y: ${rect.y}, width: ${rect.width}, height: ${rect.height}}`;
}
const logger = (prefix) => (...content) => console.log("[tilingshell]", `[${prefix}]`, ...content);
export {
  logger,
  rect_to_string
};
