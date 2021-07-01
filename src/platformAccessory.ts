import { ConfigValueType, Device, DeviceStatus } from '@smartthings/core-sdk';
import { CurrentHeaterCoolerState } from 'hap-nodejs/dist/lib/definitions';
import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { assert } from 'node:console';

import { ExampleHomebridgePlatform } from './platform';

export class ExamplePlatformAccessory {
  private service: Service;
  private device: Device;

  constructor(
    private readonly platform: ExampleHomebridgePlatform,
    private readonly accessory: PlatformAccessory
  ) {
    this.device = accessory.context.device as Device

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, this.device.manufacturerName ?? 'unknown')
      .setCharacteristic(this.platform.Characteristic.Model, this.device.deviceTypeId ?? 'unknown')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.device.presentationId ?? 'unknown');

    this.service = this.accessory.getService(this.platform.Service.HeaterCooler) || this.accessory.addService(this.platform.Service.HeaterCooler);
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.label ?? 'unkown');

    this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .setProps({
        maxValue: 30,
        minValue: 16,
        minStep: 1
      })
      .onGet(this.getCoolingTemperature.bind(this))
      .onSet(this.setCoolingTemperature.bind(this))

    this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .setProps({
        maxValue: 30,
        minValue: 16,
        minStep: 1
      })
      .onGet(this.getCoolingTemperature.bind(this))
      .onSet(this.setCoolingTemperature.bind(this))

    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setActive.bind(this))
      .onGet(this.getActive.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .onGet(this.getHeaterCoolerState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));
  }

  async getHeaterCoolerState(): Promise<CharacteristicValue> {
    let deviceStatus = await this.getStatus()
    if (deviceStatus.components) {
      let state = deviceStatus.components['main']['airConditionerMode']['airConditionerMode']['value']
      this.platform.log.debug('Mode', state)
      
      switch (state) {
        case "aIComfort": return CurrentHeaterCoolerState.IDLE
        case "cool": return CurrentHeaterCoolerState.COOLING
        case "dry": return CurrentHeaterCoolerState.IDLE
        case "wind": return CurrentHeaterCoolerState.COOLING
        case "auto": return CurrentHeaterCoolerState.COOLING
        case "heat": return CurrentHeaterCoolerState.HEATING
      }
    }

    return CurrentHeaterCoolerState.INACTIVE;
  }

  async getCoolingTemperature(): Promise<CharacteristicValue> {
    let deviceStatus = await this.getStatus()
    if (deviceStatus.components) {
      let temperature = deviceStatus.components['main']['thermostatCoolingSetpoint']['coolingSetpoint']['value']
      if (temperature) {
        return temperature as number
      }
    }
    return 10;
  }

  async setCoolingTemperature(value: CharacteristicValue) {
    this.platform.log.debug('Set Characteristic On ->', value);
    if (this.device.deviceId) {
      this.platform.client.devices.executeCommand(this.device.deviceId, {
        component: "main",
        command: "setCoolingSetpoint",
        capability: "thermostatCoolingSetpoint",
        arguments: [ value as number ]
      })
    }
  }

  async getCurrentTemperature(): Promise<CharacteristicValue> {
    let deviceStatus = await this.getStatus()
    if (deviceStatus.components) {
      let temperature = deviceStatus.components['main']['temperatureMeasurement']['temperature']['value']
      if (temperature) {
        return temperature as number
      }
    }
    return 10;
  }

  async setActive(value: CharacteristicValue) {
    this.platform.log.debug('Set Characteristic On ->', value);
    if (this.device.deviceId) {
      this.platform.client.devices.executeCommand(this.device.deviceId, {
        component: "main",
        command: value == 1 ? "on" : "off",
        capability: "switch"
      })
    }
  }

  async getActive(): Promise<CharacteristicValue> {
    if (this.device.deviceId) {
      this.platform.log.debug('Get active', this.device.deviceId);
      let deviceStatus = await this.getStatus()
      if (deviceStatus.components) {
        return deviceStatus.components['main']['switch']['switch']['value'] == 'on'
      }
    }

    return false;
  }

  getStatus(): Promise<DeviceStatus> {
    if (!this.device.deviceId) {
      throw new Error("Device id must be set.")
    }

    this.platform.log.debug('Get status for device ', this.device.deviceId);
    return this.platform.client.devices.getStatus(this.device.deviceId)
  }
}
