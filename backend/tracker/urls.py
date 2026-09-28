from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("companies", views.CompanyViewSet, basename="company")
router.register("interactions", views.InteractionViewSet, basename="interaction")
router.register("followups", views.FollowUpViewSet, basename="followup")

urlpatterns = [
    path("dashboard/", views.dashboard, name="dashboard"),
    path("config/", views.app_config, name="config"),
    path("push/subscription/", views.push_subscription, name="push-subscription"),
    path("push/test/", views.push_test, name="push-test"),
    path("cron/daily/", views.cron_daily, name="cron-daily"),
    path("", include(router.urls)),
]
