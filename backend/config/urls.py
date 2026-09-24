from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect

urlpatterns = [
    path('django-admin/', admin.site.urls),
    path('api/', include('ctms.urls')),
    path('', include('queueing.urls')),
]

