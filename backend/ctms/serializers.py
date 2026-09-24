from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from .models import (
    CsmOffice,
    CsmService,
    CtmsCounter,
    CtmsStaffOffice,
    CtmsTransaction,
)

User = get_user_model()

class CsmOfficeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CsmOffice
        fields = ['id', 'name', 'code', 'is_active']


class CsmServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CsmService
        fields = ['id', 'name', 'is_active', 'sort_order']


class CtmsCounterSerializer(serializers.ModelSerializer):
    office_name = serializers.ReadOnlyField(source='office.name')

    class Meta:
        model = CtmsCounter
        fields = ['id', 'office', 'office_name', 'name', 'is_active']


class CtmsStaffOfficeSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')
    office_name = serializers.ReadOnlyField(source='office.name')

    class Meta:
        model = CtmsStaffOffice
        fields = ['id', 'user', 'username', 'office', 'office_name']


class CheckinRequestSerializer(serializers.Serializer):
    office = serializers.PrimaryKeyRelatedField(queryset=CsmOffice.objects.filter(is_active=True))
    service = serializers.PrimaryKeyRelatedField(queryset=CsmService.objects.filter(is_active=True))
    client_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    is_priority = serializers.BooleanField(required=False, default=False)


class TicketPublicSerializer(serializers.ModelSerializer):
    office_name = serializers.ReadOnlyField(source='office.name')
    service_name = serializers.ReadOnlyField(source='service.name')
    counter = serializers.SerializerMethodField()
    ahead = serializers.SerializerMethodField()
    survey_url = serializers.ReadOnlyField()
    surveyed = serializers.ReadOnlyField(source='is_surveyed')

    class Meta:
        model = CtmsTransaction
        fields = [
            'queue_no',
            'transaction_no',
            'claim_code',
            'status',
            'office_name',
            'service_name',
            'counter',
            'assigned_personnel',
            'ahead',
            'survey_url',
            'surveyed',
            'is_priority',
            'checked_in_at',
            'called_at',
            'done_at',
        ]

    def get_counter(self, obj):
        return obj.counter.name if obj.counter else None

    def get_ahead(self, obj):
        if obj.status != CtmsTransaction.STATUS_WAITING:
            return 0

        # Waiting queue ahead calculation:
        # Priority clients get served before regular.
        # If obj is priority: only priority checked in before obj are ahead.
        # If obj is regular: all priority waiting + regular checked in before obj are ahead.
        qs = CtmsTransaction.objects.filter(
            office=obj.office,
            status=CtmsTransaction.STATUS_WAITING
        )
        if obj.is_priority:
            return qs.filter(is_priority=True, checked_in_at__lt=obj.checked_in_at).count()
        else:
            priority_count = qs.filter(is_priority=True).count()
            regular_ahead = qs.filter(is_priority=False, checked_in_at__lt=obj.checked_in_at).count()
            return priority_count + regular_ahead


class StaffTransactionSerializer(serializers.ModelSerializer):
    office_name = serializers.ReadOnlyField(source='office.name')
    service_name = serializers.ReadOnlyField(source='service.name')
    counter_name = serializers.ReadOnlyField(source='counter.name')
    served_by_username = serializers.ReadOnlyField(source='served_by.username')
    is_surveyed = serializers.ReadOnlyField()

    class Meta:
        model = CtmsTransaction
        fields = [
            'id',
            'transaction_no',
            'queue_no',
            'office',
            'office_name',
            'service',
            'service_name',
            'is_priority',
            'client_name',
            'status',
            'counter',
            'counter_name',
            'assigned_personnel',
            'source',
            'checked_in_at',
            'called_at',
            'done_at',
            'closed_at',
            'served_by',
            'served_by_username',
            'claim_code',
            'is_surveyed',
            'ticket_token',
            'survey_token',
        ]


class StaffTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Ensures user is staff (is_staff = True), same requirement as CSM.
    Returns user details and assigned offices in token response.
    """
    def validate(self, attrs):
        data = super().validate(attrs)

        if not self.user.is_staff:
            raise serializers.ValidationError("Access denied. Only DOLE staff members may log in.")

        assigned_offices = list(
            CtmsStaffOffice.objects.filter(user=self.user).values('office_id', 'office__name', 'office__code')
        )

        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'is_superuser': self.user.is_superuser,
            'assigned_offices': [
                {'id': o['office_id'], 'name': o['office__name'], 'code': o['office__code']}
                for o in assigned_offices
            ],
        }
        return data
