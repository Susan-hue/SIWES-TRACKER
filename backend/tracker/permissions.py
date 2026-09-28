import hmac

from django.conf import settings
from rest_framework.permissions import BasePermission


class HasAccessKey(BasePermission):
    """Allow everything when ACCESS_KEY is unset (local dev); otherwise require it."""

    message = "Missing or wrong access key."

    def has_permission(self, request, view):
        expected = settings.ACCESS_KEY
        if not expected:
            return True
        supplied = request.headers.get("X-Access-Key", "")
        return hmac.compare_digest(supplied.encode(), expected.encode())
