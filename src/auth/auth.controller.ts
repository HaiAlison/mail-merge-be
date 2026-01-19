import { Controller, Get, Req, Res, UseGuards, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Get('google')
    @UseGuards(GoogleAuthGuard)
    async googleAuth(@Req() req) { }

    @Get('google/callback')
    @UseGuards(GoogleAuthGuard)
    googleAuthRedirect(@Req() req, @Res() res) {
        console.log(req.user);
        res.redirect('http://localhost:3003/auth/callback?accessToken=' + req.user.accessToken + '&refreshToken=' + req.user.refreshToken);
    }

    @Post('refresh')
    async refresh(@Body('refreshToken') refreshToken: string) {
        return this.authService.refreshGoogleToken(refreshToken);
    }
}
