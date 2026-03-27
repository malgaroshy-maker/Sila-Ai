import {
  Controller,
  Get,
  Param,
  Res,
  Headers,
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
    @Headers('x-user-email') userEmail: string,
    @Res() res: express.Response,
  ) {
    if (!userEmail) throw new NotFoundException('User email header missing');

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
    @Headers('x-user-email') userEmail: string,
    @Res() res: express.Response,
  ) {
    if (!userEmail) throw new NotFoundException('User email header missing');

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
