import csv
import json
from datetime import timedelta
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker import services
from tracker.drafts import DraftError, clean_draft
from tracker.models import Company, FollowUp, Interaction


def make_company(**kwargs):
    defaults = {"name": "Acme Cloud", "sector": "Fintech", "fit_rationale": "Runs on AWS"}
    return Company.objects.create(**{**defaults, **kwargs})


def log(company, direction, days_ago, channel="linkedin", message="Hello"):
    return Interaction.objects.create(
        company=company, direction=direction, channel=channel, message=message,
        date=timezone.now() - timedelta(days=days_ago),
    )


class StatusAutomationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.company = make_company()

    def post_interaction(self, direction):
        return self.client.post(
            "/api/interactions/",
            {"company": self.company.id, "channel": "email", "direction": direction, "message": "Hi"},
            format="json",
        )

    def test_sent_moves_not_contacted_to_sent(self):
        self.assertEqual(self.post_interaction("sent").status_code, 201)
        self.company.refresh_from_db()
        self.assertEqual(self.company.status, Company.Status.SENT)

    def test_received_moves_to_replied(self):
        self.post_interaction("sent")
        self.post_interaction("received")
        self.company.refresh_from_db()
        self.assertEqual(self.company.status, Company.Status.REPLIED)

    def test_never_moves_backwards(self):
        self.company.status = Company.Status.INTERVIEW
        self.company.save()
        self.post_interaction("received")
        self.company.refresh_from_db()
        self.assertEqual(self.company.status, Company.Status.INTERVIEW)


class CompanyApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_quick_add_normalises_website(self):
        res = self.client.post(
            "/api/companies/",
            {"name": "Paystack", "sector": "Fintech", "channels": ["linkedin"], "website": "paystack.com"},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["website"], "https://paystack.com")
        self.assertEqual(res.data["status"], "not_contacted")

    def test_days_since_contact(self):
        company = make_company()
        log(company, "sent", days_ago=4)
        res = self.client.get(f"/api/companies/{company.id}/")
        self.assertEqual(res.data["days_since_contact"], 4)

    @override_settings(ACCESS_KEY="secret")
    def test_access_key_enforced_when_set(self):
        self.assertEqual(self.client.get("/api/companies/").status_code, 403)
        res = self.client.get("/api/companies/", HTTP_X_ACCESS_KEY="secret")
        self.assertEqual(res.status_code, 200)


class FollowUpTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.company = make_company(status=Company.Status.SENT)

    def test_silent_company_gets_auto_followup(self):
        log(self.company, "sent", days_ago=8)
        with mock.patch("tracker.services.generate_followup_draft", return_value="Hi again"):
            created = services.create_auto_followups()
        self.assertEqual(len(created), 1)
        self.assertEqual(created[0].drafted_message, "Hi again")
        self.assertTrue(created[0].auto_created)

    def test_no_followup_before_threshold_or_after_reply_or_twice(self):
        log(self.company, "sent", days_ago=3)
        self.assertEqual(services.companies_needing_followup(), [])

        other = make_company(name="Replied Co", status=Company.Status.SENT)
        log(other, "sent", days_ago=10)
        log(other, "received", days_ago=9)
        self.assertEqual(services.companies_needing_followup(), [])

        third = make_company(name="Waiting Co", status=Company.Status.SENT)
        log(third, "sent", days_ago=10)
        FollowUp.objects.create(company=third, due_date=timezone.localdate())
        self.assertEqual(services.companies_needing_followup(), [])

    def test_draft_failure_still_creates_followup(self):
        log(self.company, "sent", days_ago=8)
        with mock.patch("tracker.services.generate_followup_draft", side_effect=DraftError("no key")):
            created = services.create_auto_followups()
        self.assertEqual(created[0].drafted_message, "")

    def test_draft_button_returns_error_but_creates_followup(self):
        with mock.patch("tracker.views.generate_followup_draft", side_effect=DraftError("no key")):
            res = self.client.post(f"/api/companies/{self.company.id}/draft-followup/")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["draft_error"], "no key")

    def test_mark_sent_logs_interaction_and_resets_timer(self):
        log(self.company, "sent", days_ago=8, channel="email")
        followup = FollowUp.objects.create(company=self.company, due_date=timezone.localdate())
        res = self.client.post(
            f"/api/followups/{followup.id}/mark-sent/", {"message": "Edited text"}, format="json"
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data["sent"])
        latest = self.company.interactions.order_by("-date").first()
        self.assertEqual(latest.message, "Edited text")
        self.assertEqual(latest.channel, "email")
        self.assertEqual(services.companies_needing_followup(), [])

    @override_settings(CRON_SECRET="s3cret")
    def test_cron_endpoint_requires_secret(self):
        self.assertEqual(self.client.post("/api/cron/daily/").status_code, 403)
        with mock.patch("tracker.services.generate_followup_draft", return_value="x"):
            res = self.client.post("/api/cron/daily/", HTTP_X_CRON_SECRET="s3cret")
        self.assertEqual(res.status_code, 200)

    @override_settings(VAPID_PUBLIC_KEY="pub", VAPID_PRIVATE_KEY="priv")
    def test_notifications_sent_once(self):
        FollowUp.objects.create(company=self.company, due_date=timezone.localdate())
        with mock.patch("tracker.services.send_push", return_value=1) as push:
            self.assertEqual(services.notify_due_followups(), 1)
            self.assertEqual(services.notify_due_followups(), 0)
        push.assert_called_once()


class DashboardTests(TestCase):
    def test_rates(self):
        a = make_company(name="A", sector="Fintech")
        b = make_company(name="B", sector="Telecom")
        make_company(name="C", sector="Telecom")
        log(a, "sent", days_ago=10, channel="linkedin")
        log(a, "received", days_ago=7, channel="linkedin")
        log(b, "sent", days_ago=5, channel="email")
        FollowUp.objects.create(company=b, due_date=timezone.localdate() - timedelta(days=1))

        res = APIClient().get("/api/dashboard/")
        self.assertEqual(res.status_code, 200)
        totals = res.data["totals"]
        self.assertEqual(totals["companies"], 3)
        self.assertEqual(totals["messages_sent"], 2)
        self.assertEqual(totals["response_rate"], 0.5)
        self.assertEqual(totals["avg_days_to_first_reply"], 3.0)
        self.assertEqual(totals["followups_overdue"], 1)
        channels = {row["channel"]: row for row in res.data["by_channel"]}
        self.assertEqual(channels["linkedin"]["rate"], 1.0)
        self.assertEqual(channels["email"]["rate"], 0.0)
        self.assertIsNone(channels["instagram"]["rate"])
        self.assertEqual(sum(w["count"] for w in res.data["weekly_volume"]), 2)


    def test_pipeline_moves_count_without_logged_messages(self):
        make_company(name="Moved", sector="Telecom", status=Company.Status.INTERVIEW)
        make_company(name="Sent only", sector="Telecom", status=Company.Status.SENT)
        make_company(name="Untouched", sector="Telecom")
        res = APIClient().get("/api/dashboard/")
        totals = res.data["totals"]
        self.assertEqual(totals["contacted"], 2)
        self.assertEqual(totals["responded"], 1)
        self.assertEqual(totals["response_rate"], 0.5)
        self.assertEqual(totals["messages_sent"], 0)
        self.assertEqual(res.data["by_sector"][0]["contacted"], 2)


class ImportTests(TestCase):
    def test_import_with_loose_headers_is_idempotent(self):
        import tempfile

        with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False, newline="") as fh:
            writer = csv.writer(fh)
            writer.writerow(["Company Name", "Industry", "Website", "Why It's a Fit", "Priority", "Best Channel"])
            writer.writerow(["Flutterwave", "Fintech", "flutterwave.com", "Heavy cloud use", "High", "LinkedIn / Email"])
            writer.writerow(["", "", "", "", "", ""])
            path = fh.name

        out = StringIO()
        call_command("import_companies", path, stdout=out)
        self.assertIn("1 created", out.getvalue())
        call_command("import_companies", path, stdout=StringIO())
        company = Company.objects.get()
        self.assertEqual(company.priority, "high")
        self.assertEqual(company.channels, ["linkedin", "email"])
        self.assertEqual(company.website, "https://flutterwave.com")


class DraftCleaningTests(TestCase):
    def test_em_dashes_removed(self):
        self.assertEqual(clean_draft("Hi — just checking in"), "Hi, just checking in")


class ProviderTests(TestCase):
    @override_settings(LLM_API_KEY="gsk_test", LLM_PROVIDER="groq", LLM_MODEL="openai/gpt-oss-120b")
    def test_openai_compatible_request_and_cleanup(self):
        from tracker import drafts

        captured = {}

        class FakeResponse(StringIO):
            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

        def fake_urlopen(request, timeout):
            captured["url"] = request.full_url
            captured["auth"] = request.headers["Authorization"]
            captured["body"] = json.loads(request.data)
            return FakeResponse(json.dumps(
                {"choices": [{"message": {"content": "<think>hmm</think>Hello — checking in. Emmanuel"}}]}
            ))

        with mock.patch("tracker.drafts.urllib.request.urlopen", fake_urlopen):
            text = drafts.generate_followup_draft(make_company())
        self.assertEqual(text, "Hello, checking in. Emmanuel")
        self.assertEqual(captured["url"], "https://api.groq.com/openai/v1/chat/completions")
        self.assertEqual(captured["auth"], "Bearer gsk_test")
        self.assertEqual(captured["body"]["model"], "openai/gpt-oss-120b")
        self.assertEqual(captured["body"]["messages"][0]["role"], "system")

    @override_settings(LLM_API_KEY="")
    def test_missing_key(self):
        from tracker import drafts

        with self.assertRaisesMessage(DraftError, "LLM_API_KEY"):
            drafts.generate_followup_draft(make_company())

    def test_provider_detection(self):
        from config.settings import _detect_provider

        self.assertEqual(_detect_provider("gsk_abc"), "groq")
        self.assertEqual(_detect_provider("xai-abc"), "xai")
        self.assertEqual(_detect_provider("sk-ant-abc"), "anthropic")
