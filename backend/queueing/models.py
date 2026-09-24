import uuid
import secrets
from django.db import models
from django.conf import settings
from django.utils import timezone

# Unambiguous alphabet for verification codes (excluding 0, O, 1, I, L)
VERIFICATION_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

def generate_verification_code(length=4) -> str:
    return ''.join(secrets.choice(VERIFICATION_CODE_ALPHABET) for _ in range(length))


class Office(models.Model):
    class OfficeType(models.TextChoices):
        REGIONAL = 'REGIONAL', 'Regional Office'
        PROVINCIAL = 'PROVINCIAL', 'Provincial Office'
        SATELLITE = 'SATELLITE', 'Satellite Office'

    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, unique=True, db_index=True, help_text="e.g. RO3, BUL, PAM")
    slug = models.SlugField(max_length=50, unique=True, db_index=True, help_text="URL-safe slug e.g. ro3, bulacan")
    office_type = models.CharField(max_length=20, choices=OfficeType.choices, default=OfficeType.PROVINCIAL)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name = 'Office'
        verbose_name_plural = 'Offices'

    def __str__(self):
        return f"{self.name} ({self.code})"

    def get_queue_url(self) -> str:
        from django.urls import reverse
        return reverse("queueing:start", args=[self.slug])



class Unit(models.Model):
    office = models.ForeignKey(Office, on_delete=models.CASCADE, related_name='units')
    name = models.CharField(max_length=200, help_text="e.g. TSSD-LRLS, TSSD-EW, MALSU, IMSD")
    code = models.CharField(max_length=50, help_text="e.g. LRLS, EW")
    directions = models.TextField(blank=True, help_text="e.g. 2nd floor, right side")
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name = 'Unit'
        verbose_name_plural = 'Units'

    def __str__(self):
        return f"{self.office.code} - {self.name}"


class Service(models.Model):
    class Classification(models.TextChoices):
        SIMPLE = 'SIMPLE', 'Simple (<= 3 days)'
        COMPLEX = 'COMPLEX', 'Complex (<= 7 days)'
        HIGHLY_TECHNICAL = 'HIGHLY_TECHNICAL', 'Highly Technical (<= 20 days)'

    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name='services')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    requirements = models.TextField(blank=True)
    pct_minutes = models.PositiveIntegerField(help_text="Target processing cycle time in minutes (Citizen's Charter)")
    classification = models.CharField(max_length=20, choices=Classification.choices, default=Classification.SIMPLE)
    directions_override = models.TextField(blank=True, help_text="Optional override for unit directions")
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name = 'Service'
        verbose_name_plural = 'Services'

    def __str__(self):
        return f"{self.name} ({self.unit.name})"

    @property
    def directions(self) -> str:
        return self.directions_override.strip() if self.directions_override else self.unit.directions


class QueueCounter(models.Model):
    office = models.ForeignKey(Office, on_delete=models.CASCADE, related_name='queue_counters')
    service_date = models.DateField(db_index=True)
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['office', 'service_date'], name='unique_office_service_date')
        ]
        verbose_name = 'Queue Counter'
        verbose_name_plural = 'Queue Counters'

    def __str__(self):
        return f"{self.office.code} - {self.service_date}: {self.last_number}"


class QueueTicket(models.Model):
    class Source(models.TextChoices):
        SELF_SERVICE = 'SELF_SERVICE', 'Self Service (Client Mobile)'
        FRONT_DESK = 'FRONT_DESK', 'Front Desk (PACD)'

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    office = models.ForeignKey(Office, on_delete=models.PROTECT, related_name='tickets')
    service_date = models.DateField(db_index=True)
    queue_number = models.CharField(max_length=10, db_index=True, help_text="e.g. 014")
    transaction_number = models.CharField(max_length=32, unique=True, db_index=True, help_text="e.g. RO3-260923-014")
    verification_code = models.CharField(max_length=4, help_text="Manual fallback code for CSM survey")
    client_name = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    contact_number = models.CharField(max_length=30, blank=True)
    is_anonymous = models.BooleanField(default=False)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.SELF_SERVICE)
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='issued_tickets'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['office', 'service_date', 'queue_number'], name='unique_office_date_queue_number')
        ]
        ordering = ['-created_at']
        verbose_name = 'Queue Ticket'
        verbose_name_plural = 'Queue Tickets'

    def __str__(self):
        return f"{self.queue_number} ({self.transaction_number})"

    @property
    def status(self) -> str:
        """
        WAITING (all items waiting)
        IN_PROGRESS (any item called/serving, or some done while others pending)
        COMPLETED (all items DONE or SKIPPED)
        """
        items = list(self.items.all())
        if not items:
            return 'WAITING'
        statuses = [item.status for item in items]
        if all(s in [TicketItem.Status.DONE, TicketItem.Status.SKIPPED] for s in statuses):
            return 'COMPLETED'
        if all(s == TicketItem.Status.WAITING for s in statuses):
            return 'WAITING'
        return 'IN_PROGRESS'

    @property
    def total_target_pct(self) -> int:
        return sum(item.pct_minutes_snapshot for item in self.items.all())


class TicketItem(models.Model):
    class Status(models.TextChoices):
        WAITING = 'WAITING', 'Waiting'
        CALLED = 'CALLED', 'Called'
        SERVING = 'SERVING', 'Serving'
        DONE = 'DONE', 'Done'
        SKIPPED = 'SKIPPED', 'Skipped'

    ticket = models.ForeignKey(QueueTicket, on_delete=models.CASCADE, related_name='items')
    service = models.ForeignKey(Service, on_delete=models.PROTECT, related_name='ticket_items')
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name='ticket_items')
    pct_minutes_snapshot = models.PositiveIntegerField(help_text="Target PCT copied from service on creation")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.WAITING, db_index=True)
    called_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    served_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='served_ticket_items'
    )
    survey_submitted_at = models.DateTimeField(null=True, blank=True, help_text="Set ONLY by CSM survey system")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['ticket', 'service'], name='unique_ticket_service')
        ]
        indexes = [
            models.Index(fields=['unit', 'status'], name='idx_unit_status'),
        ]
        ordering = ['id']
        verbose_name = 'Ticket Item'
        verbose_name_plural = 'Ticket Items'

    def __str__(self):
        return f"{self.ticket.queue_number} - {self.service.name} [{self.status}]"

    @property
    def wait_time(self):
        """Time elapsed from ticket creation to start of service."""
        if self.started_at:
            return self.started_at - self.ticket.created_at
        return None

    @property
    def wait_time_minutes(self):
        wt = self.wait_time
        if wt:
            return round(wt.total_seconds() / 60, 1)
        return None

    @property
    def actual_pct(self):
        """Duration from started_at to completed_at."""
        if self.completed_at and self.started_at:
            return self.completed_at - self.started_at
        return None

    @property
    def actual_pct_minutes(self):
        pct = self.actual_pct
        if pct:
            return round(pct.total_seconds() / 60, 1)
        return None

    @property
    def elapsed_minutes(self):
        """Minutes spent since started_at (either until completed_at or until now)."""
        if not self.started_at:
            return 0
        end_time = self.completed_at or timezone.now()
        return round((end_time - self.started_at).total_seconds() / 60, 1)

    @property
    def is_over_pct(self) -> bool:
        """True if actual or elapsed serving time exceeds the PCT target snapshot."""
        target_seconds = self.pct_minutes_snapshot * 60
        if self.completed_at and self.started_at:
            return (self.completed_at - self.started_at).total_seconds() > target_seconds
        if self.started_at and self.status == self.Status.SERVING:
            return (timezone.now() - self.started_at).total_seconds() > target_seconds
        return False

    @property
    def pct_status_class(self) -> str:
        """CSS class helper: normal, warning (near target >= 80%), or danger (over target > 100%)."""
        if not self.started_at:
            return 'pct-normal'
        target_seconds = self.pct_minutes_snapshot * 60
        if target_seconds == 0:
            return 'pct-normal'
        end_time = self.completed_at or timezone.now()
        elapsed_seconds = (end_time - self.started_at).total_seconds()
        ratio = elapsed_seconds / target_seconds
        if ratio > 1.0:
            return 'pct-danger'
        if ratio >= 0.8:
            return 'pct-warning'
        return 'pct-normal'


class StaffProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='queueing_profile')
    office = models.ForeignKey(Office, on_delete=models.PROTECT, related_name='staff_profiles')
    unit = models.ForeignKey(Unit, null=True, blank=True, on_delete=models.SET_NULL, related_name='staff_profiles')

    class Meta:
        verbose_name = 'Staff Profile'
        verbose_name_plural = 'Staff Profiles'

    def __str__(self):
        unit_str = f" / {self.unit.code}" if self.unit else ""
        return f"{self.user.username} ({self.office.code}{unit_str})"
