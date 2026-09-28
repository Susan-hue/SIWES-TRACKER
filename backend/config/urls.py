from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path

urlpatterns = [
    path("", lambda request: JsonResponse({"service": "siwes-outreach-tracker", "ok": True})),
    path("admin/", admin.site.urls),
    path("api/", include("tracker.urls")),
]
