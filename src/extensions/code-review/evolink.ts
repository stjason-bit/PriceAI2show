export interface EvolinkMessageInput {
  system: string;
  user: string;
  maxTokens: number;
}

export interface EvolinkMessageResult {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<{
  ok: boolean;
  status?: number;
  json(): Promise<any>;
  text?(): Promise<string>;
}>;

export class EvolinkCodeReviewProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchFn: FetchLike;

  constructor({
    apiKey,
    baseUrl,
    model,
    fetchFn = fetch,
  }: {
    apiKey: string;
    baseUrl: string;
    model: string;
    fetchFn?: FetchLike;
  }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.model = model;
    this.fetchFn = fetchFn;
  }

  async createMessage({
    system,
    user,
    maxTokens,
  }: EvolinkMessageInput): Promise<EvolinkMessageResult> {
    if (!this.apiKey) {
      throw new Error('evolink_api_key_missing');
    }

    const response = await this.fetchFn(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        temperature: 0.1,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    if (!response.ok) {
      const body = response.text ? await response.text() : '';
      throw new Error(`evolink_request_failed:${response.status || ''}:${body}`);
    }

    const data = await response.json();
    const textBlock = data.content?.find((block: any) => block.type === 'text');

    return {
      text: textBlock?.text || '',
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
      },
    };
  }
}
