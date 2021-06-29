import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic, UnknownContext } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { ExamplePlatformAccessory } from './platformAccessory';
import { Backend } from './api/backend';
import { Devices } from './api/model/Devices';
import { Item } from './api/model/Item';


export class ExampleHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Loading devices with token:', this.config.token);

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');

      new Backend(config, log).getDevices()
        .then((devices: Devices) => this.handleDevices(devices))
        .catch(err => log.error('Cannot load devices', err));
    });
  }

  private handleDevices(devices: Devices) {
    this.log.debug("Got devices", devices)
    for (const item of devices.items) {
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === item.deviceId);
      if (existingAccessory) {
        this.handleExistingDevice(item, existingAccessory)
      } else {
        this.handleNewDevice(item)
      }
    }
  }

  private handleExistingDevice(item: Item, accesory: PlatformAccessory<UnknownContext>) {
    this.log.info('Restoring existing accessory from cache:', item.label);
    new ExamplePlatformAccessory(this, accesory);
  }

  private handleNewDevice(item: Item) {
    this.log.info('Adding new accessory:', item.label);

    const accessory = new this.api.platformAccessory(item.label, item.deviceId);
    accessory.context.device = item;

    new ExamplePlatformAccessory(this, accessory);
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
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
