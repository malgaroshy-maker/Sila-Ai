import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { AiService } from '../ai/ai.service';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly aiService: AiService,
  ) {}

  private requireEmail(email: string) {
    if (!email)
      throw new UnauthorizedException('x-user-email header is required');
  }

  @Post()
  createJob(
    @Headers('x-user-email') email: string,
    @Body() body: { title: string; description: string; requirements: any },
  ) {
    this.requireEmail(email);
    return this.jobsService.createJob(
      email,
      body.title,
      body.description,
      body.requirements,
    );
  }

  @Post('generate')
  async generateJob(
    @Headers('x-user-email') email: string,
    @Body() body: { prompt: string },
  ) {
    this.requireEmail(email);
    const generated = await this.aiService.generateJobFromText(
      email,
      body.prompt,
    );
    // Create the job automatically
    return this.jobsService.createJob(
      email,
      generated.title,
      generated.description,
      generated.requirements,
    );
  }

  @Get()
  getJobs(@Headers('x-user-email') email: string) {
    this.requireEmail(email);
    return this.jobsService.getJobs(email);
  }

  @Get(':id')
  getJob(@Headers('x-user-email') email: string, @Param('id') id: string) {
    this.requireEmail(email);
    return this.jobsService.getJob(email, id);
  }

  @Put(':id')
  updateJob(
    @Headers('x-user-email') email: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    this.requireEmail(email);
    return this.jobsService.updateJob(email, id, body);
  }

  @Delete(':id')
  deleteJob(@Headers('x-user-email') email: string, @Param('id') id: string) {
    this.requireEmail(email);
    return this.jobsService.deleteJob(email, id);
  }
}
