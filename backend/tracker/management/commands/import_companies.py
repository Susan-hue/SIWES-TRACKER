"""Load the researched companies list from a CSV export.

    python manage.py import_companies path/to/companies.csv [--dry-run]

Column headers are matched loosely (case and spacing ignored), so an export
straight from the spreadsheet works. Re-running updates companies by name
instead of duplicating them; status is never overwritten.
"""

import csv
import re
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from tracker.models import Channel, Company

HEADER_ALIASES = {
    "name": ["name", "company", "companyname", "organisation", "organization"],
    "sector": ["sector", "industry", "category"],
    "website": ["website", "url", "site", "web"],
    "fit_rationale": [
        "fitrationale", "fit", "rationale", "why", "whyitfits", "whycontact", "whytocontact",
        "whyitsafit", "whyfit", "notes", "reason",
    ],
    "priority": ["priority", "tier"],
    "channels": ["channels", "channel", "contactchannels", "bestchannel", "outreachchannel", "howtoreach"],
    "instagram": ["instagram", "ig", "instagramhandle"],
    "linkedin": ["linkedin", "linkedinurl", "linkedinpage"],
    "email": ["email", "emailaddress", "contactemail"],
}


def normalise(header):
    return re.sub(r"[^a-z0-9]", "", header.lower())


def parse_priority(value):
    v = value.strip().lower()
    if v.startswith("h") or v in ("1", "p1"):
        return Company.Priority.HIGH
    if v.startswith("l") or v in ("3", "p3"):
        return Company.Priority.LOW
    return Company.Priority.MEDIUM


def parse_channels(value):
    """'Instagram / Email' -> ['instagram', 'email'], keeping the listed order
    (the first one is the suggested channel)."""
    v = value.lower()
    patterns = {Channel.INSTAGRAM: r"insta|\big\b", Channel.LINKEDIN: r"linked", Channel.EMAIL: r"mail"}
    found = []
    for channel, pattern in patterns.items():
        if match := re.search(pattern, v):
            found.append((match.start(), channel.value))
    return [channel for _, channel in sorted(found)]


class Command(BaseCommand):
    help = "Import companies from a CSV file (upserts by name)."

    def add_arguments(self, parser):
        parser.add_argument("csv_path")
        parser.add_argument("--dry-run", action="store_true", help="Show what would happen, save nothing.")

    def handle(self, csv_path, dry_run=False, **options):
        path = Path(csv_path)
        if not path.exists():
            raise CommandError(f"No such file: {path}")

        with path.open(newline="", encoding="utf-8-sig") as fh:
            reader = csv.DictReader(fh)
            if not reader.fieldnames:
                raise CommandError("The CSV has no header row.")
            column_for = self._map_columns(reader.fieldnames)
            if "name" not in column_for:
                raise CommandError(
                    f"Couldn't find a company name column in: {', '.join(reader.fieldnames)}"
                )
            self.stdout.write(
                "Column mapping: "
                + ", ".join(f"{field} <- '{col}'" for field, col in column_for.items())
            )
            rows = list(reader)

        created = updated = skipped = 0
        with transaction.atomic():
            for row in rows:
                get = lambda field: (row.get(column_for[field]) or "").strip() if field in column_for else ""
                name = get("name")
                if not name:
                    skipped += 1
                    continue
                values = {
                    "sector": get("sector"),
                    "fit_rationale": get("fit_rationale"),
                    "instagram": get("instagram"),
                    "linkedin": get("linkedin"),
                    "email": get("email"),
                }
                website = get("website")
                if website:
                    values["website"] = website if "://" in website else f"https://{website}"
                if "priority" in column_for:
                    values["priority"] = parse_priority(get("priority"))
                channels = parse_channels(get("channels"))
                if not channels:
                    channels = [c for c, handle in (("instagram", values["instagram"]),
                                                    ("linkedin", values["linkedin"]),
                                                    ("email", values["email"])) if handle]
                values["channels"] = channels
                values = {k: v for k, v in values.items() if v not in ("", [])}

                company = Company.objects.filter(name__iexact=name).first()
                if company:
                    for key, value in values.items():
                        setattr(company, key, value)
                    company.save()
                    updated += 1
                else:
                    Company.objects.create(name=name, **values)
                    created += 1

            if dry_run:
                transaction.set_rollback(True)

        prefix = "[dry run] " if dry_run else ""
        self.stdout.write(self.style.SUCCESS(
            f"{prefix}{created} created, {updated} updated, {skipped} skipped (no name)."
        ))

    def _map_columns(self, fieldnames):
        by_norm = {normalise(f): f for f in fieldnames}
        mapping = {}
        for field, aliases in HEADER_ALIASES.items():
            for alias in aliases:
                if alias in by_norm and by_norm[alias] not in mapping.values():
                    mapping[field] = by_norm[alias]
                    break
        return mapping
