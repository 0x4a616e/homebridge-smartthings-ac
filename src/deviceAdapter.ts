import { ComponentStatus, Device, DeviceStatus, SmartThingsClient } from '@smartthings/core-sdk';
import { Logger } from 'homebridge';

export class DeviceAdapter {
  constructor(
        private readonly device: Device,
        private readonly log: Logger,
        private readonly client: SmartThingsClient,
  ) {}

  public async getMainComponent(): Promise<ComponentStatus> {
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

    this.log.debug('Get status for device', this.device.deviceId);
    return this.client.devices.getStatus(this.device.deviceId);
  }

  public async executeMainCommand(command: string, capability: string, commandArguments?: (string | number)[]) {
    if (!this.device.deviceId) {
      throw Error('Device ID must be set');
    }

    this.log.debug('Executing command', capability, command);

    const status = await this.client.devices.executeCommand(this.device.deviceId, {
      component: 'main',
      command: command,
      capability: capability,
      arguments: commandArguments,
    });

    this.log.debug('Command executed with status', status.status);
    if (status.status !== 'success') {
      throw Error('Command failed with status ' + status.status);
    }
  }
}