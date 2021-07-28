import { Device } from '@smartthings/core-sdk';
import { TargetHeaterCoolerState } from 'hap-nodejs/dist/lib/definitions';
import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { DeviceAdapter } from './deviceAdapter';
import { SmartThingsPlatform } from './platform';
import { PlatformStatusInfo } from './platformStatusInfo';

export class SmartThingsAirConditionerAccessory {
  private service: Service;
  private device: Device;

  private deviceStatus: PlatformStatusInfo;

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
    this.deviceStatus = {
      mode: 'auto',
      active: false,
      currentHumidity: 0,
      currentTemperature: this.platform.config.minTemperature,
      targetTemperature: this.platform.config.minTemperature,
    };

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

    const updateInterval = this.platform.config.updateInterval ?? 15;
    this.platform.log.debug('Update status every', updateInterval, 'secs');

    this.updateStatus();
    setInterval(async () => {
      await this.updateStatus();
    }, updateInterval * 1000);
  }

  private getHeaterCoolerState():CharacteristicValue {
    return this.fromSmartThingsMode(this.deviceStatus.mode);
  }

  private getCoolingTemperature(): CharacteristicValue {
    return this.deviceStatus.targetTemperature;
  }

  private getActive(): CharacteristicValue {
    return this.deviceStatus.active;
  }

  private getCurrentTemperature(): CharacteristicValue {
    return this.deviceStatus.currentTemperature;
  }

  private getCurrentHumidity(): CharacteristicValue {
    return this.deviceStatus.currentHumidity;
  }

  private async setActive(value: CharacteristicValue) {
    const isActive = value === 1;

    try {
      await this.executeCommand(isActive ? 'on' : 'off', 'switch');
      this.deviceStatus.active = isActive;
    } catch(error) {
      this.platform.log.error('Cannot set device active', error);
      await this.updateStatus();
    }
  }

  private async setHeaterCoolerState(value: CharacteristicValue) {
    const mode = this.toSmartThingsMode(value);

    try {
      await this.executeCommand('setAirConditionerMode', 'airConditionerMode', [ mode ]);
      this.deviceStatus.mode = mode;
    } catch(error) {
      this.platform.log.error('Cannot set device mode', error);
      await this.updateStatus();
    }
  }

  private async setCoolingTemperature(value: CharacteristicValue) {
    const targetTemperature = value as number;

    try {
      await this.executeCommand('setCoolingSetpoint', 'thermostatCoolingSetpoint', [targetTemperature]);
      this.deviceStatus.targetTemperature = targetTemperature;
    } catch(error) {
      this.platform.log.error('Cannot set device temperature', error);
      await this.updateStatus();
    }
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

  private async updateStatus() {
    try {
      this.deviceStatus = await this.getStatus();
    } catch(error) {
      this.platform.log.error('Error while updating device status', error);
    }
  }

  private async executeCommand(command: string, capability: string, commandArguments?: (string | number)[]) {
    await this.deviceAdapter.executeMainCommand(command, capability, commandArguments);
  }

  private getStatus(): Promise<PlatformStatusInfo> {
    return this.deviceAdapter.getStatus();
  }
}
