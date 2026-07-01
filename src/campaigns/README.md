# Campaigns Module

Module quản lý các chiến dịch email marketing (mail merge) trong hệ thống. Module này cung cấp các chức năng tạo, quản lý, và theo dõi các chiến dịch gửi email hàng loạt.

## 📋 Mục lục

- [Tổng quan](#tổng-quan)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Entities và Relationships](#entities-và-relationships)
- [API Endpoints](#api-endpoints)
- [DTOs và Validation](#dtos-và-validation)
- [Tính năng chính](#tính-năng-chính)
- [Best Practices](#best-practices)

## 🎯 Tổng quan

Module `Campaigns` là module chính để quản lý các chiến dịch email marketing. Mỗi campaign bao gồm:
- **Template email**: Subject và nội dung email
- **Recipients**: Danh sách người nhận với dữ liệu tùy chỉnh
- **Attachments**: Các file đính kèm
- **Status tracking**: Theo dõi trạng thái gửi email

## 📁 Cấu trúc thư mục

```
campaigns/
├── campaigns.controller.ts      # HTTP endpoints
├── campaigns.service.ts         # Business logic
├── campaigns.module.ts          # Module configuration
├── dto/
│   ├── create-campaign.dto.ts   # DTO cho tạo campaign
│   ├── create-recipient.dto.ts  # DTO cho thêm recipient
│   └── update-campaign.dto.ts   # DTO cho cập nhật campaign
└── README.md                    # Tài liệu này
```

## 🗄️ Entities và Relationships

### Campaign Entity

Entity chính đại diện cho một chiến dịch email.

**Các trường chính:**
- `id`: UUID (Primary Key)
- `userId`: UUID của người tạo campaign
- `name`: Tên campaign (max 255 ký tự)
- `subject`: Tiêu đề email (max 500 ký tự)
- `content`: Nội dung email (text)
- `placeholders`: Mảng các placeholder có thể thay thế trong template
- `status`: Trạng thái campaign (enum: `draft`, `scheduled`, `sending`, `sent`, `failed`)
- `totalRecipients`: Tổng số người nhận
- `sentCount`: Số email đã gửi thành công
- `failedCount`: Số email gửi thất bại
- `scheduledAt`: Thời gian lên lịch gửi (nullable)
- `sentAt`: Thời gian bắt đầu gửi (nullable)
- `createdAt`: Thời gian tạo
- `updatedAt`: Thời gian cập nhật

**Relationships:**
- `OneToMany` với `CampaignRecipient`
- `OneToMany` với `CampaignAttachment`
- `OneToMany` với `CampaignEmailLog`

### CampaignRecipient Entity

Entity đại diện cho một người nhận trong campaign.

**Các trường chính:**
- `id`: UUID (Primary Key)
- `campaignId`: UUID của campaign (Foreign Key)
- `email`: Địa chỉ email người nhận
- `data`: JSON object chứa dữ liệu tùy chỉnh cho placeholder replacement
- `status`: Trạng thái gửi (enum: `pending`, `sent`, `failed`, `bounced`)
- `sentAt`: Thời gian gửi email (nullable)
- `errorMessage`: Thông báo lỗi nếu gửi thất bại (nullable)
- `createdAt`: Thời gian tạo

**Relationships:**
- `ManyToOne` với `Campaign` (CASCADE delete)

### CampaignAttachment Entity

Entity đại diện cho file đính kèm của campaign.

**Các trường chính:**
- `id`: UUID (Primary Key)
- `campaignId`: UUID của campaign (Foreign Key)
- `fileName`: Tên file
- `filePath`: Đường dẫn file trên server
- `fileSize`: Kích thước file (bigint)
- `mimeType`: Loại MIME của file (nullable)
- `createdAt`: Thời gian tạo

**Relationships:**
- `ManyToOne` với `Campaign` (CASCADE delete)

## 🔌 API Endpoints

### Campaigns

#### `POST /campaigns`
Tạo một campaign mới.

**Request Body:**
```json
{
  "name": "Campaign Name",
  "template": {
    "subject": "Email Subject",
    "content": "Email content with {{placeholder}}"
  },
  "recipients": [
    {
      "email": "user@example.com",
      "data": {
        "name": "John Doe",
        "customField": "value"
      }
    }
  ],
  "attachmentIds": ["uuid1", "uuid2"],
  "userId": "user-uuid"
}
```

**Response:** Campaign object với đầy đủ relationships

#### `GET /campaigns`
Lấy danh sách tất cả campaigns.

**Response:** Array of Campaign objects

#### `GET /campaigns/:id`
Lấy thông tin chi tiết một campaign.

**Response:** Campaign object với recipients và attachments

#### `PATCH /campaigns/:id`
Cập nhật thông tin campaign.

**Request Body:** Partial của CreateCampaignDto

**Response:** Campaign object đã được cập nhật

#### `DELETE /campaigns/:id`
Xóa một campaign.

**Response:**
```json
{
  "deleted": true
}
```

### Attachments

#### `POST /campaigns/attachments`
Upload file đính kèm.

**Request:** Multipart form data với field `file`

**Response:** CampaignAttachment object

### Recipients

#### `POST /campaigns/:id/recipients`
Thêm một recipient vào campaign.

**Request Body:**
```json
{
  "email": "user@example.com",
  "data": {
    "name": "John Doe"
  }
}
```

**Response:** CampaignRecipient object

## 📝 DTOs và Validation

### CreateCampaignDto

```typescript
{
  name: string;                    // Required, không rỗng
  template: {
    subject: string;               // Required, không rỗng
    content: string;               // Required, không rỗng
  };
  recipients: Array<{              // Required, array
    email: string;
    [key: string]: any;            // Dữ liệu tùy chỉnh
  }>;
  attachmentIds?: string[];        // Optional, array of UUIDs
  userId?: string;                 // Optional, UUID
}
```

**Validation Rules:**
- `name`: Bắt buộc, không được rỗng
- `template.subject`: Bắt buộc, không được rỗng
- `template.content`: Bắt buộc, không được rỗng
- `recipients`: Bắt buộc, mảng các object
- `attachmentIds`: Tùy chọn, mảng các UUID hợp lệ

### CreateRecipientDto

```typescript
{
  email: string;                   // Required, phải là email hợp lệ
  data?: Record<string, any>;     // Optional, object
}
```

**Validation Rules:**
- `email`: Bắt buộc, phải là định dạng email hợp lệ
- `data`: Tùy chọn, phải là object nếu có

### UpdateCampaignDto

Extends `PartialType(CreateCampaignDto)`, cho phép cập nhật một phần các trường của campaign.

## ✨ Tính năng chính

### 1. Tạo Campaign với Template và Recipients

Khi tạo campaign, hệ thống sẽ:
- Tạo campaign với thông tin template (subject, content)
- Tạo các recipient records với email và dữ liệu tùy chỉnh
- Liên kết các attachments đã upload trước đó
- Tự động tính `totalRecipients` dựa trên số lượng recipients

### 2. Upload Attachments

- Upload file qua endpoint `/campaigns/attachments`
- File được lưu vào thư mục `./uploads`
- Trả về attachment ID để sử dụng khi tạo campaign

### 3. Quản lý Recipients

- Thêm recipient mới vào campaign đã tồn tại
- Tự động cập nhật `totalRecipients` khi thêm recipient
- Theo dõi trạng thái gửi cho từng recipient

### 4. Status Tracking

**Campaign Status:**
- `draft`: Campaign đang được soạn thảo
- `scheduled`: Campaign đã được lên lịch
- `sending`: Đang trong quá trình gửi
- `sent`: Đã gửi xong
- `failed`: Gửi thất bại

**Recipient Status:**
- `pending`: Chưa gửi
- `sent`: Đã gửi thành công
- `failed`: Gửi thất bại
- `bounced`: Email bị trả lại

### 5. Placeholder Replacement

Campaign hỗ trợ placeholder trong nội dung email. Ví dụ:
- Template: `"Hello {{name}}, your code is {{code}}"`
- Recipient data: `{ "name": "John", "code": "ABC123" }`
- Kết quả: `"Hello John, your code is ABC123"`

## 🏆 Best Practices

Module này tuân theo các best practices của NestJS:

### 1. Separation of Concerns
- **Controller**: Chỉ xử lý HTTP requests/responses
- **Service**: Chứa toàn bộ business logic
- **Repository**: Data access layer (TypeORM)

### 2. DTO Validation
- Sử dụng `class-validator` để validate input
- Sử dụng `class-transformer` để transform data
- Validation được áp dụng tự động qua `ValidationPipe`

### 3. Error Handling
- Sử dụng `NotFoundException` khi không tìm thấy resource
- Exception được xử lý bởi global exception filter

### 4. Type Safety
- Sử dụng TypeScript enums cho status values
- Type-safe DTOs với validation decorators
- Proper typing cho all entities và relationships

### 5. Database Relationships
- Sử dụng TypeORM relationships (OneToMany, ManyToOne)
- CASCADE delete để đảm bảo data integrity
- Indexes trên các trường thường query (campaignId, email, userId)

### 6. File Upload
- Sử dụng `@nestjs/platform-express` với `FileInterceptor`
- File được lưu với metadata (filename, path, size, mimeType)

## 🔄 Workflow điển hình

1. **Upload Attachments** (nếu có)
   ```
   POST /campaigns/attachments
   → Nhận attachment IDs
   ```

2. **Tạo Campaign**
   ```
   POST /campaigns
   {
     name, template, recipients, attachmentIds
   }
   → Campaign được tạo với status = 'draft'
   ```

3. **Thêm Recipients** (nếu cần)
   ```
   POST /campaigns/:id/recipients
   → Recipient được thêm và totalRecipients được cập nhật
   ```

4. **Cập nhật Campaign** (nếu cần)
   ```
   PATCH /campaigns/:id
   → Cập nhật thông tin campaign
   ```

5. **Xem Campaign**
   ```
   GET /campaigns/:id
   → Xem chi tiết campaign với recipients và attachments
   ```

## 📚 Tham khảo

- [NestJS Controllers Documentation](https://docs.nestjs.com/controllers)
- [NestJS Services Documentation](https://docs.nestjs.com/providers)
- [TypeORM Relations Documentation](https://typeorm.io/relations)
- [class-validator Documentation](https://github.com/typestack/class-validator)
- [NestJS File Upload Documentation](https://docs.nestjs.com/techniques/file-upload)

## 🚀 Cải tiến trong tương lai

- [ ] Pagination cho danh sách campaigns
- [ ] Filter và search campaigns
- [ ] Bulk operations (thêm/xóa nhiều recipients)
- [ ] Template management (lưu và tái sử dụng templates)
- [ ] Email preview với placeholder replacement
- [ ] Scheduling với cron jobs
- [ ] Email sending integration
- [ ] Analytics và reporting
