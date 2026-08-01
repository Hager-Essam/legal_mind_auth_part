import type { ParsedLegalReference } from "./legal-ref-parser";
import type { ChunkDocument } from "../../models/chunk.model";

export class LegalRefService {
  buildExactMatchAnswer(doc: ChunkDocument): string {
    const lawName = doc.law_name ?? "مرجع غير محدد";
    const articleNumber = doc.article_number ?? "غير معروف";
    const content = (doc.text ?? "").trim();
    return `تم العثور على المادة المطلوبة.\n\n[المصدر: ${lawName} - المادة ${articleNumber}]\n\n${content}`;
  }

  buildRulingAnswer(doc: ChunkDocument): string 
  {
    const appealNumber = doc.appeal_number ?? "غير معروف";
    const judicialYear = doc.judicial_year ?? "غير معروف";
    const date = doc.ruling_date ?? "";
    const subject = doc.case_subject ?? "";
    const datePart = date ? ` - بتاريخ ${date}` : "";
    const subjectPart = subject ? `\nالموضوع: ${subject}` : "";
    const content = ((doc.text as string) ?? "").trim();
    return `تم العثور على حكم النقض المطلوب.${subjectPart}\n\n[حكم النقض - الطعن رقم ${appealNumber} لسنة ${judicialYear}${datePart}]\n\n${content}`;
  }

  buildMissingArticleNumberAnswer(): string {
    return "تعذر تحديد رقم المادة من السؤال. اذكر رقم المادة واسم القانون بصيغة أوضح.";
  }

  buildNoExactMatchAnswer(ref: ParsedLegalReference): string {
    const target = ref.articleNumber && ref.lawName
      ? `المادة ${ref.articleNumber} من ${ref.lawName}`
      : ref.articleNumber
        ? `المادة ${ref.articleNumber}`
        : "المرجع القانوني المطلوب";
    return `لم يتم العثور على تطابق مباشر لـ ${target}. سيتم البحث في قاعدة البيانات للعثور على أقرب نص قانوني ذي صلة.`;
  }

  buildNoRulingMatchAnswer(ref: ParsedLegalReference): string {
    const appealPart = ref.appealNumber ?? "غير محدد";
    const label = ref.judicialYear
      ? `الطعن رقم ${appealPart} لسنة ${ref.judicialYear}`
      : `الطعن رقم ${appealPart}`;
    return `لم يتم العثور على ${label} في قاعدة البيانات. سيتم البحث عن أقرب حكم ذي صلة.`;
  }
}
