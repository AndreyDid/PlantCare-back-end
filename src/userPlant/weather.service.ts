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

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10)
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

  async getLastMonthSummary(
    city?: string | null
  ): Promise<WeatherSummary | null> {
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

    const endDate = new Date()
    endDate.setUTCDate(endDate.getUTCDate() - 1)

    const startDate = new Date(endDate)
    startDate.setUTCDate(startDate.getUTCDate() - 30)

    const archiveUrl = new URL('https://archive-api.open-meteo.com/v1/archive')
    archiveUrl.searchParams.set('latitude', String(location.latitude))
    archiveUrl.searchParams.set('longitude', String(location.longitude))
    archiveUrl.searchParams.set('start_date', toDateString(startDate))
    archiveUrl.searchParams.set('end_date', toDateString(endDate))
    archiveUrl.searchParams.set(
      'hourly',
      'temperature_2m,relative_humidity_2m,precipitation,vapour_pressure_deficit'
    )
    archiveUrl.searchParams.set('timezone', location.timezone ?? 'auto')

    const archive = await this.fetchJson<OpenMeteoArchiveResponse>(archiveUrl)
    const hourly = archive?.hourly

    if (!hourly) return null

    return {
      city: normalizedCity,
      resolvedLocation: [location.name, location.admin1, location.country]
        .filter(Boolean)
        .join(', '),
      periodStart: toDateString(startDate),
      periodEnd: toDateString(endDate),
      averageTemperatureC: average(hourly.temperature_2m),
      averageHumidityPercent: average(hourly.relative_humidity_2m),
      totalPrecipitationMm: sum(hourly.precipitation),
      averageVapourPressureDeficitKpa: average(hourly.vapour_pressure_deficit)
    }
  }
}
