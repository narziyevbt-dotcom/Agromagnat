import { HttpException, HttpStatus } from '@nestjs/common';

/** 429. NestJS ships no built-in for this status. */
export class TooManyRequestsException extends HttpException {
  constructor(message = "Juda ko'p urinish. Biroz kutib turing") {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}
