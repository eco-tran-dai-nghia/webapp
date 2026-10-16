# ECO Webapp – App nội bộ CLB Môi trường ECO Trần Đại Nghĩa

App web nội bộ để **ghi nhận, thống kê và hỗ trợ quản lý** hoạt động của CLB: task, log và điểm danh, KPI và certificate, điểm thi đua và xếp hạng, seeding, góp ý, mail của CLB, chuyển giai đoạn và nhiệm kỳ bằng cách tải sheet thành viên.

> ⚠️ Repo này công khai. **Không** đưa dữ liệu thành viên, quy chế, mật khẩu hay khóa bí mật vào đây. Mọi dữ liệu nằm trong file Google Sheets trên Drive của Gmail CLB; mật khẩu chỉ lưu dạng mã hóa một chiều.

## Cách hoạt động

| Phần | Ở đâu | Ghi chú |
|---|---|---|
| Giao diện | GitHub Pages (thư mục gốc repo: `index.html`, `css/`, `js/`, `assets/`) | App cài lên màn hình chính được (PWA) |
| Xử lý | Google Apps Script chạy bằng **Gmail CLB** (thư mục `gas/`) | Đọc ghi Sheets, gửi Gmail, tạo sheet đăng ký log, nhắc việc mỗi 10 phút |
| Dữ liệu | Một file Google Sheets **"ECO Webapp - Du lieu"** trên Drive CLB | Mỗi tab là một bảng; tab `CaiDat` sửa tay được |

Chi phí: 0 đồng. Chuyển giao hệ thống = bàn giao Gmail CLB.

## Vận hành (không cần biết code)

- **Lần đầu:** mở file dữ liệu → menu *Tiện ích mở rộng → Apps Script* → chọn hàm `setup` → *Chạy* → cho phép quyền. Nhật ký thực thi hiện **mã khởi tạo 6 số**. Mở app, nhập mã, đặt mật khẩu quản trị gốc (đăng nhập bằng Gmail CLB) và mật khẩu mặc định cho thành viên.
- **Quên mật khẩu quản trị gốc:** mở file dữ liệu → menu *App ECO → Đặt lại mật khẩu quản trị gốc*.
- **Thành viên quên mật khẩu:** BOD vào *Thành viên* → chọn người → *Đặt lại mật khẩu*.
- **Đầu mỗi đợt:** BOD vào *Tải sheet*, chọn Oday / Đợt 1 / Đợt 2 / Cập nhật, tải file theo sheet mẫu.
- Lịch chạy tự động bị mất: menu *App ECO → Cài lại lịch chạy tự động*.

## Dành cho người sửa code

- Giao diện viết bằng JavaScript thuần, không cần build. Sửa `js/*.js`, `css/app.css` rồi đẩy lên nhánh `main` là GitHub Pages tự cập nhật. Khi đổi file, tăng số `?v=` trong `index.html` và `CACHE` trong `sw.js`.
- Máy chủ: cài [clasp](https://github.com/google/clasp), `clasp login` bằng Gmail CLB, tạo `.clasp.json` trỏ tới script của file dữ liệu (`"rootDir": "gas"`), rồi `clasp push` và `clasp update-deployment <id>`. Địa chỉ web app ghi trong `js/config.js`.
- Mọi lời gọi từ giao diện là `POST {fn, token, args}` tới web app; danh sách chức năng ở các hàm `API.*` trong `gas/`.
- Quy tắc tính KPI, log, điểm, certificate nằm trong `gas/Calc.js`.

## Liên hệ

CLB Môi trường ECO Trần Đại Nghĩa – GitHub: [@eco-tran-dai-nghia](https://github.com/eco-tran-dai-nghia)
