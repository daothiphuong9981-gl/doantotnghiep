# HƯỚNG DẪN TRIỂN KHAI WEBSITE LÊN PYTHONANYWHERE (PRODUCTION)

Tài liệu này hướng dẫn chi tiết từng bước (Step-by-step) để bạn tự triển khai ứng dụng Website cho thuê và đặt sân cầu lông Đà Nẵng lên máy chủ **PythonAnywhere** sử dụng cơ sở dữ liệu **MySQL** chuẩn production theo mục 5 & 8 của `PROJECT.md`.

> [!IMPORTANT]
> **NGUYÊN TẮC BẢO MẬT BẤT BIẾN:**
> Bạn **KHÔNG ĐƯỢC** dán mật khẩu CSDL, `SECRET_KEY`, hoặc nội dung file `.env` vào khung chat với AI. Tất cả các thao tác điền thông tin nhạy cảm này bạn sẽ tự thực hiện trực tiếp trên giao diện hoặc Terminal của PythonAnywhere.

---

## BƯỚC 1: CHUẨN BỊ MÃ NGUỒN TẠI LOCAL VÀ ĐƯA LÊN GITHUB

Mã nguồn tại máy cá nhân đã được tự động chuẩn hóa:
- Cấu hình `config/settings.py` đã hỗ trợ đọc biến môi trường (`.env`) và tự động chuyển sang kết nối **MySQL** khi phát hiện biến `DB_NAME`.
- Tệp `requirements.txt` đã được bổ sung `python-dotenv`, `mysqlclient`, và `PyMySQL`.

Bạn mở Terminal tại máy cá nhân (`d:\Hieu\Test\doantotnghiep`), kiểm tra và đẩy code lên GitHub:
```bash
git status
git add .
git commit -m "Chuan bi cau hinh deploy production PythonAnywhere"
git push origin main
```

---

## BƯỚC 2: TẠO TÀI KHOẢN & CẤU HÌNH MYSQL TRÊN PYTHONANYWHERE

1. Đăng nhập hoặc đăng ký tài khoản miễn phí tại [PythonAnywhere.com](https://www.pythonanywhere.com). Giả sử username của bạn là `yourusername`.
2. Trên bảng điều khiển (Dashboard), nhấp vào tab **Databases**:
   - Tại mục **MySQL passwords**, nhập một mật khẩu bảo mật mới và nhấn **Initialize MySQL** (hoặc **Change password** nếu đã có). **Hãy ghi nhớ mật khẩu này.**
   - Tại mục **Create a database**, nhập tên database (ví dụ: `doantotnghiep`) rồi nhấn **Create**.
   - *Lưu ý quan trọng:* PythonAnywhere tự động ghép `username$` vào trước tên database. Vì vậy tên đầy đủ của CSDL sẽ là `yourusername$doantotnghiep`.
3. Ghi lại các thông tin kết nối hiển thị trên trang Databases:
   - **Database host address**: `yourusername.mysql.pythonanywhere-services.com`
   - **Username**: `yourusername`
   - **Database name**: `yourusername$doantotnghiep`

---

## BƯỚC 3: KÉO MÃ NGUỒN VỀ SERVER & CÀI ĐẶT MÔI TRƯỜNG ẢO

1. Vào tab **Consoles** trên PythonAnywhere, chọn mở một **Bash console** mới.
2. Tải mã nguồn từ GitHub về máy chủ:
   ```bash
   git clone https://github.com/username-cua-ban/ten-repository.git doantotnghiep
   cd doantotnghiep
   ```
   *(Nếu bạn đã clone từ trước, chỉ cần chạy `cd doantotnghiep && git pull origin main`)*
3. Tạo môi trường ảo và cài đặt thư viện (`requirements.txt`):
   ```bash
   # Tạo virtualenv với Python 3.10 (hoặc 3.11 tùy phiên bản trên account của bạn)
   mkvirtualenv --python=/usr/bin/python3.10 myenv
   
   # Cài đặt các thư viện cần thiết
   pip install -r requirements.txt
   ```

---

## BƯỚC 4: TẠO FILE BẢO MẬT `.env` VÀ KHỞI TẠO CSDL TRÊN SERVER

Tại Terminal (Bash console) của PythonAnywhere, khi đang ở trong thư mục `~/doantotnghiep`, bạn tạo file cấu hình `.env` chứa các biến bảo mật:

```bash
nano .env
```

Dán nội dung dưới đây vào soạn thảo (thay thế bằng thông tin thật của bạn, **KHÔNG GỬI VÀO CHAT**):
```ini
SECRET_KEY=hãy-gõ-một-chuỗi-ký-tự-dài-bất-kỳ-và-khó-đoán-vào-đây-khoảng-50-ký-tự
DEBUG=False
ALLOWED_HOSTS=yourusername.pythonanywhere.com
CSRF_TRUSTED_ORIGINS=https://yourusername.pythonanywhere.com

DB_NAME=yourusername$doantotnghiep
DB_USER=yourusername
DB_PASSWORD=mật-khẩu-mysql-bạn-đã-tạo-ở-bước-2
DB_HOST=yourusername.mysql.pythonanywhere-services.com
DB_PORT=3306
```
*(Nhấn `Ctrl + O` -> `Enter` để lưu file, rồi nhấn `Ctrl + X` để thoát nano)*

Tiếp tục chạy các lệnh khởi tạo CSDL MySQL và thu thập static files ngay trên Terminal:
```bash
# Kiểm tra kết nối và chạy migrations tạo bảng trên MySQL
python manage.py check
python manage.py migrate

# Tạo tài khoản quản trị (Superuser) cho Web trên production
python manage.py createsuperuser

# Thu thập toàn bộ file tĩnh (Bootstrap CSS, JS, Leaflet icons) vào thư mục staticfiles
python manage.py collectstatic --noinput
```

---

## BƯỚC 5: CẤU HÌNH TAB WEB & WSGI TRÊN PYTHONANYWHERE

1. Chuyển sang tab **Web** trên giao diện PythonAnywhere.
2. Nhấp vào nút **Add a new web app**:
   - Nhấp **Next** -> Chọn **Manual configuration** *(lưu ý KHÔNG chọn Django tự động vì chúng ta đã tự cài)* -> Chọn phiên bản **Python 3.10** (khớp với phiên bản lúc tạo virtualenv ở bước 3) -> Nhấp **Next**.
3. Cấu hình mục **Virtualenv**:
   - Nhập đường dẫn: `/home/yourusername/.virtualenvs/myenv` (rồi nhấn dấu tích màu xanh để lưu).
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

Quay lại tab **Web**, cuộn xuống mục **Static files** và thêm 2 bảng ánh xạ đường dẫn sau để máy chủ PythonAnywhere phục vụ CSS/JS và ảnh sân cầu lông:

| URL | Directory |
| :--- | :--- |
| `/static/` | `/home/yourusername/doantotnghiep/staticfiles` |
| `/media/` | `/home/yourusername/doantotnghiep/media` |

---

## BƯỚC 7: KHỞI ĐỘNG LẠI (RELOAD) VÀ NGHIỆM THU

1. Cuộn lên đầu tab **Web**, nhấp vào nút xanh lá cây lớn: **Reload yourusername.pythonanywhere.com**.
2. Mở trình duyệt truy cập vào đường dẫn: `https://yourusername.pythonanywhere.com`.
3. **Kiểm tra nghiệm thu (Checklist trước khi báo cáo):**
   - [ ] Trang chủ tải mượt mà, hiển thị bản đồ Leaflet WebGIS và không bị mất định dạng CSS (`DEBUG=False` hoạt động).
   - [ ] Đăng nhập tài khoản Superuser hoặc Owner, thử tải lên 1 ảnh sân cầu lông mới -> kiểm tra ảnh hiển thị tốt qua đường dẫn `/media/...`.
   - [ ] Thực hiện thử 1 luồng đặt sân end-to-end trên production để đảm bảo kết nối MySQL xử lý giao dịch (`select_for_update`) trơn tru.

---

Chúc mừng! Hệ thống WebGIS Đặt Sân Cầu Lông Đà Nẵng của bạn đã chính thức chạy thực tế trên môi trường Internet! Nếu có thắc mắc ở bước nào (ngoại trừ mật khẩu), bạn hãy phản hồi lại để được hỗ trợ.
