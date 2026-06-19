import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
  private readonly genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  constructor(private readonly prisma: PrismaService) {}

  async batchSuggestCategories(
    userId: string,
    transactions: { id: string; note: string; amount: number; type: 'income' | 'expense' }[],
  ): Promise<{ transactionId: string; categoryId: string | null }[]> {
    const categories = await this.prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, type: true },
    });

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const txList = transactions.map((tx) => ({
      id: tx.id,
      note: tx.note,
      amount: tx.amount,
      type: tx.type === 'income' ? 'Thu nhập' : 'Chi tiêu',
    }));

    const prompt = `
Bạn là trợ lý phân loại giao dịch tài chính cá nhân.

Danh sách danh mục hợp lệ (JSON):
${JSON.stringify(categories)}

Phân loại TẤT CẢ các giao dịch sau. Với mỗi giao dịch, chọn 1 danh mục phù hợp nhất từ danh sách trên. Nếu không rõ, chọn danh mục "Giao dịch khác".

Giao dịch cần phân loại:
${JSON.stringify(txList)}

Trả về JSON array (giữ nguyên thứ tự, 1 phần tử cho mỗi giao dịch):
[{"transactionId": "<id>", "categoryId": "<categoryId>"}]
`.trim();

    try {
      const result = await model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text().trim());
      if (!Array.isArray(parsed)) {
        return transactions.map((tx) => ({ transactionId: tx.id, categoryId: null }));
      }
      return parsed;
    } catch {
      return transactions.map((tx) => ({ transactionId: tx.id, categoryId: null }));
    }
  }

  async suggestCategory(
    userId: string,
    description: string,
    amount: number,
    type?: 'income' | 'expense',
  ) {
    const categories = await this.prisma.category.findMany({
      where: { userId, ...(type ? { type } : {}) },
      select: { id: true, name: true, type: true },
    });

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `
Bạn là trợ lý phân loại giao dịch tài chính cá nhân.

Danh sách danh mục hợp lệ (JSON):
${JSON.stringify(categories)}

Giao dịch cần phân loại:
- Ghi chú: "${description}"
- Số tiền: ${amount} VND${type ? `\n- Loại: ${type === 'income' ? 'Thu nhập' : 'Chi tiêu'}` : ''}

Chọn 1 danh mục phù hợp nhất từ danh sách trên. Nếu không rõ, chọn danh mục "Giao dịch khác".
Trả về JSON: {"categoryId": "<id>", "categoryName": "<name>"}
`.trim();

    try {
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text().trim());
    } catch {
      return { categoryId: null, categoryName: null };
    }
  }
}
