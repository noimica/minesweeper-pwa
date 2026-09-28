export type Cell = {
  mine: boolean;
  open: boolean;
  flagged: boolean;
  adjacent: number;
};

export type GameStatus = "playing" | "cleared" | "gameover";

export const ROWS = 24;
export const COLS = 48;
export const SIZE = ROWS;
export const MINES = 10;

const directions = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
] as const;

export function createBoard(): Cell[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      mine: false,
      open: false,
      flagged: false,
      adjacent: 0,
    }))
  );
}

function neighbors(row: number, col: number, board: Cell[][]) {
  const rowCount = board.length;
  const colCount = board[0]?.length ?? 0;

  return directions
    .map(([dr, dc]) => [row + dr, col + dc] as const)
    .filter(([r, c]) => r >= 0 && r < rowCount && c >= 0 && c < colCount);
}

function placeMines(board: Cell[][], safeRow: number, safeCol: number) {
  const candidates: [number, number][] = [];
  const rowCount = board.length;
  const colCount = board[0]?.length ?? 0;

  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      const isSafe = Math.abs(r - safeRow) <= 1 && Math.abs(c - safeCol) <= 1;
      if (!isSafe) candidates.push([r, c]);
    }
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  for (let i = 0; i < MINES; i++) {
    const [r, c] = candidates[i];
    board[r][c].mine = true;
  }

  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      board[r][c].adjacent = neighbors(r, c, board)
        .filter(([nr, nc]) => board[nr][nc].mine).length;
    }
  }
}

export function openCell(
  board: Cell[][],
  row: number,
  col: number,
  firstMove: boolean
): { board: Cell[][]; status: GameStatus; firstMove: boolean } {
  const next = board.map((line) => line.map((cell) => ({ ...cell })));

  if (firstMove) {
    placeMines(next, row, col);
  }

  const cell = next[row][col];
  if (cell.flagged || cell.open) {
    return { board: next, status: "playing", firstMove: false };
  }

  if (cell.mine) {
    for (const line of next) {
      for (const c of line) {
        if (c.mine) c.open = true;
      }
    }
    return { board: next, status: "gameover", firstMove: false };
  }

  const queue: [number, number][] = [[row, col]];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    const key = `${r},${c}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const current = next[r][c];
    if (current.flagged || current.mine) continue;

    current.open = true;

    if (current.adjacent === 0) {
      for (const [nr, nc] of neighbors(r, c, next)) {
        if (!next[nr][nc].open && !next[nr][nc].mine) {
          queue.push([nr, nc]);
        }
      }
    }
  }

  const safeRemaining = next.some((line) =>
    line.some((c) => !c.mine && !c.open)
  );

  return {
    board: next,
    status: safeRemaining ? "playing" : "cleared",
    firstMove: false,
  };
}

export function toggleFlag(board: Cell[][], row: number, col: number): Cell[][] {
  return board.map((line, r) =>
    line.map((cell, c) =>
      r === row && c === col && !cell.open
        ? { ...cell, flagged: !cell.flagged }
        : { ...cell }
    )
  );
}