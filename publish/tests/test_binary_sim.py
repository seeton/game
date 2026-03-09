import os
import sys
import unittest

TEST_ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLISH_ROOT = os.path.dirname(TEST_ROOT)

if PUBLISH_ROOT not in sys.path:
    sys.path.insert(0, PUBLISH_ROOT)

from binary_sim import BinarySimulation, quote_for_case


CASE = {
    "symbol": "USD/JPY",
    "referenceDate": "2026-03-08",
    "series": [150.100, 150.140, 150.220, 150.260],
    "totalSeconds": 3,
}

PROVIDER = {
    "name": "Historical Replay",
    "code": "historical",
    "noteCode": "binaryProviderHistorical",
    "tradingEnabled": True,
    "stale": False,
}


class BinarySimulationTests(unittest.TestCase):
    def test_quote_for_case_uses_elapsed_seconds(self):
        quote = quote_for_case(CASE, started_at_epoch=100, now_epoch=102, provider=PROVIDER)

        self.assertEqual(quote["displayPrice"], "150.220")
        self.assertEqual(quote["elapsedSeconds"], 2)
        self.assertEqual(quote["provider"]["code"], "historical")

    def test_place_trade_consumes_balance(self):
        simulation = BinarySimulation()
        quote = quote_for_case(CASE, started_at_epoch=100, now_epoch=100, provider=PROVIDER)

        simulation.place_trade("USD/JPY", "up", 10_000, 10, quote, now_epoch=100)

        self.assertEqual(simulation.balance, 90_000)
        self.assertEqual(len(simulation.open_positions), 1)
        self.assertEqual(simulation.open_positions[0]["entryPrice"], "150.100")

    def test_settle_win_adds_payout(self):
        simulation = BinarySimulation(
            balance=90_000,
            open_positions=[
                {
                    "id": "abc",
                    "symbol": "USD/JPY",
                    "direction": "up",
                    "stake": 10_000,
                    "entryPrice": "150.100",
                    "openedAt": 100,
                    "expiresAt": 102,
                    "status": "open",
                }
            ],
            case_starts={"USD/JPY": 100},
        )

        simulation.settle_expired(lambda _symbol: CASE, PROVIDER, now_epoch=120)

        self.assertEqual(simulation.balance, 108_500)
        self.assertEqual(len(simulation.open_positions), 0)
        self.assertEqual(simulation.history[0]["result"], "won")
        self.assertEqual(simulation.history[0]["exitPrice"], "150.220")

    def test_public_state_includes_chart_and_short_durations(self):
        simulation = BinarySimulation()
        quote = quote_for_case(CASE, started_at_epoch=100, now_epoch=102, provider=PROVIDER)
        state = simulation.to_public_state(
            "USD/JPY",
            {"provider": PROVIDER, "cases": {"USD/JPY": CASE}},
            quote,
            now_epoch=102,
        )

        self.assertEqual(state["startingBalance"], 100_000)
        self.assertEqual(state["defaultDuration"], 10)
        self.assertEqual(state["durations"], [10, 20, 30])
        self.assertEqual(state["chart"]["history"], CASE["series"][:3])
        self.assertEqual(state["chart"]["currentPrice"], "150.220")
        self.assertEqual(state["chart"]["priceDigits"], 3)


if __name__ == "__main__":
    unittest.main()
