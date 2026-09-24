from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from ctms.models import CsmOffice, CtmsCounter, CtmsStaffOffice

User = get_user_model()

class Command(BaseCommand):
    help = "Initialize default window counters and staff assignments for active DOLE offices"

    def handle(self, *args, **options):
        self.stdout.write("Initializing counters and staff assignments...")

        offices = CsmOffice.objects.filter(is_active=True)
        self.stdout.write(f"Found {offices.count()} active offices.")

        counter_names = [
            "Window 1",
            "Window 2",
            "Window 3 (Priority Lane)",
            "Helpdesk / Information",
        ]

        total_counters = 0
        for office in offices:
            for name in counter_names:
                cnt, created = CtmsCounter.objects.get_or_create(
                    office=office,
                    name=name,
                    defaults={'is_active': True}
                )
                if created:
                    total_counters += 1

        self.stdout.write(self.style.SUCCESS(f"Created {total_counters} window counters."))

        # Ensure superuser administrators have access to all offices
        superusers = User.objects.filter(is_superuser=True)
        assigned_count = 0
        for admin in superusers:
            for office in offices:
                _, created = CtmsStaffOffice.objects.get_or_create(
                    user=admin,
                    office=office
                )
                if created:
                    assigned_count += 1

        self.stdout.write(self.style.SUCCESS(f"Configured counters and admin assignments. Regular staff accounts are strictly assigned per office via seed_office_staff."))
