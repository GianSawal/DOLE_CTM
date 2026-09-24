from rest_framework.throttling import AnonRateThrottle

class CheckinThrottle(AnonRateThrottle):
    scope = 'checkin'

class LoginThrottle(AnonRateThrottle):
    scope = 'login'
