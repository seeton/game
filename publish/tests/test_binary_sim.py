import os
import sys
import unittest

TEST_ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLISH_ROOT = os.path.dirname(TEST_ROOT)

if PUBLISH_ROOT not in sys.path:
    sys.path.insert(0, PUBLISH_ROOT)

from binary_sim import BinarySimulation


class BinarySimulationTests(unittest.TestCase):
    def test_place_trade_consumes_balance(self):
        simulation = BinarySimulation()
        quote = {
            "price": 150.125,
            "displayPrice": "150.125",
            "provider": {"tradingEnabled": True},
        }

        simulation.place_trade("USD/JPY", "up", 10_000, 60, quote, now_epoch=100)

        self.assertEqual(simulation.balance, 990_000)
        self.assertEqual(len(simulation.open_positions), 1)
        self.assertEqual(simulation.open_positions[0]["expiresAt"], 160)

    def test_settle_win_adds_payout(self):
        simulation = BinarySimulation(
            balance=990_000,
            open_positions=[
                {
                    "id": "abc",
                    "symbol": "USD/JPY",
                    "direction": "up",
                    "stake": 10_000,
                    "entryPrice": "150.100",
                    "openedAt": 100,
                    "expiresAt": 160,
                    "status": "open",
                }
            ],
        )

        def lookup(_symbol):
            return {
                "price": 150.300,
                "displayPrice": "150.300",
                "provider": {"tradingEnabled": True},
            }

        notices = simulation.settle_expired(lookup, now_epoch=200)

        self.assertEqual(notices, [])
        self.assertEqual(simulation.balance, 1_008_500)
        self.assertEqual(len(simulation.open_positions), 0)
        self.assertEqual(simulation.history[0]["result"], "won")
        self.assertEqual(simulation.history[0]["payout"], 18_500)

    def test_settlement_stays_open_when_quote_fails(self):
        simulation = BinarySimulation(
            open_positions=[
                {
                    "id": "abc",
                    "symbol": "USD/JPY",
                    "direction": "up",
                    "stake": 10_000,
                    "entryPrice": "150.100",
                    "openedAt": 100,
                    "expiresAt": 160,
                    "status": "open",
                }
            ],
        )

        def lookup(_symbol):
            raise RuntimeError("quote failed")

        notices = simulation.settle_expired(lookup, now_epoch=200)

        self.assertIn("binarySettlementPending", notices)
        self.assertEqual(len(simulation.open_positions), 1)
        self.assertEqual(len(simulation.history), 0)


if __name__ == "__main__":
    unittest.main()
