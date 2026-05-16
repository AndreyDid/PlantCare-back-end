import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from 'src/prisma.service'
import { DeepSeekService } from './deepseek.service'
import { ExistingPlantAiDto, SuggestPlantCareDto } from './dto/plant-ai.dto'
import { WeatherService, WeatherSummary } from './weather.service'

type PlantAiSuggestion = {
  plantName: string | null
  latinName: string | null
  confidence: 'low' | 'medium' | 'high'
  summary: string | null
  suggestion: {
    plantName?: string | null
    lightLevel?: string | null
    temperatureMin?: number | null
    temperatureMax?: number | null
    humidityMin?: number | null
    humidityMax?: number | null
    potType?: string | null
    potSize?: string | null
    soilType?: string | null
    wateringIntervalDays?: number | null
    wateringIntervalSpringDays?: number | null
    wateringIntervalSummerDays?: number | null
    wateringIntervalAutumnDays?: number | null
    wateringIntervalWinterDays?: number | null
    wateringAmountMl?: number | null
    wateringNotes?: string | null
    fertilizingIntervalDays?: number | null
  }
  commonProblems: string[]
  warnings: string[]
}

type PlantCareAnalysis = {
  summary: string
  wateringStatus: 'underwatered' | 'overwatered' | 'balanced' | 'unknown'
  wateringReasoning: string
  weatherImpact: string | null
  recommendations: string[]
  risks: string[]
  nextActions: string[]
  suggestedAdjustments: PlantAiSuggestion['suggestion']
}

const suggestionJsonExample = {
  plantName: 'Monstera deliciosa',
  latinName: 'Monstera deliciosa',
  confidence: 'medium',
  summary: 'Short care profile in Russian.',
  suggestion: {
    plantName: 'Monstera deliciosa',
    lightLevel: 'bright indirect light',
    temperatureMin: 18,
    temperatureMax: 27,
    humidityMin: 50,
    humidityMax: 70,
    potType: 'pot with drainage holes',
    potSize: '12-17 cm for a young plant',
    soilType: 'loose aroid mix with bark and perlite',
    wateringIntervalDays: 8,
    wateringIntervalSpringDays: 7,
    wateringIntervalSummerDays: 5,
    wateringIntervalAutumnDays: 10,
    wateringIntervalWinterDays: 14,
    wateringAmountMl: 350,
    wateringNotes: 'Water after the top 3-5 cm of soil dry out.',
    fertilizingIntervalDays: 21
  },
  commonProblems: ['root rot from overwatering'],
  warnings: ['Values are approximate and must be adjusted to pot and light.']
}

function compactObject(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function getWeatherPrompt(weather: WeatherSummary | null) {
  if (!weather) {
    return 'Historical weather context: not provided or city was not resolved.'
  }

  return `Historical weather context for the last month:
${compactObject(weather)}`
}

function normalizeSuggestion(result: PlantAiSuggestion): PlantAiSuggestion {
  return {
    plantName: result.plantName ?? result.suggestion?.plantName ?? null,
    latinName: result.latinName ?? null,
    confidence: result.confidence ?? 'medium',
    summary: result.summary ?? null,
    suggestion: result.suggestion ?? {},
    commonProblems: Array.isArray(result.commonProblems)
      ? result.commonProblems
      : [],
    warnings: Array.isArray(result.warnings) ? result.warnings : []
  }
}

function normalizeAnalysis(result: PlantCareAnalysis): PlantCareAnalysis {
  const validStatuses: PlantCareAnalysis['wateringStatus'][] = [
    'underwatered',
    'overwatered',
    'balanced',
    'unknown'
  ]

  return {
    summary: result.summary ?? 'Недостаточно данных для краткого вывода.',
    wateringStatus: validStatuses.includes(result.wateringStatus)
      ? result.wateringStatus
      : 'unknown',
    wateringReasoning: result.wateringReasoning ?? '',
    weatherImpact: result.weatherImpact ?? null,
    recommendations: Array.isArray(result.recommendations)
      ? result.recommendations
      : [],
    risks: Array.isArray(result.risks) ? result.risks : [],
    nextActions: Array.isArray(result.nextActions) ? result.nextActions : [],
    suggestedAdjustments: result.suggestedAdjustments ?? {}
  }
}

@Injectable()
export class PlantAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deepSeekService: DeepSeekService,
    private readonly weatherService: WeatherService
  ) {}

  private getSuggestionSystemPrompt() {
    return `You are a careful indoor plant care assistant.
Return only valid json matching this example: ${compactObject(
      suggestionJsonExample
    )}.
Use Russian for human-readable strings.
Use numbers only for numeric fields.
Use null when you are not confident.
Do not mention medical certainty. This is home plant care guidance, not a diagnosis.
Prefer conservative watering guidance and explain that users should check soil moisture.`
  }

  async suggestCare(dto: SuggestPlantCareDto) {
    const weather = await this.weatherService.getLastMonthSummary(dto.city)
    const result = await this.deepSeekService.generateJson<PlantAiSuggestion>({
      messages: [
        {
          role: 'system',
          content: this.getSuggestionSystemPrompt()
        },
        {
          role: 'user',
          content: `Create a json care draft for this plant name or species: "${dto.plantName}".
Current user-entered values, if any:
${compactObject(dto.currentValues ?? {})}
${getWeatherPrompt(weather)}`
        }
      ]
    })

    return {
      ...normalizeSuggestion(result),
      weather
    }
  }

  async suggestExistingCare(
    plantId: string,
    userId: string,
    dto: ExistingPlantAiDto
  ) {
    const plant = await this.prisma.userPlant.findFirst({
      where: {
        id: plantId,
        userId
      }
    })

    if (!plant) throw new NotFoundException('Plant not found')

    const weather = await this.weatherService.getLastMonthSummary(dto.city)
    const result = await this.deepSeekService.generateJson<PlantAiSuggestion>({
      messages: [
        {
          role: 'system',
          content: this.getSuggestionSystemPrompt()
        },
        {
          role: 'user',
          content: `Update the json care draft for this existing plant.
Existing plant:
${compactObject(plant)}
User question or extra request:
${dto.question?.trim() || 'No extra request.'}
${getWeatherPrompt(weather)}`
        }
      ]
    })

    return {
      ...normalizeSuggestion(result),
      weather
    }
  }

  async analyzeCare(plantId: string, userId: string, dto: ExistingPlantAiDto) {
    const plant = await this.prisma.userPlant.findFirst({
      where: {
        id: plantId,
        userId
      },
      include: {
        careEvents: {
          orderBy: [
            {
              eventAt: 'desc'
            },
            {
              createdAt: 'desc'
            }
          ],
          take: 60
        }
      }
    })

    if (!plant) throw new NotFoundException('Plant not found')

    const weather = await this.weatherService.getLastMonthSummary(dto.city)
    const result = await this.deepSeekService.generateJson<PlantCareAnalysis>({
      messages: [
        {
          role: 'system',
          content: `You are a careful indoor plant care assistant.
Return only valid json with these fields:
{
  "summary": "short Russian summary",
  "wateringStatus": "underwatered | overwatered | balanced | unknown",
  "wateringReasoning": "Russian explanation",
  "weatherImpact": "Russian weather impact or null",
  "recommendations": ["Russian recommendation"],
  "risks": ["Russian risk"],
  "nextActions": ["Russian next action"],
  "suggestedAdjustments": {
    "wateringIntervalDays": 7,
    "wateringIntervalSpringDays": 7,
    "wateringIntervalSummerDays": 5,
    "wateringIntervalAutumnDays": 10,
    "wateringIntervalWinterDays": 14,
    "wateringAmountMl": 300,
    "wateringNotes": "Russian note"
  }
}
Use null when there is not enough data.
Do not invent exact certainty. Base the answer on plant data, care history, and weather context.`
        },
        {
          role: 'user',
          content: `Analyze watering and care for this plant.
Plant and recent care history:
${compactObject(plant)}
User question:
${dto.question?.trim() || 'Is watering and care normal?'}
${getWeatherPrompt(weather)}`
        }
      ],
      maxTokens: 3000
    })

    return {
      ...normalizeAnalysis(result),
      weather
    }
  }
}
