import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
  private readonly genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  constructor(private readonly prisma: PrismaService) {}

  // Gợi ý category cho transaction dựa trên mô tả và số tiền
  // Gửi danh sách category của user làm context để Gemini chọn đúng id
  async suggestCategory(userId: string, description: string, amount: number) {
    const categories = await this.prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, type: true },
    });

    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
Bạn là trợ lý phân loại giao dịch tài chính.

Danh sách danh mục của người dùng (JSON):
${JSON.stringify(categories)}

Giao dịch cần phân loại:
- Mô tả: "${description}"
- Số tiền: ${amount} VND

Hãy chọn 1 danh mục phù hợp nhất từ danh sách trên.
Trả về JSON duy nhất theo format: {"categoryId": "<id>", "categoryName": "<name>"}
Không giải thích thêm.
`.trim();

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    try {
      return JSON.parse(text);
    } catch {
      return { categoryId: null, categoryName: null };
    }
  }
}
