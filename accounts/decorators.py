from django.shortcuts import redirect
from django.contrib import messages
from functools import wraps

def role_required(allowed_roles=[]):
    """
    Decorator chặn truy cập dựa trên vai trò của người dùng.
    Nếu không đúng vai trò, điều hướng về trang chủ kèm thông báo lỗi.
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if not request.user.is_authenticated:
                messages.warning(request, "Vui lòng đăng nhập để thực hiện chức năng này.")
                return redirect('accounts:login')
            if request.user.role in allowed_roles or request.user.is_superuser:
                return view_func(request, *args, **kwargs)
            
            messages.error(request, "Tài khoản của bạn không có quyền truy cập chức năng này!")
            return redirect('/')
        return _wrapped_view
    return decorator

def player_required(view_func):
    return role_required(['PLAYER'])(view_func)

def owner_required(view_func):
    return role_required(['OWNER'])(view_func)
