export interface AlertEmailData {
  candidateName: string;
  jobTitle: string;
  score: number;
  companyName: string;
  justification?: string;
  strengths?: string[];
  skillsScore?: number;
  culturalFitScore?: number;
  recommendation?: string;
  dashboardUrl?: string;
}

export const generateExceptionalCandidateEmail = (data: AlertEmailData) => {
  const {
    candidateName,
    jobTitle,
    score,
    companyName,
    justification,
    strengths,
    skillsScore,
    culturalFitScore,
    recommendation,
    dashboardUrl = 'https://sila-ai.vercel.app/dashboard',
  } = data;

  const emerald = '#10b981';
  const slate = '#0f172a';
  const slate600 = '#475569';
  const slate800 = '#1e293b';
  const silver = '#f8fafc';

  const strengthsListEn = (strengths || []).map(s => `<li>${s}</li>`).join('');
  const strengthsListAr = (strengths || []).map(s => `<li>${s}</li>`).join('');

  return {
    subject: `🚀 Exceptional Match: ${candidateName} for ${jobTitle}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exceptional Candidate Alert</title>
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 0; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #020617; padding: 40px 0; }
    .main { width: 100%; max-width: 600px; background-color: ${slate}; margin: 0 auto; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.05); overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
    .header { background: linear-gradient(135deg, ${slate} 0%, #1e1b4b 100%); padding: 40px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
    .badge { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); color: ${emerald}; padding: 6px 16px; border-radius: 9999px; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; margin-bottom: 20px; }
    .title { font-size: 28px; font-weight: 800; margin: 0; color: #ffffff; letter-spacing: -0.025em; }
    .subtitle { color: ${slate600}; margin: 8px 0 0 0; font-size: 16px; }
    .content { padding: 40px; }
    .card { background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 32px; margin-bottom: 24px; }
    .score-label { color: ${slate600}; font-size: 14px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; }
    .score-value { font-size: 48px; font-weight: 900; color: ${emerald}; margin: 4px 0; }
    .info-grid { display: block; width: 100%; border-collapse: collapse; }
    .info-cell { padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
    .info-cell:last-child { border-bottom: none; }
    .info-key { color: ${slate600}; font-size: 14px; }
    .info-val { color: #ffffff; font-size: 16px; font-weight: 600; padding-top: 4px; }
    .justification { background: rgba(16, 185, 129, 0.05); border-left: 4px solid ${emerald}; padding: 20px; border-radius: 8px; font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-top: 24px; }
    .btn { background: #ffffff; color: #020617; padding: 16px 32px; border-radius: 12px; font-weight: 700; text-decoration: none; display: inline-block; transition: all 0.2s; }
    .lang-section { border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 40px; margin-top: 40px; }
    .rtl { direction: rtl; text-align: right; font-family: 'Arial', sans-serif; }
    .footer { padding: 40px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05); }
    .footer-text { color: ${slate600}; font-size: 12px; line-height: 1.5; }
    @media only screen and (max-width: 600px) {
      .main { border-radius: 0; }
      .content { padding: 24px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main">
      <div class="header">
        <div class="badge">Exceptional Found</div>
        <h1 class="title">${companyName}</h1>
        <p class="subtitle">AI Recruitment Intelligence</p>
      </div>

      <div class="content">
        <!-- English Context -->
        <div class="card">
          <div class="score-label">Overall Match</div>
          <div class="score-value">${score}%</div>
          <table class="info-grid">
            <tr>
              <td class="info-cell">
                <div class="info-key">Candidate Name</div>
                <div class="info-val">${candidateName}</div>
              </td>
            </tr>
            <tr>
              <td class="info-cell">
                <div class="info-key">Applied Position</div>
                <div class="info-val">${jobTitle}</div>
              </td>
            </tr>
            <tr>
              <td class="info-cell">
                <div class="info-key">Skill Alignment</div>
                <div class="info-val" style="color: #38bdf8;">${skillsScore || 'N/A'}%</div>
              </td>
            </tr>
            <tr>
              <td class="info-cell">
                <div class="info-key">Cultural Fit</div>
                <div class="info-val" style="color: #a78bfa;">${culturalFitScore || 'N/A'}%</div>
              </td>
            </tr>
            <tr>
              <td class="info-cell">
                <div class="info-key">AI Recommendation</div>
                <div class="info-val" style="color: ${emerald};">${recommendation || 'Exceptional Match'}</div>
              </td>
            </tr>
          </table>

          ${justification ? `<div class="justification"><strong>AI Analysis:</strong><br>${justification}</div>` : ''}
          
          <div style="margin-top: 32px; text-align: center;">
            <a href="${dashboardUrl}" class="btn">View Full Profile</a>
          </div>
        </div>

        <!-- Arabic Context -->
        <div class="card lang-section rtl">
          <div class="score-label">مدى التطابق الكلي</div>
          <div class="score-value">${score}%</div>
          <table class="info-grid" dir="rtl">
            <tr>
              <td class="info-cell">
                <div class="info-key">اسم المرشح</div>
                <div class="info-val">${candidateName}</div>
              </td>
            </tr>
            <tr>
              <td class="info-cell">
                <div class="info-key">المنصب المقدم عليه</div>
                <div class="info-val">${jobTitle}</div>
              </td>
            </tr>
            <tr>
              <td class="info-cell">
                <div class="info-key">توافق المهارات</div>
                <div class="info-val" style="color: #38bdf8;">${skillsScore || 'N/A'}%</div>
              </td>
            </tr>
            <tr>
              <td class="info-cell">
                <div class="info-key">الملاءمة الثقافية</div>
                <div class="info-val" style="color: #a78bfa;">${culturalFitScore || 'N/A'}%</div>
              </td>
            </tr>
            <tr>
              <td class="info-cell">
                <div class="info-key">قرار الذكاء الاصطناعي</div>
                <div class="info-val" style="color: ${emerald};">${recommendation === 'Hire' ? 'توظيف' : recommendation === 'Consider' ? 'دراسة الطلب' : 'تطابق استثنائي'}</div>
              </td>
            </tr>
          </table>

          ${justification ? `<div class="justification"><strong>تحليل الذكاء الاصطناعي:</strong><br>${justification}</div>` : ''}
          
          <div style="margin-top: 32px; text-align: center;">
            <a href="${dashboardUrl}" class="btn">عرض الملف الشخصي</a>
          </div>
        </div>
      </div>

      <div class="footer">
        <p class="footer-text">
          Sent via <strong>SILA AI</strong> Intelligence Agent<br>
          This is an automated administrative alert. Candidate CV is attached for your review.
        </p>
        <p class="footer-text" style="direction: rtl;">
          تم الإرسال عبر <strong>SILA AI</strong> - وكيل الذكاء الاصطناعي للتوظيف<br>
          هذا تنبيه إداري تلقائي. السيرة الذاتية للمرشح مرفقة للمراجعة.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
    `,
  };
};
