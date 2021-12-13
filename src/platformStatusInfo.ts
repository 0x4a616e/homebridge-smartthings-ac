export interface PlatformStatusInfo {
   mode: string;
   active: boolean;
   currentHumidity: number;
   currentTemperature: number;
   targetTemperature: number;
   fanMode: string;
}