import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';
import { JobsService } from '../jobs/jobs.service';
import * as puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

@Injectable()
export class ReportsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jobsService: JobsService,
  ) {}

  async generateJobReportPdf(
    userEmail: string,
    jobId: string,
  ): Promise<string> {
    const job = await this.jobsService.getJob(userEmail, jobId);
    if (!job) throw new NotFoundException('Job not found');

    const sb = this.supabaseService.getClient();
    const { data: results, error } = await sb
      .from('analysis_results')
      .select(
        '*, applications!inner(job_id, candidate_id, candidates(name, email), jobs!inner(user_email))',
      )
      .eq('applications.job_id', jobId)
      .eq('applications.jobs.user_email', userEmail)
      .order('final_score', { ascending: false });

    if (error) throw new Error(`Failed to fetch analysis: ${error.message}`);

    const html = this.buildHtmlTemplate(job, results || []);

    const executablePath = await chromium.executablePath();
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: executablePath || process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    });

    await browser.close();
    
    const fileName = `job-reports/${jobId}-${Date.now()}.pdf`;
    const { error: uploadError } = await sb.storage
      .from('reports')
      .upload(fileName, pdf, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) throw new Error(`Failed to upload report: ${uploadError.message}`);

    const { data: { publicUrl } } = sb.storage.from('reports').getPublicUrl(fileName);
    return publicUrl;
  }

  async generateCandidateReportPdf(
    userEmail: string,
    applicationId: string,
  ): Promise<string> {
    const sb = this.supabaseService.getClient();
    const { data: res, error } = await sb
      .from('analysis_results')
      .select(
        '*, applications!inner(job_id, candidate_id, candidates(name, email), jobs!inner(title, description, requirements, user_email))',
      )
      .eq('application_id', applicationId)
      .eq('applications.jobs.user_email', userEmail)
      .maybeSingle();

    if (error || !res)
      throw new NotFoundException('Analysis result not found or access denied');

    const html = this.buildCandidateHtmlTemplate(res);

    const executablePath = await chromium.executablePath();
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: executablePath || process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    });

    await browser.close();

    const fileName = `candidate-reports/${applicationId}-${Date.now()}.pdf`;
    const { error: uploadError } = await sb.storage
      .from('reports')
      .upload(fileName, pdf, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) throw new Error(`Failed to upload report: ${uploadError.message}`);

    const { data: { publicUrl } } = sb.storage.from('reports').getPublicUrl(fileName);
    return publicUrl;
  }

  private buildCandidateHtmlTemplate(res: any) {
    const isArabic = true;
    const direction = isArabic ? 'rtl' : 'ltr';
    const candidate = res.applications.candidates;
    const job = res.applications.jobs;

    return `
      <!DOCTYPE html>
      <html dir="${direction}" lang="${isArabic ? 'ar' : 'en'}">
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
          body { font-family: 'Tajawal', sans-serif; padding: 40px; color: #1E293B; line-height: 1.6; }
          .header { border-bottom: 2px solid #6366F1; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { color: #6366F1; margin: 0; font-size: 24px; }
          .score-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
          .score-card { background: #F8FAFC; padding: 15px; border-radius: 8px; border: 1px solid #E2E8F0; text-align: center; }
          .score-value { font-size: 24px; font-weight: bold; color: #6366F1; }
          .section { margin-bottom: 30px; }
          .section-title { font-weight: bold; font-size: 18px; color: #475569; margin-bottom: 10px; border-bottom: 1px solid #CBD5E1; }
          ul { padding-right: 20px; }
          .tag { display: inline-block; background: #E0E7FF; color: #4338CA; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin: 2px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>تقرير تقييم المرشح: ${candidate.name}</h1>
          <p>الوظيفة المستهدفة: ${job.title}</p>
        </div>

        <div class="score-grid">
          <div class="score-card">
            <div>الدرجة النهائية</div>
            <div class="score-value">${res.final_score}%</div>
          </div>
          <div class="score-card">
            <div>الملاءمة الثقافية</div>
            <div class="score-value">${res.cultural_fit_score}%</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">التوصية</div>
          <p>${res.recommendation}</p>
        </div>

        <div class="section">
          <div class="section-title">نقاط القوة</div>
          <ul>${res.strengths.map((s: string) => `<li>${s}</li>`).join('')}</ul>
        </div>

        <div class="section">
          <div class="section-title">نقاط الضعف</div>
          <ul>${res.weaknesses.map((w: string) => `<li>${w}</li>`).join('')}</ul>
        </div>

        <div class="section">
          <div class="section-title">المهارات والكلمات المفتاحية</div>
          <div>${res.tags.map((t: string) => `<span class="tag">${t}</span>`).join('')}</div>
        </div>

        <div style="margin-top: 40px; font-size: 12px; color: #94A3B8; text-align: center;">
          تم إنشاء هذا التقرير التفصيلي بواسطة نظام SILA للذكاء الاصطناعي
        </div>
      </body>
      </html>
    `;
  }

  private buildHtmlTemplate(job: any, results: any[]) {
    const isArabic = true; // Defaulting to Arabic for this project as requested
    const direction = isArabic ? 'rtl' : 'ltr';

    const rows = results
      .map((res, index) => {
        const candidate = res.applications.candidates;
        const scoreColor =
          res.final_score >= 80
            ? '#22C55E'
            : res.final_score >= 60
              ? '#EAB308'
              : '#EF4444';

        return `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${candidate.name}</strong><br/><small>${candidate.email}</small></td>
          <td style="color: ${scoreColor}; font-weight: bold;">${res.final_score}%</td>
          <td>${res.recommendation}</td>
          <td>
            <ul style="margin: 0; padding-right: 20px;">
              ${res.strengths
                .slice(0, 3)
                .map((s: string) => `<li>${s}</li>`)
                .join('')}
            </ul>
          </td>
        </tr>
      `;
      })
      .join('');

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
