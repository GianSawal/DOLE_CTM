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

        # Assign all staff users to active offices
        staff_users = User.objects.filter(is_staff=True)
        assigned_count = 0
        for staff in staff_users:
            for office in offices:
                _, created = CtmsStaffOffice.objects.get_or_create(
                    user=staff,
                    office=office
                )
                if created:
                    assigned_count += 1

        self.stdout.write(self.style.SUCCESS(f"Created {assigned_count} staff-office assignments for {staff_users.count()} staff user(s)."))
