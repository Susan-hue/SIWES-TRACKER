import hmac

from django.conf import settings
from django.db.models import Count, Max, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from . import services
from .drafts import DraftError, generate_followup_draft
from .models import Company, FollowUp, Interaction, PushSubscription
from .serializers import (
    CompanySerializer,
    FollowUpSerializer,
    InteractionSerializer,
    MarkSentSerializer,
    PushSubscriptionSerializer,
)


class CompanyViewSet(viewsets.ModelViewSet):
    serializer_class = CompanySerializer
    pagination_class = None

    def get_queryset(self):
        qs = Company.objects.annotate(
            last_contact_at=Max("interactions__date"),
            pending_followups=Count("followups", filter=Q(followups__sent=False), distinct=True),
        )
        params = self.request.query_params
        if status_filter := params.get("status"):
            qs = qs.filter(status=status_filter)
        if search := params.get("search"):
            qs = qs.filter(Q(name__icontains=search) | Q(sector__icontains=search))
        return qs

    @action(detail=True, methods=["post"], url_path="draft-followup")
    def draft_followup(self, request, pk=None):
        """Create a FollowUp with an LLM drafted message. If drafting fails the
        follow-up is still created (empty) so it can be written by hand."""
        company = self.get_object()
        draft_error = None
        try:
            message = generate_followup_draft(company)
        except DraftError as exc:
            message, draft_error = "", str(exc)
        followup = FollowUp.objects.create(
            company=company, due_date=timezone.localdate(), drafted_message=message
        )
        data = FollowUpSerializer(followup).data
        data["draft_error"] = draft_error
        return Response(data, status=status.HTTP_201_CREATED)


class InteractionViewSet(viewsets.ModelViewSet):
    serializer_class = InteractionSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Interaction.objects.all()
        if company := self.request.query_params.get("company"):
            qs = qs.filter(company_id=company)
        return qs

    def perform_create(self, serializer):
        interaction = serializer.save()
        services.apply_interaction_to_status(interaction)


class FollowUpViewSet(viewsets.ModelViewSet):
    serializer_class = FollowUpSerializer
    pagination_class = None

    def get_queryset(self):
        qs = FollowUp.objects.select_related("company")
        params = self.request.query_params
        if company := params.get("company"):
            qs = qs.filter(company_id=company)
        if params.get("due") == "1":
            qs = qs.filter(sent=False, due_date__lte=timezone.localdate())
        return qs

    @action(detail=True, methods=["post"], url_path="mark-sent")
    def mark_sent(self, request, pk=None):
        followup = self.get_object()
        if followup.sent:
            return Response({"detail": "Already marked as sent."}, status=status.HTTP_400_BAD_REQUEST)
        body = MarkSentSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        services.mark_followup_sent(
            followup,
            message=body.validated_data.get("message"),
            channel=body.validated_data.get("channel"),
        )
        followup.refresh_from_db()
        return Response(FollowUpSerializer(followup).data)

    @action(detail=True, methods=["post"])
    def regenerate(self, request, pk=None):
        followup = self.get_object()
        try:
            followup.drafted_message = generate_followup_draft(followup.company)
        except DraftError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        followup.save(update_fields=["drafted_message"])
        return Response(FollowUpSerializer(followup).data)


@api_view(["GET"])
def dashboard(request):
    return Response(services.dashboard_data())


@api_view(["GET"])
def app_config(request):
    return Response(
        {
            "vapid_public_key": settings.VAPID_PUBLIC_KEY or None,
            "drafting_enabled": bool(settings.LLM_API_KEY),
            "llm_provider": settings.LLM_PROVIDER if settings.LLM_API_KEY else None,
            "followup_after_days": settings.FOLLOWUP_AFTER_DAYS,
        }
    )


@api_view(["POST", "DELETE"])
def push_subscription(request):
    if request.method == "DELETE":
        PushSubscription.objects.filter(endpoint=request.data.get("endpoint", "")).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    serializer = PushSubscriptionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({"ok": True}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def push_test(request):
    if not services.push_configured():
        return Response({"detail": "VAPID keys are not configured on the server."}, status=400)
    delivered = services.send_push("Notifications are on", "You'll hear from me when a follow up is due.")
    return Response({"delivered": delivered})


@api_view(["POST"])
@permission_classes([AllowAny])
def cron_daily(request):
    """Hit daily by an external scheduler (GitHub Actions / Render cron) with
    the X-Cron-Secret header. Same work as `manage.py check_followups`."""
    secret = settings.CRON_SECRET
    supplied = request.headers.get("X-Cron-Secret", "")
    if not secret or not hmac.compare_digest(supplied.encode(), secret.encode()):
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    return Response(services.run_daily_check())
