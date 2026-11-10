"""Read-only BLE Battery Service probe. Pass a local Bluetooth address as argv[1].

Optional diagnostic dependencies: winrt-Windows.Devices.Bluetooth,
winrt-Windows.Devices.Bluetooth.GenericAttributeProfile,
winrt-Windows.Devices.Enumeration, winrt-Windows.Foundation,
winrt-Windows.Storage.Streams. No addresses are printed or saved.
"""
import asyncio
import json
import sys
from uuid import UUID
from winrt.windows.devices.bluetooth import BluetoothLEDevice, BluetoothCacheMode
from winrt.windows.devices.bluetooth.genericattributeprofile import GattCommunicationStatus
from winrt.windows.storage.streams import DataReader

async def main():
    address = int(sys.argv[1].replace(':', '').replace('-', ''), 16)
    device = await asyncio.wait_for(BluetoothLEDevice.from_bluetooth_address_async(address), 8)
    if device is None:
        print(json.dumps({'readable': False, 'reason': 'device unavailable'})); return
    result = {'name': device.name, 'readable': False, 'connection_status': int(device.connection_status)}
    try:
        services = await asyncio.wait_for(device.get_gatt_services_for_uuid_async(
            UUID('0000180f-0000-1000-8000-00805f9b34fb'), BluetoothCacheMode.UNCACHED), 8)
        result['service_status'] = int(services.status)
        for service in services.services:
            try:
                characteristics = await asyncio.wait_for(service.get_characteristics_for_uuid_async(
                    UUID('00002a19-0000-1000-8000-00805f9b34fb'), BluetoothCacheMode.UNCACHED), 8)
                for characteristic in characteristics.characteristics:
                    read = await asyncio.wait_for(characteristic.read_value_async(BluetoothCacheMode.UNCACHED), 8)
                    if read.status == GattCommunicationStatus.SUCCESS and read.value and read.value.length:
                        reader = DataReader.from_buffer(read.value)
                        value = reader.read_byte()
                        if value <= 100:
                            result.update(readable=True, percentage=value)
            finally:
                service.close()
    finally:
        device.close()
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except Exception as exc:
        print(json.dumps({'readable': False, 'error': type(exc).__name__}))
        sys.exit(1)
