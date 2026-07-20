from django.shortcuts import render, redirect
from django.contrib.auth import login, logout
from django.contrib.auth.views import LoginView, LogoutView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import CreateView, TemplateView, View
from django.urls import reverse_lazy
from django.contrib import messages
from .forms import CustomUserCreationForm

class UserLoginView(LoginView):
    template_name = 'accounts/login.html'
    redirect_authenticated_user = True

    def get_success_url(self):
        user = self.request.user
        messages.success(self.request, f"Chào mừng {user.username} quay trở lại!")
        if user.role == 'OWNER':
            return '/courts/manage/'
        return '/'

    def form_invalid(self, form):
        messages.error(self.request, "Tên đăng nhập hoặc mật khẩu không chính xác.")
        return super().form_invalid(form)


class UserLogoutView(LogoutView):
    next_page = '/'

    def dispatch(self, request, *args, **kwargs):
        messages.info(request, "Bạn đã đăng xuất tài khoản thành công.")
        return super().dispatch(request, *args, **kwargs)


class RegisterView(CreateView):
    form_class = CustomUserCreationForm
    template_name = 'accounts/register.html'
    success_url = reverse_lazy('home')

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect('/')
        return super().dispatch(request, *args, **kwargs)

    def form_valid(self, form):
        user = form.save()
        login(self.request, user)
        messages.success(self.request, f"Đăng ký tài khoản thành công! Chào mừng {user.username}.")
        if user.role == 'OWNER':
            return redirect('/courts/manage/')
        return redirect('/')

    def form_invalid(self, form):
        messages.error(self.request, "Đăng ký không thành công. Vui lòng kiểm tra lại thông tin.")
        return super().form_invalid(form)


class ProfileView(LoginRequiredMixin, TemplateView):
    template_name = 'accounts/profile.html'


class AccountDeleteView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        confirm = request.POST.get('confirm_delete')
        if not confirm:
            messages.error(request, "Bạn cần xác nhận đồng ý để thực hiện yêu cầu xóa tài khoản.")
            return redirect('accounts:profile')
        
        user = request.user
        username = user.username
        logout(request)
        user.delete()
        messages.success(request, f"Tài khoản '{username}' và toàn bộ dữ liệu liên quan đã được xóa hoàn toàn khỏi hệ thống theo quy định NĐ 13/2023/NĐ-CP.")
        return redirect('home')

    def get(self, request, *args, **kwargs):
        return redirect('accounts:profile')
