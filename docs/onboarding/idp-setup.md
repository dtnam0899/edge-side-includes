---
id: onboarding-idp-setup
type: guide
status: Draft
updated: 2026-10-24
projects: [esi, idp, grants, edge, core, portal]
issues: [ESI-140, ESI-141, ESI-142, ESI-143, ESI-144, ESI-145, ESI-146, ESI-147, ESI-148, ESI-149, ESI-150]
keywords: [idp, keycloak, setup, step by step, oracle, duckdns, caddy, cloudflare, worker, role-grant, realm, service account, bootstrap admin, demo users, core, portal, auth0 replacement, verification, troubleshooting, fresher]
---

# ESI: dựng IdP (Keycloak) cho bản demo, từng bước

Hướng dẫn này đi theo [UR-140](../requirements/UR-140-keycloak-idp-sso.md) và ba ADR [ADR-0011](../architecture/ADR-0011-identity-provider-keycloak.md), [ADR-0012](../architecture/ADR-0012-idp-hosting-and-edge.md), [ADR-0013](../architecture/ADR-0013-role-grant-service.md). Cả ba vẫn đang `Proposed`, sẽ được duyệt trong ESI-141. Đây là **trang dẫn đường**; lệnh đầy đủ nằm trong hai tài liệu gốc [infra/oracle](../../infra/oracle/README.md) và [infra/cloudflare](../../infra/cloudflare/README.md). Khi hai nơi lệch nhau, tài liệu gốc là đúng.

Mọi thứ ở đây dùng gói miễn phí (dự án cá nhân, phi thương mại). Hostname của Keycloak là subdomain DuckDNS miễn phí (UR-140 Decision 10).

## 1. Bản đồ dịch vụ sau khi dựng xong

| Thành phần | Chạy ở đâu | Gói miễn phí | Hướng dẫn gốc |
|------------|------------|--------------|----------------|
| Keycloak (`esi-idp`) | VM Oracle Always Free (ARM) | A1: khoảng 2 OCPU, 12 GB RAM chạy cả tháng | [infra/oracle](../../infra/oracle/README.md) |
| Role Grant Service (`esi-role-grant`) | cùng VM | như trên | như trên |
| PostgreSQL (2 database `keycloak`, `grants`) | cùng VM | như trên | như trên |
| HTTPS + hostname | Caddy trên VM, `<tên>.duckdns.org` | DuckDNS và Let's Encrypt miễn phí | infra/oracle phần 5 |
| Edge Worker (`esi-edge`) | Cloudflare Workers | 100.000 request/ngày, 10 ms CPU/request | [infra/cloudflare](../../infra/cloudflare/README.md) |
| Danh sách thu hồi | Workers KV | gói Free | infra/cloudflare phần 4 |
| `esi-core`, `esi-agents`, `esi-portal` | Giữ nguyên: Azure và Vercel | như hiện tại | [deployment.md](./deployment.md) |

## 2. Thứ tự dựng và ticket chặn từng bước

| Bước | Làm gì | Ở đâu | Làm được khi nào |
|------|--------|-------|-------------------|
| A | Tạo tài khoản Oracle, mạng, VM, Docker | infra/oracle phần 1-4 | Ngay bây giờ |
| B | Đăng ký DuckDNS, chạy thử Caddy có HTTPS | infra/oracle phần 5 | Ngay bây giờ |
| C | Tạo tài khoản Cloudflare, subdomain workers.dev, API token, KV | infra/cloudflare phần 1-4 | Ngay bây giờ |
| D | Thêm secret cho GitHub environment `edge-demo` | infra/cloudflare phần 5 | Ngay bây giờ (dùng khi có ESI-144) |
| E | Chạy Keycloak, Role Grant, Postgres | infra/oracle phần 6 | Sau ESI-142, ESI-143 (có image arm64) |
| F | Admin đầu tiên, realm `esi`, service account | Mục 3 và 4 bên dưới | Sau ESI-146 (realm dạng code) |
| G | Nối core và portal sang Keycloak | Mục 5 bên dưới | Sau ESI-148, ESI-149 |
| H | Đặt Worker trước core, bỏ Auth0 | infra/cloudflare phần 6, mục 6 bên dưới | Sau ESI-147, ESI-150 |
| I | Backup hằng ngày, thử restore | infra/oracle phần 7 | Ngay sau bước E |

Các bước A-D không tốn tiền và không phụ thuộc code, nên làm trước để khi có image chỉ cần chạy.

## 3. Lần chạy đầu: admin tạm và admin thật

Keycloak 26 tạo một **admin tạm** (bootstrap) từ hai biến `KC_BOOTSTRAP_ADMIN_USERNAME` và `KC_BOOTSTRAP_ADMIN_PASSWORD` trong `~/esi-idp/.env`. Admin tạm chỉ dùng để tạo admin thật, sau đó phải xoá.

1. Mở `https://<tên>.duckdns.org/admin/` từ máy có IP trùng `ESI_ADMIN_IP`. Mở từ IP khác sẽ nhận 403; đó là cố ý.
2. Đăng nhập bằng admin tạm, ở realm `master`.
3. **Users > Add user**: tạo user của bạn (ví dụ `platform-admin`), đặt mật khẩu ở tab **Credentials** (tắt *Temporary*).
4. Tab **Role mapping > Assign role**: lọc theo realm role, gán role `admin` của realm `master`.
5. Đăng xuất, đăng nhập lại bằng `platform-admin`, bật OTP cho chính tài khoản này (**Account console > Signing in**).
6. Xoá user admin tạm, rồi xoá hai biến `KC_BOOTSTRAP_ADMIN_*` khỏi `.env` và chạy `docker compose up -d keycloak`.

## 4. Realm `esi` và các client

Realm không được tạo bằng tay. Nó là code trong `services/idp` (ESI-146) và được áp dụng lại được nhiều lần (idempotent).

1. Áp dụng cấu hình realm theo lệnh ghi trong `services/idp/CLAUDE.md`. Công cụ (`keycloak-config-cli` hoặc import của Keycloak) do ESI-142 chọn, nên lệnh cụ thể là `TBD`.
2. Kiểm tra realm đã có:
   ```bash
   curl -s https://<tên>.duckdns.org/realms/esi/.well-known/openid-configuration | jq .issuer
   # "https://<tên>.duckdns.org/realms/esi"
   ```
3. Kiểm tra trong admin console (realm `esi`):
   - **Organizations** đang bật.
   - Client `esi-portal`: public, *Standard flow* bật, PKCE `S256`, *Direct access grants* tắt. Redirect URI gồm `http://localhost:4200/*`, URL Vercel production và mẫu URL preview.
   - Client scope hoặc mapper thêm audience `esi-core` vào access token.
   - Client `esi-role-grant`: confidential, *Service accounts* bật, chỉ có các role `realm-management` mà ADR-0013 cần.
   - **Realm settings > Login**: *User registration* tắt (chỉ mời).
4. Lấy secret của `esi-role-grant`: **Clients > esi-role-grant > Credentials > Client secret**. Ghi vào `ESI_GRANTS_KEYCLOAK_CLIENT_SECRET` trong `~/esi-idp/.env`, rồi `docker compose up -d role-grant`.
5. Tạo user demo. Trước D8 (ESI-153): **Users > Add user**, đặt mật khẩu tạm, bật *Required user actions: Update password, Configure OTP*. Sau D8: mời qua Role Grant Service hoặc màn hình identity admin của portal. Cách nhập user cũ là câu hỏi mở 5 của UR-140.

## 5. Nối core và portal sang Keycloak (ESI-148, ESI-149)

Core không cần đổi code, chỉ đổi cấu hình (ADR-0011):

```bash
az containerapp update -g esi-demo -n esi-core --set-env-vars \
  ESI_CORE_Auth__Mode=Oidc \
  ESI_CORE_Auth__Authority=https://<tên>.duckdns.org/realms/esi \
  ESI_CORE_Auth__Audience=esi-core
```

Với portal, ESI-149 đổi `AppConfig.auth` từ `domain` của Auth0 sang `issuer` của Keycloak. Tên biến `ESI_PORTAL_AUTH_*` và biến GitHub dùng cho bản build Vercel là `TBD` cho tới khi ESI-149 xong. Giá trị cần có:

| Thiết lập | Giá trị |
|-----------|---------|
| issuer | `https://<tên>.duckdns.org/realms/esi` |
| clientId | `esi-portal` |
| audience | `esi-core` (nếu thư viện OIDC cần) |

Đổi issuer nghĩa là user cũ (Auth0) không còn khớp. Core sẽ tạo dòng `users` mới, và database demo bắt đầu lại từ đầu (ADR-0011, Consequences).

## 6. Đặt Worker trước core và bỏ Auth0 (ESI-150)

1. Làm infra/cloudflare phần 6: đổi `ESI_DEMO_CORE_URL` sang URL của Worker, chuyển URL core vào cấu hình của Worker.
2. Xoá `infra/auth0`, xoá secret và biến Auth0 trong GitHub environments, xoá tenant Auth0 (ESI-150 làm phần này trong repo).
3. Cập nhật [deployment.md](./deployment.md) để bảng dịch vụ không còn Auth0.

## 7. Kiểm tra cuối (checklist)

- [ ] `https://<tên>.duckdns.org/realms/esi/.well-known/openid-configuration` trả JSON với `issuer` đúng.
- [ ] `/admin/` trả 403 khi mở từ mạng khác (ví dụ 4G điện thoại).
- [ ] Không có cổng nào ngoài 443 trả lời từ Internet: `nc -zv <public-ip> 8080 9000 5432` đều thất bại.
- [ ] Đăng nhập portal chuyển sang trang Keycloak, quay lại portal và gọi được `/api`.
- [ ] Gọi Worker không kèm token trả `401` problem+json, và log core không thấy request đó.
- [ ] Đăng xuất ở portal thì phiên Keycloak cũng kết thúc: mở lại portal phải đăng nhập lại.
- [ ] `~/esi-idp/backup.log` có bản backup hôm nay; đã thử restore ít nhất một lần.
- [ ] Không secret nào nằm trong repo; `.env` trên VM có quyền `600`.

## 8. Lỗi thường gặp

| Triệu chứng | Nguyên nhân hay gặp | Cách xử lý |
|-------------|----------------------|------------|
| Tạo VM báo "Out of capacity" | Vùng hết máy A1 | Thử lại sau, hoặc đổi availability domain trong cùng region |
| `curl https://<tên>.duckdns.org` treo | Cổng 443 chưa mở ở security list hoặc iptables của Ubuntu | infra/oracle phần 2 bước 2 và phần 3 bước 9 |
| Caddy báo lỗi lấy chứng chỉ | DuckDNS chưa trỏ đúng IP, hoặc 443 bị chặn | `dig +short <tên>.duckdns.org`, xem `docker compose logs caddy` |
| Đăng nhập xong bị lặp redirect, hoặc lỗi "Invalid redirect uri" | Redirect URI của `esi-portal` thiếu URL đang dùng | Thêm URL vào realm config (ESI-146), áp dụng lại |
| Core trả 401 với token hợp lệ | Token thiếu audience `esi-core`, hoặc `Authority` sai (thiếu `/realms/esi`) | Giải mã token ở jwt.io (token demo), so `iss` và `aud` với cấu hình core |
| Keycloak tự tắt, log báo hết bộ nhớ | `mem_limit` quá nhỏ hoặc heap quá lớn | Tăng `mem_limit` (VM có 12 GB) hoặc giảm `MaxRAMPercentage` |
| URL trong token là `http://` thay vì `https://` | Thiếu `KC_PROXY_HEADERS=xforwarded` hoặc `KC_HOSTNAME` | infra/oracle phần 6, mục compose |
| Worker trả lỗi hàng loạt cuối ngày | Hết 100.000 request/ngày của gói Free | Chờ reset lúc 00:00 UTC (7 giờ sáng giờ Việt Nam), kiểm tra Metrics |
