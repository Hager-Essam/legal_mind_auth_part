import { Request, Response } from "express";
import { runQuery, mongoConnect } from "./conversation.service";
import { queryRequestSchema } from "./conversation.types";
import { conversationService } from "./conversation.service";

// ════════════════════════════════════════════════════════════════
// Conversation Controller - Legal Q&A + CRUD
// ════════════════════════════════════════════════════════════════

/**
 * @desc    إرسال سؤال قانوني والحصول على إجابة
 * @route   POST /api/conversation/ask
 */
export const askQuestion = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id;
    const body = req.body;

    const parsed = queryRequestSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "البيانات المدخلة غير صحيحة",
        errors: parsed.error.issues.map((e: any) => ({ field: e.path.join("."), message: e.message })),
      });
      return;
    }

    const request = parsed.data;
    let conversationId = body.conversationId as string | undefined;

    await mongoConnect();

    // Case 1: conversationId provided → use existing conversation
    // Case 2 & 3: no conversationId → create a new conversation
    if (!conversationId) {
      const autoTitle = request.query.length > 50 ? request.query.substring(0, 50) + "..." : request.query;
      const conversation = await conversationService.createConversation(userId, autoTitle);
      conversationId = (conversation as any)._id.toString();
    }

    // conversationId is guaranteed to be a string here
    const convId = conversationId as string;

    // Save user question
    await conversationService.addMessage(convId, userId, {
      role: "user",
      content: request.query,
    });

    // Run the RAG pipeline
    const response = await runQuery(request);

    // Save assistant answer
    await conversationService.addMessage(convId, userId, {
      role: "assistant",
      content: response.answer,
      category: response.category,
      source_chunks: response.source_chunks,
      latency_ms: response.latency_ms,
      confidence_score: response.confidence_score,
    });

    res.status(200).json({
      success: true,
      message: "تمت معالجة السؤال بنجاح",
      data: {
        conversationId: convId,
        ...response,
      },
    });
  } catch (error: any) {
    console.error("Conversation ask error:", error.message);
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء معالجة السؤال",
      error: error.message,
    });
  }
};

/**
 * @desc    إنشاء محادثة جديدة
 * @route   POST /api/conversation
 */
export const createConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id;
    const { title } = req.body;

    const conversation = await conversationService.createConversation(userId, title);

    res.status(201).json({
      success: true,
      message: "تم إنشاء المحادثة بنجاح",
      data: conversation,
    });
  } catch (error: any) {
    console.error("Create conversation error:", error.message);
    res.status(500).json({ success: false, message: "حدث خطأ أثناء إنشاء المحادثة", error: error.message });
  }
};

/**
 * @desc    جلب جميع المحادثات
 * @route   GET /api/conversation
 */
export const getAllConversations = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id;
    const conversations = await conversationService.getAllConversations(userId);

    res.status(200).json({
      success: true,
      message: "تم جلب المحادثات بنجاح",
      data: conversations,
    });
  } catch (error: any) {
    console.error("Get conversations error:", error.message);
    res.status(500).json({ success: false, message: "حدث خطأ أثناء جلب المحادثات", error: error.message });
  }
};

/**
 * @desc    جلب محادثة محددة مع رسائلها
 * @route   GET /api/conversation/:conversationId
 */
export const getConversationById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id;
    const conversationId = req.params.conversationId as string;

    const conversation = await conversationService.getConversationById(conversationId, userId);
    if (!conversation) {
      res.status(404).json({ success: false, message: "المحادثة غير موجودة" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "تم جلب المحادثة بنجاح",
      data: conversation,
    });
  } catch (error: any) {
    console.error("Get conversation error:", error.message);
    res.status(500).json({ success: false, message: "حدث خطأ أثناء جلب المحادثة", error: error.message });
  }
};

/**
 * @desc    إعادة تسمية المحادثة
 * @route   PATCH /api/conversation/:conversationId
 */
export const renameConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id;
    const conversationId = req.params.conversationId as string;
    const { title } = req.body;

    if (!title || !title.trim()) {
      res.status(400).json({ success: false, message: "العنوان مطلوب" });
      return;
    }

    const conversation = await conversationService.renameConversation(conversationId, userId, title.trim());
    if (!conversation) {
      res.status(404).json({ success: false, message: "المحادثة غير موجودة" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "تم إعادة تسمية المحادثة بنجاح",
      data: conversation,
    });
  } catch (error: any) {
    console.error("Rename conversation error:", error.message);
    res.status(500).json({ success: false, message: "حدث خطأ أثناء إعادة تسمية المحادثة", error: error.message });
  }
};

/**
 * @desc    حذف المحادثة
 * @route   DELETE /api/conversation/:conversationId
 */
export const deleteConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id;
    const conversationId = req.params.conversationId as string;

    const conversation = await conversationService.deleteConversation(conversationId, userId);
    if (!conversation) {
      res.status(404).json({ success: false, message: "المحادثة غير موجودة" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "تم حذف المحادثة بنجاح",
      data: { _id: conversation._id },
    });
  } catch (error: any) {
    console.error("Delete conversation error:", error.message);
    res.status(500).json({ success: false, message: "حدث خطأ أثناء حذف المحادثة", error: error.message });
  }
};

/**
 * @desc    فحص صحة الخدمة
 * @route   GET /api/conversation/health
 */
export const healthCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    await mongoConnect();
    res.status(200).json({
      success: true,
      message: "خدمة المحادثة تعمل بشكل طبيعي",
      data: {
        status: "healthy",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    res.status(503).json({
      success: false,
      message: "خدمة المحادثة غير متاحة",
      error: error.message,
    });
  }
};
