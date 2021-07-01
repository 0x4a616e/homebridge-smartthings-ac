import { CapabilityReference, Component, ComponentStatus, Device, DeviceStatus } from '@smartthings/core-sdk';
import { CurrentHeaterCoolerState } from 'hap-nodejs/dist/lib/definitions';
import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { ExampleHomebridgePlatform } from './platform';

export class SmartThingsAirConditionerAccessory {
  private service: Service;
  private device: Device;

  public static readonly requiredCapabilities = ['switch', 'temperatureMeasurement', 'thermostatCoolingSetpoint'];

  constructor(
    private readonly platform: ExampleHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.device = accessory.context.device as Device;

    const supportedCapabilites = this.getCapabilities(this.device);

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

    if (supportedCapabilites.includes('airConditionerMode')) {
      this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
        .onGet(this.getHeaterCoolerState.bind(this));
    }
  }

  private getCapabilities(device: Device) : string[] {
    return device.components?.flatMap((component: Component) => component.capabilities)
      .map((capabilityReference: CapabilityReference) => capabilityReference.id) ?? [];
  }

  async getHeaterCoolerState(): Promise<CharacteristicValue> {
    const mainComponent = await this.getMainComponent();
    const state = mainComponent['airConditionerMode']['airConditionerMode']['value'];
    this.platform.log.debug('Mode', state);

    switch (state) {
      case 'aIComfort': return CurrentHeaterCoolerState.IDLE;
      case 'cool': return CurrentHeaterCoolerState.COOLING;
      case 'dry': return CurrentHeaterCoolerState.IDLE;
      case 'wind': return CurrentHeaterCoolerState.COOLING;
      case 'auto': return CurrentHeaterCoolerState.COOLING;
      case 'heat': return CurrentHeaterCoolerState.HEATING;
    }

    return CurrentHeaterCoolerState.INACTIVE;
  }

  async getCoolingTemperature(): Promise<CharacteristicValue> {
    const mainComponent = await this.getMainComponent();
    const temperature = mainComponent['thermostatCoolingSetpoint']['coolingSetpoint']['value'];

    return temperature as number;
  }

  async setCoolingTemperature(value: CharacteristicValue) {
    this.executeMainCommand('setCoolingSetpoint', 'thermostatCoolingSetpoint', [ value as number ]);
  }

  async getCurrentTemperature(): Promise<CharacteristicValue> {
    const mainComponent = await this.getMainComponent();
    const temperature = mainComponent['temperatureMeasurement']['temperature']['value'];

    return temperature as number;
  }

  async setActive(value: CharacteristicValue) {
    this.executeMainCommand(value === 1 ? 'on' : 'off', 'switch');
  }

  async getActive(): Promise<CharacteristicValue> {
    const mainComponent = await this.getMainComponent();

    return mainComponent['switch']['switch']['value'] === 'on';
  }

  private async getMainComponent(): Promise<ComponentStatus> {
    const status = await this.getStatus();

    if (!status.components) {
      throw Error('Cannot get device status');
    }

    return status.components['main'];
  }

  private getStatus(): Promise<DeviceStatus> {
    if (!this.device.deviceId) {
      throw new Error('Device id must be set.');
    }

    this.platform.log.debug('Get status for device ', this.device.deviceId);
    return this.platform.client.devices.getStatus(this.device.deviceId);
  }

  private async executeMainCommand(command: string, capability: string, commandArguments?: (string | number)[]) {
    if (!this.device.deviceId) {
      throw Error('Device ID must be set');
    }

    this.platform.log.debug('Executing command', capability, command);

    const status = await this.platform.client.devices.executeCommand(this.device.deviceId, {
      component: 'main',
      command: command,
      capability: capability,
      arguments: commandArguments,
    });

    this.platform.log.debug('Command executed with status', status.status);
    if (status.status !== 'success') {
      throw Error('Command failed with status ' + status.status);
    }
  }
}
