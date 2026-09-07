"""Shared helpers for the offline unit tests."""


def google_claims(email: str, **overrides) -> dict:
    claims = {
        "iss": "https://accounts.google.com",
        "aud": "917307607930-5mulp0qe4b55gvhrno6qbnvmh2a2e1sc.apps.googleusercontent.com",
        "email": email,
        "email_verified": True,
        "name": "Test User",
        "picture": "https://example.com/avatar.jpg",
    }
    claims.update(overrides)
    return claims
