export interface EmailTemplateData {
  candidateName: string;
  jobTitle: string;
  companyName?: string;
  details?: Record<string, string>;
  strengths?: string[];
  requirements?: string[];
}

/**
 * Ensures Western numerals (0-9) are used. 
 * Converts Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩) to Western (0123456789).
 */
const normalizeNumbers = (str: string): string => {
  return str.replace(/[٠-٩]/g, (d) => (d.charCodeAt(0) - 1632).toString());
};

export const generateBilingualEmail = (
  type: 'rejection' | 'interview' | 'offer',
  data: EmailTemplateData,
) => {
  const { candidateName, jobTitle, details, strengths, requirements, companyName } = data;
  const brandName = companyName || 'SILA Recruitment';

  const styles = `
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
    .header { background: #6366f1; padding: 30px; text-align: center; color: white; }
    .header h1 { margin: 0; font-size: 24px; letter-spacing: 1px; }
    .content { padding: 40px; }
    .section { margin-bottom: 30px; }
    .en { direction: ltr; text-align: left; margin-bottom: 20px; }
    .ar { direction: rtl; text-align: right; font-family: 'Arial', sans-serif; border-top: 1px solid #f1f5f9; pt: 20px; margin-top: 20px; padding-top: 20px; }
    .details-box { background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-inline-start: 4px solid #6366f1; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
    .highlight { color: #6366f1; font-weight: 600; }
  `;

  let contentEn = '';
  let contentAr = '';
  let subject = '';

  switch (type) {
    case 'rejection':
      subject = `Update regarding your application for ${jobTitle} | تحديث بخصوص طلب التوظيف الخاص بك`;
      contentEn = `
        <p>Dear <span class="highlight">${candidateName}</span>,</p>
        <p>Thank you for your interest in the <span class="highlight">${jobTitle}</span> position at ${brandName}. We were impressed with your background, particularly your ${strengths?.slice(0, 2).join(' and ')}.</p>
        <p>After careful review, we have decided to move forward with other candidates who more closely align with our current requirements, specifically ${requirements?.slice(0, 2).join(' and ')}.</p>
        <p>We appreciate your time and wish you the best in your career.</p>
      `;
      contentAr = `
        <p>عزيزي/عزيزتي <span class="highlight">${candidateName}</span>،</p>
        <p>نشكرك على اهتمامك بالتقديم لوظيفة <span class="highlight">${jobTitle}</span> لدى ${brandName}. لقد أعجبنا بخلفيتك المهنية، وبالأخص خبرتك في ${strengths?.slice(0, 2).join(' و ')}.</p>
        <p>بعد مراجعة دقيقة، قررنا المضي قدماً مع مرشحين آخرين تتوافق مهاراتهم بشكل أكبر مع متطلباتنا الحالية، وتحديداً في ${requirements?.slice(0, 2).join(' و ')}.</p>
        <p>نقدر وقتك ونتمنى لك كل التوفيق في مسيرتك المهنية.</p>
      `;
      break;

    case 'interview':
      subject = `Interview Invitation: ${jobTitle} - ${brandName}`;
      
      const dateEn = details?.dateEn || 'To be confirmed';
      const dateAr = normalizeNumbers(details?.dateAr || 'سيتم تأكيده');
      const locEn = details?.locationEn || 'Online';
      const locAr = details?.locationAr || 'عبر الإنترنت';
      const typeEn = details?.typeEn || 'Interview';
      const typeAr = details?.typeAr || 'مقابلة وظيفية';
      
      const durationEn = details?.durationEn ? `<p><b>Duration:</b> ${details.durationEn}</p>` : '';
      const durationAr = details?.durationAr ? `<p><b>المدة المتوقعة:</b> ${normalizeNumbers(details.durationAr)}</p>` : '';
      
      const interviewersEn = details?.interviewersEn ? `<p><b>Interviewers:</b> ${details.interviewersEn}</p>` : '';
      const interviewersAr = details?.interviewersAr ? `<p><b>المقابلون:</b> ${details.interviewersAr}</p>` : '';

      const contactEn = details?.reschedulingContact ? `<p><b>Rescheduling Contact:</b> ${details.reschedulingContact}</p>` : '';
      const contactAr = details?.reschedulingContact ? `<p><b>لإعادة الجدولة:</b> ${details.reschedulingContact}</p>` : '';

      const notesEn = details?.notesEn ? `<div style="margin-top:15px; font-style:italic; color:#64748b;">Note: ${details.notesEn}</div>` : '';
      const notesAr = details?.notesAr ? `<div style="margin-top:15px; font-style:italic; color:#64748b;">ملاحظة: ${normalizeNumbers(details.notesAr)}</div>` : '';

      const link = details?.link
        ? `<p><b>Meeting Link:</b> <a href="${details.link}">${details.link}</a></p>`
        : '';
      const linkAr = details?.link
        ? `<p><b>رابط الاجتماع:</b> <a href="${details.link}">${details.link}</a></p>`
        : '';

      contentEn = `
        <p>Dear <span class="highlight">${candidateName}</span>,</p>
        <p>We are excited to invite you for a <b>${typeEn}</b> for the <span class="highlight">${jobTitle}</span> position at ${brandName}. Your profile stood out based on our initial analysis.</p>
        <div class="details-box">
          <p><b>Date & Time:</b> ${dateEn}</p>
          <p><b>Location/Mode:</b> ${locEn}</p>
          ${durationEn}
          ${interviewersEn}
          ${link}
          ${contactEn}
        </div>
        ${notesEn}
        <p style="margin-top: 20px;">We look forward to speaking with you!</p>
      `;
      contentAr = `
        <p>عزيزي/عزيزتي <span class="highlight">${candidateName}</span>،</p>
        <p>يسعدنا دعوتك لإجراء <b>${typeAr}</b> لمنصب <span class="highlight">${jobTitle}</span> لدى ${brandName}. لقد لفت ملفك الشخصي انتباهنا بناءً على تحليلنا الأولي.</p>
        <div class="details-box">
          <p><b>التاريخ والوقت:</b> ${dateAr}</p>
          <p><b>الموقع/طريقة المقابلة:</b> ${locAr}</p>
          ${durationAr}
          ${interviewersAr}
          ${linkAr}
          ${contactAr}
        </div>
        ${notesAr}
        <p style="margin-top: 20px;">نتطلع للتحدث معك قريباً!</p>
      `;
      break;

    case 'offer':
      subject = `Job Offer: ${jobTitle} | عرض وظيفي - ${brandName}`;
      const salary = normalizeNumbers(details?.salary || 'Discussed in offer');
      const start = normalizeNumbers(details?.start_date || 'To be confirmed');

      contentEn = `
        <p>Dear <span class="highlight">${candidateName}</span>,</p>
        <p>Congratulations! We are thrilled to offer you the position of <span class="highlight">${jobTitle}</span> at ${brandName}. Our team was highly impressed with your qualifications and performance.</p>
        <div class="details-box">
          <p><b>Proposed Salary:</b> ${salary}</p>
          <p><b>Target Start Date:</b> ${start}</p>
        </div>
        <p>Welcome to the team!</p>
      `;
      contentAr = `
        <p>عزيزي/عزيزتي <span class="highlight">${candidateName}</span>،</p>
        <p>تهانينا! يسعدنا أن نقدم لك عرضاً وظيفياً لمنصب <span class="highlight">${jobTitle}</span> لدى ${brandName}. لقد أعجب فريقنا بشدة بمؤهلاتك وأدائك.</p>
        <div class="details-box">
          <p><b>الراتب المقترح:</b> ${salary}</p>
          <p><b>تاريخ البدء المتوقع:</b> ${start}</p>
        </div>
        <p>أهلاً بك في الفريق!</p>
      `;
      break;
  }

  return {
    subject,
    html: `
      <html>
        <head>
          <style>${styles}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${brandName}</h1>
            </div>
            <div class="content">
              <div class="en">${contentEn}</div>
              <div class="ar">${contentAr}</div>
            </div>
            <div class="footer">
              Sent by ${brandName} via SILA AI Recruitment Intelligence<br>
              ${brandName} - نظام ذكاء التوظيف
            </div>
          </div>
        </body>
      </html>
    `,
  };
};
