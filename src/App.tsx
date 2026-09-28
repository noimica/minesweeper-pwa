import { useEffect, useMemo, useRef, useState } from "react";
import { COLS, createBoard, MINES, toggleFlag, openCell, type Cell, type GameStatus } from "./game";

function App() {
  const [board, setBoard] = useState<Cell[][]>(() => createBoard());
  const [status, setStatus] = useState<GameStatus>("playing");
  const [firstMove, setFirstMove] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  const flags = useMemo(
    () => board.flat().filter((cell) => cell.flagged).length,
    [board]
  );

  useEffect(() => {
    if (status !== "playing" || firstMove) return;
    const id = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, [status, firstMove]);

  function reset() {
    setBoard(createBoard());
    setStatus("playing");
    setFirstMove(true);
    setElapsed(0);
  }

  function clearLongPress() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handleCellClick(row: number, col: number) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    if (status !== "playing") return;

    const result = openCell(board, row, col, firstMove);
    setBoard(result.board);
    setStatus(result.status);
    setFirstMove(result.firstMove);
  }

  function handleCellContextMenu(
    event: React.MouseEvent<HTMLButtonElement>,
    row: number,
    col: number
  ) {
    event.preventDefault();
    if (status !== "playing") return;

    setBoard((current) => toggleFlag(current, row, col));
  }

  function handleLongPressStart(row: number, col: number) {
    clearLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = true;
      setBoard((current) => {
        const target = current[row][col];
        if (target.open) return current;
        return toggleFlag(current, row, col);
      });
      clearLongPress();
    }, 400);
  }

  useEffect(() => {
    return () => clearLongPress();
  }, []);

  function formatTime(seconds: number) {
    return String(seconds).padStart(3, "0");
  }

  return (
    <main className="app">
      <section className="game">
        <header className="header">
          <h1>マインスイーパー</h1>

          <div className="status">
            <div>
              <span className="label">爆弾</span>
              <strong>{MINES - flags}</strong>
            </div>
            <div>
              <span className="label">時間</span>
              <strong>{formatTime(elapsed)}</strong>
            </div>
          </div>
        </header>

        <div className="board-scroll">
          <div
            className={`board ${status !== "playing" ? "finished" : ""}`}
            style={{ gridTemplateColumns: `repeat(${COLS}, 28px)` }}
            aria-label="マインスイーパー盤面"
          >
            {board.map((line, row) =>
              line.map((cell, col) => (
                <button
                  key={`${row}-${col}`}
                  className={[
                    "cell",
                    cell.open ? "open" : "closed",
                    cell.flagged ? "flagged" : "",
                    cell.mine && cell.open ? "mine" : "",
                    cell.open && cell.adjacent > 0 ? `number-${cell.adjacent}` : "",
                  ].join(" ")}
                  onClick={() => handleCellClick(row, col)}
                  onContextMenu={(event) => handleCellContextMenu(event, row, col)}
                  onPointerDown={() => handleLongPressStart(row, col)}
                  onPointerUp={clearLongPress}
                  onPointerLeave={clearLongPress}
                  onPointerCancel={clearLongPress}
                  aria-label={`行${row + 1}列${col + 1}`}
                >
                  {cell.open
                    ? cell.mine
                      ? "●"
                      : cell.adjacent > 0
                        ? cell.adjacent
                        : ""
                    : cell.flagged
                      ? "⚑"
                      : ""}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="message" aria-live="polite">
          {status === "playing" && firstMove && "最初のマスは安全です"}
          {status === "playing" && !firstMove && "爆弾を避けてすべての安全なマスを開こう"}
          {status === "cleared" && "クリアしました"}
          {status === "gameover" && "ゲームオーバー"}
        </div>

        <div className="controls">
          <button onClick={reset}>リセット</button>
        </div>
      </section>
    </main>
  );
}

export default App;