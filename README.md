# AI Hồ Sơ Trạm Biến Áp – V1 + AI thật

Ứng dụng hỗ trợ hồ sơ giấy tờ thi công trạm biến áp.

## Đã có trong V1
- Giao diện Tổng quan, Công trình, Đào tạo AI, Chat AI, Kho hồ sơ, Người dùng.
- OpenAI Responses API.
- File Search + Vector Store làm kho kiến thức.
- Upload nhiều tài liệu để AI tra cứu.
- AI không tự bịa dữ liệu; dữ liệu thiếu được đánh dấu CHƯA CÓ DỮ LIỆU.
- API key chỉ nằm ở server environment.

## Environment Variables
- OPENAI_API_KEY
- OPENAI_MODEL=gpt-5.6-luna
- OPENAI_VECTOR_STORE_ID

Không commit file .env hoặc API key.

## Chưa phải bản cuối
Đăng nhập nhiều người dùng, phân quyền Admin/User, kho hồ sơ riêng theo từng công trình và xuất Word/Excel/PDF sẽ được xây tiếp trên nền V1 này.
