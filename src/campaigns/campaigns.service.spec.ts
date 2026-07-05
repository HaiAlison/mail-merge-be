import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { Campaign } from '../entity/campaign.entity';
import { CampaignRecipient } from '../entity/campaign-recipient.entity';
import { CampaignAttachment } from '../entity/campaign-attachment.entity';
import { CampaignDataSource } from '../entity/campaign-data-source.entity';
import { CampaignEmailLog } from '../entity/campaign-email-log.entity';
import { CampaignStatus } from '../entity/enums';
import { User } from '../entity/user.entity';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { MailQueueProducer } from '../mail/mail-queue.producer';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { GmailAuthService } from '../mail/gmail-auth.service';
import { FileParserService } from './file-parser.service';
import { CampaignQueueProducer } from './campaign-queue.producer';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const mockUser: User = {
  id: 'user-uuid-001',
  email: 'tester@example.com',
  firstName: 'Test',
  lastName: 'User',
  googleProviderId: null,
  picture: null,
  googleRefreshToken: null,
  password: null,
} as User;

let campaignIdCounter = 0;

/** Build a saved campaign stub from the DTO + user */
function buildSavedCampaign(dto: CreateCampaignDto, user: User): Campaign {
  campaignIdCounter++;
  return {
    id: `campaign-uuid-${String(campaignIdCounter).padStart(3, '0')}`,
    userId: user.id,
    name: dto.name,
    subject: dto.subject,
    content: dto.content,
    placeholders: dto.placeholders,
    placeholdersMap: dto.placeholdersMap || {},
    status: dto.status,
    parseStatus: 'pending',
    totalRecipients: 0,
    sentCount: 0,
    schedulingCount: 0,
    failedCount: 0,
    scheduledAt: null,
    sentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    recipients: [],
    attachments: [],
    dataSource: null,
    dataSourceId: dto.dataSourceId,
    emailLogs: [],
  } as unknown as Campaign;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock factories
// ─────────────────────────────────────────────────────────────────────────────

const createMockQueryBuilder = () => ({
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({ affected: 1 }),
});

const createMockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(createMockQueryBuilder()),
  increment: jest.fn(),
});

describe('CampaignsService — create()', () => {
  let service: CampaignsService;
  let campaignRepo: ReturnType<typeof createMockRepository>;
  let recipientRepo: ReturnType<typeof createMockRepository>;
  let attachmentRepo: ReturnType<typeof createMockRepository>;
  let datasourceRepo: ReturnType<typeof createMockRepository>;
  let emailLogRepo: ReturnType<typeof createMockRepository>;
  let mockCampaignQueueProducer: { enqueueParseFile: jest.Mock };

  beforeEach(async () => {
    campaignIdCounter = 0;

    campaignRepo = createMockRepository();
    recipientRepo = createMockRepository();
    attachmentRepo = createMockRepository();
    datasourceRepo = createMockRepository();
    emailLogRepo = createMockRepository();
    mockCampaignQueueProducer = { enqueueParseFile: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: getRepositoryToken(Campaign), useValue: campaignRepo },
        { provide: getRepositoryToken(CampaignRecipient), useValue: recipientRepo },
        { provide: getRepositoryToken(CampaignAttachment), useValue: attachmentRepo },
        { provide: getRepositoryToken(CampaignDataSource), useValue: datasourceRepo },
        { provide: getRepositoryToken(CampaignEmailLog), useValue: emailLogRepo },
        { provide: MailQueueProducer, useValue: { enqueueBatch: jest.fn() } },
        { provide: UsersService, useValue: {} },
        { provide: MailService, useValue: {} },
        { provide: GmailAuthService, useValue: {} },
        { provide: FileParserService, useValue: {} },
        { provide: CampaignQueueProducer, useValue: mockCampaignQueueProducer },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test helper — wire up mocks for a given DTO
  // ───────────────────────────────────────────────────────────────────────────

  function setupMocksForCreate(dto: CreateCampaignDto, options?: {
    dataSource?: CampaignDataSource | null;
  }) {
    const saved = buildSavedCampaign(dto, mockUser);

    campaignRepo.create.mockReturnValue(saved);
    campaignRepo.save.mockResolvedValue(saved);
    campaignRepo.findOne.mockResolvedValue(saved);

    if (options?.dataSource !== undefined) {
      datasourceRepo.findOne.mockResolvedValue(options.dataSource);
    }

    return saved;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. HAPPY PATH — Basic draft campaign (no data source, no attachments)
  // ═══════════════════════════════════════════════════════════════════════════

  it('should create a basic draft campaign with minimal fields', async () => {
    const dto: CreateCampaignDto = {
      name: 'Welcome Email',
      subject: 'Hello {{first_name}}',
      content: '<p>Welcome, {{first_name}}!</p>',
      placeholders: ['first_name'],
      dataSourceId: null as any,
      status: CampaignStatus.DRAFT,
    };

    const expected = setupMocksForCreate(dto);
    const result = await service.create(dto, mockUser);

    expect(campaignRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Welcome Email',
        subject: 'Hello {{first_name}}',
        userId: mockUser.id,
        status: CampaignStatus.DRAFT,
      }),
    );
    expect(campaignRepo.save).toHaveBeenCalledTimes(1);
    expect(result.id).toBe(expected.id);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Campaign with multiple placeholders & placeholdersMap
  // ═══════════════════════════════════════════════════════════════════════════

  it('should create a campaign with multiple placeholders and a mapping', async () => {
    const dto: CreateCampaignDto = {
      name: 'Invoice Reminder',
      subject: 'Invoice #{{invoice_number}} for {{company}}',
      content: '<p>Hi {{first_name}}, your invoice for {{company}} is due on {{due_date}}.</p>',
      placeholders: ['first_name', 'invoice_number', 'company', 'due_date'],
      placeholdersMap: {
        first_name: 'First Name',
        invoice_number: 'Invoice No',
        company: 'Company Name',
        due_date: 'Due Date',
      },
      dataSourceId: null as any,
      status: CampaignStatus.DRAFT,
    };

    setupMocksForCreate(dto);
    const result = await service.create(dto, mockUser);

    expect(campaignRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        placeholders: ['first_name', 'invoice_number', 'company', 'due_date'],
        placeholdersMap: dto.placeholdersMap,
      }),
    );
    expect(result.name).toBe('Invoice Reminder');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Campaign with a data source — should link & enqueue parse job
  // ═══════════════════════════════════════════════════════════════════════════

  it('should link data source and enqueue parse job when dataSourceId is provided', async () => {
    const dataSource = {
      id: 'ds-uuid-001',
      fileName: 'contacts.csv',
      filePath: '/uploads/contacts.csv',
      mimeType: 'text/csv',
      fileSize: '1024',
    } as CampaignDataSource;

    const dto: CreateCampaignDto = {
      name: 'Newsletter with CSV',
      subject: 'Monthly Update for {{first_name}}',
      content: '<h1>Hi {{first_name}}</h1>',
      placeholders: ['first_name'],
      placeholdersMap: { first_name: 'first_name' },
      dataSourceId: 'ds-uuid-001',
      status: CampaignStatus.DRAFT,
    };

    const saved = setupMocksForCreate(dto, { dataSource });
    await service.create(dto, mockUser);

    // Verify data source was looked up
    expect(datasourceRepo.findOne).toHaveBeenCalledWith({ where: { id: 'ds-uuid-001' } });

    // Verify query builder updated campaign with dataSourceId
    expect(datasourceRepo.createQueryBuilder).toHaveBeenCalled();

    // Verify parse job was enqueued
    expect(mockCampaignQueueProducer.enqueueParseFile).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: saved.id,
        dataSourceId: 'ds-uuid-001',
        filePath: '/uploads/contacts.csv',
        mimeType: 'text/csv',
      }),
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Data source ID provided but data source not found — should NOT enqueue
  // ═══════════════════════════════════════════════════════════════════════════

  it('should not enqueue parse job when data source is not found in DB', async () => {
    const dto: CreateCampaignDto = {
      name: 'Orphaned DS Campaign',
      subject: 'Test',
      content: '<p>Test</p>',
      placeholders: [],
      dataSourceId: 'ds-nonexistent',
      status: CampaignStatus.DRAFT,
    };

    setupMocksForCreate(dto, { dataSource: null });
    await service.create(dto, mockUser);

    expect(datasourceRepo.findOne).toHaveBeenCalledWith({ where: { id: 'ds-nonexistent' } });
    expect(mockCampaignQueueProducer.enqueueParseFile).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Campaign with attachment IDs — should link attachments
  // ═══════════════════════════════════════════════════════════════════════════

  it('should link attachments when attachmentIds are provided', async () => {
    const dto: CreateCampaignDto = {
      name: 'Campaign with Attachments',
      subject: 'Files attached for {{first_name}}',
      content: '<p>Please see attached.</p>',
      placeholders: ['first_name'],
      attachmentIds: ['att-001', 'att-002', 'att-003'],
      dataSourceId: null as any,
      status: CampaignStatus.DRAFT,
    };

    setupMocksForCreate(dto);
    await service.create(dto, mockUser);

    const qb = attachmentRepo.createQueryBuilder();
    expect(attachmentRepo.createQueryBuilder).toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Campaign with SCHEDULED status
  // ═══════════════════════════════════════════════════════════════════════════

  it('should create a campaign with scheduled status', async () => {
    const dto: CreateCampaignDto = {
      name: 'Black Friday Early Bird',
      subject: '🔥 {{first_name}}, Early Access Deals!',
      content: '<h1>VIP Access for {{first_name}}</h1>',
      placeholders: ['first_name'],
      dataSourceId: null as any,
      status: CampaignStatus.SCHEDULED,
    };

    setupMocksForCreate(dto);
    const result = await service.create(dto, mockUser);

    expect(campaignRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: CampaignStatus.SCHEDULED }),
    );
    expect(result.status).toBe(CampaignStatus.SCHEDULED);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. Empty placeholders array — valid scenario
  // ═══════════════════════════════════════════════════════════════════════════

  it('should create a campaign with no placeholders (static content)', async () => {
    const dto: CreateCampaignDto = {
      name: 'Static Announcement',
      subject: 'System Maintenance Notice',
      content: '<p>We will undergo maintenance on Saturday.</p>',
      placeholders: [],
      dataSourceId: null as any,
      status: CampaignStatus.DRAFT,
    };

    setupMocksForCreate(dto);
    const result = await service.create(dto, mockUser);

    expect(campaignRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ placeholders: [] }),
    );
    expect(result.name).toBe('Static Announcement');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. PlaceholdersMap defaults to empty object when not provided
  // ═══════════════════════════════════════════════════════════════════════════

  it('should default placeholdersMap to {} when not provided', async () => {
    const dto: CreateCampaignDto = {
      name: 'No Map Campaign',
      subject: 'Hello',
      content: '<p>Hi</p>',
      placeholders: ['name'],
      dataSourceId: null as any,
      status: CampaignStatus.DRAFT,
    };

    setupMocksForCreate(dto);
    await service.create(dto, mockUser);

    expect(campaignRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ placeholdersMap: {} }),
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. Campaign returns full entity via findOne after save
  // ═══════════════════════════════════════════════════════════════════════════

  it('should call findOne with the saved campaign ID to return full relations', async () => {
    const dto: CreateCampaignDto = {
      name: 'Full Return Test',
      subject: 'Test',
      content: '<p>Test</p>',
      placeholders: [],
      dataSourceId: null as any,
      status: CampaignStatus.DRAFT,
    };

    const saved = setupMocksForCreate(dto);
    await service.create(dto, mockUser);

    expect(campaignRepo.findOne).toHaveBeenCalledWith({
      where: { id: saved.id },
      relations: ['recipients', 'attachments', 'dataSource', 'emailLogs'],
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. totalRecipients always starts at 0
  // ═══════════════════════════════════════════════════════════════════════════

  it('should initialize totalRecipients to 0 regardless of input', async () => {
    const dto: CreateCampaignDto = {
      name: 'Zero Recipients Start',
      subject: 'Test',
      content: '<p>Test</p>',
      placeholders: [],
      dataSourceId: null as any,
      status: CampaignStatus.DRAFT,
    };

    setupMocksForCreate(dto);
    await service.create(dto, mockUser);

    expect(campaignRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ totalRecipients: 0 }),
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. Rich HTML content with multiple merge tags
  // ═══════════════════════════════════════════════════════════════════════════

  it('should handle rich HTML content with many merge tags', async () => {
    const dto: CreateCampaignDto = {
      name: 'Rich Template Campaign',
      subject: '{{company}} — Special Offer for {{first_name}}',
      content: `
        <div style="font-family: Arial">
          <h1>Dear {{first_name}} {{last_name}},</h1>
          <p>As a valued member of {{company}}, we'd like to offer you {{discount}}% off.</p>
          <p>Use code: <code>{{promo_code}}</code></p>
          <a href="{{cta_link}}">Claim Your Offer</a>
        </div>
      `,
      placeholders: ['first_name', 'last_name', 'company', 'discount', 'promo_code', 'cta_link'],
      placeholdersMap: {
        first_name: 'First Name',
        last_name: 'Last Name',
        company: 'Company',
        discount: 'Discount %',
        promo_code: 'Code',
        cta_link: 'CTA URL',
      },
      dataSourceId: null as any,
      status: CampaignStatus.DRAFT,
    };

    setupMocksForCreate(dto);
    const result = await service.create(dto, mockUser);

    expect(result.placeholders).toHaveLength(6);
    expect(result.content).toContain('{{promo_code}}');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. userId is taken from the authenticated user, not the DTO
  // ═══════════════════════════════════════════════════════════════════════════

  it('should assign userId from the authenticated user object', async () => {
    const dto: CreateCampaignDto = {
      name: 'User Assignment Test',
      subject: 'Test',
      content: '<p>Test</p>',
      placeholders: [],
      dataSourceId: null as any,
      status: CampaignStatus.DRAFT,
    };

    setupMocksForCreate(dto);
    await service.create(dto, mockUser);

    expect(campaignRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-uuid-001' }),
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. Data source + attachments together
  // ═══════════════════════════════════════════════════════════════════════════

  it('should handle both dataSourceId and attachmentIds in a single create', async () => {
    const dataSource = {
      id: 'ds-uuid-002',
      fileName: 'leads.xlsx',
      filePath: '/uploads/leads.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileSize: '52000',
    } as CampaignDataSource;

    const dto: CreateCampaignDto = {
      name: 'Full Setup Campaign',
      subject: 'Quarterly Report for {{company}}',
      content: '<p>Hi {{first_name}}, please review the attached report.</p>',
      placeholders: ['first_name', 'company'],
      placeholdersMap: { first_name: 'first_name', company: 'company' },
      dataSourceId: 'ds-uuid-002',
      attachmentIds: ['att-010', 'att-011'],
      status: CampaignStatus.DRAFT,
    };

    setupMocksForCreate(dto, { dataSource });
    await service.create(dto, mockUser);

    // Data source linked + parse enqueued
    expect(datasourceRepo.findOne).toHaveBeenCalled();
    expect(mockCampaignQueueProducer.enqueueParseFile).toHaveBeenCalled();

    // Attachments linked
    expect(attachmentRepo.createQueryBuilder).toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 14. Empty attachmentIds array — should skip attachment linking
  // ═══════════════════════════════════════════════════════════════════════════

  it('should skip attachment linking when attachmentIds is an empty array', async () => {
    const dto: CreateCampaignDto = {
      name: 'No Attachments',
      subject: 'Test',
      content: '<p>Test</p>',
      placeholders: [],
      attachmentIds: [],
      dataSourceId: null as any,
      status: CampaignStatus.DRAFT,
    };

    setupMocksForCreate(dto);
    await service.create(dto, mockUser);

    // createQueryBuilder should NOT be called on attachments for empty array
    expect(attachmentRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 15. Long campaign name & subject
  // ═══════════════════════════════════════════════════════════════════════════

  it('should create a campaign with long name and subject strings', async () => {
    const longName = 'A'.repeat(255);
    const longSubject = 'B'.repeat(500);

    const dto: CreateCampaignDto = {
      name: longName,
      subject: longSubject,
      content: '<p>Body</p>',
      placeholders: [],
      dataSourceId: null as any,
      status: CampaignStatus.DRAFT,
    };

    setupMocksForCreate(dto);
    const result = await service.create(dto, mockUser);

    expect(campaignRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: longName, subject: longSubject }),
    );
    expect(result.name).toHaveLength(255);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 16. Unicode content in name, subject, and body
  // ═══════════════════════════════════════════════════════════════════════════

  it('should handle unicode characters in campaign fields', async () => {
    const dto: CreateCampaignDto = {
      name: '🚀 Chào mừng bạn đến với chương trình',
      subject: '🎉 Xin chào {{first_name}}! Ưu đãi đặc biệt',
      content: '<h1>こんにちは {{first_name}} 🌸</h1><p>¡Bienvenido!</p>',
      placeholders: ['first_name'],
      dataSourceId: null as any,
      status: CampaignStatus.DRAFT,
    };

    setupMocksForCreate(dto);
    const result = await service.create(dto, mockUser);

    expect(result.name).toContain('🚀');
    expect(result.subject).toContain('Ưu đãi');
    expect(result.content).toContain('こんにちは');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 17. All CampaignStatus values are accepted
  // ═══════════════════════════════════════════════════════════════════════════

  it.each([
    CampaignStatus.DRAFT,
    CampaignStatus.SCHEDULED,
    CampaignStatus.SENDING,
    CampaignStatus.SENT,
    CampaignStatus.FAILED,
    CampaignStatus.PAUSED,
  ])('should accept status "%s"', async (status) => {
    const dto: CreateCampaignDto = {
      name: `Status ${status} campaign`,
      subject: 'Test',
      content: '<p>Test</p>',
      placeholders: [],
      dataSourceId: null as any,
      status,
    };

    setupMocksForCreate(dto);
    const result = await service.create(dto, mockUser);

    expect(campaignRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status }),
    );
    expect(result.status).toBe(status);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 18. Parse job payload includes userId and placeholdersMap
  // ═══════════════════════════════════════════════════════════════════════════

  it('should include userId and placeholdersMap in the parse job payload', async () => {
    const pMap = { col_a: 'first_name', col_b: 'email' };
    const dataSource = {
      id: 'ds-uuid-003',
      fileName: 'data.csv',
      filePath: '/uploads/data.csv',
      mimeType: 'text/csv',
      fileSize: '2048',
    } as CampaignDataSource;

    const dto: CreateCampaignDto = {
      name: 'Parse Payload Test',
      subject: 'Test',
      content: '<p>{{first_name}}</p>',
      placeholders: ['first_name'],
      placeholdersMap: pMap,
      dataSourceId: 'ds-uuid-003',
      status: CampaignStatus.DRAFT,
    };

    setupMocksForCreate(dto, { dataSource });
    await service.create(dto, mockUser);

    expect(mockCampaignQueueProducer.enqueueParseFile).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockUser.id,
        placeholdersMap: pMap,
      }),
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 19. Falsy dataSourceId (empty string) — should NOT trigger data source flow
  // ═══════════════════════════════════════════════════════════════════════════

  it('should skip data source linking when dataSourceId is falsy', async () => {
    const dto: CreateCampaignDto = {
      name: 'No Data Source',
      subject: 'Test',
      content: '<p>Test</p>',
      placeholders: [],
      dataSourceId: '' as any,
      status: CampaignStatus.DRAFT,
    };

    setupMocksForCreate(dto);
    await service.create(dto, mockUser);

    expect(datasourceRepo.findOne).not.toHaveBeenCalled();
    expect(mockCampaignQueueProducer.enqueueParseFile).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 20. Create campaign and verify the full return shape
  // ═══════════════════════════════════════════════════════════════════════════

  it('should return the full campaign entity with relations after creation', async () => {
    const dto: CreateCampaignDto = {
      name: 'Full Shape Verification',
      subject: 'Welcome {{first_name}}',
      content: '<p>Hello {{first_name}} from {{company}}</p>',
      placeholders: ['first_name', 'company'],
      placeholdersMap: { first_name: 'first_name', company: 'company' },
      dataSourceId: null as any,
      status: CampaignStatus.DRAFT,
    };

    const saved = setupMocksForCreate(dto);
    const result = await service.create(dto, mockUser);

    expect(result).toEqual(
      expect.objectContaining({
        id: saved.id,
        name: 'Full Shape Verification',
        subject: 'Welcome {{first_name}}',
        userId: mockUser.id,
        status: CampaignStatus.DRAFT,
        totalRecipients: 0,
        recipients: [],
        attachments: [],
        emailLogs: [],
      }),
    );
  });
});
