import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic, UnknownContext } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { ExamplePlatformAccessory } from './platformAccessory';
import {SmartThingsClient, BearerTokenAuthenticator, Device} from '@smartthings/core-sdk';


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
    this.log.debug('Got new devices', devices);
    for (const device of devices.filter((device: Device) => device.name === '[room a/c] Samsung')) {
      this.log.debug('Got new devices', JSON.stringify(device.components));

      const existingAccessory = this.accessories.find(accessory => accessory.UUID === device.deviceId);
      if (existingAccessory) {
        this.handleExistingDevice(device, existingAccessory);
      } else {
        this.handleNewDevice(device);
      }
    }
  }

  private handleExistingDevice(device: Device, accesory: PlatformAccessory<UnknownContext>) {
    this.log.info('Restoring existing accessory from cache:', device.label);
    new ExamplePlatformAccessory(this, accesory);
  }

  private handleNewDevice(device: Device) {
    this.log.info('Adding new accessory:', device.label);
    if (device.label && device.deviceId) {
      const accessory = new this.api.platformAccessory(device.label, device.deviceId);
      accessory.context.device = device;

      new ExamplePlatformAccessory(this, accessory);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }
}
