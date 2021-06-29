import { PlatformConfig, Logger } from 'homebridge';
import { IRequestOptions } from 'typed-rest-client/Interfaces';

import * as rm from 'typed-rest-client/RestClient';
import { IRestResponse } from 'typed-rest-client/RestClient';
import { Devices } from './model/Devices';

export class Backend {
    private rest: rm.RestClient

    constructor(
        private readonly config: PlatformConfig,
        private readonly log: Logger
    ) {
        let restOptions: IRequestOptions = {
			headers: {
				"Authorization": "Bearer " + config.token
			}	
		};

        this.log.debug("Headers", restOptions)

        this.rest = new rm.RestClient('smartthings-api', 'https://api.smartthings.com/v1/devices', [], restOptions);
    }

    async getDevices(): Promise<Devices> {
        let res: IRestResponse<Devices> = await this.rest.get<Devices>('/devices')

        this.log.debug("My items", res.result?.items)

        let devices = res.result
        if (devices != null) {
            return devices
        }
        throw new Error("Cannot get devices.")
    }

    async getStatus(deviceId: String) {
        let res: IRestResponse<Devices> = await this.rest.get<Devices>('/devices/' + deviceId + "/status")


    }
}