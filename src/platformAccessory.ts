import { Device } from '@smartthings/core-sdk';
import { TargetHeaterCoolerState } from 'hap-nodejs/dist/lib/definitions';
import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { DeviceAdapter } from './deviceAdapter';
import { SmartThingsPlatform } from './platform';

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

  private mode = 'auto';
  private active = false;
  private currentHumidity = 0;
  private currentTemperature = 0;
  private targetTemperature = 0;

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
    await this.updateStatus();

    return this.fromSmartThingsMode(this.mode);
  }

  private async getCoolingTemperature(): Promise<CharacteristicValue> {
    await this.updateStatus();

    return this.targetTemperature;
  }

  private async getActive(): Promise<CharacteristicValue> {
    await this.updateStatus();

    return this.active;
  }

  private async getCurrentTemperature(): Promise<CharacteristicValue> {
    // Read-only values use cached data, no update
    return this.currentTemperature;
  }

  private async getCurrentHumidity(): Promise<CharacteristicValue> {
    // Read-only values use cached data, no update
    return this.currentHumidity;
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

    return 'auto';
  }

  private fromSmartThingsMode(state: string): CharacteristicValue {
    switch (state) {
      case 'cool': return TargetHeaterCoolerState.COOL;
      case 'auto': return TargetHeaterCoolerState.AUTO;
      case 'heat': return TargetHeaterCoolerState.HEAT;
    }

    return TargetHeaterCoolerState.AUTO;
  }

  private async updateStatus() {
    this.platform.log.debug('Updating status for device', this.device.deviceId);

    const mainComponent = await this.deviceAdapter.getMainComponent();

    this.mode = mainComponent['airConditionerMode']['airConditionerMode']['value'] as string;
    this.targetTemperature = mainComponent['thermostatCoolingSetpoint']['coolingSetpoint']['value'] as number;
    this.currentTemperature = mainComponent['temperatureMeasurement']['temperature']['value'] as number;
    this.currentHumidity = mainComponent['relativeHumidityMeasurement']['humidity']['value'] as number;
    this.active = mainComponent['switch']['switch']['value'] === 'on';
  }
}
