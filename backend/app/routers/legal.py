"""Public legal pages: privacy policy, terms, support and data deletion.

Google Play will not publish an app without a reachable Privacy Policy URL, and
it requires a separate, publicly reachable page describing how to delete an
account. Serving them from the API itself means there is exactly one thing to
deploy and the URLs can never drift out of sync with the app.

The texts live as HTML fragments in `backend/legal/<doc>.<lang>.html`; this
module only wraps them in a shared shell. Editing a text therefore never means
touching Python.
"""
import re
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from app.config import ROOT_DIR


router = APIRouter(tags=["Legal"])


LEGAL_DIR = ROOT_DIR / "legal"

# Bump this whenever a text changes in a way users should notice.
LAST_UPDATED = "2026-09-20"

SUPPORTED_LANGUAGES = ("en", "ru", "de")
DEFAULT_LANGUAGE = "en"

CONTACT_EMAIL = "maxim.maslii777@gmail.com"


# --------------------------------------------------------------------------
# Per-document, per-language chrome
# --------------------------------------------------------------------------

DOCUMENTS: dict[str, dict] = {
    "privacy": {
        "path": "/privacy",
        "titles": {
            "en": "Privacy Policy",
            "ru": "Политика конфиденциальности",
            "de": "Datenschutzerklärung",
        },
    },
    "terms": {
        "path": "/terms",
        "titles": {
            "en": "Terms of Service",
            "ru": "Условия использования",
            "de": "Nutzungsbedingungen",
        },
    },
    "support": {
        "path": "/support",
        "titles": {
            "en": "Support",
            "ru": "Поддержка",
            "de": "Support",
        },
    },
    "deletion": {
        "path": "/data-deletion",
        "titles": {
            "en": "Data deletion",
            "ru": "Удаление данных",
            "de": "Datenlöschung",
        },
    },
}


UPDATED_LABEL = {
    "en": "Last updated",
    "ru": "Обновлено",
    "de": "Zuletzt aktualisiert",
}

NAV_LABEL = {
    "en": ("Privacy", "Terms", "Support", "Data deletion"),
    "ru": ("Конфиденциальность", "Условия", "Поддержка", "Удаление данных"),
    "de": ("Datenschutz", "Nutzungsbedingungen", "Support", "Datenlöschung"),
}

INDEX_TITLE = {
    "en": "Legal & Support",
    "ru": "Правовая информация и поддержка",
    "de": "Rechtliches & Support",
}

FOOTER_NOTE = {
    "en": "PrankFX — AI photo and video effects. Questions:",
    "ru": "PrankFX — ИИ-эффекты для фото и видео. Вопросы:",
    "de": "PrankFX — KI-Effekte für Fotos und Videos. Fragen:",
}


# --------------------------------------------------------------------------
# Shell
# --------------------------------------------------------------------------

_SHELL = """<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} — PrankFX</title>
<meta name="description" content="{title} — PrankFX">
<meta name="robots" content="index, follow">
{alternates}
<style>
  :root {{
    color-scheme: light dark;
    --bg: #ffffff;
    --fg: #16181d;
    --muted: #5d6470;
    --line: #e3e6ec;
    --card: #f6f7f9;
    --brand: #ff3b30;
  }}
  @media (prefers-color-scheme: dark) {{
    :root {{
      --bg: #0f1114;
      --fg: #e9ebef;
      --muted: #9aa2af;
      --line: #23262d;
      --card: #171a1f;
      --brand: #ff5a50;
    }}
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    background: var(--bg);
    color: var(--fg);
    font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          "Helvetica Neue", Arial, sans-serif;
    -webkit-text-size-adjust: 100%;
  }}
  .wrap {{ max-width: 760px; margin: 0 auto; padding: 32px 20px 72px; }}
  header {{ border-bottom: 1px solid var(--line); padding-bottom: 20px; margin-bottom: 28px; }}
  .brand {{
    display: inline-flex; align-items: baseline; gap: 8px;
    font-weight: 800; letter-spacing: -0.3px; font-size: 20px;
    text-decoration: none; color: var(--fg);
  }}
  .brand span {{ color: var(--brand); }}
  h1 {{ font-size: 30px; line-height: 1.2; letter-spacing: -0.5px; margin: 18px 0 6px; }}
  h2 {{ font-size: 20px; letter-spacing: -0.2px; margin: 34px 0 10px; }}
  h3 {{ font-size: 16px; margin: 22px 0 6px; }}
  p, li {{ color: var(--fg); }}
  .updated {{ color: var(--muted); font-size: 14px; margin: 0; }}
  .lead {{ font-size: 17px; color: var(--muted); }}
  a {{ color: var(--brand); text-decoration-thickness: 1px; text-underline-offset: 2px; }}
  code {{
    background: var(--card); border: 1px solid var(--line);
    border-radius: 5px; padding: 1px 5px; font-size: 13.5px;
  }}
  ul, ol {{ padding-left: 22px; }}
  li {{ margin: 5px 0; }}
  table {{ border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 14.5px; }}
  th, td {{ border: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }}
  th {{ background: var(--card); font-weight: 600; }}
  .card {{
    background: var(--card); border: 1px solid var(--line);
    border-radius: 12px; padding: 16px 18px; margin: 20px 0;
  }}
  nav.langs {{ display: flex; gap: 6px; margin-top: 14px; }}
  nav.langs a {{
    font-size: 13px; font-weight: 600; text-decoration: none;
    padding: 4px 10px; border-radius: 999px;
    border: 1px solid var(--line); color: var(--muted);
  }}
  nav.langs a.on {{ background: var(--brand); border-color: var(--brand); color: #fff; }}
  footer {{
    margin-top: 48px; padding-top: 20px; border-top: 1px solid var(--line);
    color: var(--muted); font-size: 14px;
  }}
  footer .links {{ display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 10px; }}
  @media (max-width: 480px) {{
    h1 {{ font-size: 25px; }}
    table {{ font-size: 13.5px; }}
    th, td {{ padding: 6px 8px; }}
  }}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="/legal?lang={lang}">Prank<span>FX</span></a>
    <h1>{title}</h1>
    <p class="updated">{updated_label}: {updated}</p>
    <nav class="langs">{langs}</nav>
  </header>
  <main>
{body}
  </main>
  <footer>
    <div class="links">{nav}</div>
    <div>{note} <a href="mailto:{email}">{email}</a></div>
  </footer>
</div>
</body>
</html>
"""


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

# (path, mtime) -> rendered fragment, so a text edit shows up without a restart
# but the file is not read on every request.
_FRAGMENT_CACHE: dict[str, tuple[float, str]] = {}


def _pick_language(request: Request, requested: str | None) -> str:
    """Query parameter wins, then Accept-Language, then English."""

    if requested:
        candidate = requested.strip().lower()[:2]

        if candidate in SUPPORTED_LANGUAGES:
            return candidate

    header = request.headers.get("accept-language", "")

    for chunk in header.split(","):
        candidate = chunk.split(";")[0].strip().lower()[:2]

        if candidate in SUPPORTED_LANGUAGES:
            return candidate

    return DEFAULT_LANGUAGE


def _load_fragment(doc: str, lang: str) -> str:
    path = LEGAL_DIR / f"{doc}.{lang}.html"

    if not path.is_file():
        path = LEGAL_DIR / f"{doc}.{DEFAULT_LANGUAGE}.html"

    if not path.is_file():
        return "<p>This document is not available yet.</p>"

    key = str(path)
    mtime = path.stat().st_mtime
    cached = _FRAGMENT_CACHE.get(key)

    if cached and cached[0] == mtime:
        return cached[1]

    text = path.read_text(encoding="utf-8")
    _FRAGMENT_CACHE[key] = (mtime, text)

    return text


_INTERNAL_HREF = re.compile(r'href="(/(?:privacy|terms|support|data-deletion|legal))"')


def _keep_language(html: str, lang: str) -> str:
    """Carry the chosen language across the links inside a document."""

    if lang == DEFAULT_LANGUAGE:
        return html

    return _INTERNAL_HREF.sub(rf'href="\1?lang={lang}"', html)


def _language_switcher(doc_path: str, lang: str) -> str:
    return "".join(
        f'<a class="{"on" if code == lang else ""}" '
        f'href="{doc_path}?lang={code}">{code.upper()}</a>'
        for code in SUPPORTED_LANGUAGES
    )


def _alternates(doc_path: str) -> str:
    return "\n".join(
        f'<link rel="alternate" hreflang="{code}" href="{doc_path}?lang={code}">'
        for code in SUPPORTED_LANGUAGES
    )


def _footer_nav(lang: str) -> str:
    labels = NAV_LABEL.get(lang, NAV_LABEL[DEFAULT_LANGUAGE])
    suffix = "" if lang == DEFAULT_LANGUAGE else f"?lang={lang}"

    paths = ("/privacy", "/terms", "/support", "/data-deletion")

    return "".join(
        f'<a href="{path}{suffix}">{label}</a>'
        for path, label in zip(paths, labels)
    )


def _render(doc: str, request: Request, lang: str | None) -> HTMLResponse:
    document = DOCUMENTS[doc]
    language = _pick_language(request, lang)

    body = _keep_language(_load_fragment(doc, language), language)

    html = _SHELL.format(
        lang=language,
        title=document["titles"].get(language, document["titles"][DEFAULT_LANGUAGE]),
        updated=LAST_UPDATED,
        updated_label=UPDATED_LABEL.get(language, UPDATED_LABEL[DEFAULT_LANGUAGE]),
        langs=_language_switcher(document["path"], language),
        alternates=_alternates(document["path"]),
        nav=_footer_nav(language),
        note=FOOTER_NOTE.get(language, FOOTER_NOTE[DEFAULT_LANGUAGE]),
        email=CONTACT_EMAIL,
        body=body,
    )

    return HTMLResponse(
        html,
        headers={"Cache-Control": "public, max-age=3600"},
    )


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------


@router.get("/privacy", response_class=HTMLResponse, include_in_schema=False)
async def privacy(request: Request, lang: str | None = None):
    return _render("privacy", request, lang)


@router.get("/terms", response_class=HTMLResponse, include_in_schema=False)
async def terms(request: Request, lang: str | None = None):
    return _render("terms", request, lang)


@router.get("/support", response_class=HTMLResponse, include_in_schema=False)
async def support(request: Request, lang: str | None = None):
    return _render("support", request, lang)


@router.get("/data-deletion", response_class=HTMLResponse, include_in_schema=False)
async def data_deletion(request: Request, lang: str | None = None):
    return _render("deletion", request, lang)


@router.get("/legal", response_class=HTMLResponse, include_in_schema=False)
async def legal_index(request: Request, lang: str | None = None):
    """One page to link from a store listing or a mail signature."""

    language = _pick_language(request, lang)
    labels = NAV_LABEL.get(language, NAV_LABEL[DEFAULT_LANGUAGE])
    suffix = "" if language == DEFAULT_LANGUAGE else f"?lang={language}"

    items = "".join(
        f'<li><a href="{path}{suffix}">{label}</a></li>'
        for path, label in zip(
            ("/privacy", "/terms", "/support", "/data-deletion"),
            labels,
        )
    )

    html = _SHELL.format(
        lang=language,
        title=INDEX_TITLE.get(language, INDEX_TITLE[DEFAULT_LANGUAGE]),
        updated=LAST_UPDATED,
        updated_label=UPDATED_LABEL.get(language, UPDATED_LABEL[DEFAULT_LANGUAGE]),
        langs=_language_switcher("/legal", language),
        alternates=_alternates("/legal"),
        nav=_footer_nav(language),
        note=FOOTER_NOTE.get(language, FOOTER_NOTE[DEFAULT_LANGUAGE]),
        email=CONTACT_EMAIL,
        body=f"<ul>{items}</ul>",
    )

    return HTMLResponse(html, headers={"Cache-Control": "public, max-age=3600"})


# Convenience aliases so a link written from memory still resolves.
@router.get("/privacy-policy", include_in_schema=False)
async def privacy_alias():
    return RedirectResponse("/privacy", status_code=301)


@router.get("/delete-account", include_in_schema=False)
async def deletion_alias():
    return RedirectResponse("/data-deletion", status_code=301)
