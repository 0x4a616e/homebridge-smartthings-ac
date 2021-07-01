import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic, UnknownContext } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { SmartThingsAirConditionerAccessory } from './platformAccessory';
import {SmartThingsClient, BearerTokenAuthenticator, Device, Component, CapabilityReference} from '@smartthings/core-sdk';


export class ExampleHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public readonly accessories: PlatformAccessory[] = [];
  public readonly client: SmartThingsClient;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Loading devices with token:', this.config.token);
    this.client = new SmartThingsClient(new BearerTokenAuthenticator(this.config.token));

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');

      this.client.devices.list()
        .then((devices: Device[]) => this.handleDevices(devices))
        .catch(err => log.error('Cannot load devices', err));
    });
  }

  private handleDevices(devices: Device[]) {
    for (const device of devices) {
      if (device.components) {
        const capabilities = this.getCapabilities(device);
        if (this.isSupportedBy(capabilities)) {
          this.log.debug('Registering device', device.deviceId);
          this.handleSupportedDevice(device);
        } else {
          this.log.info('Skipping device', device.deviceId);
        }
      }

    }
  }

  private isSupportedBy(capabilities: string[]) {
    return SmartThingsAirConditionerAccessory.requiredCapabilities.every(
      (requiredCapability: string) => capabilities.includes(requiredCapability));
  }

  private handleSupportedDevice(device: Device) {
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === device.deviceId);
    if (existingAccessory) {
      this.handleExistingDevice(device, existingAccessory);
    } else {
      this.handleNewDevice(device);
    }
  }

  private getCapabilities(device: Device) {
    return device.components?.flatMap((component: Component) => component.capabilities)
      .map((capabilityReference: CapabilityReference) => capabilityReference.id) ?? [];
  }

  private handleExistingDevice(device: Device, accesory: PlatformAccessory<UnknownContext>) {
    this.log.info('Restoring existing accessory from cache:', device.label);
    new SmartThingsAirConditionerAccessory(this, accesory);
  }

  private handleNewDevice(device: Device) {
    this.log.info('Adding new accessory:', device.label);
    if (device.label && device.deviceId) {
      const accessory = new this.api.platformAccessory(device.label, device.deviceId);
      accessory.context.device = device;

      new SmartThingsAirConditionerAccessory(this, accessory);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    this.accessories.push(accessory);
  }
}
