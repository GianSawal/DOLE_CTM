from django.db import migrations


def create_csm_survey_eligibility_view(apps, schema_editor):
    vendor = schema_editor.connection.vendor

    if vendor == 'mysql':
        sql = """
        CREATE OR REPLACE VIEW csm_survey_eligibility AS
        SELECT
            ti.id AS ticket_item_id,
            qt.public_id,
            qt.transaction_number,
            qt.verification_code,
            o.code AS office_code,
            u.name AS unit_name,
            s.name AS service_name,
            ti.status AS item_status,
            ti.completed_at,
            ti.survey_submitted_at,
            (ti.status = 'DONE'
             AND ti.survey_submitted_at IS NULL
             AND ti.completed_at IS NOT NULL
             AND ti.completed_at >= DATE_SUB(NOW(), INTERVAL 3 DAY)) AS is_eligible
        FROM queueing_ticketitem ti
        JOIN queueing_queueticket qt ON ti.ticket_id = qt.id
        JOIN queueing_service s ON ti.service_id = s.id
        JOIN queueing_unit u ON ti.unit_id = u.id
        JOIN queueing_office o ON qt.office_id = o.id;
        """
    else:  # SQLite and other test backends
        sql = """
        CREATE VIEW IF NOT EXISTS csm_survey_eligibility AS
        SELECT
            ti.id AS ticket_item_id,
            qt.public_id,
            qt.transaction_number,
            qt.verification_code,
            o.code AS office_code,
            u.name AS unit_name,
            s.name AS service_name,
            ti.status AS item_status,
            ti.completed_at,
            ti.survey_submitted_at,
            CASE
                WHEN ti.status = 'DONE'
                 AND ti.survey_submitted_at IS NULL
                 AND ti.completed_at IS NOT NULL
                 AND ti.completed_at >= datetime('now', '-3 days')
                THEN 1 ELSE 0
            END AS is_eligible
        FROM queueing_ticketitem ti
        JOIN queueing_queueticket qt ON ti.ticket_id = qt.id
        JOIN queueing_service s ON ti.service_id = s.id
        JOIN queueing_unit u ON ti.unit_id = u.id
        JOIN queueing_office o ON qt.office_id = o.id;
        """
    schema_editor.execute(sql)


def drop_csm_survey_eligibility_view(apps, schema_editor):
    schema_editor.execute("DROP VIEW IF EXISTS csm_survey_eligibility;")


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ('queueing', '0002_seed_data'),
    ]

    operations = [
        migrations.RunPython(create_csm_survey_eligibility_view, reverse_code=drop_csm_survey_eligibility_view),
    ]
