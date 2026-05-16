import { Injectable } from '@nestjs/common'

type OpenMeteoGeocodingResponse = {
  results?: Array<{
    name: string
    latitude: number
    longitude: number
    country?: string
    admin1?: string
    timezone?: string
  }>
}

type OpenMeteoArchiveResponse = {
  hourly?: {
    temperature_2m?: Array<number | null>
    relative_humidity_2m?: Array<number | null>
    precipitation?: Array<number | null>
    vapour_pressure_deficit?: Array<number | null>
  }
}

type OpenMeteoForecastResponse = {
  current?: {
    time?: string
    temperature_2m?: number | null
    relative_humidity_2m?: number | null
    apparent_temperature?: number | null
    precipitation?: number | null
    weather_code?: number | null
    wind_speed_10m?: number | null
  }
  daily?: {
    time?: string[]
    temperature_2m_max?: Array<number | null>
    temperature_2m_min?: Array<number | null>
    precipitation_sum?: Array<number | null>
  }
}

export type WeatherSummary = {
  city: string
  resolvedLocation: string
  periodStart: string
  periodEnd: string
  averageTemperatureC: number | null
  averageHumidityPercent: number | null
  totalPrecipitationMm: number | null
  averageVapourPressureDeficitKpa: number | null
}

export type CurrentWeatherSummary = {
  city: string
  resolvedLocation: string
  observedAt: string | null
  temperatureC: number | null
  apparentTemperatureC: number | null
  humidityPercent: number | null
  precipitationMm: number | null
  windSpeedKmh: number | null
  weatherCode: number | null
  condition: string
  today: {
    temperatureMinC: number | null
    temperatureMaxC: number | null
    precipitationMm: number | null
  }
  tomorrow: {
    temperatureMinC: number | null
    temperatureMaxC: number | null
    precipitationMm: number | null
  }
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10)
}

function round(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Number(value.toFixed(1))
    : null
}

function average(values?: Array<number | null>) {
  const numbers = values?.filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value)
  )

  if (!numbers?.length) return null

  return Number(
    (numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(1)
  )
}

function sum(values?: Array<number | null>) {
  const numbers = values?.filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value)
  )

  if (!numbers?.length) return null

  return Number(numbers.reduce((total, value) => total + value, 0).toFixed(1))
}

function getWeatherCondition(code?: number | null) {
  if (code === 0) return 'Ясно'
  if (code === 1 || code === 2 || code === 3) return 'Переменная облачность'
  if (code === 45 || code === 48) return 'Туман'
  if ([51, 53, 55, 56, 57].includes(code ?? -1)) return 'Морось'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code ?? -1)) return 'Дождь'
  if ([71, 73, 75, 77, 85, 86].includes(code ?? -1)) return 'Снег'
  if ([95, 96, 99].includes(code ?? -1)) return 'Гроза'

  return 'Погода'
}

@Injectable()
export class WeatherService {
  private async fetchJson<T>(url: URL) {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json'
      }
    })

    if (!response.ok) return null

    return (await response.json()) as T
  }

  private async resolveLocation(city?: string | null) {
    const normalizedCity = city?.trim()

    if (!normalizedCity) return null

    const geocodingUrl = new URL(
      'https://geocoding-api.open-meteo.com/v1/search'
    )
    geocodingUrl.searchParams.set('name', normalizedCity)
    geocodingUrl.searchParams.set('count', '1')
    geocodingUrl.searchParams.set('language', 'ru')
    geocodingUrl.searchParams.set('format', 'json')

    const geocoding =
      await this.fetchJson<OpenMeteoGeocodingResponse>(geocodingUrl)
    const location = geocoding?.results?.[0]

    if (!location) return null

    return {
      requestedCity: normalizedCity,
      location,
      resolvedLocation: [location.name, location.admin1, location.country]
        .filter(Boolean)
        .join(', ')
    }
  }

  async getCurrentSummary(
    city?: string | null
  ): Promise<CurrentWeatherSummary | null> {
    const resolved = await this.resolveLocation(city)

    if (!resolved) return null

    const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast')
    forecastUrl.searchParams.set('latitude', String(resolved.location.latitude))
    forecastUrl.searchParams.set(
      'longitude',
      String(resolved.location.longitude)
    )
    forecastUrl.searchParams.set(
      'current',
      'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m'
    )
    forecastUrl.searchParams.set(
      'daily',
      'temperature_2m_max,temperature_2m_min,precipitation_sum'
    )
    forecastUrl.searchParams.set('forecast_days', '2')
    forecastUrl.searchParams.set(
      'timezone',
      resolved.location.timezone ?? 'auto'
    )

    const forecast =
      await this.fetchJson<OpenMeteoForecastResponse>(forecastUrl)

    if (!forecast?.current) return null

    return {
      city: resolved.requestedCity,
      resolvedLocation: resolved.resolvedLocation,
      observedAt: forecast.current.time ?? null,
      temperatureC: round(forecast.current.temperature_2m),
      apparentTemperatureC: round(forecast.current.apparent_temperature),
      humidityPercent: round(forecast.current.relative_humidity_2m),
      precipitationMm: round(forecast.current.precipitation),
      windSpeedKmh: round(forecast.current.wind_speed_10m),
      weatherCode: forecast.current.weather_code ?? null,
      condition: getWeatherCondition(forecast.current.weather_code),
      today: {
        temperatureMinC: round(forecast.daily?.temperature_2m_min?.[0]),
        temperatureMaxC: round(forecast.daily?.temperature_2m_max?.[0]),
        precipitationMm: round(forecast.daily?.precipitation_sum?.[0])
      },
      tomorrow: {
        temperatureMinC: round(forecast.daily?.temperature_2m_min?.[1]),
        temperatureMaxC: round(forecast.daily?.temperature_2m_max?.[1]),
        precipitationMm: round(forecast.daily?.precipitation_sum?.[1])
      }
    }
  }

  async getLastMonthSummary(
    city?: string | null
  ): Promise<WeatherSummary | null> {
    const resolved = await this.resolveLocation(city)

    if (!resolved) return null

    const endDate = new Date()
    endDate.setUTCDate(endDate.getUTCDate() - 1)

    const startDate = new Date(endDate)
    startDate.setUTCDate(startDate.getUTCDate() - 30)

    const archiveUrl = new URL('https://archive-api.open-meteo.com/v1/archive')
    archiveUrl.searchParams.set('latitude', String(resolved.location.latitude))
    archiveUrl.searchParams.set(
      'longitude',
      String(resolved.location.longitude)
    )
    archiveUrl.searchParams.set('start_date', toDateString(startDate))
    archiveUrl.searchParams.set('end_date', toDateString(endDate))
    archiveUrl.searchParams.set(
      'hourly',
      'temperature_2m,relative_humidity_2m,precipitation,vapour_pressure_deficit'
    )
    archiveUrl.searchParams.set(
      'timezone',
      resolved.location.timezone ?? 'auto'
    )

    const archive = await this.fetchJson<OpenMeteoArchiveResponse>(archiveUrl)
    const hourly = archive?.hourly

    if (!hourly) return null

    return {
      city: resolved.requestedCity,
      resolvedLocation: resolved.resolvedLocation,
      periodStart: toDateString(startDate),
      periodEnd: toDateString(endDate),
      averageTemperatureC: average(hourly.temperature_2m),
      averageHumidityPercent: average(hourly.relative_humidity_2m),
      totalPrecipitationMm: sum(hourly.precipitation),
      averageVapourPressureDeficitKpa: average(hourly.vapour_pressure_deficit)
    }
  }
}
