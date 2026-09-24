from django.urls import path
from . import views

app_name = 'queueing'

urlpatterns = [
    # Fallback / Single-Office Root
    path('', views.queue_root, name='root'),
    path('queue/', views.queue_root, name='queue_root'),

    # Slug-Scoped Client Flow
    path('q/<slug:office_slug>/', views.client_step1_services, name='start'),
    path('q/<slug:office_slug>/step1/', views.client_step1_services, name='client_step1'),
    path('q/<slug:office_slug>/details/', views.client_step2_details, name='client_step2'),
    path('q/<slug:office_slug>/submit/', views.client_submit, name='client_submit'),
    path('q/<slug:office_slug>/t/<uuid:public_id>/', views.client_ticket, name='client_ticket'),
    path('q/<slug:office_slug>/t/<uuid:public_id>/status/', views.client_ticket_status, name='client_ticket_status'),

    # Front Desk (PACD)
    path('front-desk/queue/', views.front_desk_queue, name='front_desk_queue'),
    path('front-desk/print/<uuid:public_id>/', views.front_desk_print, name='front_desk_print'),

    # Unit Queue Screen
    path('unit/queue/', views.unit_queue, name='unit_queue'),
    path('unit/queue/partial/', views.unit_queue_partial, name='unit_queue_partial'),
    path('unit/action/<int:item_id>/<str:action>/', views.unit_action, name='unit_action'),

    # PCT Report
    path('reports/pct/', views.pct_report, name='pct_report'),

    # Staff / Admin QR Poster View
    path('staff/office/<int:office_id>/qr-poster/', views.office_qr_poster, name='office_qr_poster'),
]
