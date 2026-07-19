import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { UnsubscribeService } from './unsubscribe.service';

/**
 * Public endpoint — NO JWT auth required.
 * Supports both:
 *   1. GET  /unsubscribe?token=xxx  — browser one-click link
 *   2. POST /unsubscribe            — RFC 8058 machine one-click (Gmail)
 */
@Controller('unsubscribe')
export class UnsubscribeController {
  constructor(private readonly unsubscribeService: UnsubscribeService) {}

  /**
   * GET /unsubscribe?token=xxx
   * User clicks from email → verify token → record unsubscribe → show HTML page.
   */
  @Get()
  async unsubscribeGet(
    @Query('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { email } = await this.unsubscribeService.unsubscribe(token);
      res.status(HttpStatus.OK).send(buildSuccessHtml(email));
    } catch {
      res.status(HttpStatus.BAD_REQUEST).send(buildErrorHtml());
    }
  }

  /**
   * POST /unsubscribe
   * RFC 8058 One-Click — called by Gmail automatically when user clicks
   * the "Unsubscribe" button in Gmail UI.
   * Body (application/x-www-form-urlencoded): List-Unsubscribe=One-Click
   * Token is passed via query param: POST /unsubscribe?token=xxx
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async unsubscribePost(@Query('token') token: string): Promise<{ ok: boolean }> {
    await this.unsubscribeService.unsubscribe(token);
    return { ok: true };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple HTML responses — replace with redirect to FE if preferred
// ─────────────────────────────────────────────────────────────────────────────

function buildSuccessHtml(email: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Unsubscribed</title>
  <style>
    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f9fafb; }
    .card { background: #fff; border-radius: 12px; padding: 40px 48px; box-shadow: 0 2px 16px rgba(0,0,0,.08); text-align: center; max-width: 440px; }
    h1 { color: #111; font-size: 1.5rem; margin-bottom: 12px; }
    p  { color: #555; line-height: 1.6; }
    .email { font-weight: 600; color: #333; }
  </style>
</head>
<body>
  <div class="card">
    <h1>✅ Unsubscribed successfully</h1>
    <p>The address <span class="email">${email}</span> has been removed from this mailing list.<br/>You will no longer receive emails from this sender.</p>
  </div>
</body>
</html>`;
}

function buildErrorHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invalid link</title>
  <style>
    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f9fafb; }
    .card { background: #fff; border-radius: 12px; padding: 40px 48px; box-shadow: 0 2px 16px rgba(0,0,0,.08); text-align: center; max-width: 440px; }
    h1 { color: #b91c1c; font-size: 1.5rem; margin-bottom: 12px; }
    p  { color: #555; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>❌ Invalid unsubscribe link</h1>
    <p>This link is invalid or has been tampered with. Please contact the sender directly.</p>
  </div>
</body>
</html>`;
}
