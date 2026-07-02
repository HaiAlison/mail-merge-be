# Plan: Background Worker for File Parsing (CSV & XLSX)

Đẩy toàn bộ việc parse file (CSV và XLSX) và insert recipient vào background worker (BullMQ), thay vì parse ở trình duyệt và gửi toàn bộ JSON qua API.

## Confirmed Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | BE trả về `headers` ngay sau upload? | ✅ Có |
| 2 | Progress bar real-time qua WebSocket? | ✅ Có |
| 3 | Disable "Send" cho đến khi parse xong? | ✅ Có |
| 4 | File storage? | 🔧 Local disk + stub `pushFileToCloud()` để sau này gắn S3 |

---

## Implementation Tasks

- `[ ]` **[BE]** Cài dependencies: `csv-parser`, `xlsx`, `@types/csv-parser`
- `[ ]` **[BE]** Tạo `file-parser.service.ts` — service tách biệt xử lý parse headers và rows (CSV + XLSX), có stub `pushFileToCloud()`
- `[ ]` **[BE]** Sửa `processUpload()` trong `campaigns.service.ts` → trả về `{ id, headers, filePath }`
- `[ ]` **[BE]** Tạo `campaign-queue.types.ts` — constants và interfaces
- `[ ]` **[BE]** Tạo `campaign-queue.producer.ts` — enqueue `parse-file` job
- `[ ]` **[BE]** Tạo `campaign-queue.consumer.ts` — worker xử lý parse, bulk insert, WebSocket progress
- `[ ]` **[BE]** Sửa `campaigns.service.ts — create()` → xóa insert recipients đồng bộ, gọi producer
- `[ ]` **[BE]** Sửa `campaigns.module.ts` → đăng ký queue + providers mới
- `[ ]` **[BE]** Thêm field `parseStatus` vào entity `Campaign` (enum: `pending` | `processing` | `done` | `failed`)
- `[ ]` **[BE]** Generate + run migration cho `parse_status`
- `[ ]` **[FE]** Sửa `StepDataSource.tsx` → xóa in-browser parsing, gọi API upload, nhận `{ id, headers }`
- `[ ]` **[FE]** Sửa `campaignService.ts` → `uploadDataSource()` nhận `{ id, headers }`
- `[ ]` **[FE]** Sửa `CampaignNew.tsx` → xóa `recipients` khỏi payload, bỏ state `dataRows`/`uniqueData`
- `[ ]` **[FE]** Sửa `types.ts` → xóa/optional `recipients` trong `Campaign` interface, thêm `parseStatus` vào `CampaignItem`
- `[ ]` **[FE]** Sửa `CampaignDetail.tsx` → disable nút "Send" khi `parseStatus !== 'done'`
- `[ ]` **[FE]** WebSocket listener → nhận `campaign.parse.progress` và `campaign.parse.completed`, cập nhật UI

---

## Proposed Changes (Chi tiết)

### Phase 1: Backend — File Parser Service + Upload Headers

#### [NEW] src/campaigns/file-parser.service.ts
- `extractHeaders(filePath, mimeType): Promise<string[]>` — đọc nhanh dòng đầu.
- `streamRows(filePath, mimeType, callback): Promise<void>` — stream từng row.
- `pushFileToCloud(filePath): Promise<string>` — stub, hiện tại return `filePath`, sau thay bằng S3 URL.

#### [MODIFY] src/campaigns/campaigns.service.ts — processUpload()
- Gọi `fileParserService.extractHeaders(filePath, mimeType)` sau khi save.
- Trả về `{ id, headers }`.

---

### Phase 2: Backend — Campaign Queue Worker

#### [NEW] src/campaigns/campaign-queue.types.ts
```
CAMPAIGN_QUEUE = 'campaign-queue'
PARSE_FILE_JOB = 'parse-file'
ParseFileJobPayload { campaignId, dataSourceId, filePath, mimeType, placeholdersMap, userId }
```

#### [NEW] src/campaigns/campaign-queue.producer.ts
- `enqueueParseFile(payload)` → push job vào `CAMPAIGN_QUEUE`.

#### [NEW] src/campaigns/campaign-queue.consumer.ts
- Xử lý `PARSE_FILE_JOB`:
  1. Cập nhật `campaign.parseStatus = 'processing'`.
  2. Emit WS: `campaign.parse.started`.
  3. Stream rows qua `fileParserService.streamRows()`, remap keys theo `placeholdersMap`.
  4. Bulk-insert batch 500 dòng vào `campaign_recipients`.
  5. Emit WS: `campaign.parse.progress { campaignId, processed, total }` mỗi batch.
  6. Sau khi xong: update `campaign.totalRecipients`, `campaign.parseStatus = 'done'`.
  7. Emit WS: `campaign.parse.completed { campaignId }`.
  8. Nếu lỗi: set `campaign.parseStatus = 'failed'`, emit `campaign.parse.failed`.

#### [MODIFY] src/entity/campaign.entity.ts
- Thêm `@Column` `parseStatus: 'pending' | 'processing' | 'done' | 'failed'`, default `'pending'`.

#### [MODIFY] src/campaigns/campaigns.service.ts — create()
- Xóa loop insert recipients.
- Gọi `campaignQueueProducer.enqueueParseFile(...)` sau khi save campaign.

#### [MODIFY] src/campaigns/campaigns.module.ts
- `BullModule.registerQueue({ name: 'campaign-queue' })`.
- Provide: `FileParserService`, `CampaignQueueProducer`, `CampaignQueueConsumer`.

---

### Phase 3: Frontend

#### [MODIFY] StepDataSource.tsx
- Xóa PapaParse + XLSX logic.
- Khi chọn file → gọi `campaignService.uploadDataSource(file)` ngay → nhận `{ id, headers }`.
- Hiển thị loading state khi đang upload.

#### [MODIFY] campaignService.ts
- Return type `uploadDataSource`: `{ id: string, headers: string[] }`.

#### [MODIFY] CampaignNew.tsx
- Bỏ state `dataRows`, `uniqueData`.
- Payload `handleCreate()` không còn `recipients`.

#### [MODIFY] CampaignDetail.tsx
- Disable nút "Send Campaign" khi `campaign.parseStatus !== 'done'`.
- Hiển thị badge/text trạng thái parse (e.g. "Processing file...").

#### [MODIFY] types.ts
- `Campaign`: xóa `recipients`.
- `CampaignItem`: thêm `parseStatus: 'pending' | 'processing' | 'done' | 'failed'`.

---

## Dependencies

```bash
# Backend
npm install csv-parser xlsx
npm install -D @types/csv-parser
```

> `xlsx` đã có ở FE, cần cài thêm ở BE.

---

## Verification Plan

1. Upload CSV 10,000 dòng → API response < 500ms, không timeout.
2. Upload XLSX → `headers` trả về đúng.
3. BullMQ log hiện job `parse-file` picked up + completed.
4. `campaign.totalRecipients` cập nhật đúng sau job xong.
5. `campaign.parseStatus` chuyển `pending → processing → done`.
6. `CampaignDetail` nút Send disable khi `parseStatus !== 'done'`.
7. WebSocket nhận events `parse.progress` + `parse.completed` trên FE.
8. Gửi mail sau khi parse xong vẫn hoạt động đúng với dữ liệu recipient.


## User Review Required

> **Breaking Change:** `StepDataSource.tsx` hiện đang parse CSV/XLSX hoàn toàn ở trình duyệt (PapaParse + xlsx library). Sau khi implement, chức năng đó sẽ bị gỡ bỏ. Điều này nghĩa là:
> - Bước 1 (Data Source) sẽ chỉ cho người dùng upload file và xem **preview nhỏ** (ví dụ 5 dòng đầu), không còn load toàn bộ vào bộ nhớ trình duyệt.
> - Mapping `placeholdersMap` (đổi tên cột) vẫn cần hoạt động, nhưng cần lấy danh sách `headers` từ backend sau khi upload.

> **Open Questions cần trả lời trước khi implement:**
> 1. **Preview headers:** Khi FE upload file xong, BE nên trả về `headers` (danh sách tên cột) ngay lập tức để FE render bảng mapping. Đồng ý không?
> 2. **Progress bar:** Có muốn hiển thị progress bar real-time (via WebSocket) khi worker đang parse file không?
> 3. **Send restriction:** Nút "Send Campaign" có nên bị disable cho đến khi parse job hoàn tất không?
> 4. **File storage:** File hiện lưu ở `./uploads` (local disk). Nếu deploy multi-instance, worker có thể không đọc được file. Cần chuyển sang S3 hay vẫn dùng local disk?

---

## Proposed Changes

### Phase 1: Backend — Upload endpoint trả về Headers

#### [MODIFY] src/campaigns/campaigns.controller.ts
- `POST /data-source`: Sau khi lưu file, parse nhanh phần header (dòng đầu).
- Trả về: `{ id: dataSourceId, headers: string[] }`.

#### [MODIFY] src/campaigns/campaigns.service.ts — processUpload()
- Sau khi save DataSource record, đọc phần headers từ file.
- Thư viện sử dụng:
  - **CSV:** `csv-parser` stream — chỉ đọc dòng đầu rồi `destroy()`.
  - **XLSX:** `exceljs` — `workbook.xlsx.createReadStream()` để stream từng row (low memory).
- Trả về `{ id, headers }` trong response.

---

### Phase 2: Backend — Campaign Queue (BullMQ Worker)

#### [NEW] src/campaigns/campaign-queue.types.ts
- `CAMPAIGN_QUEUE = 'campaign-queue'`
- `PARSE_FILE_JOB = 'parse-file'`
- Interface `ParseFileJobPayload { campaignId, dataSourceId, filePath, mimeType, placeholdersMap }`

#### [NEW] src/campaigns/campaign-queue.producer.ts
- Service inject BullMQ Queue.
- Method: `enqueueParseFile(payload: ParseFileJobPayload)`.

#### [NEW] src/campaigns/campaign-queue.consumer.ts
- Worker xử lý `PARSE_FILE_JOB`:
  1. Detect file type qua `mimeType`:
     - `text/csv` → `fs.createReadStream` + `csv-parser` (streaming, low memory).
     - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (xlsx) → `xlsx` library, stream hoặc readFile.
  2. Remap keys của mỗi row theo `placeholdersMap`.
  3. Bulk-insert vào `campaign_recipients` theo batch 500–1000 dòng.
  4. Cập nhật `campaign.totalRecipients` sau khi xong.
  5. Emit WebSocket event `campaign.parse.completed` (và optionally progress).

#### [MODIFY] src/campaigns/campaigns.service.ts — create()
- Xóa bỏ loop insert recipients đồng bộ.
- Gọi: `this.campaignQueueProducer.enqueueParseFile(...)`.

#### [MODIFY] src/campaigns/campaigns.module.ts
- Đăng ký `BullModule.registerQueue({ name: 'campaign-queue' })`.
- Provide `CampaignQueueProducer`, `CampaignQueueConsumer`.

---

### Phase 3: Frontend — Loại bỏ in-browser parsing

#### [MODIFY] src/components/campaigns/steps/StepDataSource.tsx
- Gỡ bỏ PapaParse và XLSX parsing logic.
- Luồng mới: Upload file → nhận `{ id, headers }` từ API → gọi `onDataLoaded` với headers.
- Hiển thị "File uploaded successfully, X columns detected".

#### [MODIFY] src/services/campaignService.ts
- `uploadDataSource()`: Cập nhật response type nhận `{ id, headers }`.

#### [MODIFY] src/pages/CampaignNew.tsx
- `handleCreate()`: Xóa `recipients: uniqueData` khỏi payload.
- Bỏ state `dataRows`, `uniqueData`.

#### [MODIFY] src/components/campaigns/types.ts
- `recipients` trong `Campaign` interface: mark as optional hoặc xóa.

---

## Dependencies cần cài

Backend:
```
npm install csv-parser exceljs
npm install -D @types/csv-parser
```

Ghi chú: `xlsx` đã có ở FE. Cần cài thêm ở BE vì parsing giờ chạy server-side.

---

## Verification Plan

1. Upload file CSV 10,000 dòng → API response nhanh, không timeout.
2. Upload file XLSX → headers trả về đúng.
3. BullMQ job `parse-file` được pickup và hoàn thành trong log.
4. `campaign.totalRecipients` cập nhật đúng sau khi job xong.
5. `recipient.data` trong DB có keys đúng theo `placeholdersMap`.
6. Gửi mail vẫn hoạt động đúng sau refactor.

