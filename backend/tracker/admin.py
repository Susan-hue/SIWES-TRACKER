from django.contrib import admin

from .models import Company, FollowUp, Interaction, PushSubscription


class InteractionInline(admin.TabularInline):
    model = Interaction
    extra = 0


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ["name", "sector", "priority", "status", "created_at"]
    list_filter = ["status", "priority", "sector"]
    search_fields = ["name", "sector"]
    inlines = [InteractionInline]


@admin.register(Interaction)
class InteractionAdmin(admin.ModelAdmin):
    list_display = ["company", "direction", "channel", "date"]
    list_filter = ["direction", "channel"]


@admin.register(FollowUp)
class FollowUpAdmin(admin.ModelAdmin):
    list_display = ["company", "due_date", "sent", "auto_created", "notified_at"]
    list_filter = ["sent", "auto_created"]


admin.site.register(PushSubscription)
