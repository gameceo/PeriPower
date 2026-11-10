"""One-shot battery/charging query for 1532:00BF only; no device settings writes.

Uses the same read-query feature reports as RazerHidProvider. Run with Python 3
from the repository. Output contains no serial numbers or device paths.
"""
import ctypes as C
import json
import time
from pathlib import Path

class Info(C.Structure):
    pass
Info._fields_ = [
    ('path', C.c_char_p), ('vendor_id', C.c_ushort), ('product_id', C.c_ushort),
    ('serial_number', C.c_wchar_p), ('release_number', C.c_ushort),
    ('manufacturer_string', C.c_wchar_p), ('product_string', C.c_wchar_p),
    ('usage_page', C.c_ushort), ('usage', C.c_ushort), ('interface_number', C.c_int),
    ('next', C.POINTER(Info)), ('bus_type', C.c_int),
]

def query(lib, handle, command):
    payload = [0] * 90
    payload[1], payload[5], payload[6], payload[7] = 0x1F, 2, 7, command
    for value in payload[2:88]:
        payload[88] ^= value
    packet = (C.c_ubyte * 91)(0, *payload)
    if lib.hid_send_feature_report(handle, packet, 91) < 0:
        return None
    time.sleep(0.05)
    response = (C.c_ubyte * 91)()
    size = lib.hid_get_feature_report(handle, response, 91)
    data = list(response)[1:91] if size >= 91 else list(response)[:90] if size == 90 else []
    if len(data) != 90 or data[0] != 2 or data[6:8] != [7, command]:
        return None
    return data[9]

def main():
    lib = C.CDLL(str(Path(__file__).resolve().parents[1] / 'external/hidapi/hidapi.dll'))
    lib.hid_enumerate.argtypes = [C.c_ushort, C.c_ushort]
    lib.hid_enumerate.restype = C.POINTER(Info)
    lib.hid_free_enumeration.argtypes = [C.POINTER(Info)]
    lib.hid_open_path.argtypes = [C.c_char_p]
    lib.hid_open_path.restype = C.c_void_p
    lib.hid_close.argtypes = [C.c_void_p]
    for method in ('hid_send_feature_report', 'hid_get_feature_report'):
        getattr(lib, method).argtypes = [C.c_void_p, C.POINTER(C.c_ubyte), C.c_size_t]
        getattr(lib, method).restype = C.c_int
    if lib.hid_init() != 0:
        raise RuntimeError('hid_init failed')
    head = lib.hid_enumerate(0x1532, 0x00BF)
    result = {'device': 'Razer DeathAdder V4 Pro', 'vid': '1532', 'pid': '00BF', 'readable': False}
    try:
        cursor = head
        while cursor:
            info = cursor.contents
            # Vendor-defined and the mouse's control interface only.
            if info.usage_page >= 0xFF00 or info.interface_number == 0:
                handle = lib.hid_open_path(info.path)
                if handle:
                    try:
                        value = query(lib, handle, 0x80)
                        if value is not None:
                            charging = query(lib, handle, 0x84)
                            result.update(readable=True, raw=value, percentage=(value * 100 + 127) // 255,
                                          charging=None if charging is None else charging != 0,
                                          interface=info.interface_number, usage_page=hex(info.usage_page))
                            break
                    finally:
                        lib.hid_close(handle)
            cursor = info.next
    finally:
        lib.hid_free_enumeration(head)
        lib.hid_exit()
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()
