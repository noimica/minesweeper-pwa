import { solvePublicBoard, type PublicBoard } from "./ConstraintSolver";

export function solveBoardState(board: PublicBoard) {
  return solvePublicBoard(board);
}
