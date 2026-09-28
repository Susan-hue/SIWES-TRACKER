from django.core.management.base import BaseCommand

from tracker.services import run_daily_check


class Command(BaseCommand):
    help = "Create follow-ups for silent companies, draft them, and push due reminders."

    def add_arguments(self, parser):
        parser.add_argument("--no-draft", action="store_true", help="Skip LLM drafting (no API cost).")

    def handle(self, no_draft=False, **options):
        result = run_daily_check(draft=not no_draft)
        self.stdout.write(self.style.SUCCESS(
            f"{result['followups_created']} follow ups created, "
            f"{result['followups_notified']} announced by push."
        ))
