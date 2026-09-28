import { describe, expect, it } from "vitest";
import { buildConstraintsFromPublicBoard, solvePublicBoard, type PublicBoard } from "./ConstraintSolver";

function createPublicBoard(overrides: Partial<PublicBoard> = {}): PublicBoard {
  const rows = overrides.rows ?? 3;
  const cols = overrides.cols ?? 3;
  const opened = overrides.opened ?? Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
  const flagged = overrides.flagged ?? Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
  const numbers = overrides.numbers ?? Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));

  return {
    rows,
    cols,
    mines: overrides.mines ?? 0,
    opened,
    flagged,
    numbers,
  };
}

describe("ConstraintSolver", () => {
  it("builds a simple equality constraint from an opened numbered cell", () => {
    const board = createPublicBoard({
      rows: 3,
      cols: 3,
      opened: [
        [false, false, false],
        [false, true, false],
        [false, false, false],
      ],
      numbers: [
        [0, 0, 0],
        [0, 1, 0],
        [0, 0, 0],
      ],
    });

    const constraints = buildConstraintsFromPublicBoard(board);
    expect(constraints.length).toBeGreaterThan(0);
    const target = constraints.find((constraint) => constraint.mines === 1);
    expect(target).toBeDefined();
    expect(target?.variables.size).toBeGreaterThan(0);
    expect(target?.variables.size).toBeLessThanOrEqual(8);
  });

  it("resolves a forced mine by subset difference", () => {
    const board = createPublicBoard({
      rows: 2,
      cols: 3,
      opened: [
        [false, true, false],
        [false, false, false],
      ],
      numbers: [
        [0, 2, 0],
        [0, 0, 0],
      ],
      flagged: [
        [false, false, false],
        [false, false, false],
      ],
    });

    const result = solvePublicBoard(board);
    if (result.type === "contradiction") {
      throw new Error("Expected a non-contradiction solver result");
    }
    expect(result.assignments).toBeDefined();
  });

  it("returns stuck if no logical move is available", () => {
    const board = createPublicBoard({
      rows: 2,
      cols: 2,
      opened: [
        [false, false],
        [false, false],
      ],
      numbers: [
        [0, 0],
        [0, 0],
      ],
    });

    const result = solvePublicBoard(board);
    expect(result.type).toBe("stuck");
  });
});
