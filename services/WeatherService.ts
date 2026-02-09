import * as Location from 'expo-location';
import axios from 'axios';

/**
 * Weather data interface
 */
export interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windGust?: number;
  weatherCondition: string;
  weatherCode: string;
  visibility: number;
  pressure: number;
  uvIndex?: number;
  precipitation?: number;
  // Air quality data
  pm25?: number; // PM2.5 concentration (µg/m³)
  pm10?: number; // PM10 concentration (µg/m³)
  aqi?: number; // Air Quality Index (0-500)
  airQualityLevel?: string; // Good, Moderate, etc.
  lastUpdated: Date;
}

/**
 * Coordinate interface
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Weather Service using Open-Meteo API (free, no key required)
 * Provides real-time weather data and forecasts
 */
class WeatherServiceClass {
  private baseUrl = 'https://api.open-meteo.com/v1/forecast';
  private weatherCodeMap: { [key: number]: string } = {
    0: 'Clear',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Foggy (rime)',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Thunderstorm with hail (heavy)',
  };

  /**
   * Get current weather for a location
   */
  async getCurrentWeather(latitude: number, longitude: number): Promise<WeatherData> {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          latitude,
          longitude,
          // Request all available current weather parameters from Open-Meteo
          current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,pressure_msl,cloud_cover,is_day,uv_index',
          temperature_unit: 'celsius',
          wind_speed_unit: 'kmh',
          precipitation_unit: 'mm',
          timezone: 'auto',
        },
      });

      const current = response.data.current;
      const weatherCode = current.weather_code || 0;

      // Fetch air quality data separately
      let airQualityData: any = {};
      try {
        const aqResponse = await axios.get('https://air-quality-api.open-meteo.com/v1/air-quality', {
          params: {
            latitude,
            longitude,
            current: 'pm2_5,pm10,us_aqi',
            timezone: 'auto',
          },
        });
        airQualityData = aqResponse.data.current || {};
      } catch (aqError) {
        console.warn('Warning: Could not fetch air quality data:', aqError);
      }

      const pm25 = airQualityData.pm2_5 || 0;
      const pm10 = airQualityData.pm10 || 0;
      const usAqi = airQualityData.us_aqi || 0;

      return {
        temperature: current.temperature_2m || 0,
        feelsLike: current.apparent_temperature || current.temperature_2m || 0,
        humidity: current.relative_humidity_2m || 0,
        windSpeed: current.wind_speed_10m || 0,
        windGust: current.wind_gusts_10m || current.wind_speed_10m || 0,
        weatherCondition: this.weatherCodeMap[weatherCode] || 'Unknown',
        weatherCode: weatherCode.toString(),
        visibility: current.visibility || 10000,
        pressure: current.pressure_msl || 1013,
        uvIndex: current.uv_index || 0,
        precipitation: current.precipitation || 0,
        pm25: pm25,
        pm10: pm10,
        aqi: usAqi,
        airQualityLevel: this.getAirQualityLevel(usAqi),
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error('Error fetching weather data:', error);
      throw new Error('Failed to fetch weather data');
    }
  }

  /**
   * Get air quality level description
   */
  private getAirQualityLevel(aqi: number): string {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
  }

  /**
   * Get weather for current user location
   */
  async getWeatherForCurrentLocation(): Promise<WeatherData> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return this.getCurrentWeather(
        location.coords.latitude,
        location.coords.longitude
      );
    } catch (error) {
      console.error('Error getting location for weather:', error);
      throw new Error('Failed to get location for weather');
    }
  }

  /**
   * Get hourly forecast for next 24 hours
   */
  async getHourlyForecast(
    latitude: number,
    longitude: number,
    hours: number = 24
  ): Promise<any[]> {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          latitude,
          longitude,
          hourly: 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m,precipitation',
          temperature_unit: 'celsius',
          wind_speed_unit: 'kmh',
          precipitation_unit: 'mm',
          forecast_days: Math.ceil(hours / 24),
          timezone: 'auto',
        },
      });

      const hourly = response.data.hourly;
      const forecast = [];

      for (let i = 0; i < Math.min(hours, hourly.time.length); i++) {
        forecast.push({
          time: new Date(hourly.time[i]),
          temperature: hourly.temperature_2m[i],
          precipitationProbability: hourly.precipitation_probability[i] || 0,
          weatherCode: hourly.weather_code[i],
          windSpeed: hourly.wind_speed_10m[i],
          precipitation: hourly.precipitation[i] || 0,
        });
      }

      return forecast;
    } catch (error) {
      console.error('Error fetching hourly forecast:', error);
      return [];
    }
  }

  /**
   * Cache weather data to avoid excessive API calls
   */
  private weatherCache: Map<string, { data: WeatherData; timestamp: number }> = new Map();
  private cacheExpiry = 10 * 60 * 1000; // 10 minutes

  /**
   * Get cached weather or fetch new
   */
  async getWeatherCached(latitude: number, longitude: number): Promise<WeatherData> {
    const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
    const cached = this.weatherCache.get(key);

    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log('✅ Using cached weather data');
      return cached.data;
    }

    const weather = await this.getCurrentWeather(latitude, longitude);
    this.weatherCache.set(key, { data: weather, timestamp: Date.now() });
    return weather;
  }

  /**
   * Clear weather cache
   */
  clearCache(): void {
    this.weatherCache.clear();
  }
}

export const WeatherService = new WeatherServiceClass();
