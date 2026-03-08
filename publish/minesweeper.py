from collections import deque
import random


class Cell(object):
    def __init__(self, mine=False, adjacent=0, revealed=False, flagged=False):
        self.mine = mine
        self.adjacent = adjacent
        self.revealed = revealed
        self.flagged = flagged

    def to_dict(self):
        return {
            "mine": self.mine,
            "adjacent": self.adjacent,
            "revealed": self.revealed,
            "flagged": self.flagged,
        }

    @classmethod
    def from_dict(cls, payload):
        return cls(
            mine=bool(payload.get("mine", False)),
            adjacent=int(payload.get("adjacent", 0)),
            revealed=bool(payload.get("revealed", False)),
            flagged=bool(payload.get("flagged", False)),
        )


class Game(object):
    def __init__(self, rows, cols, mines, label="custom"):
        if rows <= 0 or cols <= 0:
            raise ValueError("rows and cols must be positive")
        total_cells = rows * cols
        if mines <= 0 or mines >= total_cells:
            raise ValueError("mines must be between 1 and total_cells - 1")

        self.rows = rows
        self.cols = cols
        self.mines = mines
        self.label = label
        self.status = "ready"
        self.started = False
        self.revealed_safe_cells = 0
        self._grid = [[Cell() for _ in range(cols)] for _ in range(rows)]

    def serialize(self):
        return {
            "rows": self.rows,
            "cols": self.cols,
            "mines": self.mines,
            "label": self.label,
            "status": self.status,
            "started": self.started,
            "revealed_safe_cells": self.revealed_safe_cells,
            "grid": [[cell.to_dict() for cell in row] for row in self._grid],
        }

    @classmethod
    def from_dict(cls, payload):
        game = cls(
            int(payload["rows"]),
            int(payload["cols"]),
            int(payload["mines"]),
            payload.get("label", "custom"),
        )
        game.status = payload.get("status", "ready")
        game.started = bool(payload.get("started", False))
        game.revealed_safe_cells = int(payload.get("revealed_safe_cells", 0))
        game._grid = [
            [Cell.from_dict(cell_payload) for cell_payload in row_payload]
            for row_payload in payload["grid"]
        ]
        return game

    def reveal(self, row, col):
        self._validate(row, col)
        cell = self._grid[row][col]
        if cell.flagged or cell.revealed or self.status in ("won", "lost"):
            return self.to_public_state()

        if not self.started:
            self._place_mines(row, col)
            self.started = True
            self.status = "playing"
            cell = self._grid[row][col]

        if cell.mine:
            cell.revealed = True
            self.status = "lost"
            return self.to_public_state()

        self._flood_reveal(row, col)
        if self.revealed_safe_cells == (self.rows * self.cols) - self.mines:
            self.status = "won"

        return self.to_public_state()

    def toggle_flag(self, row, col):
        self._validate(row, col)
        if self.status in ("won", "lost"):
            return self.to_public_state()

        cell = self._grid[row][col]
        if cell.revealed:
            return self.to_public_state()

        cell.flagged = not cell.flagged
        return self.to_public_state()

    def to_public_state(self):
        if self.status == "won":
            flags_used = self.mines
        else:
            flags_used = sum(1 for row in self._grid for cell in row if cell.flagged)
        return {
            "rows": self.rows,
            "cols": self.cols,
            "mines": self.mines,
            "label": self.label,
            "status": self.status,
            "started": self.started,
            "revealedSafeCells": self.revealed_safe_cells,
            "flagsUsed": flags_used,
            "board": [
                [
                    {
                        "state": self._public_state(cell),
                        "adjacent": cell.adjacent if cell.revealed and not cell.mine else 0,
                    }
                    for cell in row
                ]
                for row in self._grid
            ],
        }

    def _public_state(self, cell):
        if self.status == "lost":
            if cell.mine and cell.revealed:
                return "exploded"
            if cell.mine:
                return "mine"
            if cell.flagged and not cell.mine:
                return "wrong-flag"
            if cell.flagged:
                return "flagged"
            if cell.revealed:
                return "revealed"
            return "hidden"

        if self.status == "won" and cell.mine:
            return "flagged"

        if cell.flagged:
            return "flagged"
        if cell.revealed:
            return "revealed"
        return "hidden"

    def _flood_reveal(self, start_row, start_col):
        queue = deque([(start_row, start_col)])
        while queue:
            row, col = queue.popleft()
            cell = self._grid[row][col]
            if cell.revealed or cell.flagged or cell.mine:
                continue

            cell.revealed = True
            self.revealed_safe_cells += 1
            if cell.adjacent != 0:
                continue

            for neighbor_row, neighbor_col in self._neighbors(row, col):
                neighbor = self._grid[neighbor_row][neighbor_col]
                if not neighbor.revealed and not neighbor.flagged and not neighbor.mine:
                    queue.append((neighbor_row, neighbor_col))

    def _place_mines(self, first_row, first_col):
        safe_zone = set()
        for row in range(max(0, first_row - 1), min(self.rows, first_row + 2)):
            for col in range(max(0, first_col - 1), min(self.cols, first_col + 2)):
                safe_zone.add((row, col))

        candidates = []
        for row in range(self.rows):
            for col in range(self.cols):
                if (row, col) not in safe_zone:
                    candidates.append((row, col))

        if len(candidates) < self.mines:
            candidates = []
            for row in range(self.rows):
                for col in range(self.cols):
                    if (row, col) != (first_row, first_col):
                        candidates.append((row, col))

        for row, col in random.sample(candidates, self.mines):
            self._grid[row][col].mine = True

        for row in range(self.rows):
            for col in range(self.cols):
                if self._grid[row][col].mine:
                    continue
                adjacent = 0
                for neighbor_row, neighbor_col in self._neighbors(row, col):
                    if self._grid[neighbor_row][neighbor_col].mine:
                        adjacent += 1
                self._grid[row][col].adjacent = adjacent

    def _neighbors(self, row, col):
        neighbors = []
        for neighbor_row in range(max(0, row - 1), min(self.rows, row + 2)):
            for neighbor_col in range(max(0, col - 1), min(self.cols, col + 2)):
                if (neighbor_row, neighbor_col) == (row, col):
                    continue
                neighbors.append((neighbor_row, neighbor_col))
        return neighbors

    def _validate(self, row, col):
        if not (0 <= row < self.rows and 0 <= col < self.cols):
            raise ValueError("row or col out of bounds")
