import { useEffect, useMemo, useState } from "react";
import { createBoard, MINES, SIZE, toggleFlag, openCell, type Cell, type GameStatus } from "./game";

type Mode = "open" | "flag";

function App() {
  const [board, setBoard] = useState<Cell[][]>(() => createBoard());
  const [status, setStatus] = useState<GameStatus>("playing");
  const [mode, setMode] = useState<Mode>("open");
  const [firstMove, setFirstMove] = useState(true);
  const [elapsed, setElapsed] = useState(0);

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
    setMode("open");
    setFirstMove(true);
    setElapsed(0);
  }

  function handleCellClick(row: number, col: number) {
    if (status !== "playing") return;

    if (mode === "flag") {
      setBoard((current) => toggleFlag(current, row, col));
      return;
    }

    const result = openCell(board, row, col, firstMove);
    setBoard(result.board);
    setStatus(result.status);
    setFirstMove(result.firstMove);
  }

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

        <div
          className={`board ${status !== "playing" ? "finished" : ""}`}
          style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}
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

        <div className="message" aria-live="polite">
          {status === "playing" && firstMove && "最初のマスは安全です"}
          {status === "playing" && !firstMove && "爆弾を避けてすべての安全なマスを開こう"}
          {status === "cleared" && "クリアしました"}
          {status === "gameover" && "ゲームオーバー"}
        </div>

        <div className="controls">
          <button
            className={mode === "open" ? "active" : ""}
            onClick={() => setMode("open")}
          >
            開く
          </button>
          <button
            className={mode === "flag" ? "active" : ""}
            onClick={() => setMode("flag")}
          >
            旗を置く
          </button>
          <button onClick={reset}>リセット</button>
        </div>
      </section>
    </main>
  );
}

export default App;