import io
import qrcode
from datetime import timedelta
from django.conf import settings
from django.db import models
from django.db.models import Avg, F, ExpressionWrapper, fields
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import (
    CsmOffice,
    CsmService,
    CsmResponse,
    CtmsCounter,
    CtmsStaffOffice,
    CtmsTransaction,
)
from .serializers import (
    CsmOfficeSerializer,
    CsmServiceSerializer,
    CtmsCounterSerializer,
    CtmsStaffOfficeSerializer,
    CheckinRequestSerializer,
    TicketPublicSerializer,
    StaffTransactionSerializer,
    StaffTokenObtainPairSerializer,
)
from .throttling import CheckinThrottle, LoginThrottle
from . import services


# =====================================================================
# Auth Views & Permission Helpers
# =====================================================================

class StaffLoginView(TokenObtainPairView):
    serializer_class = StaffTokenObtainPairSerializer
    throttle_classes = [LoginThrottle]


class StaffMeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not user.is_staff:
            return Response({"detail": "Forbidden: Staff account required."}, status=status.HTTP_403_FORBIDDEN)

        assigned_offices = get_staff_offices(user)
        return Response({
            "id": user.id,
            "username": user.username,
            "is_superuser": user.is_superuser,
            "assigned_offices": CsmOfficeSerializer(assigned_offices, many=True).data,
        })


def get_staff_offices(user):
    """Returns queryset of CsmOffices the staff user has access to."""
    if user.is_superuser:
        return CsmOffice.objects.filter(is_active=True)
    assigned_ids = CtmsStaffOffice.objects.filter(user=user).values_list('office_id', flat=True)
    if assigned_ids.exists():
        return CsmOffice.objects.filter(id__in=assigned_ids, is_active=True)
    # If staff user has no explicit office restrictions, allow all active offices
    return CsmOffice.objects.filter(is_active=True)


class IsStaffUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


# =====================================================================
# Public Endpoints (No Auth)
# =====================================================================

class HealthCheckView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            "status": "ok",
            "system": "DOLE CTMS",
            "time": timezone.now().isoformat(),
        })


class PublicOfficeDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, office_id):
        office = get_object_or_404(CsmOffice, pk=office_id, is_active=True)
        services_qs = CsmService.objects.filter(is_active=True).order_by('sort_order', 'name')
        return Response({
            "office": CsmOfficeSerializer(office).data,
            "services": CsmServiceSerializer(services_qs, many=True).data,
        })


class PublicCheckinView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [CheckinThrottle]

    def post(self, request):
        serializer = CheckinRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            tx = services.create_transaction(
                office=data['office'],
                service=data['service'],
                client_name=data.get('client_name'),
                is_priority=data.get('is_priority', False),
                source=CtmsTransaction.SOURCE_QR,
            )
            return Response({
                "ticket_token": tx.ticket_token,
                "queue_no": tx.queue_no,
                "transaction_no": tx.transaction_no,
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PublicTicketDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, ticket_token):
        tx = get_object_or_404(CtmsTransaction, ticket_token=ticket_token)
        return Response(TicketPublicSerializer(tx).data)


class PublicDisplayBoardView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, office_id):
        office = get_object_or_404(CsmOffice, pk=office_id, is_active=True)
        today = timezone.localdate()

        # Currently serving transactions at this office
        serving_qs = CtmsTransaction.objects.filter(
            office=office,
            status=CtmsTransaction.STATUS_SERVING,
            queue_date=today
        ).select_related('counter').order_by('-called_at')

        serving_data = []
        for s in serving_qs:
            serving_data.append({
                "counter": s.counter.name if s.counter else "Counter",
                "queue_no": s.queue_no,
                "called_at": s.called_at,
            })

        # Next waiting queue numbers (priority first, then FIFO) - numbers only, never names!
        next_waiting_qs = CtmsTransaction.objects.filter(
            office=office,
            status=CtmsTransaction.STATUS_WAITING,
            queue_date=today
        ).order_by('-is_priority', 'checked_in_at')[:10]

        next_queue_numbers = [tx.queue_no for tx in next_waiting_qs]

        return Response({
            "office": CsmOfficeSerializer(office).data,
            "serving": serving_data,
            "next": next_queue_numbers,
            "updated_at": timezone.now().isoformat(),
        })


# =====================================================================
# Staff Queue & Operations Endpoints
# =====================================================================

class StaffQueueView(APIView):
    permission_classes = [IsStaffUser]

    def get(self, request):
        office_id = request.query_params.get('office')
        counter_id = request.query_params.get('counter')

        allowed_offices = get_staff_offices(request.user)
        if office_id:
            office = get_object_or_404(allowed_offices, pk=office_id)
        else:
            office = allowed_offices.first()
            if not office:
                return Response({"waiting": [], "serving": [], "counters": []})

        today = timezone.localdate()

        # Waiting list: priority first, then FIFO
        waiting_qs = CtmsTransaction.objects.filter(
            office=office,
            status=CtmsTransaction.STATUS_WAITING,
            queue_date=today
        ).select_related('office', 'service').order_by('-is_priority', 'checked_in_at')

        # Serving list: all serving in this office or counter
        serving_qs = CtmsTransaction.objects.filter(
            office=office,
            status=CtmsTransaction.STATUS_SERVING,
            queue_date=today
        ).select_related('office', 'service', 'counter', 'served_by').order_by('-called_at')

        if counter_id:
            serving_qs = serving_qs.filter(counter_id=counter_id)

        counters_qs = CtmsCounter.objects.filter(office=office, is_active=True)
        if not counters_qs.exists():
            counter_names = ["Window 1", "Window 2", "Window 3 (Priority)", "Helpdesk"]
            for name in counter_names:
                CtmsCounter.objects.get_or_create(office=office, name=name, defaults={'is_active': True})
            counters_qs = CtmsCounter.objects.filter(office=office, is_active=True)

        return Response({
            "office": CsmOfficeSerializer(office).data,
            "waiting": StaffTransactionSerializer(waiting_qs, many=True).data,
            "serving": StaffTransactionSerializer(serving_qs, many=True).data,
            "counters": CtmsCounterSerializer(counters_qs, many=True).data,
        })


class StaffCreateWalkinView(APIView):
    permission_classes = [IsStaffUser]

    def post(self, request):
        serializer = CheckinRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        allowed_offices = get_staff_offices(request.user)
        if not allowed_offices.filter(pk=data['office'].pk).exists():
            return Response({"detail": "Forbidden: You are not assigned to this office."}, status=status.HTTP_403_FORBIDDEN)

        try:
            tx = services.create_transaction(
                office=data['office'],
                service=data['service'],
                client_name=data.get('client_name'),
                is_priority=data.get('is_priority', False),
                source=CtmsTransaction.SOURCE_STAFF,
            )
            return Response(StaffTransactionSerializer(tx).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class StaffCallNextView(APIView):
    permission_classes = [IsStaffUser]

    def post(self, request):
        office_id = request.data.get('office')
        counter_id = request.data.get('counter')

        if not office_id:
            return Response({"detail": "Office is required."}, status=status.HTTP_400_BAD_REQUEST)

        allowed_offices = get_staff_offices(request.user)
        office = get_object_or_404(allowed_offices, pk=office_id)

        if counter_id:
            counter = get_object_or_404(CtmsCounter, pk=counter_id, office=office, is_active=True)
        else:
            counter = CtmsCounter.objects.filter(office=office, is_active=True).first()
            if not counter:
                counter, _ = CtmsCounter.objects.get_or_create(office=office, name="Window 1", defaults={'is_active': True})

        tx = services.call_next_transaction(office=office, counter=counter)
        if not tx:
            return Response({"detail": "No waiting clients in the queue."}, status=status.HTTP_204_NO_CONTENT)

        return Response(StaffTransactionSerializer(tx).data)


class StaffTransactionActionView(APIView):
    permission_classes = [IsStaffUser]

    def post(self, request, pk, action):
        tx = get_object_or_404(CtmsTransaction, pk=pk)
        allowed_offices = get_staff_offices(request.user)
        if not allowed_offices.filter(pk=tx.office_id).exists():
            return Response({"detail": "Forbidden: Not assigned to this office."}, status=status.HTTP_403_FORBIDDEN)

        try:
            if action == 'call':
                counter_id = request.data.get('counter')
                if counter_id:
                    counter = get_object_or_404(CtmsCounter, pk=counter_id, office=tx.office, is_active=True)
                else:
                    counter = CtmsCounter.objects.filter(office=tx.office, is_active=True).first()
                    if not counter:
                        counter, _ = CtmsCounter.objects.get_or_create(office=tx.office, name="Window 1", defaults={'is_active': True})
                tx = services.call_specific_transaction(tx, counter)

            elif action == 'recall':
                if not tx.counter:
                    return Response({"detail": "Transaction is not assigned to a counter."}, status=status.HTTP_400_BAD_REQUEST)
                tx = services.call_specific_transaction(tx, tx.counter)

            elif action == 'done':
                tx = services.mark_done(tx, request.user)

            elif action == 'undo-done':
                tx = services.undo_done(tx)

            elif action == 'no-show':
                tx = services.mark_no_show(tx)

            elif action == 'cancel':
                tx = services.cancel_transaction(tx)

            elif action == 'requeue':
                tx = services.requeue_transaction(tx)

            else:
                return Response({"detail": f"Unknown action: {action}"}, status=status.HTTP_400_BAD_REQUEST)

            return Response(StaffTransactionSerializer(tx).data)

        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_409_CONFLICT)


class StaffTransactionsListView(APIView):
    permission_classes = [IsStaffUser]

    def get(self, request):
        allowed_offices = get_staff_offices(request.user)
        qs = CtmsTransaction.objects.filter(office__in=allowed_offices).select_related('office', 'service', 'counter', 'served_by')

        office_id = request.query_params.get('office')
        if office_id:
            qs = qs.filter(office_id=office_id)

        service_id = request.query_params.get('service')
        if service_id:
            qs = qs.filter(service_id=service_id)

        status_param = request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        date_from = request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(queue_date__gte=date_from)

        date_to = request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(queue_date__lte=date_to)

        q = request.query_params.get('q')
        if q:
            qs = qs.filter(
                models.Q(transaction_no__icontains=q) |
                models.Q(queue_no__icontains=q) |
                models.Q(client_name__icontains=q)
            )

        # Pagination / limit
        limit = int(request.query_params.get('limit', 100))
        qs = qs.order_by('-checked_in_at')[:limit]

        return Response(StaffTransactionSerializer(qs, many=True).data)


class StaffReportsSummaryView(APIView):
    permission_classes = [IsStaffUser]

    def get(self, request):
        allowed_offices = get_staff_offices(request.user)
        qs = CtmsTransaction.objects.filter(office__in=allowed_offices)

        office_id = request.query_params.get('office')
        if office_id:
            qs = qs.filter(office_id=office_id)

        date_from = request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(queue_date__gte=date_from)

        date_to = request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(queue_date__lte=date_to)

        total_checked_in = qs.count()
        total_done = qs.filter(status=CtmsTransaction.STATUS_DONE).count()
        total_waiting = qs.filter(status=CtmsTransaction.STATUS_WAITING).count()
        total_serving = qs.filter(status=CtmsTransaction.STATUS_SERVING).count()
        total_no_show = qs.filter(status=CtmsTransaction.STATUS_NO_SHOW).count()
        total_cancelled = qs.filter(status=CtmsTransaction.STATUS_CANCELLED).count()

        # Avg wait time (called_at - checked_in_at in minutes)
        called_txs = qs.filter(called_at__isnull=False)
        wait_times = [(t.called_at - t.checked_in_at).total_seconds() / 60.0 for t in called_txs if t.called_at and t.checked_in_at]
        avg_wait_min = round(sum(wait_times) / len(wait_times), 1) if wait_times else 0

        # Avg service time (done_at - called_at in minutes)
        done_txs = qs.filter(status=CtmsTransaction.STATUS_DONE, done_at__isnull=False, called_at__isnull=False)
        service_times = [(t.done_at - t.called_at).total_seconds() / 60.0 for t in done_txs if t.done_at and t.called_at]
        avg_service_min = round(sum(service_times) / len(service_times), 1) if service_times else 0

        # Survey rate calculation
        # Reads ctms_transaction_id from csm_csmresponse
        done_ids = list(qs.filter(status=CtmsTransaction.STATUS_DONE).values_list('id', flat=True))
        try:
            surveyed_count = CsmResponse.objects.filter(ctms_transaction_id__in=done_ids).count()
        except Exception:
            surveyed_count = 0

        survey_rate = round((surveyed_count / total_done * 100), 1) if total_done > 0 else 0

        return Response({
            "total_checked_in": total_checked_in,
            "total_done": total_done,
            "total_waiting": total_waiting,
            "total_serving": total_serving,
            "total_no_show": total_no_show,
            "total_cancelled": total_cancelled,
            "avg_wait_min": avg_wait_min,
            "avg_service_min": avg_service_min,
            "surveyed_count": surveyed_count,
            "survey_rate_percent": survey_rate,
        })


class StaffQrCodeView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, office_id):
        office = get_object_or_404(CsmOffice, pk=office_id)
        base_url = settings.CTMS_BASE_URL.rstrip('/')
        checkin_url = f"{base_url}/checkin/office/{office.id}"

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(checkin_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#0305ba", back_color="white")

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        return HttpResponse(buffer.getvalue(), content_type="image/png")


# =====================================================================
# Counters and Staff Assignment Management
# =====================================================================

class CtmsCounterViewSet(viewsets.ModelViewSet):
    serializer_class = CtmsCounterSerializer
    permission_classes = [IsStaffUser]

    def get_queryset(self):
        allowed_offices = get_staff_offices(self.request.user)
        return CtmsCounter.objects.filter(office__in=allowed_offices)


class CtmsStaffOfficeViewSet(viewsets.ModelViewSet):
    serializer_class = CtmsStaffOfficeSerializer
    permission_classes = [permissions.IsAdminUser]
    queryset = CtmsStaffOffice.objects.all().select_related('user', 'office')
