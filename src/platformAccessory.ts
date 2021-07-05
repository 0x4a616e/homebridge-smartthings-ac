import { Device } from '@smartthings/core-sdk';
import { TargetHeaterCoolerState } from 'hap-nodejs/dist/lib/definitions';
import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { DeviceAdapter } from './deviceAdapter';
import { SmartThingsPlatform } from './platform';

export class SmartThingsAirConditionerAccessory {
  private service: Service;
  private device: Device;

  public static readonly requiredCapabilities = ['switch', 'temperatureMeasurement', 'thermostatCoolingSetpoint', 'airConditionerMode'];

  constructor(
    private readonly platform: SmartThingsPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly deviceAdapter: DeviceAdapter,
  ) {
    this.device = accessory.context.device as Device;

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, this.device.manufacturerName ?? 'unknown')
      .setCharacteristic(this.platform.Characteristic.Model, this.device.deviceTypeId ?? 'unknown')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.device.presentationId ?? 'unknown');

    this.service = this.accessory.getService(this.platform.Service.HeaterCooler)
      || this.accessory.addService(this.platform.Service.HeaterCooler);
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.label ?? 'unkown');

    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setActive.bind(this))
      .onGet(this.getActive.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .setProps({
        maxValue: 30,
        minValue: 16,
        minStep: 1,
      })
      .onGet(this.getCoolingTemperature.bind(this))
      .onSet(this.setCoolingTemperature.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .setProps({
        maxValue: 30,
        minValue: 16,
        minStep: 1,
      })
      .onGet(this.getCoolingTemperature.bind(this))
      .onSet(this.setCoolingTemperature.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .onGet(this.getHeaterCoolerState.bind(this))
      .onSet(this.setHeaterCoolerState.bind(this));
  }

  private async getHeaterCoolerState(): Promise<CharacteristicValue> {
    const mainComponent = await this.deviceAdapter.getMainComponent();
    const state = mainComponent['airConditionerMode']['airConditionerMode']['value'];

    return this.fromSmartThingsMode(state as string);
  }

  private async getCoolingTemperature(): Promise<CharacteristicValue> {
    const mainComponent = await this.deviceAdapter.getMainComponent();
    const temperature = mainComponent['thermostatCoolingSetpoint']['coolingSetpoint']['value'];

    return temperature as number;
  }

  private async setHeaterCoolerState(value: CharacteristicValue) {
    const mode = this.toSmartThingsMode(value);

    this.deviceAdapter.executeMainCommand('setAirConditionerMode', 'airConditionerMode', [ mode ]);
  }

  private async setCoolingTemperature(value: CharacteristicValue) {
    this.deviceAdapter.executeMainCommand('setCoolingSetpoint', 'thermostatCoolingSetpoint', [value as number]);
  }

  private async getCurrentTemperature(): Promise<CharacteristicValue> {
    const mainComponent = await this.deviceAdapter.getMainComponent();
    const temperature = mainComponent['temperatureMeasurement']['temperature']['value'];

    return temperature as number;
  }

  private async setActive(value: CharacteristicValue) {
    this.deviceAdapter.executeMainCommand(value === 1 ? 'on' : 'off', 'switch');
  }

  private async getActive(): Promise<CharacteristicValue> {
    const mainComponent = await this.deviceAdapter.getMainComponent();

    return mainComponent['switch']['switch']['value'] === 'on';
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
}
