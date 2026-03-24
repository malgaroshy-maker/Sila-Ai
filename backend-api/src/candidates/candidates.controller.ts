import { Controller, Post, Patch, UseInterceptors, UploadedFile, Body, BadRequestException, Headers, UnauthorizedException, Param } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CandidatesService } from './candidates.service';

@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  private requireEmail(email: string) {
    if (!email) throw new UnauthorizedException('x-user-email header is required');
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCV(
    @Headers('x-user-email') userEmail: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('jobId') jobId: string,
    @Body('name') name: string,
    @Body('email') email: string
  ) {
    this.requireEmail(userEmail);
    if (!file) throw new BadRequestException('CV file is missing');
    if (!jobId || !name) throw new BadRequestException('jobId and candidate name are required');

    return this.candidatesService.processCandidate(userEmail, jobId, name, email || '', file);
  }

  @Post('upload-auto')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCVAuto(
    @Headers('x-user-email') userEmail: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    this.requireEmail(userEmail);
    if (!file) throw new BadRequestException('CV file is missing');
    return this.candidatesService.autoProcessCandidate(userEmail, file);
  }

  @Patch('applications/:id/stage')
  async updateStage(
    @Headers('x-user-email') userEmail: string,
    @Param('id') applicationId: string,
    @Body('stage') stage: string
  ) {
    this.requireEmail(userEmail);
    if (!stage) throw new BadRequestException('Stage is required');
    return this.candidatesService.updateApplicationStage(userEmail, applicationId, stage);
  }
}
