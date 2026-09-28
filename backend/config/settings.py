"""Django settings for the SIWES Outreach Tracker backend.

Everything environment specific is read from env vars (a local .env file is
loaded in development). See .env.example for the full list.
"""

import os
import sys
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(name, default=False):
    return os.environ.get(name, str(default)).lower() in ("1", "true", "yes", "on")


def env_list(name, default=""):
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-insecure-key-change-me")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
if render_host := os.environ.get("RENDER_EXTERNAL_HOSTNAME"):
    ALLOWED_HOSTS.append(render_host)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "tracker",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Postgres via DATABASE_URL in production; SQLite fallback keeps local dev zero-setup.
DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
    )
}
# Tests never touch the real (Supabase) database.
if "test" in sys.argv:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.environ.get("TIME_ZONE", "Africa/Lagos")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["tracker.permissions.HasAccessKey"],
    "UNAUTHENTICATED_USER": None,
}
ACCESS_KEY = os.environ.get("ACCESS_KEY", "")
CRON_SECRET = os.environ.get("CRON_SECRET", "")

CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CORS_ALLOW_HEADERS = (
    "accept",
    "content-type",
    "x-access-key",
)

# Force HTTPS only behind Render's proxy (it sets RENDER=true), never on a
# local runserver, which speaks plain http whatever DJANGO_DEBUG says.
if env_bool("DJANGO_SSL_REDIRECT", bool(os.environ.get("RENDER"))):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True

# Follow-up drafting
# One key; the provider is inferred from its prefix unless LLM_PROVIDER is set.
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_DEFAULT_MODELS = {
    "groq": "openai/gpt-oss-120b",
    "xai": "grok-4",
    "anthropic": "claude-opus-5",
}


def _detect_provider(key):
    if key.startswith("gsk_"):
        return "groq"
    if key.startswith("xai-"):
        return "xai"
    if key.startswith("sk-ant-"):
        return "anthropic"
    return "groq"


LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "").lower() or _detect_provider(LLM_API_KEY)
LLM_MODEL = os.environ.get("LLM_MODEL", "") or LLM_DEFAULT_MODELS.get(LLM_PROVIDER, "")
FOLLOWUP_AFTER_DAYS = int(os.environ.get("FOLLOWUP_AFTER_DAYS", "7"))

# Web Push (generate with: python manage.py generate_vapid_keys)
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:amechisusanogechi@gmail.com")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
