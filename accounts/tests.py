from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth import get_user_model

User = get_user_model()

class LegalComplianceTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username="player_test",
            email="player@example.com",
            phone_number="0901234567",
            password="testpassword123",
            role="PLAYER"
        )

    def test_register_requires_privacy_consent(self):
        """Kiểm tra form đăng ký bắt buộc phải tick đồng ý điều khoản NĐ 13/2023"""
        response = self.client.post(reverse('accounts:register'), {
            'username': 'newuser',
            'email': 'new@example.com',
            'phone_number': '0988888888',
            'role': 'PLAYER',
            'password': 'password123',
            'password1': 'password123',
            'password2': 'password123',
            # Không gửi 'data_privacy_consent'
        })
        self.assertEqual(response.status_code, 200) # Form invalid, quay lại trang register
        self.assertIn("Bạn phải đồng ý với Điều khoản thu thập và bảo vệ dữ liệu cá nhân.", response.context['form'].errors['data_privacy_consent'])
        self.assertFalse(User.objects.filter(username='newuser').exists())

    def test_profile_view_and_legal_notice(self):
        """Kiểm tra trang cá nhân hiển thị rõ ràng thông tin thu thập và thông báo NĐ 13/2023"""
        self.client.login(username="player_test", password="testpassword123")
        response = self.client.get(reverse('accounts:profile'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Nghị định 13/2023/NĐ-CP")
        self.assertContains(response, "player_test")
        self.assertContains(response, "0901234567")
        self.assertContains(response, "Quyền được xóa dữ liệu")

    def test_right_to_be_forgotten_account_deletion(self):
        """Kiểm tra chức năng xóa tài khoản hoạt động thật (Right to be forgotten - NĐ 13/2023)"""
        self.client.login(username="player_test", password="testpassword123")
        # Gửi POST yêu cầu xóa tài khoản có xác nhận
        response = self.client.post(reverse('accounts:delete_account'), {
            'confirm_delete': 'on'
        })
        self.assertRedirects(response, reverse('home'))
        # Kiểm tra user đã bị xóa hoàn toàn khỏi CSDL
        self.assertFalse(User.objects.filter(username="player_test").exists())
        # Kiểm tra session đã được đăng xuất
        self.assertNotIn('_auth_user_id', self.client.session)
