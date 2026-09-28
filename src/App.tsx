import { useEffect, useMemo, useRef, useState } from "react";
import {
  clampBoardConfig,
  createBoard,
  DEFAULT_COLS,
  DEFAULT_MINES,
  DEFAULT_ROWS,
  openCell,
  resetBoardForRetry,
  solvePublicBoard,
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

function getSimpleHintMap(board: Cell[][]): Map<string, "safe" | "mine"> {
  const hints = new Map<string, "safe" | "mine">();

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const cell = board[row][col];
      if (!cell.open || cell.adjacent <= 0) continue;

      const neighbors: [number, number][] = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nextRow = row + dr;
          const nextCol = col + dc;
          if (nextRow < 0 || nextRow >= board.length || nextCol < 0 || nextCol >= board[0].length) {
            continue;
          }
          neighbors.push([nextRow, nextCol]);
        }
      }

      const hiddenNeighbors = neighbors.filter(([r, c]) => !board[r][c].open && !board[r][c].flagged);
      const flaggedNeighbors = neighbors.filter(([r, c]) => board[r][c].flagged).length;
      const remainingMines = cell.adjacent - flaggedNeighbors;

      if (remainingMines === 0) {
        for (const [r, c] of hiddenNeighbors) {
          hints.set(`${r}-${c}`, "safe");
        }
      }

      if (hiddenNeighbors.length > 0 && remainingMines === hiddenNeighbors.length) {
        for (const [r, c] of hiddenNeighbors) {
          hints.set(`${r}-${c}`, "mine");
        }
      }
    }
  }

  return hints;
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
  const [lastTriggeredMine, setLastTriggeredMine] = useState<{ row: number; col: number } | null>(null);
  const [zoom, setZoom] = useState(1.2);
  const [showSettings, setShowSettings] = useState(false);
  const [showHints, setShowHints] = useState(true);
  const [draftConfig, setDraftConfig] = useState<BoardConfig>(initialConfig);
  const zoomRef = useRef(zoom);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const lastFlagToggleRef = useRef<number>(0);
  const pinchDistanceRef = useRef<number | null>(null);
  const pinchGestureRef = useRef(false);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

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

  function retryGame() {
    setBoard((current) => resetBoardForRetry(current, lastTriggeredMine));
    setStatus("playing");
    setFirstMove(false);
    setElapsed(0);
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
    if (result.status === "gameover") {
      setLastTriggeredMine({ row, col });
    }
    setStatus(result.status);
    setFirstMove(result.firstMove);
  }

  function handleCellContextMenu(
    event: React.MouseEvent<HTMLButtonElement>,
    row: number,
    col: number
  ) {
    event.preventDefault();
    // Prevent duplicate toggles when long-press also triggers contextmenu
    const now = Date.now();
    if (now - lastFlagToggleRef.current < 500) return;
    lastFlagToggleRef.current = now;
    if (status !== "playing") return;

    setBoard((current) => toggleFlag(current, row, col));
  }

  function handleLongPressStart(row: number, col: number) {
    if (pinchGestureRef.current) {
      clearLongPress();
      return;
    }

    clearLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = true;
      const now = Date.now();
      if (now - lastFlagToggleRef.current >= 500) {
        lastFlagToggleRef.current = now;
        setBoard((current) => {
          const target = current[row][col];
          if (target.open) return current;
          return toggleFlag(current, row, col);
        });
      }
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
    setZoom((current) => clampZoom(nextZoom ?? current));
  }

  function handleWheelZoom(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    updateZoom(zoomRef.current + delta);
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length === 2) {
      event.preventDefault();
      pinchGestureRef.current = true;
      pinchDistanceRef.current = getTouchDistance(event.touches[0], event.touches[1]);
      clearLongPress();
      suppressClickRef.current = true;
    }
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 2 || pinchDistanceRef.current === null) return;

    event.preventDefault();
    const nextDistance = getTouchDistance(event.touches[0], event.touches[1]);
    const ratio = nextDistance / pinchDistanceRef.current;
    pinchDistanceRef.current = nextDistance;
    updateZoom(zoomRef.current * ratio);
  }

  function handleTouchEnd() {
    pinchGestureRef.current = false;
    pinchDistanceRef.current = null;
    suppressClickRef.current = false;
  }

  const cellSize = BASE_CELL_SIZE * zoom;
  const remainingMines = Math.max(boardConfig.mines - flags, 0);
  const activePreset = PRESET_OPTIONS.find(
    (preset) =>
      preset.rows === boardConfig.rows &&
      preset.cols === boardConfig.cols &&
      preset.mines === boardConfig.mines
  );

  const hintCells = useMemo(() => {
    if (!showHints || status !== "playing") {
      return new Map<string, "safe" | "mine">();
    }

    const publicBoard = {
      rows: board.length,
      cols: board[0]?.length ?? 0,
      mines: boardConfig.mines,
      opened: board.map((line) => line.map((cell) => cell.open)),
      flagged: board.map((line) => line.map((cell) => cell.flagged)),
      numbers: board.map((line) => line.map((cell) => cell.open ? cell.adjacent : 0)),
    };

    const nextHints = getSimpleHintMap(board);

    const result = solvePublicBoard(publicBoard);
    if (result.type !== "contradiction") {
      for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[row].length; col++) {
          const cell = board[row][col];
          if (cell.open || cell.flagged) continue;
          const id = row * board[row].length + col;
          const value = result.assignments[id];
          if (value === false) {
            nextHints.set(`${row}-${col}`, "safe");
          }
          if (value === true) {
            nextHints.set(`${row}-${col}`, "mine");
          }
        }
      }
    }

    return nextHints;
  }, [board, boardConfig.mines, showHints, status]);

  return (
    <main className="app">
      <section className="game">
        <header className="header">
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

          <div className="controls">
            <button type="button" onClick={() => setShowHints((current) => !current)}>
              {showHints ? "ヒント:ON" : "ヒント:OFF"}
            </button>
            <button type="button" onClick={openSettings}>設定</button>
            <button type="button" onClick={reset}>リセット</button>
            {status === "gameover" && (
              <button type="button" onClick={retryGame} className="retry-button">
                リトライ
              </button>
            )}
          </div>
        </header>

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
                    showHints && hintCells.get(`${row}-${col}`) === "safe" ? "hint-safe" : "",
                    showHints && hintCells.get(`${row}-${col}`) === "mine" ? "hint-mine" : "",
                  ].join(" ")}
                  onClick={() => handleCellClick(row, col)}
                  onContextMenu={(event) => handleCellContextMenu(event, row, col)}
                  onPointerDown={() => handleLongPressStart(row, col)}
                  onPointerUp={clearLongPress}
                  onPointerLeave={clearLongPress}
                  onPointerCancel={clearLongPress}
                  onTouchStart={(e) => {
                    // Ensure touch devices trigger long-press logic
                    if (e.touches && e.touches.length === 1) {
                      handleLongPressStart(row, col);
                    }
                  }}
                  onTouchEnd={clearLongPress}
                  onTouchCancel={clearLongPress}
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

      {status === "gameover" && (
        <div className="result-overlay" role="dialog" aria-modal="true" aria-label="ゲームオーバー">
          <div className="result-dialog">
            <h2>爆弾に当たりました</h2>
            <p>同じ条件でもう一度挑戦できます。</p>
            <button type="button" onClick={retryGame} className="primary-action">
              リトライ
            </button>
          </div>
        </div>
      )}

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