import { WeatherData } from './WeatherService';

/**
 * Safety alert level
 */
export type SafetyLevel = 'safe' | 'caution' | 'warning' | 'danger';

/**
 * Weather alert information
 */
export interface WeatherAlert {
  level: SafetyLevel;
  title: string;
  message: string;
  recommendations: string[];
  hazards: string[];
  isSafeToTravel: boolean;
  conditions: {
    temperature?: string;
    windSpeed?: string;
    visibility?: string;
    precipitation?: string;
    uvIndex?: string;
    airQuality?: string;
  };
}

/**
 * Weather Alert Service
 * Analyzes weather conditions and determines travel safety
 */
class WeatherAlertServiceClass {
  /**
   * Safety thresholds for different conditions
   */
  private thresholds = {
    // Temperature thresholds (Celsius)
    temperature: {
      extremeCold: -10,
      veryHot: 40,
      hot: 35,
      cold: 0,
    },
    // Wind speed (km/h)
    windSpeed: {
      dangerous: 60, // Hurricane force
      severe: 50, // Strong gale
      strong: 40, // Gale
      moderate: 25,
    },
    // Visibility (meters)
    visibility: {
      hazardous: 100, // Very poor
      poor: 500, // Poor
      moderate: 1000,
    },
    // Precipitation (mm)
    precipitation: {
      heavy: 10,
      moderate: 5,
    },
    // UV Index
    uvIndex: {
      extreme: 11,
      veryHigh: 8,
      high: 6,
    },
  };

  /**
   * Compare two safety levels and return true if second is worse than first
   */
  private isSafetyLevelWorse(current: SafetyLevel, potential: SafetyLevel): boolean {
    const hierarchy: Record<SafetyLevel, number> = {
      'safe': 0,
      'caution': 1,
      'warning': 2,
      'danger': 3,
    };
    return hierarchy[potential] > hierarchy[current];
  }

  /**
   * Analyze weather and return alert
   */
  analyzeWeather(weather: WeatherData): WeatherAlert {
    const hazards: string[] = [];
    const recommendations: string[] = [];
    let safetyLevel: SafetyLevel = 'safe';
    let isSafeToTravel = true;

    // Temperature analysis
    const tempAnalysis = this.analyzeTemperature(weather.temperature, hazards, recommendations);
    if (this.isSafetyLevelWorse(safetyLevel, tempAnalysis)) {
      safetyLevel = tempAnalysis;
    }

    // Wind analysis
    const windAnalysis = this.analyzeWind(weather.windSpeed, weather.windGust || 0, hazards, recommendations);
    if (this.isSafetyLevelWorse(safetyLevel, windAnalysis)) {
      safetyLevel = windAnalysis;
    }

    // Visibility analysis
    const visibilityAnalysis = this.analyzeVisibility(weather.visibility, hazards, recommendations);
    if (this.isSafetyLevelWorse(safetyLevel, visibilityAnalysis)) {
      safetyLevel = visibilityAnalysis;
    }

    // Precipitation analysis
    const precipAnalysis = this.analyzePrecipitation(
      weather.precipitation || 0,
      weather.weatherCode,
      hazards,
      recommendations
    );
    if (this.isSafetyLevelWorse(safetyLevel, precipAnalysis)) {
      safetyLevel = precipAnalysis;
    }

    // UV Index analysis
    const uvAnalysis = this.analyzeUVIndex(weather.uvIndex || 0, hazards, recommendations);
    if (this.isSafetyLevelWorse(safetyLevel, uvAnalysis)) {
      safetyLevel = uvAnalysis;
    }

    // Humidity analysis
    this.analyzeHumidity(weather.humidity, hazards, recommendations);



    // Determine travel safety
    isSafeToTravel = safetyLevel === 'safe' || safetyLevel === 'caution';

    // Add positive recommendations when conditions are safe
    if (safetyLevel === 'safe' && recommendations.length === 0) {
      recommendations.push('✅ All weather conditions are favorable for safe travel.');
      recommendations.push('Good visibility and normal wind conditions - enjoy your journey!');

    } else if (safetyLevel === 'caution' && recommendations.length === 0) {
      recommendations.push('⚠️ Conditions are manageable - exercise normal caution while traveling.');
      recommendations.push('Stay alert and adjust your travel plans if conditions worsen.');
    }

    return {
      level: safetyLevel,
      title: this.getSafetyLevelTitle(safetyLevel, isSafeToTravel),
      message: this.generateMessage(safetyLevel, weather.weatherCondition),
      recommendations,
      hazards: [...new Set(hazards)], // Remove duplicates
      isSafeToTravel,
      conditions: {
        temperature: `${weather.temperature}°C (feels like ${weather.feelsLike}°C)`,
        windSpeed: `${weather.windSpeed} km/h` + (weather.windGust ? ` (gusts up to ${weather.windGust} km/h)` : ''),
        visibility: `${(weather.visibility / 1000).toFixed(1)} km`,
        precipitation: `${weather.precipitation || 0} mm`,
        uvIndex: weather.uvIndex ? `${weather.uvIndex} (${this.getUVIndexLevel(weather.uvIndex)})` : 'N/A',
      },
    };
  }

  /**
   * Analyze temperature
   */
  private analyzeTemperature(
    temp: number,
    hazards: string[],
    recommendations: string[]
  ): SafetyLevel {
    if (temp <= this.thresholds.temperature.extremeCold) {
      hazards.push('Extreme cold - Risk of hypothermia and frostbite');
      recommendations.push('Avoid outdoor travel. Risk of hypothermia is critical.');
      recommendations.push('If necessary, wear heavy insulation and limit exposure time.');
      return 'danger';
    } else if (temp < this.thresholds.temperature.cold) {
      hazards.push('Cold temperature - Risk of hypothermia');
      recommendations.push('Dress warmly if traveling. Limit outdoor exposure.');
      recommendations.push('Avoid prolonged exposure and monitor for signs of hypothermia.');
      return 'warning';
    } else if (temp >= this.thresholds.temperature.veryHot) {
      hazards.push('Extreme heat - Risk of heat stroke');
      recommendations.push('Avoid strenuous outdoor activities. Risk of heat stroke is critical.');
      recommendations.push('Stay hydrated and seek shade regularly.');
      return 'danger';
    } else if (temp >= this.thresholds.temperature.hot) {
      hazards.push('High temperature - Heat exhaustion risk');
      recommendations.push('Carry water and take frequent breaks in shade.');
      recommendations.push('Wear light clothing and avoid peak sun hours (10 AM - 4 PM).');
      return 'warning';
    }

    return 'safe';
  }

  /**
   * Analyze wind conditions
   */
  private analyzeWind(
    windSpeed: number,
    windGust: number,
    hazards: string[],
    recommendations: string[]
  ): SafetyLevel {
    const maxWind = Math.max(windSpeed, windGust);

    if (maxWind >= this.thresholds.windSpeed.dangerous) {
      hazards.push(`Dangerous winds (${maxWind} km/h) - Risk of being blown over`);
      recommendations.push('Do NOT travel. Dangerous wind speeds can cause loss of balance.');
      recommendations.push('Secure outdoor items and stay indoors.');
      return 'danger';
    } else if (maxWind >= this.thresholds.windSpeed.severe) {
      hazards.push(`Severe wind (${maxWind} km/h) - Difficulty walking`);
      recommendations.push('Travel only if absolutely necessary. Use caution with movement.');
      recommendations.push('Avoid areas near trees or structures that could collapse.');
      return 'warning';
    } else if (maxWind >= this.thresholds.windSpeed.strong) {
      hazards.push(`Strong wind (${maxWind} km/h) - Slowed progress`);
      recommendations.push('Use caution and reduce travel speed.');
      recommendations.push('Be aware of surrounding objects that could be blown away.');
      return 'caution';
    } else if (maxWind >= this.thresholds.windSpeed.moderate) {
      hazards.push(`Moderate wind (${maxWind} km/h)`);
      return 'caution';
    }

    return 'safe';
  }

  /**
   * Analyze visibility
   */
  private analyzeVisibility(
    visibility: number,
    hazards: string[],
    recommendations: string[]
  ): SafetyLevel {
    if (visibility < this.thresholds.visibility.hazardous) {
      hazards.push('Extremely poor visibility - High collision risk');
      recommendations.push('Do NOT travel. Visibility too poor for safe navigation.');
      recommendations.push('Wait for visibility to improve before traveling.');
      return 'danger';
    } else if (visibility < this.thresholds.visibility.poor) {
      hazards.push('Poor visibility - Increased accident risk');
      recommendations.push('Reduce speed and use caution. Turn on lights/high visibility gear.');
      recommendations.push('Avoid areas with traffic or obstacles.');
      return 'warning';
    } else if (visibility < this.thresholds.visibility.moderate) {
      hazards.push('Moderate visibility reduction');
      recommendations.push('Increase awareness and caution when moving.');
      return 'caution';
    }

    return 'safe';
  }

  /**
   * Analyze precipitation
   */
  private analyzePrecipitation(
    precipitation: number,
    weatherCode: string,
    hazards: string[],
    recommendations: string[]
  ): SafetyLevel {
    const code = parseInt(weatherCode);

    // Thunderstorm analysis
    if (code === 95 || code === 96 || code === 99) {
      hazards.push('Thunderstorm - Risk of lightning strike');
      recommendations.push('Seek shelter immediately. Lightning risk is critical.');
      recommendations.push('Avoid open areas and tall objects.');
      return 'danger';
    }

    // Heavy precipitation
    if (precipitation >= this.thresholds.precipitation.heavy || code >= 80 && code <= 82) {
      hazards.push('Heavy rain/showers - Risk of slips and flooding');
      recommendations.push('Avoid travel if possible. Risk of slips and poor footing.');
      recommendations.push('If traveling, watch for water accumulation and slippery surfaces.');
      return 'warning';
    } else if (precipitation >= this.thresholds.precipitation.moderate || code >= 61 && code <= 67) {
      hazards.push('Rain - Slippery surfaces');
      recommendations.push('Use caution - surfaces may be slippery.');
      recommendations.push('Wear non-slip footwear and watch for wet pavement.');
      return 'caution';
    }

    // Snow analysis
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
      if (code >= 75 || code === 86) {
        hazards.push('Heavy snow - Risk of slips and reduced visibility');
        recommendations.push('Avoid travel if possible. Heavy snow creates hazardous conditions.');
        return 'warning';
      } else {
        hazards.push('Snow - Slippery surfaces');
        recommendations.push('Reduce speed and use extra caution.');
        return 'caution';
      }
    }

    // Drizzle analysis
    if (code >= 51 && code <= 55) {
      hazards.push('Drizzle - Slightly slippery surfaces');
      recommendations.push('Use normal caution.');
      return 'caution';
    }

    return 'safe';
  }

  /**
   * Analyze UV Index
   */
  private analyzeUVIndex(
    uvIndex: number,
    hazards: string[],
    recommendations: string[]
  ): SafetyLevel {
    if (uvIndex >= this.thresholds.uvIndex.extreme) {
      hazards.push(`Extreme UV Index (${uvIndex}) - Severe burn risk`);
      recommendations.push('Apply SPF 50+ sunscreen and reapply frequently.');
      recommendations.push('Wear protective clothing, hat, and sunglasses.');
      return 'warning';
    } else if (uvIndex >= this.thresholds.uvIndex.veryHigh) {
      hazards.push(`Very high UV Index (${uvIndex}) - High burn risk`);
      recommendations.push('Apply SPF 30+ sunscreen and wear protective gear.');
      recommendations.push('Limit sun exposure between 10 AM and 4 PM.');
      return 'caution';
    } else if (uvIndex >= this.thresholds.uvIndex.high) {
      hazards.push(`High UV Index (${uvIndex})`);
      recommendations.push('Apply SPF 15+ sunscreen during extended outdoor time.');
      return 'caution';
    }

    return 'safe';
  }

  /**
   * Analyze humidity
   */
  private analyzeHumidity(
    humidity: number,
    hazards: string[],
    recommendations: string[]
  ): void {
    if (humidity > 90) {
      hazards.push('Very high humidity - Reduced cooling efficiency');
      recommendations.push('Take more frequent breaks and drink extra water.');
    } else if (humidity < 30) {
      recommendations.push('Low humidity - Stay hydrated as dehydration occurs faster.');
    }
  }

  /**
   * Get UV Index level name
   */
  private getUVIndexLevel(uvIndex: number): string {
    if (uvIndex < 3) return 'Low';
    if (uvIndex < 6) return 'Moderate';
    if (uvIndex < 8) return 'High';
    if (uvIndex < 11) return 'Very High';
    return 'Extreme';
  }

  /**
   * Get safety level title
   */
  private getSafetyLevelTitle(level: SafetyLevel, isSafeToTravel: boolean): string {
    const titles: { [key in SafetyLevel]: string } = {
      safe: '✅ Safe to Travel',
      caution: '⚠️ Exercise Caution',
      warning: '🔶 Travel with Care',
      danger: '🚫 Not Safe to Travel',
    };
    return titles[level];
  }

  /**
   * Generate appropriate message based on conditions
   */
  private generateMessage(level: SafetyLevel, weatherCondition: string): string {
    const messages: { [key in SafetyLevel]: string } = {
      safe: `Current conditions are favorable for travel. ${weatherCondition} conditions are present.`,
      caution: `Exercise caution while traveling. Weather conditions require careful attention.`,
      warning: `Travel with extra care. Current weather conditions pose moderate risks.`,
      danger: `Do not travel unless absolutely necessary. Current weather conditions are hazardous.`,
    };
    return messages[level];
  }

  /**
   * Compare safety level strings for sorting
   */
  private isSaferThan(level1: SafetyLevel, level2: SafetyLevel): boolean {
    const order: SafetyLevel[] = ['safe', 'caution', 'warning', 'danger'];
    return order.indexOf(level1) < order.indexOf(level2);
  }
}

export const WeatherAlertService = new WeatherAlertServiceClass();
