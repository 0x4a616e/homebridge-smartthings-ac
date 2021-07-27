import { Device } from '@smartthings/core-sdk';
import { TargetHeaterCoolerState } from 'hap-nodejs/dist/lib/definitions';
import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { DeviceAdapter } from './deviceAdapter';
import { SmartThingsPlatform } from './platform';
import { PlatformStatusInfo } from './platformStatusInfo';

export class SmartThingsAirConditionerAccessory {
  private service: Service;
  private device: Device;

  public static readonly requiredCapabilities = [
    'switch',
    'temperatureMeasurement',
    'thermostatCoolingSetpoint',
    'relativeHumidityMeasurement',
    'airConditionerMode',
  ];

  constructor(
    private readonly platform: SmartThingsPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly deviceAdapter: DeviceAdapter,
  ) {
    this.device = accessory.context.device as Device;

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, this.device.manufacturerName ?? 'unknown')
      .setCharacteristic(this.platform.Characteristic.Model, this.device.name ?? 'unknown')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.device.presentationId ?? 'unknown');

    this.service = this.accessory.getService(this.platform.Service.HeaterCooler)
      || this.accessory.addService(this.platform.Service.HeaterCooler);
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.label ?? 'unkown');

    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setActive.bind(this))
      .onGet(this.getActive.bind(this));

    const temperatureProperties = {
      maxValue: this.platform.config.maxTemperature,
      minValue: this.platform.config.minTemperature,
      minStep: 1,
    };

    this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .setProps(temperatureProperties)
      .onGet(this.getCoolingTemperature.bind(this))
      .onSet(this.setCoolingTemperature.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .setProps(temperatureProperties)
      .onGet(this.getCoolingTemperature.bind(this))
      .onSet(this.setCoolingTemperature.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .onGet(this.getHeaterCoolerState.bind(this))
      .onSet(this.setHeaterCoolerState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
      .onGet(this.getCurrentHumidity.bind(this));

  }

  private async getHeaterCoolerState(): Promise<CharacteristicValue> {
    return this.fromSmartThingsMode((await this.getStatus()).mode);
  }

  private async getCoolingTemperature(): Promise<CharacteristicValue> {
    return (await this.getStatus()).targetTemperature;
  }

  private async getActive(): Promise<CharacteristicValue> {
    return (await this.getStatus()).active;
  }

  private async getCurrentTemperature(): Promise<CharacteristicValue> {
    return (await this.getStatus()).currentTemperature;
  }

  private async getCurrentHumidity(): Promise<CharacteristicValue> {
    return (await this.getStatus()).currentHumidity;
  }

  private async setActive(value: CharacteristicValue) {
    this.deviceAdapter.executeMainCommand(value === 1 ? 'on' : 'off', 'switch');
  }

  private async setHeaterCoolerState(value: CharacteristicValue) {
    const mode = this.toSmartThingsMode(value);

    this.deviceAdapter.executeMainCommand('setAirConditionerMode', 'airConditionerMode', [ mode ]);
  }

  private async setCoolingTemperature(value: CharacteristicValue) {
    this.deviceAdapter.executeMainCommand('setCoolingSetpoint', 'thermostatCoolingSetpoint', [value as number]);
  }

  private toSmartThingsMode(value: CharacteristicValue): string {
    switch (value) {
      case TargetHeaterCoolerState.HEAT: return 'heat';
      case TargetHeaterCoolerState.COOL: return 'cool';
      case TargetHeaterCoolerState.AUTO: return 'auto';
    }

    this.platform.log.warn('Illegal heater-cooler state', value);
    return 'auto';
  }

  private fromSmartThingsMode(state: string): CharacteristicValue {
    switch (state) {
      case 'cool': return TargetHeaterCoolerState.COOL;
      case 'auto': return TargetHeaterCoolerState.AUTO;
      case 'heat': return TargetHeaterCoolerState.HEAT;
    }

    this.platform.log.warn('Received unknown heater-cooler state', state);
    return TargetHeaterCoolerState.AUTO;
  }

  private getStatus(): Promise<PlatformStatusInfo> {
    this.platform.log.debug('Updating status for device', this.device.deviceId);

    return this.deviceAdapter.getStatus();
  }
}
