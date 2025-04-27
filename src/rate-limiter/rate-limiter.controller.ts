import {
  Controller,
  Post,
  Ip,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
  HttpException,
} from '@nestjs/common';
import { RateLimiterService } from './rate-limiter.service';
import { v4 as uuidv4 } from 'uuid';

@Controller('rate-limiter')
export class RateLimiterController {
  private readonly logger = new Logger(RateLimiterController.name);

  constructor(private readonly rateLimiterService: RateLimiterService) {}

  @Post('request')
  @HttpCode(HttpStatus.ACCEPTED)
  async handleHttpRequest(@Ip() ip: string) {
    this.logger.log(`Received HTTP request from IP: ${ip}`);

    let isLimited: boolean;
    try {
      isLimited = await this.rateLimiterService.isRateLimited(ip);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Rate limit check failed for IP ${ip}: ${errorMessage}`,
        errorStack,
      );
      throw new ServiceUnavailableException('Rate limiter service unavailable');
    }

    if (isLimited) {
      this.logger.warn(`Rate limit exceeded for IP: ${ip}`);
      throw new HttpException(
        'Rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const requestId = uuidv4();
    this.logger.log(`Request accepted for IP ${ip}, ID: ${requestId}`);
    return { message: 'Request accepted', requestId };
  }
}
