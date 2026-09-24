import time
from functools import wraps
from django.core.cache import cache
from django.http import HttpResponse


def get_client_ip(request) -> str:
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR', '127.0.0.1')
    return ip or '127.0.0.1'


def ratelimit_ip(max_requests: int = 15, window_seconds: int = 60):
    """
    Lightweight IP-based rate limiter using Django's cache framework.
    Throttles aggressive POST submissions without requiring third-party libraries.
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if request.method == 'POST':
                ip = get_client_ip(request)
                cache_key = f"qms_ratelimit:{view_func.__name__}:{ip}"
                history = cache.get(cache_key, [])
                now = time.time()
                # Keep timestamps within the sliding window
                history = [t for t in history if now - t < window_seconds]
                if len(history) >= max_requests:
                    return HttpResponse(
                        "Too many ticket requests submitted. Please wait a moment before trying again.",
                        status=429,
                        content_type="text/plain"
                    )
                history.append(now)
                cache.set(cache_key, history, window_seconds)
            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator
