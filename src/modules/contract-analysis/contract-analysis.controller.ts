import { Response } from "express";
import type { Request } from "express-serve-static-core";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import MarkdownIt from "markdown-it";
import { generatePdf } from "html-pdf-node";
import { processJob } from "../contract-analysis/helpers/job-processor";
import { jobRepository } from "../contract-analysis/repositories/job.repository";
import { resultsAnalysisRepository } from "../contract-analysis/repositories/results-analysis.repository";
import { r2Storage } from "../../config/r2.config";
import { STAGE_NAMES } from "../contract-analysis/contract-analysis.types";

const getJobId = (req: Request): string => req.params.jobId as string;

export const healthCheck = (_req: Request, res: Response): void => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
};

export const uploadContract = async (
  req: Request & { file?: Express.Multer.File },
  res: Response,
): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'لم يتم رفع أي ملف. يُرجى إرسال ملف بمفتاح "file".',
      });
      return;
    }

    const userId = (req as any).user._id.toString();
    const jobId = uuidv4();

    const contractKey = r2Storage.generateKey(
      jobId,
      req.file.originalname,
      "contracts",
    );
    const contractUrl = await r2Storage.uploadFile(
      req.file.path,
      contractKey,
      req.file.mimetype,
    );

    const job = await jobRepository.create({
      id: jobId,
      status: "queued",
      userId,
      originalFileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      contractFileUrl: contractUrl,
      createdAt: new Date(),
      progressLogs: [],
    });

    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(201).json({
      success: true,
      message: "تم رفع العقد بنجاح! يمكنك الآن بدء التحليل عند الجاهزية.",
      data: {
        jobId: job.id,
        status: job.status,
        fileName: job.originalFileName,
        fileSize: job.fileSize,
        fileType: job.fileType,
        createdAt: job.createdAt,
      },
    });
  } catch (error: any) {
    console.error("خطأ في رفع العقد:", error);
    res.status(500).json({
      success: false,
      message: "فشل في رفع العقد. يُرجى المحاولة مرة أخرى.",
      error: error.message,
    });
  }
};

export const startAnalysis = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = (req as any).user._id.toString();

    const job = await jobRepository.findByIdAndUserId(jobId, userId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: "لم يتم العثور على العقد. يُرجى التأكد من معرّف العقد.",
      });
      return;
    }

    if (job.status !== "queued") {
      const statusMessages: Record<string, string> = {
        processing:
          "العقد قيد التحليل حالياً. يُرجى الانتظار حتى اكتمال التحليل.",
        completed: "تم تحليل هذا العقد بالفعل. يمكنك الاطلاع على النتائج.",
        failed: "فشل التحليل سابقاً. يُرجى رفع العقد مجدداً.",
      };
      res.status(409).json({
        success: false,
        message:
          statusMessages[job.status] ||
          "حالة العقد غير صالحة للبدء في التحليل.",
      });
      return;
    }

    processJob(job).catch((err: unknown) => {
      console.error(`فشل تحليل العقد ${job.id}:`, err);
    });

    res.status(202).json({
      success: true,
      message: "تم بدء تحليل العقد بنجاح! يمكنك متابعة التقدم عبر معرّف العقد.",
      data: {
        jobId: job.id,
        status: "processing",
      },
    });
  } catch (error: any) {
    console.error("خطأ في بدء التحليل:", error);
    res.status(500).json({
      success: false,
      message: "فشل في بدء التحليل. يُرجى المحاولة مرة أخرى.",
      error: error.message,
    });
  }
};

export const getJobStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = (req as any).user._id.toString();

    const job = await jobRepository.findByIdAndUserId(jobId, userId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: "لم يتم العثور على العقد. يُرجى التأكد من معرّف العقد.",
      });
      return;
    }

    const response: Record<string, any> = {
      jobId: job.id,
      status: job.status,
      fileName: job.originalFileName,
      fileSize: job.fileSize,
      fileType: job.fileType,
      createdAt: job.createdAt,
    };

    if (job.status === "completed" && job.analysisId) {
      const analysis = await resultsAnalysisRepository.findById(
        job.analysisId.toString(),
      );

      if (analysis) {
        response.result = {
          overall: analysis.overall,
          clauses: analysis.clauses,
          report_markdown: analysis.reportMarkdown,
          processed_at: analysis.processedAt,
        };
      }

      response.completedAt = job.completedAt;
      response.files = {
        contract: job.contractFileUrl,
        report: job.reportFileUrl,
      };
    }

    if (job.status === "processing") {
      const lastEvent = job.progressLogs
        .filter((e) => e.step !== "done" && e.step !== "error")
        .pop();

      if (lastEvent) {
        response.currentStage =
          STAGE_NAMES[lastEvent.step] || "جاري المعالجة...";
        response.currentStep = lastEvent.step;
        response.totalSteps = "7/7";
        const stepNum = parseInt(lastEvent.step.split("/")[0], 10);
        response.progress = Math.round((stepNum / 7) * 100);
      }
    }

    if (job.status === "failed" && job.error) {
      response.error = job.error;
      response.completedAt = job.completedAt;
    }

    res.json({
      success: true,
      message: "تم جلب بيانات العقد بنجاح.",
      data: response,
    });
  } catch (error: any) {
    console.error("خطأ في جلب حالة العقد:", error);
    res.status(500).json({
      success: false,
      message: "فشل في جلب بيانات العقد. يُرجى المحاولة مرة أخرى.",
      error: error.message,
    });
  }
};

export const getAllJobs = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as any).user._id.toString();
    const jobs = await jobRepository.findAll({
      userId,
      limit: 100,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    const allJobs = jobs.map((job) => ({
      jobId: job.id,
      status: job.status,
      fileName: job.originalFileName,
      fileSize: job.fileSize,
      fileType: job.fileType,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      contractUrl: job.contractFileUrl,
      reportUrl: job.reportFileUrl,
    }));

    res.json({
      success: true,
      message: `تم جلب ${allJobs.length} عقد بنجاح.`,
      data: allJobs,
    });
  } catch (error: any) {
    console.error("خطأ في جلب العقود:", error);
    res.status(500).json({
      success: false,
      message: "فشل في جلب قائمة العقود. يُرجى المحاولة مرة أخرى.",
      error: error.message,
    });
  }
};

export const streamJobProgress = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = (req as any).user._id.toString();

    const job = await jobRepository.findByIdAndUserId(jobId, userId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: "لم يتم العثور على العقد. يُرجى التأكد من معرّف العقد.",
      });
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    for (const event of job.progressLogs) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    if (job.status === "completed" || job.status === "failed") {
      res.end();
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const updatedJob = await jobRepository.findByIdAndUserId(jobId, userId);

        if (!updatedJob) {
          clearInterval(pollInterval);
          res.end();
          return;
        }

        const newLogs = updatedJob.progressLogs.slice(job.progressLogs.length);
        for (const event of newLogs) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }

        job.progressLogs = updatedJob.progressLogs;

        if (
          updatedJob.status === "completed" ||
          updatedJob.status === "failed"
        ) {
          clearInterval(pollInterval);
          res.end();
        }
      } catch (error) {
        console.error("خطأ في متابعة التقدم:", error);
        clearInterval(pollInterval);
        res.end();
      }
    }, 2000);

    req.on("close", () => {
      clearInterval(pollInterval);
      res.end();
    });
  } catch (error: any) {
    console.error("خطأ في متابعة تقدم العقد:", error);
    res.status(500).json({
      success: false,
      message: "فشل في متابعة تقدم العقد. يُرجى المحاولة مرة أخرى.",
      error: error.message,
    });
  }
};

export const getJobProgress = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = (req as any).user._id.toString();

    const job = await jobRepository.findByIdAndUserId(jobId, userId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: "لم يتم العثور على العقد. يُرجى التأكد من معرّف العقد.",
      });
      return;
    }

    const progressLogs = await jobRepository.getProgressLogs(jobId);

    res.json({
      success: true,
      message: `تم جلب سجل التقدم بنجاح (${progressLogs.length} سجل).`,
      data: {
        jobId,
        logs: progressLogs,
        totalLogs: progressLogs.length,
      },
    });
  } catch (error: any) {
    console.error("خطأ في جلب سجل التقدم:", error);
    res.status(500).json({
      success: false,
      message: "فشل في جلب سجل التقدم. يُرجى المحاولة مرة أخرى.",
      error: error.message,
    });
  }
};

export const deleteJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = (req as any).user._id.toString();

    const job = await jobRepository.findByIdAndUserId(jobId, userId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: "لم يتم العثور على العقد. يُرجى التأكد من معرّف العقد.",
      });
      return;
    }

    if (job.contractFileUrl) {
      try {
        const contractKey = job.contractFileUrl.split("/").slice(-3).join("/");
        await r2Storage.deleteFile(contractKey);
      } catch (error) {
        console.error("فشل في حذف العقد من التخزين السحابي:", error);
      }
    }

    if (job.reportFileUrl) {
      try {
        const reportKey = job.reportFileUrl.split("/").slice(-3).join("/");
        await r2Storage.deleteFile(reportKey);
      } catch (error) {
        console.error("فشل في حذف التقرير من التخزين السحابي:", error);
      }
    }

    if (job.analysisId) {
      await resultsAnalysisRepository.deleteById(job.analysisId.toString());
    }

    await jobRepository.delete(jobId);

    res.json({
      success: true,
      message: "تم حذف العقد وجميع البيانات المرتبطة بنجاح.",
      data: { jobId },
    });
  } catch (error: any) {
    console.error("خطأ في حذف العقد:", error);
    res.status(500).json({
      success: false,
      message: "فشل في حذف العقد. يُرجى المحاولة مرة أخرى.",
      error: error.message,
    });
  }
};

export const downloadReport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = (req as any).user._id.toString();

    const job = await jobRepository.findByIdAndUserId(jobId, userId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: "لم يتم العثور على العقد. يُرجى التأكد من معرّف العقد.",
      });
      return;
    }

    if (job.status !== "completed") {
      res.status(400).json({
        success: false,
        message: "العقد لم يتم تحليله بعد. يُرجى بدء التحليل أولاً.",
      });
      return;
    }

    if (!job.analysisId) {
      res.status(404).json({
        success: false,
        message: "لم يتم العثور على نتائج التحليل لهذا العقد.",
      });
      return;
    }

    const analysis = await resultsAnalysisRepository.findById(
      job.analysisId.toString(),
    );

    if (!analysis) {
      res.status(404).json({
        success: false,
        message: "لم يتم العثور على بيانات التحليل. يُرجى إعادة التحليل.",
      });
      return;
    }

    const reportName = `report_${job.originalFileName.replace(/\.[^/.]+$/, "")}.pdf`;

    // Convert markdown to HTML
    const md = new MarkdownIt();
    const htmlContent = md.render(analysis.reportMarkdown);

    // Wrap HTML with proper styling
    /*
  IMPORTANT (backend generatePdf options):
  Page margins for EVERY page must also be set here, otherwise chromium may ignore @page:

  const options = {
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20mm',
      right: '18mm',
      bottom: '20mm',
      left: '18mm',
    },
  };
*/
    const htmlPage = `
<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <style>
      /* Applies to page 1, 2, 3... — all four sides */
      @page {
        size: A4;
        margin: 20mm 18mm 20mm 18mm;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        direction: rtl;
        text-align: right;
        color: #191c1e;
        background: #ffffff;
        font-family: Tahoma, "Segoe UI", Arial, sans-serif;
        font-size: 12px;
        line-height: 1.75;
      }

      /* Content wrapper only — do NOT add large padding here
         (it won't repeat on new pages). Use @page + generatePdf margin. */
      .page {
        max-width: 100%;
      }

      /* ── Brand header ── */
      .report-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 0 0 16px;
        margin-bottom: 18px;
        border-bottom: 3px solid #003ec7;
      }

      .brand-block {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .brand-logo {
        width: 48px;
        height: 48px;
        flex-shrink: 0;
      }

      .brand-logo img,
      .brand-logo svg {
        width: 48px;
        height: 48px;
        display: block;
      }

      .brand-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .brand-name {
        font-size: 18px;
        font-weight: 700;
        color: #0b1326;
        letter-spacing: -0.02em;
        line-height: 1.2;
      }

      .brand-name span {
        color: #003ec7;
        margin-right: 4px;
      }

      .brand-tagline {
        font-size: 10px;
        color: #5a6478;
        font-weight: 600;
      }

      .report-meta {
        text-align: left;
        direction: ltr;
        font-size: 10px;
        color: #5a6478;
        line-height: 1.5;
      }

      .report-meta strong {
        display: block;
        color: #003ec7;
        font-size: 11px;
        margin-bottom: 2px;
      }

      /* ── Accent bar ── */
      .accent-bar {
        height: 4px;
        margin: -18px 0 22px;
        background: linear-gradient(
          90deg,
          #d69e2e 0%,
          #003ec7 55%,
          #adc7f7 100%
        );
        border-radius: 999px;
      }

      /* ── Content ── */
      .report-body {
        color: #191c1e;
      }

      .report-body h1 {
        font-size: 22px;
        color: #0b1326;
        margin: 0 0 14px;
        padding-bottom: 8px;
        border-bottom: 1px solid #d8e3f8;
      }

      .report-body h2 {
        font-size: 16px;
        color: #003ec7;
        margin: 22px 0 10px;
        padding: 6px 10px;
        background: #f0f4ff;
        border-right: 4px solid #003ec7;
        border-radius: 0 6px 6px 0;
      }

      .report-body h3 {
        font-size: 14px;
        color: #0b1326;
        margin: 18px 0 8px;
      }

      .report-body h4,
      .report-body h5,
      .report-body h6 {
        font-size: 12.5px;
        color: #24304a;
        margin: 14px 0 6px;
      }

      .report-body p {
        margin: 0 0 10px;
      }

      .report-body ul,
      .report-body ol {
        margin: 0 0 12px;
        padding-right: 22px;
        padding-left: 0;
      }

      .report-body li {
        margin-bottom: 4px;
      }

      .report-body strong {
        color: #0b1326;
      }

      .report-body a {
        color: #003ec7;
        text-decoration: none;
      }

      .report-body hr {
        border: 0;
        border-top: 1px solid #d8e3f8;
        margin: 18px 0;
      }

      .report-body blockquote {
        margin: 12px 0;
        padding: 10px 14px;
        border-right: 4px solid #d69e2e;
        border-left: 0;
        background: #fffaf0;
        color: #4a5568;
        border-radius: 0 6px 6px 0;
      }

      .report-body pre {
        background: #f4f7fc;
        border: 1px solid #d8e3f8;
        border-radius: 8px;
        padding: 12px;
        overflow-x: auto;
        direction: ltr;
        text-align: left;
        font-size: 11px;
      }

      .report-body code {
        background: #f0f4ff;
        color: #003ec7;
        padding: 1px 5px;
        border-radius: 4px;
        font-family: Consolas, "Courier New", monospace;
        font-size: 11px;
      }

      .report-body pre code {
        background: transparent;
        padding: 0;
        color: inherit;
      }

      .report-body table {
        width: 100%;
        border-collapse: collapse;
        margin: 14px 0 18px;
        font-size: 11px;
        overflow: hidden;
        border-radius: 8px;
      }

      .report-body th,
      .report-body td {
        border: 1px solid #d8e3f8;
        padding: 9px 11px;
        text-align: right;
        vertical-align: top;
      }

      .report-body th {
        background: #003ec7;
        color: #ffffff;
        font-weight: 700;
      }

      .report-body tr:nth-child(even) td {
        background: #f7f9ff;
      }

      /* ── Footer ── */
      .report-footer {
        margin-top: 32px;
        padding-top: 14px;
        border-top: 2px solid #e6ecf8;
        font-size: 9.5px;
        color: #5a6478;
        line-height: 1.6;
      }

      .report-footer .footer-brand {
        color: #003ec7;
        font-weight: 700;
      }

      .report-footer .disclaimer {
        margin-top: 6px;
        padding: 8px 10px;
        background: #f8faff;
        border: 1px solid #e6ecf8;
        border-radius: 6px;
      }
    </style>
  </head>
  <body>
  <div class="page">
    <header class="report-header">
      <div class="brand-block">
        <div class="brand-logo">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
            fill="none"
            aria-hidden="true"
          >
            <rect width="100" height="100" rx="22" fill="#0b1326" />
            <defs>
              <linearGradient
                id="lmGrad"
                x1="0"
                y1="0"
                x2="100"
                y2="100"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stop-color="#003ec7" />
                <stop offset="100%" stop-color="#adc7f7" />
              </linearGradient>
            </defs>
            <path
              d="M50 12 L85 24 C85 55 70 78 50 88 C30 78 15 55 15 24 Z"
              stroke="url(#lmGrad)"
              stroke-width="7"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <circle cx="50" cy="35" r="5.5" fill="#d69e2e" />
            <path
              d="M35 52 L65 52"
              stroke="#003ec7"
              stroke-width="5"
              stroke-linecap="round"
            />
            <path d="M50 35 L50 65" stroke="url(#lmGrad)" stroke-width="5" />
            <path
              d="M42 65 L58 65"
              stroke="#d69e2e"
              stroke-width="5.5"
              stroke-linecap="round"
            />
          </svg>
        </div>
        <div class="brand-text">
          <div class="brand-name">ليجال مايند<span>AI</span></div>
          <div class="brand-tagline">
            تقرير تحليل عقد العمل • محرك التدقيق المعرفي
          </div>
        </div>
      </div>
      <div class="report-meta">
        <strong>LegalMind Report</strong>
        Confidential • Generated automatically
      </div>
    </header>

    <div class="accent-bar"></div>

    <main class="report-body">${htmlContent}</main>

    <footer class="report-footer">
      <div>
        إعداد آلي بواسطة
        <span class="footer-brand">ليجال مايند AI</span>
        — لا يُغني عن مراجعة محامٍ مختص.
      </div>
      <div class="disclaimer">
        تنبيه قانوني: هذا التقرير ناتج عن نظام تحليل آلي، ويُقدَّم لأغراض
        استرشادية فقط. يُنصح بمراجعة النتائج من محامٍ متخصص قبل الاعتماد عليها
        في أي إجراء قانوني أو تعاقدي.
      </div>
    </footer>
  </div>
  </body>
</html>
`;

    // margin applies on EVERY PDF page (not just the first)
    const options = {
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        right: "18mm",
        bottom: "20mm",
        left: "18mm",
      },
    };
    const file = { content: htmlPage };
    const pdfBuffer = await generatePdf(file, options);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${reportName}"`,
    );
    res.status(200).send(pdfBuffer);
  } catch (error: any) {
    console.error("خطأ في تحميل التقرير:", error);
    res.status(500).json({
      success: false,
      message: "فشل في تحميل التقرير. يُرجى المحاولة مرة أخرى.",
      error: error.message,
    });
  }
};
