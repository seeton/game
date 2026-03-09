import json
import os
import time
import uuid
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


STARTING_BALANCE = 1_000_000
DEFAULT_SYMBOL = "USD/JPY"
DEFAULT_DURATION = 60
DEFAULT_PAYOUT_RATE = Decimal("0.85")
MIN_STAKE = 1_000
MAX_HISTORY_ITEMS = 12
QUOTE_CACHE_TTL_SECONDS = 10
STALE_CACHE_MAX_AGE_SECONDS = 300
TWELVE_DATA_KEY_ENV = "TWELVEDATA_API_KEY"
ALLOW_DELAYED_TRADING_ENV = "BINARY_SIM_ALLOW_DELAYED_QUOTES"
QUOTE_CACHE_DIRNAME = "quote_cache"

SYMBOLS = {
    "USD/JPY": {"base": "USD", "quote": "JPY", "digits": 3},
    "EUR/JPY": {"base": "EUR", "quote": "JPY", "digits": 3},
    "GBP/JPY": {"base": "GBP", "quote": "JPY", "digits": 3},
}

DURATIONS = (30, 60, 180)
DIRECTIONS = {"up", "down"}


def _quantize_pattern(digits):
    return Decimal("1." + ("0" * digits))


def _format_price(symbol, price):
    digits = SYMBOLS[symbol]["digits"]
    return format(price.quantize(_quantize_pattern(digits)), "f")


def _format_timestamp(epoch_seconds):
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(int(epoch_seconds)))


def _cache_dir(runtime_dir):
    return os.path.join(runtime_dir, QUOTE_CACHE_DIRNAME)


def ensure_runtime_dirs(runtime_dir):
    directory = _cache_dir(runtime_dir)
    if not os.path.isdir(directory):
        os.makedirs(directory)


def _cache_path(runtime_dir, symbol):
    safe_symbol = symbol.replace("/", "_")
    return os.path.join(_cache_dir(runtime_dir), "%s.json" % safe_symbol)


def _read_cache(runtime_dir, symbol):
    path = _cache_path(runtime_dir, symbol)
    if not os.path.isfile(path):
        return None
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def _write_cache(runtime_dir, symbol, payload):
    ensure_runtime_dirs(runtime_dir)
    path = _cache_path(runtime_dir, symbol)
    temp_path = path + ".tmp"
    with open(temp_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, separators=(",", ":"))
    os.replace(temp_path, path)


def _fetch_json(url):
    request = Request(url, headers={"User-Agent": "SEETONA/1.0"})
    try:
        with urlopen(request, timeout=4) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(body or "quote provider request failed")
    except (URLError, OSError):
        raise RuntimeError("quote provider request failed")


def _twelve_data_quote(symbol):
    api_key = os.environ.get(TWELVE_DATA_KEY_ENV, "").strip()
    if not api_key:
        raise RuntimeError("live fx api key missing")

    payload = _fetch_json(
        "https://api.twelvedata.com/price?%s"
        % urlencode({"symbol": symbol, "apikey": api_key})
    )
    if payload.get("status") == "error":
        raise RuntimeError(payload.get("message") or "live fx quote failed")

    try:
        price = Decimal(str(payload["price"]))
    except (KeyError, InvalidOperation):
        raise RuntimeError("live fx quote failed")

    now_epoch = int(time.time())
    return {
        "symbol": symbol,
        "price": float(price),
        "displayPrice": _format_price(symbol, price),
        "updatedAt": _format_timestamp(now_epoch),
        "provider": {
            "name": "Twelve Data",
            "code": "live",
            "noteCode": "binaryProviderLive",
            "tradingEnabled": True,
            "stale": False,
        },
    }


def _frankfurter_quote(symbol):
    config = SYMBOLS[symbol]
    payload = _fetch_json(
        "https://api.frankfurter.dev/v1/latest?%s"
        % urlencode({"base": config["base"], "symbols": config["quote"]})
    )

    try:
        price = Decimal(str(payload["rates"][config["quote"]]))
    except (KeyError, InvalidOperation, TypeError):
        raise RuntimeError("daily fx quote failed")

    trading_enabled = str(os.environ.get(ALLOW_DELAYED_TRADING_ENV, "")).lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    quote_date = str(payload.get("date", ""))
    updated_label = "%sT16:00:00Z" % quote_date if quote_date else _format_timestamp(time.time())

    return {
        "symbol": symbol,
        "price": float(price),
        "displayPrice": _format_price(symbol, price),
        "updatedAt": updated_label,
        "provider": {
            "name": "Frankfurter",
            "code": "daily",
            "noteCode": "binaryProviderDailyEnabled" if trading_enabled else "binaryProviderDailyDisabled",
            "tradingEnabled": trading_enabled,
            "stale": False,
        },
    }


def get_quote(symbol, runtime_dir):
    if symbol not in SYMBOLS:
        raise ValueError("unknown symbol")

    cached = _read_cache(runtime_dir, symbol)
    now_epoch = int(time.time())
    if cached is not None:
        cache_age = now_epoch - int(cached.get("cachedAt", 0))
        if cache_age <= QUOTE_CACHE_TTL_SECONDS:
            return cached["quote"]

    provider_errors = []
    for fetcher in (_twelve_data_quote, _frankfurter_quote):
        try:
            quote = fetcher(symbol)
            _write_cache(runtime_dir, symbol, {"cachedAt": now_epoch, "quote": quote})
            return quote
        except RuntimeError as exc:
            provider_errors.append(str(exc))

    if cached is not None:
        cache_age = now_epoch - int(cached.get("cachedAt", 0))
        if cache_age <= STALE_CACHE_MAX_AGE_SECONDS:
            cached_quote = dict(cached["quote"])
            provider = dict(cached_quote.get("provider", {}))
            provider["stale"] = True
            provider["noteCode"] = "binaryProviderStale"
            cached_quote["provider"] = provider
            return cached_quote

    raise RuntimeError(provider_errors[-1] if provider_errors else "fx quote unavailable")


class BinarySimulation(object):
    def __init__(self, balance=STARTING_BALANCE, open_positions=None, history=None):
        self.balance = int(balance)
        self.open_positions = list(open_positions or [])
        self.history = list(history or [])

    def serialize(self):
        return {
            "balance": self.balance,
            "openPositions": self.open_positions,
            "history": self.history,
        }

    @classmethod
    def from_dict(cls, payload):
        return cls(
            balance=int(payload.get("balance", STARTING_BALANCE)),
            open_positions=payload.get("openPositions", []),
            history=payload.get("history", []),
        )

    def settle_expired(self, quote_lookup, now_epoch=None):
        now_epoch = int(now_epoch or time.time())
        pending = []
        remaining = []
        for position in self.open_positions:
            expires_at = int(position["expiresAt"])
            if expires_at > now_epoch:
                remaining.append(position)
                continue

            try:
                quote = quote_lookup(position["symbol"])
            except RuntimeError:
                remaining.append(position)
                pending.append("binarySettlementPending")
                continue

            entry_price = Decimal(str(position["entryPrice"]))
            exit_price = Decimal(str(quote["price"]))
            result = _resolve_result(position["direction"], entry_price, exit_price)
            stake = int(position["stake"])

            if result == "won":
                payout = int(
                    (
                        Decimal(stake) * (Decimal("1.0") + DEFAULT_PAYOUT_RATE)
                    ).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
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
                    "exitPrice": _format_price(position["symbol"], exit_price),
                    "settledAt": now_epoch,
                }
            )
            self.history.insert(0, history_item)

        self.open_positions = remaining
        self.history = self.history[:MAX_HISTORY_ITEMS]
        return pending

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
        if not bool(quote.get("provider", {}).get("tradingEnabled")):
            raise ValueError("live quote required")

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

    def to_public_state(self, selected_symbol, current_quote, notices=None, now_epoch=None):
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

        provider = current_quote.get("provider") if current_quote else {
            "name": "Unavailable",
            "code": "unavailable",
            "noteCode": "binaryProviderUnavailable",
            "tradingEnabled": False,
            "stale": False,
        }

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
            "provider": provider,
            "tradingEnabled": bool(provider.get("tradingEnabled")),
            "notices": list(dict.fromkeys(notices or [])),
            "openPositions": public_open_positions,
            "history": public_history,
        }


def _resolve_result(direction, entry_price, exit_price):
    if exit_price == entry_price:
        return "draw"
    if direction == "up":
        return "won" if exit_price > entry_price else "lost"
    return "won" if exit_price < entry_price else "lost"


def build_public_state(simulation, selected_symbol, runtime_dir, now_epoch=None):
    now_epoch = int(now_epoch or time.time())
    selected_symbol = selected_symbol if selected_symbol in SYMBOLS else DEFAULT_SYMBOL
    notices = []
    quote_cache = {}

    def quote_lookup(symbol):
        if symbol not in quote_cache:
            quote_cache[symbol] = get_quote(symbol, runtime_dir)
        return quote_cache[symbol]

    notices.extend(simulation.settle_expired(quote_lookup, now_epoch=now_epoch))

    current_quote = None
    try:
        current_quote = quote_lookup(selected_symbol)
    except RuntimeError:
        notices.append("binaryProviderUnavailable")

    if current_quote is not None:
        note_code = current_quote.get("provider", {}).get("noteCode")
        if note_code:
            notices.append(note_code)

    return simulation.to_public_state(
        selected_symbol,
        current_quote,
        notices=notices,
        now_epoch=now_epoch,
    )
