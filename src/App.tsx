import { useEffect, useMemo, useRef, useState } from "react";
import {
  clampBoardConfig,
  createBoard,
  DEFAULT_COLS,
  DEFAULT_MINES,
  DEFAULT_ROWS,
  toggleFlag,
  openCell,
  type BoardConfig,
  type Cell,
  type GameStatus,
} from "./game";

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.5;
const BASE_CELL_SIZE = 28;

const BOARD_PRESETS = [
  { label: "初級", rows: 16, cols: 16, mines: 10 },
  { label: "中級", rows: 16, cols: 30, mines: 99 },
  { label: "上級", rows: 48, cols: 24, mines: 256 },
] as const;

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
  const [settings, setSettings] = useState<BoardConfig>(() =>
    clampBoardConfig(DEFAULT_ROWS, DEFAULT_COLS, DEFAULT_MINES)
  );
  const [board, setBoard] = useState<Cell[][]>(() => createBoard(DEFAULT_ROWS, DEFAULT_COLS));
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

  function applyBoardSettings(nextSettings: BoardConfig) {
    const normalized = clampBoardConfig(nextSettings.rows, nextSettings.cols, nextSettings.mines);
    setSettings(normalized);
    setBoard(createBoard(normalized.rows, normalized.cols));
    setStatus("playing");
    setFirstMove(true);
    setElapsed(0);
  }

  function reset() {
    applyBoardSettings(settings);
  }

  function handleSettingChange(key: "rows" | "cols" | "mines", rawValue: string) {
    const nextValue = Number.parseInt(rawValue, 10);
    if (Number.isNaN(nextValue)) return;

    applyBoardSettings({
      ...settings,
      [key]: nextValue,
    });
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

    const result = openCell(board, row, col, firstMove, settings.mines);
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
  const remainingMines = Math.max(settings.mines - flags, 0);
  const activePreset = BOARD_PRESETS.find(
    (preset) =>
      preset.rows === settings.rows &&
      preset.cols === settings.cols &&
      preset.mines === settings.mines
  );

  return (
    <main className="app">
      <section className="game">
        <header className="header">
          <h1>マインスイーパー</h1>

          <div className="status">
            <div>
              <span className="label">爆弾</span>
              <strong>{remainingMines}</strong>
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

        <div className="settings" aria-label="盤面設定">
          <div className="preset-group" aria-label="難易度プリセット">
            {BOARD_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={['preset', activePreset?.label === preset.label ? 'active' : ''].join(' ')}
                onClick={() => applyBoardSettings(clampBoardConfig(preset.rows, preset.cols, preset.mines))}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <label className="field">
            <span>行</span>
            <input
              type="number"
              min={5}
              max={48}
              value={settings.rows}
              onChange={(event) => handleSettingChange("rows", event.target.value)}
            />
          </label>
          <label className="field">
            <span>列</span>
            <input
              type="number"
              min={5}
              max={48}
              value={settings.cols}
              onChange={(event) => handleSettingChange("cols", event.target.value)}
            />
          </label>
          <label className="field">
            <span>爆弾</span>
            <input
              type="number"
              min={1}
              max={Math.max(1, settings.rows * settings.cols - 9)}
              value={settings.mines}
              onChange={(event) => handleSettingChange("mines", event.target.value)}
            />
          </label>
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
            style={{ gridTemplateColumns: `repeat(${board[0]?.length ?? settings.cols}, ${cellSize}px)` }}
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