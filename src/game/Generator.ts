import type { Cell, GameStatus } from "../game";
import { buildConstraintsFromPublicBoard, solvePublicBoard, type PublicBoard } from "./ConstraintSolver";

export type GenerateBoardOptions = {
  rows: number;
  cols: number;
  mines: number;
};

const directions = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
] as const;

function neighbors(row: number, col: number, rows: number, cols: number): [number, number][] {
  const result: [number, number][] = [];

  for (const [dr, dc] of directions) {
    const nextRow = row + dr;
    const nextCol = col + dc;
    if (nextRow >= 0 && nextRow < rows && nextCol >= 0 && nextCol < cols) {
      result.push([nextRow, nextCol]);
    }
  }

  return result;
}

function createEmptyBoard(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false,
      open: false,
      flagged: false,
      adjacent: 0,
    }))
  );
}

export function placeMines(board: Cell[][], safeRow: number, safeCol: number, mineCount: number): void {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const candidates: [number, number][] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const isSafeZone = Math.abs(row - safeRow) <= 1 && Math.abs(col - safeCol) <= 1;
      if (!isSafeZone) {
        candidates.push([row, col]);
      }
    }
  }

  for (let index = candidates.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }

  for (let index = 0; index < Math.min(mineCount, candidates.length); index++) {
    const [row, col] = candidates[index];
    board[row][col].mine = true;
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      board[row][col].adjacent = neighbors(row, col, rows, cols)
        .filter(([nr, nc]) => board[nr][nc].mine).length;
    }
  }
}

export function buildPublicBoardFromVisibleState(board: Cell[][]): PublicBoard {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const opened = board.map((line) => line.map((cell) => cell.open));
  const flagged = board.map((line) => line.map((cell) => cell.flagged));
  const numbers = board.map((line) => line.map((cell) => (cell.open ? cell.adjacent : 0)));

  return {
    rows,
    cols,
    mines: board.flat().filter((cell) => cell.mine).length,
    opened,
    flagged,
    numbers,
  };
}

export function revealSafeOpening(board: Cell[][], startRow: number, startCol: number): Cell[][] {
  const next = board.map((line) => line.map((cell) => ({ ...cell })));
  next[startRow][startCol].open = true;

  const queue: [number, number][] = [[startRow, startCol]];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const [row, col] = queue.shift()!;
    const key = `${row},${col}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const cell = next[row][col];
    if (cell.mine || cell.flagged) continue;
    cell.open = true;

    if (cell.adjacent === 0) {
      for (const [nr, nc] of neighbors(row, col, next.length, next[0].length)) {
        if (!next[nr][nc].open && !next[nr][nc].flagged && !next[nr][nc].mine) {
          queue.push([nr, nc]);
        }
      }
    }
  }

  return next;
}

export function generateSolvableBoard({ rows, cols, mines }: GenerateBoardOptions): Cell[][] {
  const maxAttempts = 500;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const board = createEmptyBoard(rows, cols);
    const safeRow = Math.floor(rows / 2);
    const safeCol = Math.floor(cols / 2);

    placeMines(board, safeRow, safeCol, mines);

    const openedBoard = revealSafeOpening(board, safeRow, safeCol);
    const publicBoard = buildPublicBoardFromVisibleState(openedBoard);
    const result = solvePublicBoard(publicBoard);

    if (result.type === "solved") {
      return board;
    }
  }

  throw new Error(`Could not generate a logically solvable board for ${rows}x${cols} with ${mines} mines.`);
}
