import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';
import { JobsService } from '../jobs/jobs.service';
import * as puppeteer from 'puppeteer';

@Injectable()
export class ReportsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jobsService: JobsService,
  ) {}

  async generateJobReportPdf(userEmail: string, jobId: string): Promise<Buffer> {
    const job = await this.jobsService.getJob(userEmail, jobId);
    if (!job) throw new NotFoundException('Job not found');

    const sb = this.supabaseService.getClient();
    const { data: results, error } = await sb
      .from('analysis_results')
      .select('*, applications!inner(job_id, candidate_id, candidates(name, email), jobs!inner(user_email))')
      .eq('applications.job_id', jobId)
      .eq('applications.jobs.user_email', userEmail)
      .order('final_score', { ascending: false });

    if (error) throw new Error(`Failed to fetch analysis: ${error.message}`);

    const html = this.buildHtmlTemplate(job, results || []);
    
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    });

    await browser.close();
    return Buffer.from(pdf);
  }

  private buildHtmlTemplate(job: any, results: any[]) {
    const isArabic = true; // Defaulting to Arabic for this project as requested
    const direction = isArabic ? 'rtl' : 'ltr';

    const rows = results.map((res, index) => {
      const candidate = res.applications.candidates;
      const scoreColor = res.final_score >= 80 ? '#22C55E' : res.final_score >= 60 ? '#EAB308' : '#EF4444';
      
      return `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${candidate.name}</strong><br/><small>${candidate.email}</small></td>
          <td style="color: ${scoreColor}; font-weight: bold;">${res.final_score}%</td>
          <td>${res.recommendation}</td>
          <td>
            <ul style="margin: 0; padding-right: 20px;">
              ${res.strengths.slice(0, 3).map((s: string) => `<li>${s}</li>`).join('')}
            </ul>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html dir="${direction}" lang="${isArabic ? 'ar' : 'en'}">
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
          body { font-family: 'Tajawal', sans-serif; padding: 40px; color: #1E293B; line-height: 1.6; }
          .header { border-bottom: 2px solid #0369A1; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { color: #0369A1; margin: 0; font-size: 24px; }
          .header p { margin: 5px 0 0; color: #64748B; }
          .summary { background: #F8FAFC; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #E2E8F0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #0369A1; color: white; text-align: ${isArabic ? 'right' : 'left'}; padding: 12px; font-size: 14px; }
          td { padding: 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; vertical-align: top; }
          tr:nth-child(even) { background: #F1F5F9; }
          .badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>تقرير تحليل المرشحين - ${job.title}</h1>
          <p>تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}</p>
        </div>

        <div class="summary">
          <strong>عن الوظيفة:</strong>
          <p>${job.description}</p>
          <strong>المتطلبات الأساسية:</strong>
          <p>${job.requirements.join(' • ')}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>المرشح</th>
              <th>الدرجة النهائية</th>
              <th>التوصية</th>
              <th>أبرز نقاط القوة</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div style="margin-top: 40px; font-size: 12px; color: #94A3B8; text-align: center;">
          تم إنشاء هذا التقرير تلقائياً بواسطة نظام الذكاء الاصطناعي للتوظيف
        </div>
      </body>
      </html>
    `;
  }
}
