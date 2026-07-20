# HƯỚNG DẪN TRIỂN KHAI WEBSITE LÊN PYTHONANYWHERE (PRODUCTION - SQLITE)

Tài liệu này hướng dẫn chi tiết từng bước (Step-by-step) để bạn tự triển khai ứng dụng Website cho thuê và đặt sân cầu lông Đà Nẵng lên máy chủ **PythonAnywhere** sử dụng cơ sở dữ liệu **SQLite (`db.sqlite3`)** theo Quyết định đã duyệt ngày 20/07/2026 trong `STATE.md` (giúp sinh viên sử dụng trọn vẹn tài khoản **Beginner miễn phí $0/tháng** của PythonAnywhere mà không cần nâng cấp gói trả phí).

> [!IMPORTANT]
> **NGUYÊN TẮC BẢO MẬT BẤT BIẾN:**
> Bạn **KHÔNG ĐƯỢC** dán `SECRET_KEY` hoặc nội dung file `.env` vào khung chat với AI. Bạn sẽ tự điền trực tiếp trên Terminal của PythonAnywhere.

---

## BƯỚC 1: CHUẨN BỊ MÃ NGUỒN TẠI LOCAL VÀ ĐƯA LÊN GITHUB

Mở Terminal tại máy cá nhân (`d:\Hieu\Test\doantotnghiep`), kiểm tra và đẩy code lên GitHub (hoặc nén file zip):
```bash
git add .
git commit -m "Chuan bi cau hinh deploy production PythonAnywhere (SQLite free tier)"
git push origin main
```
*( Nếu bạn chưa tạo repository trên GitHub, bạn có thể tạo 1 repo mới trên GitHub, sau đó chạy lệnh `git remote add origin https://github.com/username-cua-ban/ten-repo.git && git branch -M main && git push -u origin main`)*

---

## BƯỚC 2: ĐĂNG KÝ TÀI KHOẢN BEGINNER (HOÀN TOÀN MIỄN PHÍ)

1. Truy cập trực tiếp trang tạo tài khoản miễn phí của PythonAnywhere:
   👉 **[https://www.pythonanywhere.com/registration/register/beginner/](https://www.pythonanywhere.com/registration/register/beginner/)**
2. Điền Username, Email, Password và tích đồng ý điều khoản rồi nhấn **Register**.
   *(Giả sử Username của bạn là `yourusername` — ví dụ: `hieudt`)*
3. **Lưu ý cực kỳ tiện lợi:** Vì chúng ta dùng **SQLite**, bạn **KHÔNG CẦN** vào tab Databases để tạo MySQL phức tạp nữa! CSDL sẽ tự động tạo ngay trong file storage của bạn ở Bước 4.

---

## BƯỚC 3: TẢI CODE VỀ SERVER & CÀI ĐẶT MÔI TRƯỜNG ẢO (Bash Console)

1. Trên Dashboard PythonAnywhere, nhấp vào tab **Consoles** -> mở một **Bash console** mới.
2. Tải mã nguồn từ GitHub về máy chủ:
   ```bash
   git clone https://github.com/username-cua-ban/ten-repository.git doantotnghiep
   cd doantotnghiep
   ```
   *(Nếu tải file zip từ tab Files thay vì dùng Git, bạn chạy `unzip doantotnghiep.zip && cd doantotnghiep`)*
3. Tạo môi trường ảo với Python 3.10 và cài đặt thư viện:
   ```bash
   mkvirtualenv --python=/usr/bin/python3.10 myenv
   pip install -r requirements.txt
   ```

---

## BƯỚC 4: TẠO FILE BẢO MẬT `.env` VÀ KHỞI TẠO CSDL SQLITE TRÊN SERVER

Tại Terminal (Bash console) của PythonAnywhere, khi đang ở trong thư mục `doantotnghiep`, bạn tạo file cấu hình `.env` bằng lệnh `nano`:

```bash
nano .env
```

Dán 4 dòng cấu hình ngắn gọn dưới đây vào soạn thảo (thay thế `yourusername` bằng tên tài khoản thật của bạn):
```ini
SECRET_KEY=chuoi-ky-tu-bao-mat-dai-50-ky-tu-bat-ky-khai-bao-tai-server
DEBUG=False
ALLOWED_HOSTS=yourusername.pythonanywhere.com
CSRF_TRUSTED_ORIGINS=https://yourusername.pythonanywhere.com
```
*(Nhấn `Ctrl + O` -> `Enter` để lưu file, rồi nhấn `Ctrl + X` để thoát nano)*

Tiếp tục chạy các lệnh khởi tạo CSDL SQLite (`db.sqlite3`), tạo Superuser và thu thập static files ngay trên Terminal console:
```bash
# Tạo CSDL SQLite và chạy migrations
python manage.py check
python manage.py migrate

# Tạo tài khoản quản trị (Superuser) để truy cập Django Admin trên production
python manage.py createsuperuser

# Thu thập toàn bộ file tĩnh (Bootstrap CSS, JS, Leaflet icons) vào thư mục staticfiles
python manage.py collectstatic --noinput
```

---

## BƯỚC 5: CẤU HÌNH TAB WEB & WSGI TRÊN PYTHONANYWHERE

1. Chuyển sang tab **Web** trên giao diện PythonAnywhere.
2. Nhấp vào nút **Add a new web app**:
   - Nhấp **Next** -> Chọn **Manual configuration** -> Chọn phiên bản **Python 3.10** -> Nhấp **Next**.
3. Cấu hình mục **Virtualenv**:
   - Nhập đường dẫn: `/home/yourusername/.virtualenvs/myenv` (bấm dấu tích màu xanh để lưu).
4. Cấu hình mục **Code**:
   - **Source code**: `/home/yourusername/doantotnghiep`
   - **Working directory**: `/home/yourusername/doantotnghiep`
5. Cấu hình file **WSGI configuration file**:
   - Nhấp vào đường dẫn file WSGI (có dạng `/var/www/yourusername_pythonanywhere_com_wsgi.py`).
   - Xóa sạch toàn bộ nội dung mặc định trong trình soạn thảo, rồi dán đoạn code sau vào:

```python
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# 1. Thêm thư mục gốc của project vào sys.path
path = '/home/yourusername/doantotnghiep'
if path not in sys.path:
    sys.path.append(path)

# 2. Nạp các biến bảo mật từ file .env vào os.environ
env_path = Path(path) / '.env'
load_dotenv(dotenv_path=env_path)

# 3. Chỉ định settings module
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'

# 4. Khởi tạo application cho máy chủ WSGI
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
```
   - Nhấp nút **Save** màu xanh ở góc phải trên cùng.

---

## BƯỚC 6: CẤU HÌNH TỆP TĨNH (STATIC) & TỆP TẢI LÊN (MEDIA)

Quay lại tab **Web**, cuộn xuống mục **Static files** và thêm 2 bảng ánh xạ đường dẫn sau để máy chủ phục vụ CSS/JS và ảnh sân:

| URL | Directory |
| :--- | :--- |
| `/static/` | `/home/yourusername/doantotnghiep/staticfiles` |
| `/media/` | `/home/yourusername/doantotnghiep/media` |

---

## BƯỚC 7: KHỞI ĐỘNG LẠI (RELOAD) VÀ NGHIỆM THU THỰC TẾ

1. Cuộn lên đầu tab **Web**, nhấp vào nút xanh lá cây lớn: **Reload yourusername.pythonanywhere.com**.
2. Mở trình duyệt truy cập vào đường dẫn: `https://yourusername.pythonanywhere.com`.
3. **Kiểm tra nghiệm thu:**
   - [ ] Trang chủ tải nhanh, bản đồ Leaflet hiển thị mượt mà, không lỗi CSS (`DEBUG=False` hoạt động).
   - [ ] Đăng nhập Admin/Owner -> đăng ký hoặc cập nhật thử thông tin sân cầu lông.
   - [ ] Thực hiện 1 lượt đặt sân trực tuyến -> xác nhận booking thành công trong CSDL SQLite production.

Chúc mừng! Hệ thống của bạn đã chính thức vận hành trên Internet hoàn toàn miễn phí!
