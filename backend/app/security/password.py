"""
Password hashing.

Uses the `bcrypt` package directly instead of going through passlib.

passlib 1.7.4 reads `bcrypt.__about__.__version__`, which bcrypt removed in
4.1 — that combination (which is exactly what requirements.txt pins) logs a
noisy traceback on every hash and is a known source of hard-to-read 500s.
Hashes are byte-for-byte identical, so accounts created by the old code keep
working.
"""

import bcrypt


# bcrypt hashes at most 72 bytes and raises on anything longer.
_MAX_BCRYPT_BYTES = 72


def _normalize(password: str) -> bytes:
    if not isinstance(password, str):
        raise ValueError("Password must be a string")

    return password.encode("utf-8")[:_MAX_BCRYPT_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_normalize(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    if not password or not password_hash:
        return False

    try:
        return bcrypt.checkpw(
            _normalize(password),
            password_hash.encode("utf-8"),
        )
    except (ValueError, TypeError):
        # Malformed hash in the database — treat as a failed login rather than
        # letting a 500 escape to the client.
        return False
