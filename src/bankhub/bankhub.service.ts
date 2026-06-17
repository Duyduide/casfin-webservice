import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BankTx {
  referenceId: string;
  // dương = tiền vào, âm = tiền ra (VND)
  amount: number;
  date: string;
  description: string;
}

interface GrantTokenResponse {
  data: { grantToken: string };
}

interface ExchangeResponse {
  data: { accessToken: string };
}

interface BankhubTransaction {
  id: string;
  amount: number;
  when: string;
  description: string;
  [key: string]: unknown;
}

interface TransactionsResponse {
  data: BankhubTransaction[];
}

@Injectable()
export class BankhubService {
  private readonly logger = new Logger(BankhubService.name);
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly secretKey: string;
  private readonly apiVersion = '2023-01-01';

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('BANKHUB_BASE_URL');
    this.clientId = config.getOrThrow<string>('CASSO_TRANSACTION_CLIENT_ID');
    this.secretKey = config.getOrThrow<string>('CASSO_TRANSACTION_SECRET_KEY');
  }

  private get commonHeaders(): Record<string, string> {
    return {
      'X-BankHub-Api-Version': this.apiVersion,
      'x-client-id': this.clientId,
      'x-secret-key': this.secretKey,
      'Content-Type': 'application/json',
    };
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.commonHeaders,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new InternalServerErrorException(`BankHub ${path} failed: ${res.status} ${text}`);
    }
    return res.json() as Promise<T>;
  }

  private async get<T>(path: string, accessToken: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    const res = await fetch(url.toString(), {
      headers: { ...this.commonHeaders, Authorization: accessToken },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new InternalServerErrorException(`BankHub ${path} failed: ${res.status} ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async createGrantToken(redirectUri: string): Promise<{ grantToken: string; linkUrl: string }> {
    const data = await this.post<GrantTokenResponse>('/grant/token', {
      scopes: 'transaction',
      language: 'vi',
      redirectUri,
    });
    const grantToken = data.data.grantToken;
    const linkUrl = `${this.baseUrl}/link?token=${grantToken}`;
    this.logger.log('Grant token created');
    return { grantToken, linkUrl };
  }

  async exchangePublicToken(publicToken: string): Promise<{ accessToken: string }> {
    const data = await this.post<ExchangeResponse>('/grant/exchange', { publicToken });
    return { accessToken: data.data.accessToken };
  }

  async fetchTransactions(accessToken: string, fromDate?: Date): Promise<BankTx[]> {
    const params: Record<string, string> = {};
    if (fromDate) {
      params['fromDate'] = fromDate.toISOString();
    }
    const data = await this.get<TransactionsResponse>('/transactions', accessToken, params);
    return data.data.map((t) => ({
      referenceId: t.id,
      amount: t.amount,
      date: t.when,
      description: t.description,
    }));
  }
}
