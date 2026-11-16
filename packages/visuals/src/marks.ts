// The entry `@mark1russell7/visuals/marks`: the marks that a viewer draws, as plain data. It imports no three.js.
export { DIRECTION_TOLERANCE, MARK_FAULT_CODES, checkMarks, type MarkFault, type MarkFaultCode } from "./marks/check.ts";
export { LEVELS, LEVEL_SHAPES, SHAPE_OUTLINES, levelRank, levelShape, shapeRing, type Level, type LevelShape, type ShapeOutline } from "./marks/levels.ts";
export {
  MARK_TYPES,
  fieldCellCenter,
  fieldRowStep,
  fieldValue,
  type FieldMark,
  type FieldScale,
  type Frame,
  type LinkEnd,
  type LinkMark,
  type Mark,
  type MarkBase,
  type MarkType,
  type MeterMark,
  type PointMark,
  type RunMark,
} from "./marks/mark.ts";
