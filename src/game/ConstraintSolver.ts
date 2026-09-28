export type VariableId = number;

export type Constraint = {
  variables: Set<VariableId>;
  mines: number;
};

export type PublicBoard = {
  rows: number;
  cols: number;
  mines: number;
  opened: boolean[][];
  flagged: boolean[][];
  numbers: number[][];
};

export type SolverResult =
  | { type: "solved"; assignments: Record<number, boolean> }
  | { type: "stuck"; assignments: Record<number, boolean> }
  | { type: "contradiction"; reason?: string };

export function buildConstraintsFromPublicBoard(board: PublicBoard): Constraint[] {
  const constraints: Constraint[] = [];

  for (let row = 0; row < board.rows; row++) {
    for (let col = 0; col < board.cols; col++) {
      if (!board.opened[row]?.[col]) continue;
      const number = board.numbers[row]?.[col] ?? 0;
      if (number <= 0) continue;

      const variables = new Set<VariableId>();
      let remainingMines = number;

      for (const [nr, nc] of neighbors(row, col, board.rows, board.cols)) {
        if (board.opened[nr]?.[nc]) continue;
        if (board.flagged[nr]?.[nc]) {
          remainingMines -= 1;
          continue;
        }
        variables.add(toVariableId(nr, nc, board.cols));
      }

      if (remainingMines < 0) {
        return [{ variables: new Set(), mines: Number.POSITIVE_INFINITY }];
      }

      if (variables.size === 0) {
        if (remainingMines === 0) continue;
        return [{ variables: new Set(), mines: Number.POSITIVE_INFINITY }];
      }

      if (remainingMines > variables.size) {
        return [{ variables: new Set(), mines: Number.POSITIVE_INFINITY }];
      }

      constraints.push({ variables, mines: remainingMines });
    }
  }

  return dedupeConstraints(constraints);
}

export function solvePublicBoard(board: PublicBoard): SolverResult {
  const knownSafe = new Set<VariableId>();
  const knownMine = new Set<VariableId>();
  const allUnknown = new Set<VariableId>();

  for (let row = 0; row < board.rows; row++) {
    for (let col = 0; col < board.cols; col++) {
      const id = toVariableId(row, col, board.cols);
      if (board.flagged[row]?.[col]) {
        knownMine.add(id);
      } else if (!board.opened[row]?.[col]) {
        allUnknown.add(id);
      }
      if (board.opened[row]?.[col]) {
        knownSafe.add(id);
      }
    }
  }

  let constraints = buildConstraintsFromPublicBoard(board);
  let lastAssignments = buildAssignments(knownSafe, knownMine);

  for (let iteration = 0; iteration < 200; iteration++) {
    let progress = false;
    const nextConstraints: Constraint[] = [];

    for (const constraint of constraints) {
      const normalized = normalizeConstraint(constraint, knownSafe, knownMine);
      if (normalized.type === "contradiction") {
        return normalized;
      }

      if (normalized.safe.size > 0) {
        for (const id of normalized.safe) {
          if (!knownSafe.has(id) && !knownMine.has(id)) {
            knownSafe.add(id);
            progress = true;
          }
        }
      }

      if (normalized.mine.size > 0) {
        for (const id of normalized.mine) {
          if (!knownSafe.has(id) && !knownMine.has(id)) {
            knownMine.add(id);
            progress = true;
          }
        }
      }

      if (normalized.constraint) {
        nextConstraints.push(normalized.constraint);
      }
    }

    for (let i = 0; i < nextConstraints.length; i++) {
      for (let j = 0; j < nextConstraints.length; j++) {
        if (i === j) continue;
        const a = nextConstraints[i];
        const b = nextConstraints[j];
        if (!isSubsetOf(a.variables, b.variables)) continue;

        const diff = setDifference(a.variables, b.variables);
        if (diff.size === 0) continue;

        const diffMines = a.mines - b.mines;
        if (diffMines < 0 || diffMines > diff.size) {
          return { type: "contradiction", reason: "subset difference violates a constraint" };
        }

        if (diffMines === 0) {
          for (const id of diff) {
            if (!knownSafe.has(id) && !knownMine.has(id)) {
              knownSafe.add(id);
              progress = true;
            }
          }
        } else if (diffMines === diff.size) {
          for (const id of diff) {
            if (!knownSafe.has(id) && !knownMine.has(id)) {
              knownMine.add(id);
              progress = true;
            }
          }
        }
      }
    }

    const unresolved = [...allUnknown].filter((id) => !knownSafe.has(id) && !knownMine.has(id));
    if (unresolved.length > 0) {
      const enumeration = enumerateCommonAssignments(unresolved, nextConstraints, knownSafe, knownMine);
      if (enumeration.type === "contradiction") {
        return enumeration;
      }

      for (const id of enumeration.safe) {
        if (!knownSafe.has(id) && !knownMine.has(id)) {
          knownSafe.add(id);
          progress = true;
        }
      }

      for (const id of enumeration.mine) {
        if (!knownSafe.has(id) && !knownMine.has(id)) {
          knownMine.add(id);
          progress = true;
        }
      }
    }

    constraints = dedupeConstraints(nextConstraints);
    lastAssignments = buildAssignments(knownSafe, knownMine);

    if (!progress) {
      break;
    }
  }

  const remaining = [...allUnknown].filter((id) => !knownSafe.has(id) && !knownMine.has(id));
  if (remaining.length === 0) {
    return { type: "solved", assignments: buildAssignments(knownSafe, knownMine) };
  }

  if (constraints.some((constraint) => constraint.mines < 0 || constraint.mines > constraint.variables.size)) {
    return { type: "contradiction", reason: "invalid constraint after inference" };
  }

  return { type: "stuck", assignments: lastAssignments };
}

function normalizeConstraint(
  constraint: Constraint,
  knownSafe: Set<VariableId>,
  knownMine: Set<VariableId>
): { type: "ok"; constraint: Constraint | null; safe: Set<VariableId>; mine: Set<VariableId> } | { type: "contradiction"; reason: string } {
  const variables = new Set<VariableId>();
  let mines = constraint.mines;
  const safe = new Set<VariableId>();
  const mine = new Set<VariableId>();

  for (const id of constraint.variables) {
    if (knownMine.has(id)) {
      mines -= 1;
      continue;
    }
    if (knownSafe.has(id)) {
      continue;
    }
    variables.add(id);
  }

  if (mines < 0) {
    return { type: "contradiction", reason: "constraint exceeds known mine count" };
  }

  if (variables.size === 0) {
    if (mines === 0) {
      return { type: "ok", constraint: null, safe, mine };
    }
    return { type: "contradiction", reason: "a fully resolved constraint still requires mines" };
  }

  if (mines === 0) {
    for (const id of variables) {
      safe.add(id);
    }
    return { type: "ok", constraint: null, safe, mine };
  }

  if (mines === variables.size) {
    for (const id of variables) {
      mine.add(id);
    }
    return { type: "ok", constraint: null, safe, mine };
  }

  return { type: "ok", constraint: { variables, mines }, safe, mine };
}

function enumerateCommonAssignments(
  unresolved: VariableId[],
  constraints: Constraint[],
  knownSafe: Set<VariableId>,
  knownMine: Set<VariableId>
): { type: "ok"; safe: Set<VariableId>; mine: Set<VariableId> } | { type: "contradiction"; reason: string } {
  const relevantConstraints = constraints.filter((constraint) => {
    for (const id of constraint.variables) {
      if (unresolved.includes(id)) return true;
    }
    return false;
  });

  if (relevantConstraints.length === 0) {
    return { type: "ok", safe: new Set(), mine: new Set() };
  }

  const components = buildConnectedComponents(unresolved, relevantConstraints);
  const safe = new Set<VariableId>();
  const mine = new Set<VariableId>();

  for (const component of components) {
    const componentConstraints = relevantConstraints.filter((constraint) =>
      [...constraint.variables].some((id) => component.includes(id))
    );

    const solutions = enumerateSolutions(component, componentConstraints);
    if (solutions.length === 0) {
      return { type: "contradiction", reason: "no satisfying assignment in the connected component" };
    }

    for (const id of component) {
      if (knownSafe.has(id) || knownMine.has(id)) continue;

      const values = solutions.map((solution) => solution.get(id) ?? 0);
      if (values.every((value) => value === 0)) safe.add(id);
      if (values.every((value) => value === 1)) mine.add(id);
    }
  }

  return { type: "ok", safe, mine };
}

function buildConnectedComponents(variables: VariableId[], constraints: Constraint[]): VariableId[][] {
  const adjacency = new Map<VariableId, Set<VariableId>>();

  for (const variable of variables) {
    adjacency.set(variable, new Set());
  }

  for (const constraint of constraints) {
    const values = [...constraint.variables];
    for (let i = 0; i < values.length; i++) {
      if (!adjacency.has(values[i])) continue;
      for (let j = i + 1; j < values.length; j++) {
        if (!adjacency.has(values[j])) continue;
        adjacency.get(values[i])!.add(values[j]);
        adjacency.get(values[j])!.add(values[i]);
      }
    }
  }

  const visited = new Set<VariableId>();
  const result: VariableId[][] = [];

  for (const variable of variables) {
    if (visited.has(variable)) continue;

    const stack = [variable];
    const component: VariableId[] = [];
    visited.add(variable);

    while (stack.length > 0) {
      const current = stack.pop()!;
      component.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push(neighbor);
        }
      }
    }

    result.push(component.sort((a, b) => a - b));
  }

  return result;
}

function enumerateSolutions(variables: VariableId[], constraints: Constraint[]): Map<VariableId, number>[] {
  if (variables.length === 0) return [];

  const ordered = [...new Set(variables)].sort((a, b) => a - b);
  const assignment = new Map<VariableId, number>();
  const solutions: Map<VariableId, number>[] = [];

  function isFeasible(): boolean {
    for (const constraint of constraints) {
      let sum = 0;
      let unknown = 0;

      for (const id of constraint.variables) {
        if (assignment.has(id)) {
          sum += assignment.get(id)!;
        } else {
          unknown += 1;
        }
      }

      if (sum > constraint.mines) return false;
      if (sum + unknown < constraint.mines) return false;
    }
    return true;
  }

  function backtrack(index: number): void {
    if (index === ordered.length) {
      const candidate = new Map<VariableId, number>();
      for (const id of ordered) {
        candidate.set(id, assignment.get(id) ?? 0);
      }

      if (constraints.every((constraint) => {
        let sum = 0;
        for (const id of constraint.variables) {
          sum += candidate.get(id) ?? 0;
        }
        return sum === constraint.mines;
      })) {
        solutions.push(candidate);
      }
      return;
    }

    const current = ordered[index];
    for (const value of [0, 1]) {
      assignment.set(current, value);
      if (isFeasible()) {
        backtrack(index + 1);
      }
      assignment.delete(current);
    }
  }

  backtrack(0);
  return solutions;
}

function buildAssignments(knownSafe: Set<VariableId>, knownMine: Set<VariableId>): Record<number, boolean> {
  const assignments: Record<number, boolean> = {};
  for (const id of knownSafe) {
    assignments[id] = false;
  }
  for (const id of knownMine) {
    assignments[id] = true;
  }
  return assignments;
}

function dedupeConstraints(constraints: Constraint[]): Constraint[] {
  const unique = new Map<string, Constraint>();
  for (const constraint of constraints) {
    const normalized = [...constraint.variables].sort((a, b) => a - b);
    const key = `${normalized.join("|")}:${constraint.mines}`;
    if (!unique.has(key)) {
      unique.set(key, { variables: new Set(normalized), mines: constraint.mines });
    }
  }
  return [...unique.values()];
}

function setDifference(left: Set<VariableId>, right: Set<VariableId>): Set<VariableId> {
  const result = new Set<VariableId>();
  for (const id of left) {
    if (!right.has(id)) result.add(id);
  }
  return result;
}

function isSubsetOf(left: Set<VariableId>, right: Set<VariableId>): boolean {
  if (left.size === 0 || left.size > right.size) return false;
  for (const id of left) {
    if (!right.has(id)) return false;
  }
  return true;
}

function neighbors(row: number, col: number, rows: number, cols: number): [number, number][] {
  const result: [number, number][] = [];

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nextRow = row + dr;
      const nextCol = col + dc;
      if (nextRow >= 0 && nextRow < rows && nextCol >= 0 && nextCol < cols) {
        result.push([nextRow, nextCol]);
      }
    }
  }

  return result;
}

function toVariableId(row: number, col: number, cols: number): VariableId {
  return row * cols + col;
}
