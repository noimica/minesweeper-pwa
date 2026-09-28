import { useEffect, useMemo, useRef, useState } from "react";
import {
  clampBoardConfig,
  createBoard,
  DEFAULT_COLS,
  DEFAULT_MINES,
  DEFAULT_ROWS,
  openCell,
  toggleFlag,
  type BoardConfig,
  type Cell,
  type GameStatus,
} from "./game";

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.5;
const BASE_CELL_SIZE = 32;

const PRESET_OPTIONS = [
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
  const initialConfig = useMemo(
    () => clampBoardConfig(DEFAULT_ROWS, DEFAULT_COLS, DEFAULT_MINES),
    []
  );

  const [boardConfig, setBoardConfig] = useState<BoardConfig>(initialConfig);
  const [board, setBoard] = useState<Cell[][]>(() => createBoard(DEFAULT_ROWS, DEFAULT_COLS));
  const [status, setStatus] = useState<GameStatus>("playing");
  const [firstMove, setFirstMove] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [zoom, setZoom] = useState(1.2);
  const [showSettings, setShowSettings] = useState(false);
  const [draftConfig, setDraftConfig] = useState<BoardConfig>(initialConfig);
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

  function applyBoardSettings(nextConfig: BoardConfig) {
    const normalized = clampBoardConfig(nextConfig.rows, nextConfig.cols, nextConfig.mines);
    setBoardConfig(normalized);
    setBoard(createBoard(normalized.rows, normalized.cols));
    setStatus("playing");
    setFirstMove(true);
    setElapsed(0);
  }

  function reset() {
    applyBoardSettings(boardConfig);
  }

  function openSettings() {
    setDraftConfig(boardConfig);
    setShowSettings(true);
  }

  function applySettings() {
    const normalized = clampBoardConfig(draftConfig.rows, draftConfig.cols, draftConfig.mines);
    setBoardConfig(normalized);
    setBoard(createBoard(normalized.rows, normalized.cols));
    setStatus("playing");
    setFirstMove(true);
    setElapsed(0);
    setShowSettings(false);
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

    const result = openCell(board, row, col, firstMove, boardConfig.mines);
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
  const remainingMines = Math.max(boardConfig.mines - flags, 0);
  const activePreset = PRESET_OPTIONS.find(
    (preset) =>
      preset.rows === boardConfig.rows &&
      preset.cols === boardConfig.cols &&
      preset.mines === boardConfig.mines
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
            <button type="button" onClick={openSettings}>設定</button>
            <button type="button" onClick={reset}>リセット</button>
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
            style={{ gridTemplateColumns: `repeat(${boardConfig.cols}, ${cellSize}px)` }}
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

      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="settings-header">
              <h2>設定</h2>
              <button type="button" className="close-button" onClick={() => setShowSettings(false)}>
                閉じる
              </button>
            </div>

            <div className="preset-group">
              {PRESET_OPTIONS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={
                    activePreset?.label === preset.label ? "preset active" : "preset"
                  }
                  onClick={() => setDraftConfig(clampBoardConfig(preset.rows, preset.cols, preset.mines))}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="config-grid">
              <label className="field">
                <span>行</span>
                <input
                  type="number"
                  min={5}
                  max={48}
                  value={draftConfig.rows}
                  onChange={(event) =>
                    setDraftConfig((current) => ({
                      ...current,
                      rows: Number(event.target.value),
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>列</span>
                <input
                  type="number"
                  min={5}
                  max={48}
                  value={draftConfig.cols}
                  onChange={(event) =>
                    setDraftConfig((current) => ({
                      ...current,
                      cols: Number(event.target.value),
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>爆弾</span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, draftConfig.rows * draftConfig.cols - 9)}
                  value={draftConfig.mines}
                  onChange={(event) =>
                    setDraftConfig((current) => ({
                      ...current,
                      mines: Number(event.target.value),
                    }))
                  }
                />
              </label>
            </div>

            <div className="settings-actions">
              <button type="button" className="secondary" onClick={() => setShowSettings(false)}>
                キャンセル
              </button>
              <button type="button" onClick={applySettings}>
                適用
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;