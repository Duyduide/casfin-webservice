import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BankTx {
  referenceId: string;
  // dương = tiền vào, âm = tiền ra (VND)
  amount: number;
  transactionDateTime: string;
  description: string;
  runningBalance: number | null;
  counterAccountName: string | null;
  counterAccountBankName: string | null;
  accountNumber: string;
}

export interface BankSyncResult {
  fiService: {
    code: string;
    name: string;
    logo: string;
    maxHistoryDays: number;
  };
  bankAccounts: Array<{
    accountNumber: string;
    accountName: string;
    balance: number;
    currency: string;
  }>;
  transactions: BankTx[];
}

interface GrantTokenResponse {
  grantToken: string;
}

interface ExchangeResponse {
  accessToken: string;
}

interface TransactionsApiResponse {
  requestId: string;
  accounts: Array<{
    accountNumber: string;
    accountName: string;
    balance: number;
    currency: string;
  }>;
  transactions: Array<{
    reference: string;
    transactionDateTime: string;
    amount: number;
    description: string;
    runningBalance: number | null;
    accountNumber: string;
    counterAccountName: string | null;
    counterAccountBankName: string | null;
    [key: string]: unknown;
  }>;
  fiService: {
    id: string;
    code: string;
    name: string;
    logo: string;
    maxHistoryDays: number;
    [key: string]: unknown;
  };
}

@Injectable()
export class BankhubService {
  private readonly logger = new Logger(BankhubService.name);
  private readonly baseUrl: string;
  private readonly linkBaseUrl: string;
  private readonly clientId: string;
  private readonly secretKey: string;
  private readonly apiVersion = '2023-01-01';

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('BANKHUB_BASE_URL');
    this.linkBaseUrl = config.getOrThrow<string>('BANKHUB_LINK_URL');
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
    const grantToken = data.grantToken;
    const linkUrl = `${this.linkBaseUrl}?grantToken=${grantToken}&redirectUri=${encodeURIComponent(redirectUri)}`;
    this.logger.log('Grant token created');
    return { grantToken, linkUrl };
  }

  async exchangePublicToken(publicToken: string): Promise<{ accessToken: string }> {
    const data = await this.post<ExchangeResponse>('/grant/exchange', { publicToken });
    return { accessToken: data.accessToken };
  }

  private toDateParam(d: Date): string {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD — BankHub expects this format
  }

  async fetchTransactions(accessToken: string, fromDate?: Date, toDate?: Date): Promise<BankSyncResult> {
    const params: Record<string, string> = {};
    if (fromDate) params['fromDate'] = this.toDateParam(fromDate);
    if (toDate) params['toDate'] = this.toDateParam(toDate);
    const data = await this.get<TransactionsApiResponse>('/transactions', accessToken, params);

    if (!data.fiService || !data.transactions) {
      const errMsg = (data as unknown as Record<string, unknown>).message as string | undefined;
      throw new InternalServerErrorException(
        `BankHub /transactions error: ${errMsg ?? 'Unexpected response format'}`,
      );
    }

    return {
      fiService: {
        code: data.fiService.code,
        name: data.fiService.name,
        logo: data.fiService.logo,
        maxHistoryDays: data.fiService.maxHistoryDays,
      },
      bankAccounts: data.accounts.map((a) => ({
        accountNumber: a.accountNumber,
        accountName: a.accountName,
        balance: a.balance,
        currency: a.currency,
      })),
      transactions: data.transactions.map((t) => ({
        referenceId: t.reference,
        amount: t.amount,
        transactionDateTime: t.transactionDateTime,
        description: t.description,
        runningBalance: t.runningBalance,
        counterAccountName: t.counterAccountName,
        counterAccountBankName: t.counterAccountBankName,
        accountNumber: t.accountNumber,
      })),
    };
  }
}
