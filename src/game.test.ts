import { describe, expect, it } from "vitest";
import { createBoard, openCell, resetBoardForRetry } from "./game";

describe("openCell", () => {
  it("reveals only the triggered mine instead of all mines on a loss", () => {
    const board = createBoard(3, 3);
    board[1][1].mine = true;
    board[0][0].mine = true;

    const result = openCell(board, 1, 1, false, 2);

    expect(result.status).toBe("gameover");
    expect(result.board[1][1].open).toBe(true);
    expect(result.board[0][0].open).toBe(false);
  });

  it("reopens only the last triggered mine while keeping the rest of the opened board intact", () => {
    const board = createBoard(3, 3);
    board[0][0].mine = true;
    board[1][1].open = true;
    board[1][1].adjacent = 1;
    board[2][2].flagged = true;

    const next = resetBoardForRetry(board, { row: 0, col: 0 });

    expect(next[0][0].mine).toBe(true);
    expect(next[0][0].open).toBe(false);
    expect(next[1][1].open).toBe(true);
    expect(next[2][2].flagged).toBe(true);
  });
});
