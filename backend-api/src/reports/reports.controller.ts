import {
  Controller,
  Get,
  Param,
  Res,
  Headers,
  Query,
  NotFoundException,
} from '@nestjs/common';
import * as express from 'express';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('job/:id/pdf')
  async downloadJobReport(
    @Param('id') jobId: string,
    @Headers('x-user-email') userEmailHeader: string,
    @Query('email') userEmailQuery: string,
    @Res() res: express.Response,
  ) {
    const userEmail = userEmailHeader || userEmailQuery;
    if (!userEmail) throw new NotFoundException('User email missing');

    try {
      const pdfBuffer = await this.reportsService.generateJobReportPdf(
        userEmail,
        jobId,
      );

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=job-report-${jobId}.pdf`,
        'Content-Length': pdfBuffer.length,
      });

      res.end(pdfBuffer);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  @Get('application/:id/pdf')
  async downloadCandidateReport(
    @Param('id') applicationId: string,
    @Headers('x-user-email') userEmailHeader: string,
    @Query('email') userEmailQuery: string,
    @Res() res: express.Response,
  ) {
    const userEmail = userEmailHeader || userEmailQuery;
    if (!userEmail) throw new NotFoundException('User email missing');

    try {
      const pdfBuffer = await this.reportsService.generateCandidateReportPdf(
        userEmail,
        applicationId,
      );

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=candidate-report-${applicationId}.pdf`,
        'Content-Length': pdfBuffer.length,
      });

      res.end(pdfBuffer);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}
