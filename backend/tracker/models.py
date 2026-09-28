from django.db import models


class Channel(models.TextChoices):
    INSTAGRAM = "instagram", "Instagram"
    LINKEDIN = "linkedin", "LinkedIn"
    EMAIL = "email", "Email"


class Company(models.Model):
    class Priority(models.TextChoices):
        HIGH = "high", "High"
        MEDIUM = "medium", "Medium"
        LOW = "low", "Low"

    class Status(models.TextChoices):
        NOT_CONTACTED = "not_contacted", "Not Contacted"
        SENT = "sent", "Sent"
        REPLIED = "replied", "Opened/Replied"
        IN_CONVERSATION = "in_conversation", "In Conversation"
        INTERVIEW = "interview", "Interview"
        CLOSED_WON = "closed_won", "Closed-Won"
        CLOSED_LOST = "closed_lost", "Closed-Lost"

    name = models.CharField(max_length=200)
    sector = models.CharField(max_length=120, blank=True)
    website = models.URLField(blank=True)
    fit_rationale = models.TextField(blank=True)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    # Stored as a list of Channel values, e.g. ["linkedin", "email"].
    channels = models.JSONField(default=list, blank=True)
    # Optional direct links/handles so Company Detail can link straight out.
    instagram = models.CharField(max_length=200, blank=True)
    linkedin = models.CharField(max_length=300, blank=True)
    email = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NOT_CONTACTED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "companies"

    def __str__(self):
        return self.name


class Interaction(models.Model):
    class Direction(models.TextChoices):
        SENT = "sent", "Sent"
        RECEIVED = "received", "Received"

    company = models.ForeignKey(Company, related_name="interactions", on_delete=models.CASCADE)
    channel = models.CharField(max_length=20, choices=Channel.choices)
    direction = models.CharField(max_length=10, choices=Direction.choices)
    message = models.TextField(blank=True)
    date = models.DateTimeField()
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["date", "id"]

    def __str__(self):
        return f"{self.company} {self.direction} via {self.channel} on {self.date:%Y-%m-%d}"


class FollowUp(models.Model):
    company = models.ForeignKey(Company, related_name="followups", on_delete=models.CASCADE)
    due_date = models.DateField()
    drafted_message = models.TextField(blank=True)
    sent = models.BooleanField(default=False)
    # True when the scheduled job created it, False when made from the button.
    auto_created = models.BooleanField(default=False)
    notified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["due_date", "id"]

    def __str__(self):
        return f"Follow up {self.company} on {self.due_date}"


class PushSubscription(models.Model):
    endpoint = models.URLField(max_length=1000, unique=True)
    p256dh = models.CharField(max_length=200)
    auth = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def as_webpush_info(self):
        return {"endpoint": self.endpoint, "keys": {"p256dh": self.p256dh, "auth": self.auth}}
