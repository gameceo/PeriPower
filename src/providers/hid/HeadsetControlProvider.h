#pragma once
#include "src/core/IBatteryProvider.h"
#include <QByteArray>
class HeadsetControlProvider : public IBatteryProvider {
public:
    std::wstring displayName() const override { return L"HeadsetControl"; }
    std::vector<BatteryDevice> readDevices() override;
    // Parse only the whitelisted PRO X 2 result; no third-party code linked.
    static std::vector<BatteryDevice> parseOutput(const QByteArray &json);
};
