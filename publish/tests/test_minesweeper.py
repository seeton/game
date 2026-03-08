import unittest

try:
    from publish.minesweeper import Game
except ModuleNotFoundError:
    from minesweeper import Game


class GameTests(unittest.TestCase):
    def test_first_click_is_safe(self) -> None:
        game = Game(rows=9, cols=9, mines=10, label="easy")
        game.reveal(4, 4)

        center = game.to_public_state()["board"][4][4]
        self.assertEqual(center["state"], "revealed")

    def test_flagging_hidden_cell_updates_count(self) -> None:
        game = Game(rows=9, cols=9, mines=10, label="easy")
        state = game.toggle_flag(1, 1)

        self.assertEqual(state["flagsUsed"], 1)
        self.assertEqual(state["board"][1][1]["state"], "flagged")

    def test_winning_marks_game_complete(self) -> None:
        game = Game(rows=2, cols=2, mines=1, label="tiny")
        game._grid[0][0].mine = True
        game._grid[0][1].adjacent = 1
        game._grid[1][0].adjacent = 1
        game._grid[1][1].adjacent = 1
        game.started = True
        game.status = "playing"

        game.reveal(0, 1)
        game.reveal(1, 0)
        state = game.reveal(1, 1)

        self.assertEqual(state["status"], "won")

    def test_hitting_mine_loses_game(self) -> None:
        game = Game(rows=2, cols=2, mines=1, label="tiny")
        game._grid[0][0].mine = True
        game.started = True
        game.status = "playing"

        state = game.reveal(0, 0)
        self.assertEqual(state["status"], "lost")
        self.assertEqual(state["board"][0][0]["state"], "exploded")


if __name__ == "__main__":
    unittest.main()
