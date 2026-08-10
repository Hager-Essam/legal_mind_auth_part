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
  res: Response
): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'لم يتم رفع أي ملف. يُرجى إرسال ملف بمفتاح "file".',
      });
      return;
    }

    const userId = req.user!.id;
    const jobId = uuidv4();

    const contractKey = r2Storage.generateKey(jobId, req.file.originalname, "contracts");
    const contractUrl = await r2Storage.uploadFile(req.file.path, contractKey, req.file.mimetype);

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

export const startAnalysis = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = req.user!.id;

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
        processing: "العقد قيد التحليل حالياً. يُرجى الانتظار حتى اكتمال التحليل.",
        completed: "تم تحليل هذا العقد بالفعل. يمكنك الاطلاع على النتائج.",
        failed: "فشل التحليل سابقاً. يُرجى رفع العقد مجدداً.",
      };
      res.status(409).json({
        success: false,
        message: statusMessages[job.status] || "حالة العقد غير صالحة للبدء في التحليل.",
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

export const getJobStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = req.user!.id;

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
      const analysis = await resultsAnalysisRepository.findById(job.analysisId.toString());

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
      const lastEvent = job.progressLogs.filter((e) => e.step !== "done" && e.step !== "error").pop();

      if (lastEvent) {
        response.currentStage = STAGE_NAMES[lastEvent.step] || "جاري المعالجة...";
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

export const getAllJobs = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
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

export const streamJobProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = req.user!.id;

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

        if (updatedJob.status === "completed" || updatedJob.status === "failed") {
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

export const getJobProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = req.user!.id;

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

export const cancelJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = req.user!.id;

    const job = await jobRepository.findByIdAndUserId(jobId, userId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: "لم يتم العثور على العقد.",
      });
      return;
    }

    if (job.status !== "queued" && job.status !== "processing") {
      res.status(400).json({
        success: false,
        message: `لا يمكن إلغاء العقد في الحالة الحالية (${job.status}).`,
      });
      return;
    }

    await jobRepository.updateStatus(job.id, "cancelled", {
      completedAt: new Date(),
    });

    await jobRepository.addProgressLog(job.id, {
      step: "cancelled",
      phase: "done",
      message: "⛔ تم إلغاء التحليل من قبل المستخدم.",
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: "تم إلغاء التحليل بنجاح.",
      data: { jobId, status: "cancelled" },
    });
  } catch (error: any) {
    console.error("خطأ في إلغاء العقد:", error);
    res.status(500).json({
      success: false,
      message: "فشل في إلغاء العقد.",
      error: error.message,
    });
  }
};

export const deleteJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = req.user!.id;

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

export const downloadReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = getJobId(req);
    const userId = req.user!.id;

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

    const analysis = await resultsAnalysisRepository.findById(job.analysisId.toString());

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
      :root {
        --lm-brand: #003ec7;
        --lm-brand-deep: #0038b6;
        --lm-navy: #0b1326;
        --lm-ink: #152033;
        --lm-muted: #5c6b82;
        --lm-accent: #d69e2e;
        --lm-soft: #adc7f7;
        --lm-surface: #f0f4ff;
        --lm-paper: #ffffff;
        --lm-rule: #d8e0ef;
        --lm-rule-strong: #c3cde3;
      }

      @page {
        size: A4;
        margin: 18mm 16mm 18mm 16mm;
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
        color: var(--lm-ink);
        background: var(--lm-paper);
        font-family: "IBM Plex Sans Arabic", Tahoma, "Segoe UI", Arial, sans-serif;
        font-size: 12.5px;
        line-height: 1.85;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      /* Do NOT pad .page heavily — padding does not repeat on new pages */
      .page {
        max-width: 100%;
        position: relative;
      }

      /* ── Header ── */
      .report-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 0 0 14px;
        margin-bottom: 0;
        border-bottom: 2px solid var(--lm-brand);
      }

      .brand-block {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }

      .brand-logo {
        width: 44px;
        height: 44px;
        flex-shrink: 0;
      }

      .brand-logo svg {
        width: 44px;
        height: 44px;
        display: block;
      }

      .brand-text {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }

      .brand-name {
        font-size: 17px;
        font-weight: 700;
        color: var(--lm-navy);
        letter-spacing: -0.02em;
        line-height: 1.2;
      }

      .brand-name span {
        color: var(--lm-brand);
        margin-right: 5px;
      }

      .brand-tagline {
        font-size: 10px;
        color: var(--lm-muted);
        font-weight: 600;
        letter-spacing: 0.01em;
      }

      .report-meta {
        text-align: left;
        direction: ltr;
        font-size: 9.5px;
        color: var(--lm-muted);
        line-height: 1.55;
        flex-shrink: 0;
        padding: 6px 10px;
        border: 1px solid var(--lm-rule);
        border-radius: 8px;
        background: var(--lm-surface);
      }

      .report-meta strong {
        display: block;
        color: var(--lm-brand);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin-bottom: 2px;
      }

      /* Thin brand rule — institutional, print-safe */
      .accent-bar {
        height: 3px;
        margin: 0 0 22px;
        background: linear-gradient(
          90deg,
          var(--lm-accent) 0%,
          var(--lm-brand) 42%,
          var(--lm-soft) 100%
        );
      }

      /* ── Body ── */
      .report-body {
        color: var(--lm-ink);
        text-align: justify;
      }

      .report-body > :first-child {
        margin-top: 0;
      }

      .report-body h1 {
        font-size: 20px;
        font-weight: 700;
        color: var(--lm-navy);
        margin: 0 0 14px;
        padding-bottom: 8px;
        line-height: 1.35;
        border-bottom: 1px solid var(--lm-rule);
        text-align: right;
      }

      .report-body h2 {
        font-size: 15px;
        font-weight: 700;
        color: var(--lm-brand);
        margin: 22px 0 10px;
        padding: 0 0 6px 0;
        line-height: 1.4;
        border-bottom: 1px solid var(--lm-rule);
        background: transparent;
        text-align: right;
        page-break-after: avoid;
      }

      .report-body h3 {
        font-size: 13.5px;
        font-weight: 700;
        color: var(--lm-navy);
        margin: 16px 0 8px;
        line-height: 1.45;
        page-break-after: avoid;
      }

      .report-body h4,
      .report-body h5,
      .report-body h6 {
        font-size: 12.5px;
        font-weight: 700;
        color: #24304a;
        margin: 14px 0 6px;
        page-break-after: avoid;
      }

      .report-body p {
        margin: 0 0 10px;
      }

      .report-body ul,
      .report-body ol {
        margin: 0 0 12px;
        padding-right: 1.35rem;
        padding-left: 0;
      }

      .report-body li {
        margin-bottom: 4px;
      }

      .report-body li + li {
        margin-top: 2px;
      }

      .report-body strong {
        color: var(--lm-navy);
        font-weight: 700;
      }

      .report-body a {
        color: var(--lm-brand);
        text-decoration: underline;
        text-underline-offset: 2px;
      }

      .report-body hr {
        border: 0;
        border-top: 1px solid var(--lm-rule);
        margin: 18px 0;
      }

      .report-body blockquote {
        margin: 12px 0;
        padding: 10px 14px;
        border-right: 3px solid var(--lm-accent);
        border-left: 0;
        background: rgba(0, 62, 199, 0.04);
        color: var(--lm-muted);
        border-radius: 0 8px 8px 0;
      }

      .report-body pre {
        background: #f4f7fc;
        border: 1px solid var(--lm-rule);
        border-radius: 8px;
        padding: 12px;
        overflow-x: auto;
        direction: ltr;
        text-align: left;
        font-size: 11px;
        line-height: 1.55;
      }

      .report-body code {
        background: var(--lm-surface);
        color: var(--lm-brand);
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

      .report-body mark {
        background: rgba(214, 158, 46, 0.28);
        border-radius: 3px;
        padding: 0 0.15em;
      }

      .report-body table {
        width: 100%;
        border-collapse: collapse;
        margin: 14px 0 18px;
        font-size: 11.5px;
        page-break-inside: avoid;
      }

      .report-body th,
      .report-body td {
        border: 1px solid var(--lm-rule);
        padding: 8px 10px;
        text-align: right;
        vertical-align: top;
      }

      .report-body th {
        background: rgba(0, 62, 199, 0.07);
        color: var(--lm-brand);
        font-weight: 700;
      }

      .report-body tr:nth-child(even) td {
        background: #f7f9ff;
      }

      /* Keep headings with following content when possible */
      .report-body h1,
      .report-body h2,
      .report-body h3,
      .report-body h4 {
        break-after: avoid;
      }

      .report-body p,
      .report-body li {
        orphans: 3;
        widows: 3;
      }

      /* ── Footer ── */
      .report-footer {
        margin-top: 28px;
        padding-top: 12px;
        border-top: 1.5px solid var(--lm-rule-strong);
        font-size: 9.5px;
        color: var(--lm-muted);
        line-height: 1.65;
        page-break-inside: avoid;
      }

      .report-footer .footer-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .report-footer .footer-brand {
        color: var(--lm-brand);
        font-weight: 700;
      }

      .report-footer .footer-en {
        direction: ltr;
        text-align: left;
        font-size: 9px;
        color: var(--lm-muted);
        opacity: 0.9;
      }

      .report-footer .disclaimer {
        margin-top: 8px;
        padding: 9px 11px;
        background: var(--lm-surface);
        border: 1px solid var(--lm-rule);
        border-right: 3px solid var(--lm-brand);
        border-radius: 6px;
        color: #434656;
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
              تقرير تحليل عقد • محرك التدقيق المعرفي
            </div>
          </div>
        </div>
        <div class="report-meta">
          <strong>LegalMind Report</strong>
          Confidential · Auto-generated
        </div>
      </header>

      <div class="accent-bar" aria-hidden="true"></div>

      <main class="report-body">${htmlContent}</main>

      <footer class="report-footer">
        <div class="footer-row">
          <div>
            إعداد آلي بواسطة
            <span class="footer-brand">ليجال مايند AI</span>
            — لا يُغني عن مراجعة محامٍ مختص.
          </div>
          <div class="footer-en">legalmind.ai</div>
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
    res.setHeader("Content-Disposition", `attachment; filename="${reportName}"`);
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
