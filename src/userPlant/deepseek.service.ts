import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

type DeepSeekMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  error?: {
    message?: string
  }
}

@Injectable()
export class DeepSeekService {
  constructor(private readonly configService: ConfigService) {}

  private getConfig() {
    const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY')

    if (!apiKey) {
      throw new InternalServerErrorException(
        'DeepSeek API key is not configured'
      )
    }

    return {
      apiKey,
      model:
        this.configService.get<string>('DEEPSEEK_MODEL') ?? 'deepseek-v4-flash',
      apiUrl:
        this.configService.get<string>('DEEPSEEK_API_URL') ??
        'https://api.deepseek.com/chat/completions'
    }
  }

  private parseJson<T>(content: string): T {
    try {
      return JSON.parse(content) as T
    } catch {
      const start = content.indexOf('{')
      const end = content.lastIndexOf('}')

      if (start === -1 || end === -1 || end <= start) {
        throw new BadGatewayException('AI returned invalid JSON')
      }

      return JSON.parse(content.slice(start, end + 1)) as T
    }
  }

  async generateJson<T>({
    messages,
    maxTokens = 2500,
    temperature = 0.2
  }: {
    messages: DeepSeekMessage[]
    maxTokens?: number
    temperature?: number
  }) {
    const { apiKey, apiUrl, model } = this.getConfig()

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        response_format: {
          type: 'json_object'
        }
      })
    })

    const payload = (await response
      .json()
      .catch(() => null)) as DeepSeekResponse | null

    if (!response.ok) {
      throw new BadGatewayException(
        payload?.error?.message ?? 'DeepSeek request failed'
      )
    }

    const content = payload?.choices?.[0]?.message?.content

    if (!content) throw new BadGatewayException('AI returned an empty response')

    return this.parseJson<T>(content)
  }
}
