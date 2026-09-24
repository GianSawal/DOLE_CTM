from django.contrib import admin
from .models import (
    Office,
    Unit,
    Service,
    QueueCounter,
    QueueTicket,
    TicketItem,
    StaffProfile,
)


from django.utils.html import format_html
from django.urls import reverse
from django.shortcuts import redirect


class UnitInline(admin.TabularInline):
    model = Unit
    extra = 0
    fields = ('name', 'code', 'directions', 'is_active', 'sort_order')


@admin.register(Office)
class OfficeAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'slug', 'office_type', 'is_active', 'sort_order', 'poster_button')
    list_filter = ('office_type', 'is_active')
    search_fields = ('name', 'code', 'slug')
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('public_queue_link', 'poster_link')
    fields = ('name', 'code', 'slug', 'office_type', 'is_active', 'sort_order', 'public_queue_link', 'poster_link')
    inlines = [UnitInline]
    actions = ['generate_qr_poster']

    def public_queue_link(self, obj):
        if obj.slug:
            url = obj.get_queue_url()
            return format_html('<a href="{}" target="_blank"><strong>{}</strong></a>', url, url)
        return "—"
    public_queue_link.short_description = "Public Queue Link"

    def poster_link(self, obj):
        if obj.id:
            url = reverse('queueing:office_qr_poster', args=[obj.id])
            return format_html('<a href="{}" target="_blank" class="button">🖨️ Open Printable A4 Poster</a>', url)
        return "—"
    poster_link.short_description = "QR Poster"

    def poster_button(self, obj):
        url = reverse('queueing:office_qr_poster', args=[obj.id])
        return format_html('<a href="{}" target="_blank">🖨️ Print Poster</a>', url)
    poster_button.short_description = "QR Poster"

    @admin.action(description="Print QR Poster for selected office")
    def generate_qr_poster(self, request, queryset):
        first_office = queryset.first()
        if first_office:
            return redirect('queueing:office_qr_poster', office_id=first_office.id)


class ServiceInline(admin.TabularInline):
    model = Service
    extra = 0
    fields = ('name', 'pct_minutes', 'classification', 'is_active', 'sort_order')


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'office', 'is_active', 'sort_order')
    list_filter = ('office', 'is_active')
    search_fields = ('name', 'code', 'office__name')
    inlines = [ServiceInline]


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ('name', 'unit', 'pct_minutes', 'classification', 'is_active', 'sort_order')
    list_filter = ('unit__office', 'unit', 'classification', 'is_active')
    search_fields = ('name', 'unit__name', 'description')


class TicketItemInline(admin.TabularInline):
    model = TicketItem
    extra = 0
    readonly_fields = (
        'service',
        'unit',
        'pct_minutes_snapshot',
        'called_at',
        'started_at',
        'completed_at',
        'served_by',
        'survey_submitted_at',
    )
    can_delete = False


@admin.register(QueueTicket)
class QueueTicketAdmin(admin.ModelAdmin):
    list_display = (
        'queue_number',
        'transaction_number',
        'office',
        'service_date',
        'status',
        'source',
        'is_anonymous',
        'client_name',
        'created_at',
    )
    list_filter = ('office', 'service_date', 'source', 'is_anonymous')
    search_fields = ('transaction_number', 'queue_number', 'client_name', 'verification_code')
    readonly_fields = (
        'public_id',
        'queue_number',
        'transaction_number',
        'verification_code',
        'created_at',
        'updated_at',
    )
    inlines = [TicketItemInline]


@admin.register(TicketItem)
class TicketItemAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'ticket',
        'service',
        'unit',
        'status',
        'pct_minutes_snapshot',
        'started_at',
        'completed_at',
        'served_by',
        'survey_submitted_at',
    )
    list_filter = ('unit__office', 'unit', 'status', 'ticket__service_date')
    search_fields = ('ticket__transaction_number', 'ticket__queue_number', 'service__name')
    readonly_fields = (
        'called_at',
        'started_at',
        'completed_at',
        'survey_submitted_at',
    )


@admin.register(QueueCounter)
class QueueCounterAdmin(admin.ModelAdmin):
    list_display = ('office', 'service_date', 'last_number')
    list_filter = ('office', 'service_date')


@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'office', 'unit')
    list_filter = ('office', 'unit')
    search_fields = ('user__username', 'user__first_name', 'user__last_name', 'office__name')
