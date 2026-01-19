export class CreateCampaignDto {
    name: string;
    subject: string;
    content: string;
    placeholders?: string[]; // Optional, can be extracted from content or passed explicitly
    scheduledAt?: Date;
    userId: string; // Should be extracted from JWT/request, but needed for entity creation
}
