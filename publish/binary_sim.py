import datetime as dt
import hashlib
import json
import math
import os
import time
import uuid
from decimal import Decimal, ROUND_HALF_UP
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


STARTING_BALANCE = 100_000
DEFAULT_SYMBOL = "USD/JPY"
DEFAULT_DURATION = 10
DEFAULT_PAYOUT_RATE = Decimal("0.85")
MIN_STAKE = 1_000
MAX_HISTORY_ITEMS = 12
CASE_TOTAL_SECONDS = 600
CASE_SEGMENTS = 6
HISTORY_LOOKBACK_DAYS = 45
JST_OFFSET = dt.timedelta(hours=9)
CASE_CACHE_DIRNAME = "binary_case_cache"
CASE_FORMAT_VERSION = 3

SYMBOLS = {
    "USD/JPY": {"base": "USD", "quote": "JPY", "digits": 3},
    "EUR/JPY": {"base": "EUR", "quote": "JPY", "digits": 3},
    "GBP/JPY": {"base": "GBP", "quote": "JPY", "digits": 3},
}

DURATIONS = (10, 20, 30)
DIRECTIONS = {"up", "down"}


def _quantize_pattern(digits):
    return Decimal("1." + ("0" * digits))


def _format_price(symbol, price):
    digits = SYMBOLS[symbol]["digits"]
    decimal_price = Decimal(str(price))
    return format(decimal_price.quantize(_quantize_pattern(digits)), "f")


def _cache_dir(runtime_dir):
    return os.path.join(runtime_dir, CASE_CACHE_DIRNAME)


def ensure_runtime_dirs(runtime_dir):
    directory = _cache_dir(runtime_dir)
    if not os.path.isdir(directory):
        os.makedirs(directory)


def _cache_path(runtime_dir, day_key):
    return os.path.join(_cache_dir(runtime_dir), "%s.json" % day_key)


def _load_cached_cases(runtime_dir, day_key):
    path = _cache_path(runtime_dir, day_key)
    if not os.path.isfile(path):
        return None
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def _is_payload_compatible(payload):
    if not isinstance(payload, dict):
        return False
    if int(payload.get("formatVersion", 0)) != CASE_FORMAT_VERSION:
        return False
    cases = payload.get("cases", {})
    if not isinstance(cases, dict) or not cases:
        return False
    for case_payload in cases.values():
        if int(case_payload.get("totalSeconds", -1)) != CASE_TOTAL_SECONDS:
            return False
        series = case_payload.get("series")
        if not isinstance(series, list) or len(series) != CASE_TOTAL_SECONDS + 1:
            return False
    return True


def _jst_now(now_epoch=None):
    now_epoch = time.time() if now_epoch is None else now_epoch
    return dt.datetime.utcfromtimestamp(now_epoch) + JST_OFFSET


def _today_key(now_epoch=None):
    return _jst_now(now_epoch).date().isoformat()


def _yesterday_key(now_epoch=None):
    return (_jst_now(now_epoch).date() - dt.timedelta(days=1)).isoformat()


def _parse_iso_date(value):
    return dt.datetime.strptime(value, "%Y-%m-%d").date()


def _fetch_json(url):
    request = Request(url, headers={"User-Agent": "SEETONA/1.0"})
    try:
        with urlopen(request, timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(body or "historical case fetch failed")
    except (URLError, OSError):
        raise RuntimeError("historical case fetch failed")


def _fetch_daily_series(symbol, end_date):
    config = SYMBOLS[symbol]
    start_date = end_date - dt.timedelta(days=HISTORY_LOOKBACK_DAYS)
    payload = _fetch_json(
        "https://api.frankfurter.dev/v1/%s..%s?%s"
        % (
            start_date.isoformat(),
            end_date.isoformat(),
            urlencode({"base": config["base"], "symbols": config["quote"]}),
        )
    )

    rates = payload.get("rates", {})
    items = []
    for day in sorted(rates.keys()):
        try:
            price = float(rates[day][config["quote"]])
        except (KeyError, TypeError, ValueError):
            continue
        items.append({"date": day, "price": price})

    if len(items) < CASE_SEGMENTS + 1:
        raise RuntimeError("historical case unavailable")
    return items


def _average_abs_change(anchor_prices):
    if len(anchor_prices) < 2:
        return 0.0
    total = 0.0
    for index in range(len(anchor_prices) - 1):
        total += abs(anchor_prices[index + 1] - anchor_prices[index])
    return total / float(len(anchor_prices) - 1)


def _build_series(symbol, anchor_points, day_key):
    prices = [point["price"] for point in anchor_points]
    total_segments = len(anchor_points) - 1
    seconds_per_segment = CASE_TOTAL_SECONDS // total_segments
    precision_step = 10 ** (-SYMBOLS[symbol]["digits"])
    average_change = max(_average_abs_change(prices), precision_step * 3)
    seed_text = "%s:%s:%s" % (day_key, symbol, anchor_points[-1]["date"])
    seed = int(hashlib.sha1(seed_text.encode("utf-8")).hexdigest()[:8], 16)

    series = [float(_format_price(symbol, prices[0]))]
    for index in range(total_segments):
        start_price = prices[index]
        end_price = prices[index + 1]
        span = end_price - start_price
        amplitude = max(abs(span) * 0.38, average_change * 0.16, precision_step * 4)
        amplitude = min(amplitude, abs(span) + average_change * 0.45)
        direction = 1 if ((seed >> index) & 1) == 0 else -1

        for second in range(1, seconds_per_segment + 1):
            progress = second / float(seconds_per_segment)
            wave = math.sin(math.pi * progress) * amplitude * direction
            price = start_price + (span * progress) + wave
            series.append(float(_format_price(symbol, price)))

    return series[: CASE_TOTAL_SECONDS + 1]


def _build_case(symbol, history_points, day_key):
    anchor_points = history_points[-(CASE_SEGMENTS + 1) :]
    return {
        "symbol": symbol,
        "title": symbol,
        "referenceDate": anchor_points[-1]["date"],
        "anchorDates": [point["date"] for point in anchor_points],
        "series": _build_series(symbol, anchor_points, day_key),
        "totalSeconds": CASE_TOTAL_SECONDS,
    }


def _latest_cached_payload(runtime_dir):
    ensure_runtime_dirs(runtime_dir)
    latest_name = None
    for filename in os.listdir(_cache_dir(runtime_dir)):
        if filename.endswith(".json") and (latest_name is None or filename > latest_name):
            latest_name = filename
    if latest_name is None:
        return None
    with open(os.path.join(_cache_dir(runtime_dir), latest_name), "r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload if _is_payload_compatible(payload) else None


def load_daily_cases(runtime_dir, now_epoch=None):
    ensure_runtime_dirs(runtime_dir)
    day_key = _today_key(now_epoch)
    path = _cache_path(runtime_dir, day_key)
    if os.path.isfile(path):
        with open(path, "r", encoding="utf-8") as handle:
            cached_payload = json.load(handle)
        if _is_payload_compatible(cached_payload):
            return cached_payload

    try:
        end_date = _parse_iso_date(_yesterday_key(now_epoch))
        cases = {}
        for symbol in SYMBOLS:
            history_points = _fetch_daily_series(symbol, end_date)
            cases[symbol] = _build_case(symbol, history_points, day_key)
        payload = {
            "formatVersion": CASE_FORMAT_VERSION,
            "dayKey": day_key,
            "provider": {
                "name": "Historical Replay",
                "code": "historical",
                "noteCode": "binaryProviderHistorical",
                "tradingEnabled": True,
                "stale": False,
            },
            "cases": cases,
        }
        with open(path + ".tmp", "w", encoding="utf-8") as handle:
            json.dump(payload, handle, separators=(",", ":"))
        os.replace(path + ".tmp", path)
        return payload
    except RuntimeError:
        cached = _latest_cached_payload(runtime_dir)
        if cached is not None:
            provider = dict(cached.get("provider", {}))
            provider["stale"] = True
            provider["noteCode"] = "binaryProviderHistoricalStale"
            cached["provider"] = provider
            return cached
        raise


def quote_for_case(case_payload, started_at_epoch, now_epoch, provider):
    elapsed = max(0, int(now_epoch) - int(started_at_epoch))
    total_seconds = int(case_payload["totalSeconds"])
    current_second = min(total_seconds, elapsed)
    price = float(case_payload["series"][current_second])
    return {
        "symbol": case_payload["symbol"],
        "price": price,
        "displayPrice": _format_price(case_payload["symbol"], price),
        "updatedAt": "%sT+%03ds" % (case_payload["referenceDate"], current_second),
        "elapsedSeconds": current_second,
        "totalSeconds": total_seconds,
        "referenceDate": case_payload["referenceDate"],
        "provider": provider,
    }


class BinarySimulation(object):
    def __init__(self, balance=STARTING_BALANCE, open_positions=None, history=None, case_starts=None, case_day_key=None):
        self.balance = int(balance)
        self.open_positions = list(open_positions or [])
        self.history = list(history or [])
        self.case_starts = dict(case_starts or {})
        self.case_day_key = case_day_key

    def serialize(self):
        return {
            "balance": self.balance,
            "openPositions": self.open_positions,
            "history": self.history,
            "caseStarts": self.case_starts,
            "caseDayKey": self.case_day_key,
        }

    @classmethod
    def from_dict(cls, payload):
        return cls(
            balance=int(payload.get("balance", STARTING_BALANCE)),
            open_positions=payload.get("openPositions", []),
            history=payload.get("history", []),
            case_starts=payload.get("caseStarts", {}),
            case_day_key=payload.get("caseDayKey"),
        )

    def ensure_case_started(self, symbol, now_epoch):
        if symbol not in self.case_starts:
            self.case_starts[symbol] = int(now_epoch)
        return int(self.case_starts[symbol])

    def settle_expired(self, case_lookup, provider, now_epoch=None):
        now_epoch = int(now_epoch or time.time())
        remaining = []
        for position in self.open_positions:
            expires_at = int(position["expiresAt"])
            if expires_at > now_epoch:
                remaining.append(position)
                continue

            case_payload = case_lookup(position["symbol"])
            started_at = self.ensure_case_started(position["symbol"], int(position["openedAt"]))
            exit_quote = quote_for_case(case_payload, started_at, expires_at, provider)

            entry_price = Decimal(str(position["entryPrice"]))
            exit_price = Decimal(str(exit_quote["price"]))
            result = _resolve_result(position["direction"], entry_price, exit_price)
            stake = int(position["stake"])

            if result == "won":
                payout = int(
                    (Decimal(stake) * (Decimal("1.0") + DEFAULT_PAYOUT_RATE)).quantize(
                        Decimal("1"), rounding=ROUND_HALF_UP
                    )
                )
            elif result == "draw":
                payout = stake
            else:
                payout = 0

            self.balance += payout
            history_item = dict(position)
            history_item.update(
                {
                    "status": "settled",
                    "result": result,
                    "payout": payout,
                    "profit": payout - stake,
                    "exitPrice": exit_quote["displayPrice"],
                    "settledAt": expires_at,
                }
            )
            self.history.insert(0, history_item)

        self.open_positions = remaining
        self.history = self.history[:MAX_HISTORY_ITEMS]

    def place_trade(self, symbol, direction, stake, duration, quote, now_epoch=None):
        now_epoch = int(now_epoch or time.time())
        if symbol not in SYMBOLS:
            raise ValueError("unknown symbol")
        if direction not in DIRECTIONS:
            raise ValueError("unknown direction")
        if duration not in DURATIONS:
            raise ValueError("unknown duration")
        if stake < MIN_STAKE:
            raise ValueError("stake too small")
        if stake > self.balance:
            raise ValueError("insufficient balance")

        self.ensure_case_started(symbol, now_epoch)
        position = {
            "id": uuid.uuid4().hex[:12],
            "symbol": symbol,
            "direction": direction,
            "stake": int(stake),
            "entryPrice": str(quote["displayPrice"]),
            "openedAt": now_epoch,
            "expiresAt": now_epoch + int(duration),
            "status": "open",
        }
        self.balance -= int(stake)
        self.open_positions.insert(0, position)
        return position

    def to_public_state(self, selected_symbol, cases_payload, current_quote, notices=None, now_epoch=None):
        now_epoch = int(now_epoch or time.time())
        public_open_positions = []
        for position in sorted(self.open_positions, key=lambda item: int(item["expiresAt"])):
            public_open_positions.append(
                {
                    "id": position["id"],
                    "symbol": position["symbol"],
                    "direction": position["direction"],
                    "stake": int(position["stake"]),
                    "entryPrice": position["entryPrice"],
                    "openedAt": int(position["openedAt"]),
                    "expiresAt": int(position["expiresAt"]),
                    "secondsLeft": max(0, int(position["expiresAt"]) - now_epoch),
                }
            )

        public_history = []
        for item in self.history[:MAX_HISTORY_ITEMS]:
            public_history.append(
                {
                    "id": item["id"],
                    "symbol": item["symbol"],
                    "direction": item["direction"],
                    "stake": int(item["stake"]),
                    "entryPrice": item["entryPrice"],
                    "exitPrice": item["exitPrice"],
                    "result": item["result"],
                    "payout": int(item["payout"]),
                    "profit": int(item["profit"]),
                    "settledAt": int(item["settledAt"]),
                }
            )

        selected_case = cases_payload["cases"][selected_symbol]
        case_started_at = self.ensure_case_started(selected_symbol, now_epoch)
        current_elapsed = int(current_quote["elapsedSeconds"])
        revealed_series = [float(price) for price in selected_case["series"][: current_elapsed + 1]]
        return {
            "balance": self.balance,
            "startingBalance": STARTING_BALANCE,
            "currency": "JPY",
            "selectedSymbol": selected_symbol,
            "symbols": list(SYMBOLS.keys()),
            "durations": list(DURATIONS),
            "defaultDuration": DEFAULT_DURATION,
            "minStake": MIN_STAKE,
            "payoutRate": float(DEFAULT_PAYOUT_RATE),
            "quote": current_quote,
            "provider": dict(cases_payload["provider"]),
            "tradingEnabled": True,
            "notices": list(dict.fromkeys(notices or [])),
            "openPositions": public_open_positions,
            "history": public_history,
            "chart": {
                "symbol": selected_symbol,
                "history": revealed_series,
                "elapsedSeconds": current_elapsed,
                "totalSeconds": int(selected_case["totalSeconds"]),
                "priceDigits": int(SYMBOLS[selected_symbol]["digits"]),
                "currentPrice": str(current_quote["displayPrice"]),
            },
            "caseInfo": {
                "symbol": selected_symbol,
                "referenceDate": selected_case["referenceDate"],
                "startedAt": case_started_at,
                "elapsedSeconds": current_elapsed,
                "totalSeconds": int(selected_case["totalSeconds"]),
                "completed": current_elapsed >= int(selected_case["totalSeconds"]),
            },
        }


def _resolve_result(direction, entry_price, exit_price):
    if exit_price == entry_price:
        return "draw"
    if direction == "up":
        return "won" if exit_price > entry_price else "lost"
    return "won" if exit_price < entry_price else "lost"


def build_public_state(simulation, selected_symbol, runtime_dir, now_epoch=None):
    now_epoch = int(now_epoch or time.time())
    cases_payload = load_daily_cases(runtime_dir, now_epoch=now_epoch)
    selected_symbol = selected_symbol if selected_symbol in SYMBOLS else DEFAULT_SYMBOL
    provider = dict(cases_payload["provider"])
    current_day_key = cases_payload["dayKey"]

    if simulation.case_day_key and simulation.case_day_key != current_day_key:
        previous_cases = _load_cached_cases(runtime_dir, simulation.case_day_key)
        if previous_cases is not None and simulation.open_positions:
            simulation.settle_expired(
                lambda symbol: previous_cases["cases"][symbol],
                dict(previous_cases.get("provider", provider)),
                now_epoch=now_epoch,
            )
        else:
            simulation.open_positions = []
        simulation.case_starts = {}

    simulation.case_day_key = current_day_key

    def case_lookup(symbol):
        return cases_payload["cases"][symbol]

    simulation.ensure_case_started(selected_symbol, now_epoch)
    simulation.settle_expired(case_lookup, provider, now_epoch=now_epoch)
    current_quote = quote_for_case(
        case_lookup(selected_symbol),
        simulation.ensure_case_started(selected_symbol, now_epoch),
        now_epoch,
        provider,
    )

    notices = [provider.get("noteCode", "binaryProviderHistorical")]
    return simulation.to_public_state(
        selected_symbol,
        cases_payload,
        current_quote,
        notices=notices,
        now_epoch=now_epoch,
    )
