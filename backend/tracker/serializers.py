from django.utils import timezone
from rest_framework import serializers

from .models import Channel, Company, FollowUp, Interaction, PushSubscription


class CompanySerializer(serializers.ModelSerializer):
    channels = serializers.ListField(
        child=serializers.ChoiceField(choices=Channel.choices), required=False
    )
    last_contact_at = serializers.DateTimeField(read_only=True)
    days_since_contact = serializers.SerializerMethodField()
    pending_followups = serializers.IntegerField(read_only=True)

    class Meta:
        model = Company
        fields = [
            "id", "name", "sector", "website", "fit_rationale", "priority", "channels",
            "instagram", "linkedin", "email", "status", "created_at", "updated_at",
            "last_contact_at", "days_since_contact", "pending_followups",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_days_since_contact(self, obj):
        last = getattr(obj, "last_contact_at", None)
        if not last:
            return None
        return (timezone.localdate() - timezone.localdate(last)).days

    def validate_channels(self, value):
        # Dedupe while keeping order.
        return list(dict.fromkeys(value))

    def to_internal_value(self, data):
        # Accept "example.com" as well as a full URL.
        website = data.get("website") if hasattr(data, "get") else None
        if isinstance(website, str) and website.strip() and "://" not in website:
            data = data.copy()
            data["website"] = f"https://{website.strip()}"
        return super().to_internal_value(data)


class InteractionSerializer(serializers.ModelSerializer):
    date = serializers.DateTimeField(required=False)

    class Meta:
        model = Interaction
        fields = ["id", "company", "channel", "direction", "message", "date", "notes"]

    def validate(self, attrs):
        if not attrs.get("date") and not self.instance:
            attrs["date"] = timezone.now()
        return attrs


class FollowUpSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    due_date = serializers.DateField(required=False)

    class Meta:
        model = FollowUp
        fields = [
            "id", "company", "company_name", "due_date", "drafted_message", "sent",
            "auto_created", "notified_at", "created_at",
        ]
        read_only_fields = ["auto_created", "notified_at", "created_at"]

    def validate(self, attrs):
        if not attrs.get("due_date") and not self.instance:
            attrs["due_date"] = timezone.localdate()
        return attrs


class MarkSentSerializer(serializers.Serializer):
    message = serializers.CharField(required=False, allow_blank=True)
    channel = serializers.ChoiceField(choices=Channel.choices, required=False)


class PushSubscriptionSerializer(serializers.Serializer):
    endpoint = serializers.URLField(max_length=1000)
    keys = serializers.DictField(child=serializers.CharField())

    def validate_keys(self, keys):
        if not keys.get("p256dh") or not keys.get("auth"):
            raise serializers.ValidationError("p256dh and auth keys are required.")
        return keys

    def save(self):
        data = self.validated_data
        sub, _ = PushSubscription.objects.update_or_create(
            endpoint=data["endpoint"],
            defaults={"p256dh": data["keys"]["p256dh"], "auth": data["keys"]["auth"]},
        )
        return sub
