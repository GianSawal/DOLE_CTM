from django.db import migrations


def seed_dole_data(apps, schema_editor):
    Office = apps.get_model('queueing', 'Office')
    Unit = apps.get_model('queueing', 'Unit')
    Service = apps.get_model('queueing', 'Service')
    Group = apps.get_model('auth', 'Group')
    Permission = apps.get_model('auth', 'Permission')
    ContentType = apps.get_model('contenttypes', 'ContentType')

    # 1. Regional Office III
    ro3, _ = Office.objects.get_or_create(
        code='RO3',
        defaults={
            'name': 'DOLE Regional Office III',
            'slug': 'ro3',
            'office_type': 'REGIONAL',
            'is_active': True,
            'sort_order': 1,
        }
    )

    # RO3 Units
    lrls_ro3, _ = Unit.objects.get_or_create(
        office=ro3,
        code='LRLS',
        defaults={
            'name': 'TSSD-LRLS',
            'directions': '2nd floor, right side',
            'is_active': True,
            'sort_order': 1,
        }
    )
    ew_ro3, _ = Unit.objects.get_or_create(
        office=ro3,
        code='EW',
        defaults={
            'name': 'TSSD-EW',
            'directions': '2nd floor, left side',
            'is_active': True,
            'sort_order': 2,
        }
    )
    malsu_ro3, _ = Unit.objects.get_or_create(
        office=ro3,
        code='MALSU',
        defaults={
            'name': 'MALSU',
            'directions': '',
            'is_active': True,
            'sort_order': 3,
        }
    )
    imsd_ro3, _ = Unit.objects.get_or_create(
        office=ro3,
        code='IMSD',
        defaults={
            'name': 'IMSD',
            'directions': '',
            'is_active': True,
            'sort_order': 4,
        }
    )

    # RO3 Services
    Service.objects.get_or_create(
        unit=lrls_ro3,
        name='Labor Rights Query',
        defaults={
            'description': 'Consultation regarding labor standards and worker rights',
            'pct_minutes': 15,
            'classification': 'SIMPLE',
            'is_active': True,
            'sort_order': 1,
        }
    )
    Service.objects.get_or_create(
        unit=lrls_ro3,
        name='SEnA Request for Assistance',
        defaults={
            'description': 'Single Entry Approach conciliation-mediation filing',
            'pct_minutes': 30,
            'classification': 'SIMPLE',
            'is_active': True,
            'sort_order': 2,
        }
    )
    Service.objects.get_or_create(
        unit=lrls_ro3,
        name='Rule 1020 Registration',
        defaults={
            'description': 'Registration of establishments under the Occupational Safety and Health Standards',
            'pct_minutes': 45,
            'classification': 'COMPLEX',
            'is_active': True,
            'sort_order': 3,
        }
    )

    Service.objects.get_or_create(
        unit=ew_ro3,
        name='TUPAD Program',
        defaults={
            'description': 'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers',
            'pct_minutes': 30,
            'classification': 'SIMPLE',
            'is_active': True,
            'sort_order': 1,
        }
    )
    Service.objects.get_or_create(
        unit=ew_ro3,
        name='DILP (Kabuhayan Program)',
        defaults={
            'description': 'DOLE Integrated Livelihood Program',
            'pct_minutes': 45,
            'classification': 'COMPLEX',
            'is_active': True,
            'sort_order': 2,
        }
    )
    Service.objects.get_or_create(
        unit=ew_ro3,
        name='SPES Application',
        defaults={
            'description': 'Special Program for Employment of Students',
            'pct_minutes': 20,
            'classification': 'SIMPLE',
            'is_active': True,
            'sort_order': 3,
        }
    )

    Service.objects.get_or_create(
        unit=malsu_ro3,
        name='Legal Consultation / Advice',
        defaults={
            'description': 'Legal advice from Med-Arbitration and Legal Services Unit',
            'pct_minutes': 30,
            'classification': 'SIMPLE',
            'sort_order': 1,
        }
    )
    Service.objects.get_or_create(
        unit=imsd_ro3,
        name='General Inquiry / Document Receiving',
        defaults={
            'description': 'Receiving of official incoming documents and routing',
            'pct_minutes': 10,
            'classification': 'SIMPLE',
            'sort_order': 1,
        }
    )

    # 2. Provincial Offices of Region III
    provinces = [
        ('AUR', 'DOLE Aurora Provincial Office', 'aurora', 10),
        ('BTN', 'DOLE Bataan Provincial Office', 'bataan', 20),
        ('BUL', 'DOLE Bulacan Provincial Office', 'bulacan', 30),
        ('NE',  'DOLE Nueva Ecija Provincial Office', 'nueva-ecija', 40),
        ('PAM', 'DOLE Pampanga Provincial Office', 'pampanga', 50),
        ('TAR', 'DOLE Tarlac Provincial Office', 'tarlac', 60),
        ('ZAM', 'DOLE Zambales Provincial Office', 'zambales', 70),
    ]

    for code, name, slug, sort_order in provinces:
        p_office, _ = Office.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'slug': slug,
                'office_type': 'PROVINCIAL',
                'is_active': True,
                'sort_order': sort_order,
            }
        )

        p_lrls, _ = Unit.objects.get_or_create(
            office=p_office,
            code='LRLS',
            defaults={
                'name': 'TSSD-LRLS',
                'directions': '',
                'is_active': True,
                'sort_order': 1,
            }
        )
        p_ew, _ = Unit.objects.get_or_create(
            office=p_office,
            code='EW',
            defaults={
                'name': 'TSSD-EW',
                'directions': '',
                'is_active': True,
                'sort_order': 2,
            }
        )

        Service.objects.get_or_create(
            unit=p_lrls,
            name='Labor Rights Query',
            defaults={
                'description': 'Consultation regarding labor standards (Provincial)',
                'pct_minutes': 15,
                'classification': 'SIMPLE',
                'sort_order': 1,
            }
        )
        Service.objects.get_or_create(
            unit=p_lrls,
            name='SEnA Request for Assistance',
            defaults={
                'description': 'SEnA conciliation filing (Provincial)',
                'pct_minutes': 30,
                'classification': 'SIMPLE',
                'sort_order': 2,
            }
        )
        Service.objects.get_or_create(
            unit=p_ew,
            name='TUPAD Program',
            defaults={
                'description': 'TUPAD emergency employment assistance (Provincial)',
                'pct_minutes': 30,
                'classification': 'SIMPLE',
                'sort_order': 1,
            }
        )
        Service.objects.get_or_create(
            unit=p_ew,
            name='DILP (Kabuhayan Program)',
            defaults={
                'description': 'Livelihood grant intake and orientation (Provincial)',
                'pct_minutes': 45,
                'classification': 'COMPLEX',
                'sort_order': 2,
            }
        )

    # 3. User Groups & Permissions
    ticket_ct, _ = ContentType.objects.get_or_create(app_label='queueing', model='queueticket')
    item_ct, _ = ContentType.objects.get_or_create(app_label='queueing', model='ticketitem')

    pacd_group, _ = Group.objects.get_or_create(name='PACD')
    add_ticket_perm, _ = Permission.objects.get_or_create(
        content_type=ticket_ct,
        codename='add_queueticket',
        defaults={'name': 'Can add queue ticket'}
    )
    view_ticket_perm, _ = Permission.objects.get_or_create(
        content_type=ticket_ct,
        codename='view_queueticket',
        defaults={'name': 'Can view queue ticket'}
    )
    pacd_group.permissions.add(add_ticket_perm, view_ticket_perm)

    unit_group, _ = Group.objects.get_or_create(name='Unit Staff')
    change_item_perm, _ = Permission.objects.get_or_create(
        content_type=item_ct,
        codename='change_ticketitem',
        defaults={'name': 'Can change ticket item'}
    )
    view_item_perm, _ = Permission.objects.get_or_create(
        content_type=item_ct,
        codename='view_ticketitem',
        defaults={'name': 'Can view ticket item'}
    )
    unit_group.permissions.add(change_item_perm, view_item_perm)


def reverse_seed_data(apps, schema_editor):
    Office = apps.get_model('queueing', 'Office')
    Group = apps.get_model('auth', 'Group')
    Office.objects.all().delete()
    Group.objects.filter(name__in=['PACD', 'Unit Staff']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('queueing', '0001_initial'),
        ('contenttypes', '__latest__'),
        ('auth', '__latest__'),
    ]

    operations = [
        migrations.RunPython(seed_dole_data, reverse_code=reverse_seed_data),
    ]
