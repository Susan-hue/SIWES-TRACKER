"""Follow-up draft generation via an LLM (Groq, xAI Grok or Anthropic Claude).

Drafts are only ever suggestions: they are saved on a FollowUp and edited by
hand. Nothing here sends a message anywhere.

Switching provider = changing LLM_API_KEY (the provider is detected from the
key prefix, or forced with LLM_PROVIDER). All provider-specific code lives in
`call_llm` below.
"""

import json
import logging
import re
import urllib.error
import urllib.request

from django.conf import settings
from django.utils import timezone

from .models import Interaction

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You write short follow-up messages for Emmanuel, a Nigerian \
Cloud and DevOps student looking for a SIWES (industrial training) placement \
and building his professional network.

Write in clean, warm, professional prose. Keep it brief: three to five \
sentences, suitable for a LinkedIn message, Instagram DM, or short email. \
Politely reference the earlier message, restate in one line why he is a good \
fit for this company specifically, and close with a clear, low pressure ask.

Never use em dashes, en dashes, or hyphens. Rephrase instead (write \
"follow up", "well known", and so on). Do not use exclamation marks more \
than once. Do not invent facts about Emmanuel or the company beyond what you \
are given. Reply with the message text only: no subject line, no preamble, \
no placeholders in brackets, signed simply "Emmanuel"."""

DASH_PATTERN = re.compile(r"\s*[—–]\s*")

# OpenAI-compatible chat completion endpoints.
OPENAI_COMPATIBLE_URLS = {
    "groq": "https://api.groq.com/openai/v1/chat/completions",
    "xai": "https://api.x.ai/v1/chat/completions",
}


class DraftError(Exception):
    pass


def _style_examples(limit=3):
    """Emmanuel's own recent sent messages, so drafts pick up his voice over time."""
    messages = (
        Interaction.objects.filter(direction=Interaction.Direction.SENT)
        .exclude(message="")
        .order_by("-date")
        .values_list("message", flat=True)[:limit]
    )
    return list(messages)


def build_prompt(company):
    last_sent = (
        company.interactions.filter(direction=Interaction.Direction.SENT).order_by("-date").first()
    )
    if last_sent:
        days_silent = (timezone.now() - last_sent.date).days
        last_block = (
            f"Last message Emmanuel sent (via {last_sent.get_channel_display()}, "
            f"{days_silent} days ago, no reply since):\n{last_sent.message or '(not recorded)'}"
        )
        channel = last_sent.get_channel_display()
    else:
        last_block = "No earlier message is recorded. Write a first, friendly check in."
        channel = "LinkedIn"

    parts = [
        f"Company: {company.name}",
        f"Sector: {company.sector or 'unknown'}",
        f"Why this company is a fit: {company.fit_rationale or 'not recorded'}",
        f"Channel for this follow up: {channel}",
        "",
        last_block,
    ]
    examples = _style_examples()
    if examples:
        parts += ["", "Examples of Emmanuel's own writing, match this voice:"]
        parts += [f"<example>\n{text}\n</example>" for text in examples]
    parts += ["", "Write the follow up message now."]
    return "\n".join(parts)


def clean_draft(text):
    # Belt and braces for the "no em dashes" rule, plus reasoning tags some
    # open models leak into their output.
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S)
    return DASH_PATTERN.sub(", ", text).strip()


# ------------------------------------------------------------------ providers

def _call_openai_compatible(provider, system, user):
    body = {
        "model": settings.LLM_MODEL,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "max_tokens": 2000,
    }
    request = urllib.request.Request(
        OPENAI_COMPATIBLE_URLS[provider],
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {settings.LLM_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "siwes-outreach-tracker",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.load(response)
    except urllib.error.HTTPError as exc:
        detail = exc.read()[:300].decode(errors="replace")
        logger.warning("%s API error %s: %s", provider, exc.code, detail)
        if exc.code in (401, 403):
            raise DraftError(f"The {provider} API key was rejected.") from exc
        if exc.code == 429:
            raise DraftError("Rate limit hit, try again in a minute.") from exc
        raise DraftError(f"{provider} API error ({exc.code}).") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise DraftError(f"Could not reach the {provider} API.") from exc

    try:
        return data["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError) as exc:
        raise DraftError("Unexpected response from the LLM API.") from exc


def _call_anthropic(system, user):
    import anthropic

    client = anthropic.Anthropic(api_key=settings.LLM_API_KEY, timeout=60.0)
    try:
        response = client.beta.messages.create(
            model=settings.LLM_MODEL,
            max_tokens=2000,
            system=system,
            messages=[{"role": "user", "content": user}],
            output_config={"effort": "low"},
            # If a safety classifier declines, the API re-runs on its recommended fallback model.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.AuthenticationError as exc:
        raise DraftError("The Anthropic API key was rejected.") from exc
    except anthropic.RateLimitError as exc:
        raise DraftError("Rate limit hit, try again in a minute.") from exc
    except anthropic.APIStatusError as exc:
        logger.exception("Claude API error")
        raise DraftError(f"Claude API error ({exc.status_code}).") from exc
    except anthropic.APIConnectionError as exc:
        raise DraftError("Could not reach the Claude API.") from exc
    if response.stop_reason == "refusal":
        raise DraftError("Claude declined to draft this message.")
    return "".join(block.text for block in response.content if block.type == "text")


def call_llm(system, user):
    """The one place that knows about providers. Returns the raw reply text."""
    provider = settings.LLM_PROVIDER
    if provider == "anthropic":
        return _call_anthropic(system, user)
    if provider in OPENAI_COMPATIBLE_URLS:
        return _call_openai_compatible(provider, system, user)
    raise DraftError(f"Unknown LLM_PROVIDER '{provider}'.")


def generate_followup_draft(company):
    if not settings.LLM_API_KEY:
        raise DraftError("LLM_API_KEY is not set on the server.")
    text = clean_draft(call_llm(SYSTEM_PROMPT, build_prompt(company)))
    if not text:
        raise DraftError("The model returned an empty draft.")
    return text
