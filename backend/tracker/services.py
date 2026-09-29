"""Business rules that don't belong in views: status automation, the daily
follow-up check, push delivery and analytics."""

import json
import logging
from collections import defaultdict
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .drafts import DraftError, generate_followup_draft
from .models import Channel, Company, FollowUp, Interaction, PushSubscription

logger = logging.getLogger(__name__)

STATUS_ORDER = [value for value, _ in Company.Status.choices]


# ---------------------------------------------------------------- status rules

def apply_interaction_to_status(interaction):
    """Nudge the pipeline forward when an interaction is logged. Never moves a
    company backwards and never touches a status you set by hand past these."""
    company = interaction.company
    Status = Company.Status
    if interaction.direction == Interaction.Direction.SENT:
        if company.status == Status.NOT_CONTACTED:
            company.status = Status.SENT
            company.save(update_fields=["status", "updated_at"])
    elif company.status in (Status.NOT_CONTACTED, Status.SENT):
        company.status = Status.REPLIED
        company.save(update_fields=["status", "updated_at"])


def default_channel_for(company):
    last = company.interactions.filter(direction=Interaction.Direction.SENT).order_by("-date").first()
    if last:
        return last.channel
    if company.channels:
        return company.channels[0]
    return Channel.LINKEDIN


@transaction.atomic
def mark_followup_sent(followup, message=None, channel=None):
    """Record a follow-up as sent by hand: it becomes a Sent interaction, which
    also resets the silence timer for the next automatic follow-up."""
    if message is not None:
        followup.drafted_message = message
    followup.sent = True
    followup.save(update_fields=["drafted_message", "sent"])
    interaction = Interaction.objects.create(
        company=followup.company,
        channel=channel or default_channel_for(followup.company),
        direction=Interaction.Direction.SENT,
        message=followup.drafted_message,
        date=timezone.now(),
        notes="Follow up",
    )
    apply_interaction_to_status(interaction)
    return interaction


# ------------------------------------------------------------- daily follow-up

def companies_needing_followup(now=None):
    """Companies sitting in Sent for more than FOLLOWUP_AFTER_DAYS since the
    last message with no reply, and no follow-up already waiting."""
    now = now or timezone.now()
    cutoff = now - timedelta(days=settings.FOLLOWUP_AFTER_DAYS)
    result = []
    candidates = Company.objects.filter(status=Company.Status.SENT).prefetch_related(
        "interactions", "followups"
    )
    for company in candidates:
        sent = [i for i in company.interactions.all() if i.direction == Interaction.Direction.SENT]
        if not sent:
            continue
        last_sent = max(i.date for i in sent)
        if last_sent > cutoff:
            continue
        replied = any(
            i.direction == Interaction.Direction.RECEIVED and i.date >= last_sent
            for i in company.interactions.all()
        )
        if replied:
            continue
        # One pending follow-up at a time, and don't recreate one you deleted
        # for this same stretch of silence.
        if any(not f.sent or f.created_at >= last_sent for f in company.followups.all()):
            continue
        result.append(company)
    return result


def create_auto_followups(now=None, draft=True):
    created = []
    today = timezone.localdate(now) if now else timezone.localdate()
    for company in companies_needing_followup(now):
        message = ""
        if draft:
            try:
                message = generate_followup_draft(company)
            except DraftError as exc:
                logger.warning("Draft for %s failed: %s", company, exc)
        created.append(
            FollowUp.objects.create(
                company=company, due_date=today, drafted_message=message, auto_created=True
            )
        )
    return created


def notify_due_followups():
    """Push one notification summarising follow-ups that are due and haven't
    been announced yet. Returns the number of follow-ups announced."""
    due = list(
        FollowUp.objects.filter(
            sent=False, due_date__lte=timezone.localdate(), notified_at__isnull=True
        ).select_related("company")
    )
    if not due:
        return 0
    names = [f.company.name for f in due]
    if len(names) == 1:
        title, body = "Follow up due", f"Time to follow up with {names[0]}."
    else:
        shown = ", ".join(names[:3]) + (f" and {len(names) - 3} more" if len(names) > 3 else "")
        title, body = f"{len(names)} follow ups due", shown
    url = f"/companies/{due[0].company_id}" if len(due) == 1 else "/"
    delivered = send_push(title, body, url)
    if delivered:
        FollowUp.objects.filter(pk__in=[f.pk for f in due]).update(notified_at=timezone.now())
    return len(due) if delivered else 0


def run_daily_check(draft=True):
    created = create_auto_followups(draft=draft)
    notified = notify_due_followups()
    return {"followups_created": len(created), "followups_notified": notified}


# ------------------------------------------------------------------------ push

def push_configured():
    return bool(settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY)


def send_push(title, body, url="/"):
    """Send to every registered device. Returns how many deliveries succeeded."""
    if not push_configured():
        logger.info("Push skipped, VAPID keys not configured")
        return 0
    from pywebpush import WebPushException, webpush

    payload = json.dumps({"title": title, "body": body, "url": url})
    delivered = 0
    for sub in PushSubscription.objects.all():
        try:
            webpush(
                subscription_info=sub.as_webpush_info(),
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_SUBJECT},
                ttl=60 * 60 * 24,
            )
            delivered += 1
        except WebPushException as exc:
            status = getattr(exc.response, "status_code", None)
            if status in (404, 410):
                sub.delete()  # device unsubscribed or expired
            else:
                logger.warning("Push to %s failed: %s", sub.endpoint[:60], exc)
    return delivered


# ------------------------------------------------------------------- analytics

REPLIED_STATUSES = {
    Company.Status.REPLIED,
    Company.Status.IN_CONVERSATION,
    Company.Status.INTERVIEW,
    Company.Status.CLOSED_WON,
}


def _rate(responded, contacted):
    return round(responded / contacted, 3) if contacted else None


def dashboard_data():
    today = timezone.localdate()
    companies = list(Company.objects.prefetch_related("interactions"))
    channel_labels = dict(Channel.choices)

    funnel_counts = defaultdict(int)
    by_channel = defaultdict(lambda: [0, 0])  # channel -> [contacted, responded]
    by_sector = defaultdict(lambda: [0, 0])
    reply_days = []
    first_contact_dates = []
    contacted_total = responded_total = messages_sent = 0

    for company in companies:
        funnel_counts[company.status] += 1
        interactions = list(company.interactions.all())
        sent = [i for i in interactions if i.direction == Interaction.Direction.SENT]
        received = [i for i in interactions if i.direction == Interaction.Direction.RECEIVED]
        messages_sent += len(sent)

        # Moving a card on the pipeline counts even when no message was logged.
        contacted = bool(sent) or company.status != Company.Status.NOT_CONTACTED
        if not contacted:
            continue
        responded = bool(received) or company.status in REPLIED_STATUSES
        contacted_total += 1
        responded_total += responded
        sector = company.sector.strip() or "Unspecified"
        by_sector[sector][0] += 1
        by_sector[sector][1] += responded

        # Channel, weekly volume and reply time need dated messages.
        if not sent:
            continue
        first_sent = min(i.date for i in sent)
        first_contact_dates.append(timezone.localdate(first_sent))

        for channel in {i.channel for i in sent}:
            by_channel[channel][0] += 1
            by_channel[channel][1] += any(r.channel == channel for r in received)

        replies_after = [r.date for r in received if r.date >= first_sent]
        if replies_after:
            reply_days.append((min(replies_after) - first_sent).total_seconds() / 86400)

    # Companies first contacted per week, last 12 weeks (weeks start Monday).
    this_week = today - timedelta(days=today.weekday())
    weeks = [this_week - timedelta(weeks=n) for n in range(11, -1, -1)]
    week_counts = defaultdict(int)
    for d in first_contact_dates:
        week_counts[d - timedelta(days=d.weekday())] += 1

    due = FollowUp.objects.filter(sent=False, due_date__lte=today).select_related("company")

    return {
        "totals": {
            "companies": len(companies),
            "contacted": contacted_total,
            "messages_sent": messages_sent,
            "responded": responded_total,
            "response_rate": _rate(responded_total, contacted_total),
            "followups_due_today": sum(1 for f in due if f.due_date == today),
            "followups_overdue": sum(1 for f in due if f.due_date < today),
            "avg_days_to_first_reply": round(sum(reply_days) / len(reply_days), 1) if reply_days else None,
        },
        "funnel": [
            {"status": value, "label": label, "count": funnel_counts[value]}
            for value, label in Company.Status.choices
        ],
        "by_channel": [
            {
                "channel": value,
                "label": channel_labels[value],
                "contacted": by_channel[value][0],
                "responded": by_channel[value][1],
                "rate": _rate(by_channel[value][1], by_channel[value][0]),
            }
            for value, _ in Channel.choices
        ],
        "by_sector": sorted(
            (
                {"sector": s, "contacted": c, "responded": r, "rate": _rate(r, c)}
                for s, (c, r) in by_sector.items()
            ),
            key=lambda row: (-(row["rate"] or 0), -row["contacted"], row["sector"]),
        ),
        "weekly_volume": [{"week": w.isoformat(), "count": week_counts[w]} for w in weeks],
        "due_followups": [
            {
                "id": f.id,
                "company": f.company_id,
                "company_name": f.company.name,
                "due_date": f.due_date.isoformat(),
                "overdue": f.due_date < today,
                "has_draft": bool(f.drafted_message),
            }
            for f in due
        ],
    }
