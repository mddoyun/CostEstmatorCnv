# aibim_quantity_takeoff_web/urls.py
from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse
from connections import views as connection_views

def favicon_view(request):
    """Return empty response for favicon.ico to prevent 404 errors"""
    return HttpResponse(status=204)  # 204 No Content

urlpatterns = [
    path('', connection_views.revit_control_panel, name='home'),
    path('admin/', admin.site.urls),
    path('favicon.ico', favicon_view, name='favicon'),
    # ▼▼▼ [핵심] 이 줄이 빠져있거나 잘못 설정되어 있는지 확인하세요. ▼▼▼
    path('connections/', include('connections.urls')),
]