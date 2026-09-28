import { useEffect, useMemo, useRef, useState } from "react";
import { COLS, createBoard, MINES, toggleFlag, openCell, type Cell, type GameStatus } from "./game";

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.5;
const BASE_CELL_SIZE = 28;

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function getTouchDistance(
  touchA: { clientX: number; clientY: number },
  touchB: { clientX: number; clientY: number }
) {
  return Math.hypot(touchA.clientX - touchB.clientX, touchA.clientY - touchB.clientY);
}

function App() {
  const [board, setBoard] = useState<Cell[][]>(() => createBoard());
  const [status, setStatus] = useState<GameStatus>("playing");
  const [firstMove, setFirstMove] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [zoom, setZoom] = useState(1);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const pinchDistanceRef = useRef<number | null>(null);

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

  function updateZoom(nextZoom: number) {
    setZoom(clampZoom(nextZoom));
  }

  function handleWheelZoom(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    updateZoom(zoom + delta);
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length === 2) {
      pinchDistanceRef.current = getTouchDistance(event.touches[0], event.touches[1]);
    }
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 2 || pinchDistanceRef.current === null) return;

    event.preventDefault();
    const nextDistance = getTouchDistance(event.touches[0], event.touches[1]);
    const ratio = nextDistance / pinchDistanceRef.current;
    pinchDistanceRef.current = nextDistance;
    updateZoom(zoom * ratio);
  }

  function handleTouchEnd() {
    pinchDistanceRef.current = null;
  }

  const cellSize = BASE_CELL_SIZE * zoom;

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

        <div className="toolbar">
          <div className="message" aria-live="polite">
            {status === "playing" && firstMove && "最初のマスは安全です"}
            {status === "playing" && !firstMove && "爆弾を避けてすべての安全なマスを開こう"}
            {status === "cleared" && "クリアしました"}
            {status === "gameover" && "ゲームオーバー"}
          </div>

          <div className="controls">
            <button onClick={reset}>リセット</button>
          </div>
        </div>

        <div
          className="board-scroll"
          onWheel={handleWheelZoom}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className={`board ${status !== "playing" ? "finished" : ""}`}
            style={{ gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)` }}
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
                  style={{
                    width: `${cellSize}px`,
                    height: `${cellSize}px`,
                    minWidth: `${cellSize}px`,
                    minHeight: `${cellSize}px`,
                    fontSize: `${Math.max(12, 16 * zoom)}px`,
                  }}
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
      </section>
    </main>
  );
}

export default App;